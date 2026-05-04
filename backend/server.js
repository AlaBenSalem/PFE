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

const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const app      = require('./src/app');
const { connectAllMongo } = require('./config/mongodbConnections');
const Admin    = require('./src/models/Admin');
const KCReference = require('./src/models/KCReference');
const KC_DATA     = require('./src/data/kcData');

const { GOOGLE_CLIENT_IDS } = require('./src/services/googleAuthService');

const PORT           = Number.parseInt(process.env.PORT, 10) || 5000;
const ADMIN_EMAIL    = String(process.env.ADMIN_EMAIL    || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();
const ADMIN_NAME     = String(process.env.ADMIN_NAME     || 'Administrateur').trim();

async function ensureKCData() {
  try {
    const count = await KCReference.countDocuments();
    if (count === 0) {
      await KCReference.insertMany(KC_DATA);
      console.log(`✅ KCReference auto-initialisée: ${KC_DATA.length} cultures FAO-56 chargées`);
    }
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

async function startServer() {
  try {
    console.log('Starting SmartIrrig Backend...');
    await connectAllMongo();
    await ensureAdminAccount();
    await ensureKCData();
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
