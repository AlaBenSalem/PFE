// src/routes/userRoutes.js
const express                        = require('express');
const router                         = express.Router();
const User                           = require('../models/User');
const Culture                        = require('../models/Culture');
const { requireAuth, requireAdmin }  = require('../middleware/auth');

// GET /api/users — admin only
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password -resetCode -resetCodeExpiry').sort({ createdAt: -1 });
    const withCount = await Promise.all(users.map(async (u) => {
      const culturesCount = await Culture.countDocuments({ userId: u._id });
      return { id: u._id, firstName: u.firstName, lastName: u.lastName, address: u.address, email: u.email, isActive: u.isActive, createdAt: u.createdAt, culturesCount };
    }));
    res.json({ success: true, data: withCount });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/users/:id — self or admin
router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (req.userRole !== 'admin' && req.userId !== req.params.id)
      return res.status(403).json({ success: false, error: 'Accès refusé.' });
    const user = await User.findById(req.params.id).select('-password -resetCode -resetCodeExpiry');
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    const cultures = await Culture.find({ userId: req.params.id });
    res.json({ success: true, data: { id: user._id, firstName: user.firstName, lastName: user.lastName, address: user.address, email: user.email, isActive: user.isActive, createdAt: user.createdAt, cultures } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/users/:id — self or admin
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (req.userRole !== 'admin' && req.userId !== req.params.id)
      return res.status(403).json({ success: false, error: 'Accès refusé.' });
    const { password, resetCode, resetCodeExpiry, ...safeFields } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, safeFields, { new: true, runValidators: true })
      .select('-password -resetCode -resetCodeExpiry');
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    res.json({ success: true, data: user });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/users/:id — admin only
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
