// src/routes/authRoutes.js
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const axios    = require('axios');
const User     = require('../models/User');
const Admin    = require('../models/Admin');
const { sendResetCodeEmail }  = require('../services/emailService');
const { verifyGoogleIdToken, GOOGLE_CLIENT_IDS } = require('../services/googleAuthService');
const { requireAuth } = require('../middleware/auth');
const {
  validate,
  registerValidators,
  loginValidators,
  forgotPasswordValidators,
  resetPasswordValidators,
} = require('../middleware/validate');

const JWT_SECRET = process.env.JWT_SECRET;

function normalizeEmail(v) { return String(v || '').trim().toLowerCase(); }

// POST /api/auth/register
router.post('/register', registerValidators, validate, async (req, res) => {
  try {
    const { firstName, lastName, address, email, password } = req.body;
    if (!firstName || !lastName || !address || !email || !password)
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    if (password.length < 8)
      return res.status(400).json({ message: 'Mot de passe min 8 caractères.' });
    if (await User.findOne({ email: normalizeEmail(email) }))
      return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      firstName: firstName.trim(), lastName: lastName.trim(),
      address: address.trim(), email: normalizeEmail(email), password: hashed,
    });
    const token = jwt.sign({ id: user._id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      message: 'Compte créé.', token, role: 'user',
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email },
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: "Erreur lors de l'inscription." });
  }
});

// POST /api/auth/login
router.post('/login', loginValidators, validate, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email et mot de passe requis.' });
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    if (!user.isActive)
      return res.status(403).json({ message: 'Compte désactivé.' });
    const token = jwt.sign({ id: user._id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Connexion réussie.', token, role: 'user',
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la connexion.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordValidators, validate, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "L'email est requis." });
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (user) {
      const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      user.resetCode       = resetCode;
      user.resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      sendResetCodeEmail(email, resetCode, user.firstName)
        .catch(err => console.warn('[ForgotPassword] Email failed:', err.message));
    }
    res.json({ message: 'Si cet email est associé à un compte, vous recevrez un code.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ message: 'Erreur lors de la réinitialisation.' });
  }
});

// POST /api/auth/verify-code
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Email et code requis.' });
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    if (!user.resetCode || !user.resetCodeExpiry)
      return res.status(400).json({ message: 'Aucune demande en cours.' });
    if (user.resetCodeExpiry < new Date())
      return res.status(400).json({ message: 'Le code a expiré.' });
    if (user.resetCode !== code.toUpperCase())
      return res.status(401).json({ message: 'Code incorrect.' });
    res.json({ message: 'Code vérifié avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la vérification.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', resetPasswordValidators, validate, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword)
      return res.status(400).json({ message: 'Email, code et nouveau mot de passe requis.' });
    if (newPassword.length < 8)
      return res.status(400).json({ message: 'Mot de passe min 8 caractères.' });
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    if (!user.resetCode || !user.resetCodeExpiry)
      return res.status(400).json({ message: 'Aucune demande en cours.' });
    if (user.resetCodeExpiry < new Date())
      return res.status(400).json({ message: 'Le code a expiré.' });
    if (user.resetCode !== code.toUpperCase())
      return res.status(401).json({ message: 'Code incorrect.' });
    user.password        = await bcrypt.hash(newPassword, 12);
    user.resetCode       = null;
    user.resetCodeExpiry = null;
    await user.save();
    res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la réinitialisation.' });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { accessToken, idToken } = req.body;
    if (!accessToken && !idToken)
      return res.status(400).json({ message: 'accessToken ou idToken requis.' });

    let profile;
    if (idToken) {
      if (GOOGLE_CLIENT_IDS.length === 0)
        return res.status(500).json({ message: 'GOOGLE_CLIENT_ID non configuré sur le serveur.' });
      profile = await verifyGoogleIdToken(idToken);
      if (!profile) return res.status(401).json({ message: 'idToken Google invalide ou expiré.' });
    } else {
      try {
        const r = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }, timeout: 8000,
        });
        profile = r.data;
      } catch {
        return res.status(401).json({ message: 'accessToken Google invalide.' });
      }
    }

    const { email, given_name, family_name, name } = profile;
    if (!email) return res.status(400).json({ message: 'Email Google non disponible.' });

    const normalizedEmail = normalizeEmail(email);
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const firstName = given_name || (name ? name.split(' ')[0] : 'Google');
      const lastName  = family_name || (name ? name.split(' ').slice(1).join(' ') : 'User') || 'User';
      const hashed    = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 12);
      user = await User.create({ firstName, lastName, address: 'Non renseigné', email: normalizedEmail, password: hashed, isActive: true });
    }
    if (!user.isActive)
      return res.status(403).json({ message: 'Compte désactivé.' });
    const token = jwt.sign({ id: user._id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Connexion Google réussie.', token, role: 'user',
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email } });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(500).json({ message: 'Erreur connexion Google.' });
  }
});

// GET /api/auth/profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -resetCode -resetCodeExpiry');
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    res.json({ success: true, data: user });
  } catch {
    res.status(401).json({ message: 'Token invalide.' });
  }
});

module.exports = router;
