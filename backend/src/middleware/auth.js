// src/middleware/auth.js — centralised JWT middleware
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Any valid token (user or admin)
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

// Role must be 'user'
function requireUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token manquant.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.id || decoded.role !== 'user') {
      return res.status(403).json({ success: false, message: 'Accès utilisateur requis.' });
    }
    req.userId   = decoded.id;
    req.userRole = decoded.role;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalide.' });
  }
}

// Role must be 'admin'
function requireAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token manquant.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Accès admin requis.' });
    }
    req.userId   = decoded.id;
    req.userRole = decoded.role;
    req.admin    = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: 'Token invalide.' });
  }
}

// Extracts token if present — never blocks
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

module.exports = { requireAuth, requireUser, requireAdmin, optionalAuth };
