// src/routes/userRoutes.js — CORRIGÉ
// Fix : ajout d'un middleware requireAuth sur toutes les routes sensibles
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const Culture = require('../models/Culture');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

// ✅ Middleware : token JWT requis (user OU admin)
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

// ✅ Middleware : admin seulement
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès admin requis.' });
    }
    next();
  });
}

// GET /api/users — liste tous les users (admin seulement)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -resetCode -resetCodeExpiry')
      .sort({ createdAt: -1 });

    const withCount = await Promise.all(users.map(async (u) => {
      const culturesCount = await Culture.countDocuments({ userId: u._id });
      return {
        id: u._id, firstName: u.firstName, lastName: u.lastName,
        address: u.address, email: u.email, isActive: u.isActive,
        createdAt: u.createdAt, culturesCount,
      };
    }));

    res.json({ success: true, data: withCount });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/users/:id — un user avec ses cultures (user lui-même OU admin)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    // Un user ne peut voir que son propre profil
    if (req.userRole !== 'admin' && req.userId !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Accès refusé.' });
    }

    const user = await User.findById(req.params.id).select('-password -resetCode -resetCodeExpiry');
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });

    const cultures = await Culture.find({ userId: req.params.id });
    res.json({
      success: true,
      data: {
        id: user._id, firstName: user.firstName, lastName: user.lastName,
        address: user.address, email: user.email, isActive: user.isActive,
        createdAt: user.createdAt, cultures,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/users/:id — modifier (user lui-même OU admin)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    // Un user ne peut modifier que son propre profil
    if (req.userRole !== 'admin' && req.userId !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Accès refusé.' });
    }

    const { password, resetCode, resetCodeExpiry, ...safeFields } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, safeFields, {
      new: true, runValidators: true,
    }).select('-password -resetCode -resetCodeExpiry');

    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    res.json({ success: true, data: user });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/users/:id — admin seulement
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    res.json({ success: true, message: 'Utilisateur supprimé' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
