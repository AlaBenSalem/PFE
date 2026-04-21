const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const cultureController = require('../controllers/cultureController');

// ── Middleware optionnel : extrait userId et role depuis Bearer token ──────────
function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'default-secret-change-in-production'
      );
      if (decoded?.id)   req.userId   = decoded.id;
      if (decoded?.role) req.userRole = decoded.role;
    }
  } catch {}
  next();
}

router.get('/',       optionalAuth, cultureController.getAllCultures);
router.get('/:id',    optionalAuth, cultureController.getCultureById);
router.post('/',      optionalAuth, cultureController.createCulture);
router.delete('/:id', optionalAuth, cultureController.deleteCulture);

module.exports = router;