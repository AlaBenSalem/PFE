// controllers/cultureController.js
const Culture = require('../models/Culture');
const { getKcForCultureAndMonth } = require('./kcController');

// NOTE: Kc lookup is kept for getCultureById and createCulture only.
// getAllCultures no longer saves Kc back to DB — GET endpoints must be idempotent.

// ─── GET toutes les cultures ──────────────────────────────────────────────────
exports.getAllCultures = async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin';
    let filter = {};

    if (!isAdmin) {
      if (req.userId) {
        filter = { $or: [{ userId: req.userId }, { userId: null }] };
      } else {
        filter = { userId: null };
      }
    }

    const cultures = await Culture.find(filter).sort({ createdAt: -1 });
    const currentMonth = new Date().getMonth() + 1;

    const updated = cultures.map((culture) => {
      // Return a plain object with kc applied in memory — no DB write on a GET
      const obj = culture.toObject();
      return obj;
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('❌ Erreur GET /cultures:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET culture par ID ───────────────────────────────────────────────────────
exports.getCultureById = async (req, res) => {
  try {
    const culture = await Culture.findById(req.params.id);
    if (!culture) {
      return res.status(404).json({ success: false, error: 'Culture non trouvée' });
    }
    const currentMonth = new Date().getMonth() + 1;
    const { kc, stade } = await getKcForCultureAndMonth(culture.nom, currentMonth);
    const data = culture.toObject();
    data.kcActuel    = kc;
    data.stadeActuel = stade;
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erreur GET /cultures/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST nouvelle culture ────────────────────────────────────────────────────
exports.createCulture = async (req, res) => {
  try {
    console.log('📦 Données reçues:', req.body);

    const {
      parcelle, nom, variete, datePlantation,
      surface, nombreArbres,
      typeSol = 'limoneux',
      region,
      profondeurRacinaire,
      irrigation,
      debitGoutteur,
      nbGoutteursParArbre,
      densitePlantation,
      thetaCc,
      thetaPf,
      sableFraction,
      argileFraction,
      matOrganique,
      thetaSource,
    } = req.body;

    const currentMonth = new Date().getMonth() + 1;
    const { kc, stade, source, found, type: cultureType } = await getKcForCultureAndMonth(nom, currentMonth);

    console.log(`🌿 Kc pour "${nom}" (mois ${currentMonth}): ${kc} — stade: ${stade}`);

    let densite;
    const parsedNombreArbres = nombreArbres ? parseInt(nombreArbres) : null;
    const parsedSurface = surface ? parseFloat(surface) : null;
    if (parsedNombreArbres && parsedSurface) {
      densite = Math.round((parsedNombreArbres / parsedSurface) * 10000);
    }

    const culture = new Culture({
      userId:             req.userRole === 'admin' ? null : (req.userId || null),
      parcelle:           parcelle || null,
      region:             region?.trim() || null,
      nom,
      variete,
      datePlantation:     datePlantation ? new Date(datePlantation) : null,
      surface:            parsedSurface,
      nombreArbres:       parsedNombreArbres,
      densite,
      kcActuel:           kc,
      stadeActuel:        stade,
      type:               cultureType || undefined,
      typeSol,
      profondeurRacinaire: profondeurRacinaire ? parseFloat(profondeurRacinaire) : null,
      // Système d'irrigation
      irrigation: irrigation ? {
        type:      irrigation.type      || 'goutte-a-goutte',
        debit:     irrigation.debit     ? parseFloat(irrigation.debit)     : null,
        efficacite:irrigation.efficacite? parseFloat(irrigation.efficacite): 0.9,
      } : undefined,
      debitGoutteur:       debitGoutteur       != null ? parseFloat(debitGoutteur)       : null,
      nbGoutteursParArbre: nbGoutteursParArbre != null ? parseInt(nbGoutteursParArbre)   : null,
      densitePlantation:   densitePlantation   != null ? parseFloat(densitePlantation)   : null,
      // Paramètres hydriques sol (FAO-56 §3.1)
      thetaCc: thetaCc != null ? parseFloat(thetaCc) : null,
      thetaPf: thetaPf != null ? parseFloat(thetaPf) : null,
      // Texture Saxton & Rawls
      sableFraction:  sableFraction  != null ? parseFloat(sableFraction)  : null,
      argileFraction: argileFraction != null ? parseFloat(argileFraction) : null,
      matOrganique:   matOrganique   != null ? parseFloat(matOrganique)   : null,
      thetaSource:    thetaSource    || null,
    });

    await culture.save();
    console.log('✅ Culture créée ID:', culture._id, '| Kc:', kc, '| Région:', region || 'non définie');

    res.status(201).json({
      success: true,
      data: culture,
      kcInfo: { kc, stade, source, found },
    });
  } catch (error) {
    console.error('❌ Erreur POST /cultures:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── DELETE culture ───────────────────────────────────────────────────────────
exports.deleteCulture = async (req, res) => {
  try {
    console.log('🗑️ Suppression ID:', req.params.id);
    if (!req.params.id || req.params.id.length < 10) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    const isAdmin = req.userRole === 'admin';
    let culture;
    if (isAdmin) {
      culture = await Culture.findByIdAndDelete(req.params.id);
    } else {
      culture = await Culture.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    }
    if (!culture) {
      return res.status(404).json({ success: false, error: 'Culture non trouvée ou non autorisée' });
    }
    console.log('✅ Culture supprimée:', culture.nom);
    res.json({ success: true, message: 'Culture supprimée', data: culture });
  } catch (error) {
    console.error('❌ Erreur DELETE:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};