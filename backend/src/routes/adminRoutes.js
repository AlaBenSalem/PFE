// src/routes/adminRoutes.js
const express    = require('express');
const router     = express.Router();
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const rateLimit  = require('express-rate-limit');
const Admin      = require('../models/Admin');
const Culture    = require('../models/Culture');
const Irrigation = require('../models/Irrigation');
const Fertilisation = require('../models/Fertilisation');
const Weather    = require('../models/Weather');
const Message    = require('../models/Message');
const KC_DATA    = require('../data/kcData');
const { requireAdmin } = require('../middleware/auth');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

// POST /api/admin/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis.' });
    const admin = await Admin.findOne({ email: String(email).trim().toLowerCase() });
    if (!admin || !(await bcrypt.compare(password, admin.password)))
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    admin.lastLoginAt = new Date();
    await admin.save();
    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Connexion admin réussie.', token, role: 'admin',
      admin: { id: admin._id, fullName: admin.fullName, email: admin.email } });
  } catch (err) {
    res.status(500).json({ message: 'Erreur connexion admin.' });
  }
});

// PATCH /api/admin/profile
router.patch('/profile', requireAdmin, async (req, res) => {
  try {
    const { fullName } = req.body;
    if (!fullName?.trim()) return res.status(400).json({ message: 'Nom requis.' });
    const admin = await Admin.findByIdAndUpdate(req.userId, { fullName: fullName.trim() }, { new: true });
    if (!admin) return res.status(404).json({ message: 'Admin non trouvé.' });
    res.json({ success: true, admin: { id: admin._id, fullName: admin.fullName, email: admin.email } });
  } catch {
    res.status(500).json({ message: 'Erreur mise à jour.' });
  }
});

// ✅ FIX : requireAdmin ajouté sur /stats (était public avant)
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const User = mongoose.models.User;

    const totalCultures   = await Culture.countDocuments({});
    const allUserIds      = User ? await User.distinct('_id') : [];
    const culturesByUsers = await Culture.countDocuments({ userId: { $in: allUserIds } });
    // Répartition par utilisateur
    const culturesByUserBreakdown = await Culture.aggregate([
      { $match: { userId: { $in: allUserIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    // Catalogue KC : données statiques FAO-56 (kcData.js)
    const kcCatalogCount = Array.isArray(KC_DATA) ? KC_DATA.length : 0;

    // Cultures ajoutées manuellement par l'admin (KCReference avec fao != true)
    let adminAddedCount = 0;
    try {
      const KCReference = require('../models/KCReference');
      adminAddedCount = await KCReference.countDocuments({ 'references.fao': { $ne: true } });
    } catch (_e) { /* KCReference non disponible, on garde 0 */ }

    const totalIrrigations = await Irrigation.countDocuments();
    const todayCount       = await Irrigation.countDocuments({
      date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    const lastWeather = await Weather.findOne().sort({ date: -1 });
    const totalUsers  = User ? await User.countDocuments() : 0;

    const volResult = await Irrigation.aggregate([
      { $group: { _id: null, total: { $sum: '$volume' }, avgEtc: { $avg: '$etc' } } }
    ]);
    const surfaceResult = await Culture.aggregate([
      { $group: { _id: null, totalSurface: { $sum: '$surface' } } }
    ]);
    const durationResult = await Irrigation.aggregate([
      { $group: { _id: null, totalDuration: { $sum: '$duree' } } }
    ]);
    const modeResult = await Irrigation.aggregate([
      { $group: { _id: '$mode', count: { $sum: 1 }, volume: { $sum: '$volume' } } }
    ]);
    const activeUsers = User ? await User.countDocuments({ isActive: true }) : 0;

    res.json({
      success: true,
      data: {
        totalCultures,
        culturesByUsers,
        culturesByAdmin:  adminAddedCount,
        culturesByUserBreakdown,
        kcDataCount:      kcCatalogCount,
        totalCulturesAll: kcCatalogCount + adminAddedCount,
        totalIrrigations,
        totalUsers,
        activeUsers,
        todayIrrigations: todayCount,
        totalVolume:   volResult[0]?.total || 0,
        avgEtc:        volResult[0]?.avgEtc || 0,
        totalSurface:  surfaceResult[0]?.totalSurface || 0,
        totalDuration: durationResult[0]?.totalDuration || 0,
        et0Today:      lastWeather?.et0 || null,
        tempToday:     lastWeather?.temperature?.current || null,
        byMode:        modeResult,
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ FIX : requireAdmin ajouté sur volume-by-day (était public avant)
router.get('/irrigations/volume-by-day', requireAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const days = parseInt(req.query.days) || 30;
    const from = new Date();
    from.setDate(from.getDate() - days);
    const match = { date: { $gte: from } };
    if (req.query.userId) {
      try {
        const uid = new mongoose.Types.ObjectId(req.query.userId);
        const cultureIds = await Culture.find({ userId: uid }).distinct('_id');
        match.cultureId = { $in: cultureIds };
      } catch {}
    }
    const result = await Irrigation.aggregate([
      { $match: match },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          volume: { $sum: '$volume' },
          count:  { $sum: 1 },
          avgEtc: { $avg: '$etc' }
      }},
      { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Volume by day error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/users/:id/stats — irrigation count + total volume for a user
router.get('/users/:id/stats', requireAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    let userId;
    try { userId = new mongoose.Types.ObjectId(req.params.id); } catch {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    const cultureIds = await Culture.find({ userId }).distinct('_id');
    const cultureFilter = { cultureId: { $in: cultureIds } };
    const irrigationCount = await Irrigation.countDocuments(cultureFilter);
    const volResult = await Irrigation.aggregate([
      { $match: cultureFilter },
      { $group: { _id: null, total: { $sum: '$volume' } } }
    ]);
    res.json({
      success: true,
      data: {
        irrigationCount,
        totalVolume: volResult[0]?.total || 0,
      }
    });
  } catch (e) {
    console.error('User stats error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/admin/users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const User = mongoose.models.User;
    if (!User) return res.status(500).json({ success: false, error: 'User model not found' });

    const users = await User.find().select('-password -resetCode -resetCodeExpiry').sort({ createdAt: -1 });

    const withCount = await Promise.all(users.map(async (u) => {
      const culturesCount = await Culture.countDocuments({ userId: u._id });
      return {
        id: u._id, _id: u._id,
        firstName: u.firstName, lastName: u.lastName,
        address: u.address, email: u.email,
        isActive: u.isActive, createdAt: u.createdAt,
        culturesCount,
      };
    }));

    res.json({ success: true, users: withCount });
  } catch (e) {
    console.error('Get users error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/admin/users
router.post('/users', requireAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const User = mongoose.models.User;
    if (!User) return res.status(500).json({ success: false, error: 'User model not found' });

    const { firstName, lastName, address, email, password, isActive } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Champs requis manquants.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Mot de passe min 8 caractères.' });
    }
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: 'Email déjà utilisé.' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      firstName: firstName.trim(), lastName: lastName.trim(),
      address: (address || '').trim() || 'Non renseigné',
      email: email.toLowerCase().trim(),
      password: hashed,
      isActive: isActive !== false,
    });

    res.status(201).json({
      success: true,
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, address: user.address, isActive: user.isActive, createdAt: user.createdAt }
    });
  } catch (e) {
    console.error('Create user error:', e);
    res.status(500).json({ message: e.message.includes('duplicate') ? 'Email déjà utilisé.' : 'Erreur création.' });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const User = mongoose.models.User;
    if (!User) return res.status(500).json({ success: false, error: 'User model not found' });

    const { firstName, lastName, address, isActive, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    if (firstName) user.firstName = firstName.trim();
    if (lastName)  user.lastName  = lastName.trim();
    if (address)   user.address   = address.trim();
    if (typeof isActive === 'boolean') user.isActive = isActive;

    if (password) {
      if (password.length < 8) return res.status(400).json({ message: 'Mot de passe min 8 caractères.' });
      user.password = await bcrypt.hash(password, 12);
    }

    await user.save();
    res.json({
      success: true,
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, address: user.address, isActive: user.isActive, createdAt: user.createdAt }
    });
  } catch (e) {
    console.error('Update user error:', e);
    res.status(500).json({ message: 'Erreur modification.' });
  }
});

// PATCH /api/admin/users/:id/status
router.patch('/users/:id/status', requireAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const User = mongoose.models.User;
    if (!User) return res.status(500).json({ success: false, error: 'User model not found' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, isActive: user.isActive });
  } catch (e) {
    console.error('Toggle status error:', e);
    res.status(500).json({ message: 'Erreur toggle statut.' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const User = mongoose.models.User;
    if (!User) return res.status(500).json({ success: false, error: 'User model not found' });

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouve.' });

    const cultures = await Culture.find({ userId: req.params.id }).select('_id');
    const cultureIds = cultures.map(c => c._id);

    await Irrigation.deleteMany({ userId: req.params.id });
    if (cultureIds.length > 0) {
      await Fertilisation.deleteMany({ cultureId: { $in: cultureIds } });
    }
    await Culture.deleteMany({ userId: req.params.id });

    res.json({ success: true, message: 'Utilisateur supprime.' });
  } catch (e) {
    console.error('Delete user error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/admin/messages/unread-count
router.get('/messages/unread-count', requireAdmin, async (req, res) => {
  try {
    const count = await Message.countDocuments({ readAt: null });
    res.json({ success: true, count });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/admin/messages
router.get('/messages', requireAdmin, async (req, res) => {
  try {
    const limit     = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const skip      = Math.max(parseInt(req.query.skip, 10) || 0, 0);
    const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true';
    const query     = unreadOnly ? { readAt: null } : {};
    const items     = await Message.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    res.json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PATCH /api/admin/messages/:id/read
router.patch('/messages/:id/read', requireAdmin, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message non trouve.' });
    if (!message.readAt) { message.readAt = new Date(); await message.save(); }
    res.json({ success: true, data: { id: message._id, readAt: message.readAt } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/admin/messages/:id/reply
router.post('/messages/:id/reply', requireAdmin, async (req, res) => {
  try {
    const replyText = String(req.body?.replyBody ?? '').trim();
    if (!replyText) return res.status(400).json({ success: false, message: 'Reponse vide.' });

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message non trouve.' });

    const toEmail = message.senderEmail;
    if (!toEmail) return res.status(400).json({ success: false, message: 'Adresse email introuvable.' });

    // Send reply email
    const nodemailer = require('nodemailer');
    const { Resend }  = require('resend');

    const subjectLine = message.subject?.trim()
      ? `Re: ${message.subject.trim()}`
      : 'Reponse de SmartIrrig Admin';

    const html = `
      <div style="font-family:Arial,sans-serif;background:#f4f6f8;padding:24px;">
        <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;padding:24px;border:1px solid #e5e7eb;">
          <h2 style="margin:0;color:#16a34a;">SmartIrrig — Reponse de l'administrateur</h2>
          <p style="color:#64748b;margin-top:8px;">Cher(e) <strong>${message.senderName || toEmail}</strong>,</p>
          <div style="margin-top:14px;padding:14px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;white-space:pre-wrap;color:#0f172a;">${String(replyText).replace(/</g,'&lt;')}</div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">
            En reponse a votre message du ${new Date(message.createdAt).toLocaleDateString('fr-FR')}<br>
            Objet: ${message.subject || '(sans objet)'}
          </p>
        </div>
      </div>`;

    let emailSent = false;

    if (process.env.RESEND_API_KEY) {
      const resend   = new Resend(process.env.RESEND_API_KEY);
      const emailFrom = process.env.EMAIL_FROM || 'SmartIrrig <onboarding@resend.dev>';
      const { error } = await resend.emails.send({ from: emailFrom, to: toEmail, subject: subjectLine, html });
      if (!error) emailSent = true;
    }

    if (!emailSent && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      await transporter.sendMail({ from: process.env.EMAIL_USER, to: toEmail, subject: subjectLine, html });
      emailSent = true;
    }

    // Persist reply regardless of email success
    message.repliedAt = new Date();
    message.replyBody = replyText;
    if (!message.readAt) message.readAt = message.repliedAt;
    await message.save();

    res.json({
      success: true,
      emailSent,
      data: { id: message._id, repliedAt: message.repliedAt },
    });
  } catch (e) {
    console.error('[AdminReply]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
