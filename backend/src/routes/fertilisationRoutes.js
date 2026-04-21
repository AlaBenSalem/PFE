// backend/src/routes/fertilisationRoutes.js
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const ctrl    = require('../controllers/fertilisationController');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token manquant.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.id) return res.status(403).json({ success: false, message: 'Accès refusé.' });
    req.userId   = decoded.id;
    req.userRole = decoded.role;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalide.' });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET  /api/fertilisations              → historique complet
router.get('/',             requireUser, ctrl.getFertilisations);

// GET  /api/fertilisations/prochaines   → prochaines dates par culture
router.get('/prochaines',  requireUser, ctrl.getProchaines);

// GET  /api/fertilisations/:id          → détail d'une fertilisation
router.get('/:id',         requireUser, ctrl.getFertilisationById);

// POST /api/fertilisations              → créer une fertilisation
router.post('/',           requireUser, ctrl.createFertilisation);

// PUT  /api/fertilisations/:id          → modifier
router.put('/:id',         requireUser, ctrl.updateFertilisation);

// DELETE /api/fertilisations/:id        → supprimer
router.delete('/:id',      requireUser, ctrl.deleteFertilisation);

module.exports = router;