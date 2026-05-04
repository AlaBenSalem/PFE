// server.js — entry point
const dotenv = require('dotenv');
const fs     = require('fs');
const path   = require('path');

function loadEnvFile(filePath) {
  try { if (fs.existsSync(filePath)) dotenv.config({ path: filePath }); } catch {}
}
loadEnvFile(path.resolve(__dirname, '..', '.env'));
loadEnvFile(path.resolve(__dirname, '.env'));

// Fail fast on missing secrets
if (!process.env.JWT_SECRET) { console.error('FATAL: JWT_SECRET is required'); process.exit(1); }
if (!process.env.GROQ_API_KEY) { console.error('FATAL: GROQ_API_KEY is required'); process.exit(1); }

const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const cron        = require('node-cron');
const app         = require('./src/app');
const { connectAllMongo } = require('./config/mongodbConnections');
const Admin       = require('./src/models/Admin');
const KCReference = require('./src/models/KCReference');
const KC_DATA     = require('./src/data/kcData');
const Culture     = require('./src/models/Culture');
const Irrigation  = require('./src/models/Irrigation');
const Weather     = require('./src/models/Weather');

const { GOOGLE_CLIENT_IDS } = require('./src/services/googleAuthService');

const PORT           = Number.parseInt(process.env.PORT, 10) || 5000;
const ADMIN_EMAIL    = String(process.env.ADMIN_EMAIL    || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();
const ADMIN_NAME     = String(process.env.ADMIN_NAME     || 'Administrateur').trim();

async function ensureKCData() {
  try {
    const ops = KC_DATA.map(item => ({
      updateOne: {
        filter: { culture: item.culture },
        update: { $set: item },
        upsert: true,
      },
    }));
    const result = await KCReference.bulkWrite(ops);
    const changed = result.upsertedCount + result.modifiedCount;
    if (changed > 0)
      console.log(`✅ KCReference sync: ${result.upsertedCount} ajoutée(s), ${result.modifiedCount} mise(s) à jour`);
    else
      console.log(`✅ KCReference: ${KC_DATA.length} cultures FAO-56 déjà à jour`);
  } catch (err) {
    console.warn(`⚠️  ensureKCData: ${err.message}`);
  }
}

async function ensureAdminAccount() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.warn('ADMIN_EMAIL / ADMIN_PASSWORD non définis.'); return; }
  if (ADMIN_PASSWORD.length < 8) { console.warn('ADMIN_PASSWORD doit contenir au moins 8 caractères.'); return; }
  if (await Admin.findOne({ email: ADMIN_EMAIL })) return;
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await Admin.create({ fullName: ADMIN_NAME, email: ADMIN_EMAIL, password: hashedPassword });
  console.log(`Admin créé: ${ADMIN_EMAIL}`);
}

// ── FAO-56 water balance helpers ─────────────────────────────────────────────
const THETA_STD_CRON = {
  sableux:         { cc: 0.12, pf: 0.05 },
  limono_sableux:  { cc: 0.23, pf: 0.10 },
  limoneux:        { cc: 0.31, pf: 0.15 },
  argilo_limoneux: { cc: 0.38, pf: 0.22 },
  argileux:        { cc: 0.42, pf: 0.26 },
};
const Z_DEFAUT_CRON = { agrume: 0.9, fruit: 1.0, legume: 0.5, cereale: 1.0 };

function computeWcc(culture) {
  const typeSol    = culture.typeSol || 'limoneux';
  const typeCult   = culture.type    || 'legume';
  const std        = THETA_STD_CRON[typeSol] || THETA_STD_CRON.limoneux;
  const thetaCcEff = culture.thetaCc != null ? culture.thetaCc : std.cc;
  const thetaPfEff = culture.thetaPf != null ? culture.thetaPf : std.pf;
  const z          = culture.profondeurRacinaire != null
    ? culture.profondeurRacinaire
    : (Z_DEFAUT_CRON[typeCult] || 0.6);
  return {
    W_cc:  thetaCcEff * z * 1000,
    W_pf:  thetaPfEff * z * 1000,
    ru:    (thetaCcEff - thetaPfEff) * z * 1000,
  };
}

// Sync water balance for all cultures:
// - initializes null stocks from last irrigation
// - applies any missed daily ETc deductions (handles server downtime)
async function syncWaterBalance() {
  try {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const weather  = await Weather.findOne({ date: { $gte: today, $lt: tomorrow } }).sort({ date: -1 });
    const et0      = weather?.et0 || 4.48;
    const rainRaw  = parseFloat(weather?.precipitation?.rain) || 0;

    const cultures = await Culture.find({});
    let updated = 0;

    for (const culture of cultures) {
      try {
        const { W_cc, W_pf, ru } = computeWcc(culture);
        const kc  = culture.kcActuel || 0.65;
        const etc = et0 * kc;

        let peff = 0;
        if (rainRaw > 5)   peff = 0.8 * rainRaw - 2;
        if (rainRaw >= 25) peff = 0.6 * rainRaw + 0.5;
        peff = Math.min(peff, ru);

        if (culture.stockEauMm == null) {
          // First time: initialize from last irrigation date
          const p         = culture.p != null ? parseFloat(culture.p) : 0.5;
          const rfu       = p * ru;
          const lastIrrig = await Irrigation.findOne({ cultureId: culture._id }).sort({ date: -1 });
          const refDate   = lastIrrig
            ? new Date(lastIrrig.date)
            : culture.datePlantation ? new Date(culture.datePlantation) : new Date(Date.now() - 86400000);
          const refMidnight = new Date(refDate); refMidnight.setHours(0, 0, 0, 0);
          const days        = Math.max(0, Math.round((today - refMidnight) / 86400000));
          const roughFreq   = etc > 0 ? Math.max(1, Math.round(rfu / etc)) : 14;
          const joursSince  = lastIrrig ? days : Math.min(days, roughFreq);
          culture.stockEauMm = parseFloat(Math.max(W_pf, Math.min(W_cc, W_cc - etc * joursSince + peff)).toFixed(1));
        } else {
          // Apply missed days since last update
          const lastUpd    = new Date(culture.stockEauUpdatedAt || today);
          lastUpd.setHours(0, 0, 0, 0);
          const daysMissed = Math.round((today - lastUpd) / 86400000);
          if (daysMissed <= 0) continue; // already up-to-date today
          const newStock = Math.max(W_pf, Math.min(W_cc, culture.stockEauMm - etc * daysMissed + peff));
          culture.stockEauMm = parseFloat(newStock.toFixed(1));
        }

        culture.stockEauUpdatedAt = today;
        await culture.save();
        updated++;
      } catch (err) {
        console.error(`⚠️  syncWaterBalance culture ${culture._id}:`, err.message);
      }
    }
    if (updated > 0) console.log(`✅ Bilan hydrique sync: ${updated} culture(s) mise(s) à jour`);
  } catch (err) {
    console.error('❌ syncWaterBalance:', err.message);
  }
}

async function startServer() {
  try {
    console.log('Starting SmartIrrig Backend...');
    await connectAllMongo();
    await ensureAdminAccount();
    await ensureKCData();
    await syncWaterBalance();

    // Cron: every day at midnight — update soil water balance
    cron.schedule('0 0 * * *', () => {
      console.log('🌿 Cron bilan hydrique quotidien...');
      syncWaterBalance();
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      if (!process.env.RESEND_API_KEY) console.warn('⚠️  RESEND_API_KEY non configuré — les emails ne seront pas envoyés');
      else console.log('✅ Resend email service configuré');
      if (GOOGLE_CLIENT_IDS.length === 0) console.warn('⚠️  GOOGLE_CLIENT_ID non configuré — Google Auth désactivé');
      else console.log(`✅ Google Auth configuré (${GOOGLE_CLIENT_IDS.length} client ID(s))`);
    });
  } catch (error) {
    console.error('Failed to start:', error.message);
    process.exit(1);
  }
}

startServer();
