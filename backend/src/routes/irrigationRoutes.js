// src/routes/irrigationRoutes.js — CORRIGÉ
// Fix : ajout optionalAuth sur toutes les routes pour isoler les données par user
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const irrigationController = require('../controllers/irrigationController');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

// Middleware optionnel : extrait userId et role sans bloquer si absent
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

// Middleware requis pour les mutations
function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Token manquant.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ success: false, error: 'Token invalide.' });
    req.userId   = decoded.id;
    req.userRole = decoded.role;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token invalide ou expiré.' });
  }
}

router.get('/',                              optionalAuth, irrigationController.getAllIrrigations);
router.get('/today',                         optionalAuth, irrigationController.getTodayIrrigations);
router.get('/calculate-needs/:cultureId',    optionalAuth, irrigationController.calculateIrrigationNeeds);
router.get('/culture/:cultureId',            optionalAuth, irrigationController.getIrrigationsByCulture);
router.get('/etc-history/:cultureId',        optionalAuth, irrigationController.getETcHistory);
router.get('/:id',                           optionalAuth, irrigationController.getIrrigationById);
router.post('/',                             requireAuth,  irrigationController.createIrrigation);
router.put('/:id',                           requireAuth,  irrigationController.updateIrrigation);
router.delete('/:id',                        requireAuth,  irrigationController.deleteIrrigation);

module.exports = router;
