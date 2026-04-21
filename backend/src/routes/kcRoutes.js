// src/routes/kcRoutes.js
// Routes pour la gestion de la base KCReference (cultures FAO-56 + admin)
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const kcController = require('../controllers/kcController');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

// ─── Middleware optionnel — extrait userId et role ────────────────────────────
function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.id)   req.userId   = decoded.id;
      if (decoded?.role) req.userRole = decoded.role;
    }
  } catch {}
  next();
}

// ─── Middleware admin requis ──────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token manquant.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Accès admin requis.' });
    }
    req.admin = decoded;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalide.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT : les routes spécifiques DOIVENT être déclarées AVANT /:id
// sinon Express interprète "current", "search", "mensuel" comme des IDs Mongo.
// ─────────────────────────────────────────────────────────────────────────────

// ─── GET /api/kc/current?culture=Orange&mois=4 ───────────────────────────────
// ✅ Retourne le Kc saisonnier FAO-56 du mois courant pour une culture donnée
router.get('/current', optionalAuth, kcController.getKCCurrent);

// ─── GET /api/kc/search?culture=Tomate&mois=5 ────────────────────────────────
router.get('/search', optionalAuth, kcController.getKCByCulture);

// ─── GET /api/kc/mensuel/:culture ────────────────────────────────────────────
router.get('/mensuel/:culture', optionalAuth, kcController.getKCMensuel);

// ─── GET /api/kc — liste toutes les cultures de la base Kc ───────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const KCReference = require('../models/KCReference');
    const cultures = await KCReference.find().sort({ culture: 1 });
    res.json({ success: true, data: cultures });
  } catch (err) {
    console.error('❌ GET /kc error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/kc/:id — détail d'une culture ──────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const KCReference = require('../models/KCReference');
    const culture = await KCReference.findById(req.params.id);
    if (!culture) {
      return res.status(404).json({ success: false, error: 'Culture non trouvée' });
    }
    res.json({ success: true, data: culture });
  } catch (err) {
    console.error('❌ GET /kc/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/kc/init — (re)charge toutes les données FAO-56 (admin) ─────────
router.post('/init', requireAdmin, kcController.initializeKCData);

// ─── POST /api/kc/add — ajoute une culture via kcController (admin) ───────────
router.post('/add', requireAdmin, kcController.addKCEntry);

// ─── POST /api/kc — ajoute une culture directement (admin) ───────────────────
router.post('/', requireAdmin, async (req, res) => {
  try {
    const KCReference = require('../models/KCReference');
    const { culture, aliases, variete, type, stades, kcMoyen, references } = req.body;

    if (!culture || !culture.trim()) {
      return res.status(400).json({ success: false, error: 'Le nom de la culture est requis' });
    }

    const existing = await KCReference.findOne({
      culture: { $regex: new RegExp(`^${culture.trim()}$`, 'i') }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `La culture "${culture}" existe déjà dans la base Kc`,
        existing,
      });
    }

    let computedKcMoyen = kcMoyen;
    if (!computedKcMoyen && Array.isArray(stades) && stades.length > 0) {
      computedKcMoyen = parseFloat(
        (stades.reduce((sum, s) => sum + (s.kc || 0), 0) / stades.length).toFixed(3)
      );
    }

    const newKC = await KCReference.create({
      culture: culture.trim(),
      aliases: aliases || [culture.toLowerCase().trim()],
      variete: variete || 'Standard',
      type: type || 'legume',
      stades: stades || [],
      kcMoyen: computedKcMoyen,
      references: references || { fao: false, source: "Ajouté par l'administrateur" },
    });

    console.log('✅ KCReference créée:', newKC.culture);
    res.status(201).json({ success: true, data: newKC });
  } catch (err) {
    console.error('❌ POST /kc error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/kc/:id — supprimer une culture de la base Kc (admin) ─────────
router.delete('/:id', requireAdmin, kcController.deleteKCEntry);

module.exports = router;