const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath });
    }
  } catch {}
}

// Load env from repo root first (recommended), then backend/.env as fallback.
// Does NOT override real environment variables (e.g. Render dashboard vars).
loadEnvFile(path.resolve(__dirname, "..", ".env"));
loadEnvFile(path.resolve(__dirname, ".env"));
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const crypto = require("crypto");
const helmet = require("helmet");
const morgan = require("morgan");
const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const { OAuth2Client } = require("google-auth-library"); // ✅ NOUVEAU

const weatherRoutes       = require("./src/routes/weatherRoutes");
const kcRoutes            = require("./src/routes/kcRoutes");
const cultureRoutes       = require("./src/routes/cultureRoutes");
const irrigationRoutes    = require("./src/routes/irrigationRoutes");
const fertilisationRoutes = require("./src/routes/fertilisationRoutes");
const adminRoutes         = require("./src/routes/adminRoutes");
const userRoutes          = require("./src/routes/userRoutes");
const messageRoutes       = require("./src/routes/messageRoutes");
const Irrigation       = require("./src/models/Irrigation");
const KCReference      = require("./src/models/KCReference");
const KC_DATA          = require("./src/data/kcData");
const { connectAllMongo } = require("./config/mongodbConnections");

const aiRoutes = require('./src/routes/aiRoutes');

const app = express();
app.use(helmet());
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
app.use(express.json());
app.use(morgan("dev"));
app.use('/api/ai', aiRoutes);
const PORT           = Number.parseInt(process.env.PORT, 10) || 5000;
const JWT_SECRET     = process.env.JWT_SECRET  || "default-secret-change-in-production";
const APP_URL        = process.env.APP_URL      || "http://localhost:3000";
const ADMIN_EMAIL    = String(process.env.ADMIN_EMAIL    || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "").trim();
const ADMIN_NAME     = String(process.env.ADMIN_NAME     || "Administrateur").trim();

// ✅ Google OAuth Client IDs (Web + Android)
const GOOGLE_CLIENT_IDS = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter(Boolean);

// ✅ Resend — HTTP, fonctionne parfaitement sur Render
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const EMAIL_FROM = process.env.EMAIL_FROM || "SmartIrrig <onboarding@resend.dev>";

function shouldLogResetCodes() {
  const explicit = String(process.env.LOG_RESET_CODES || "").trim().toLowerCase();
  if (explicit === "true" || explicit === "1" || explicit === "yes") return true;
  return String(process.env.NODE_ENV || "").toLowerCase() !== "production";
}

function hasGmailConfig() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function createGmailTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ─── EMAIL ────────────────────────────────────────────────────────────────────
async function sendResetCodeEmail(email, resetCode, userName) {
  const allowLogCode = shouldLogResetCodes();
  const provider = String(process.env.EMAIL_PROVIDER || "auto").trim().toLowerCase();
  const to = String(email || "").trim().toLowerCase();

  try {
    if (!process.env.RESEND_API_KEY) {
      if (provider !== "resend" && hasGmailConfig()) {
        const transporter = createGmailTransport();
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: to || email,
          subject: "SmartIrrig - Password reset code",
          html: `<p>Hello ${String(userName || "").trim() || "User"},</p>
<p>Your reset code is:</p>
<h1 style="letter-spacing:6px; color:#16a34a;">${resetCode}</h1>
<p>This code expires in 15 minutes.</p>`,
        });
        console.log(`Email sent via Gmail to: ${to || email}`);
        return true;
      }

      if (allowLogCode) {
        console.log(`[DEV] Reset code for ${to || email}: ${resetCode}`);
      } else {
        console.warn("[Email] No RESEND_API_KEY and Gmail not configured.");
      }
      return false;
    }

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to:   to || email,
      subject: "SmartIrrig — Code de réinitialisation de mot de passe",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background: #f4f6f8; padding: 32px;">
            <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
              <h2 style="color: #22c55e; margin-top: 0;">🌿 SmartIrrig</h2>
              <p style="color: #374151;">Bonjour <strong>${userName}</strong>,</p>
              <p style="color: #374151;">Vous avez demandé une réinitialisation de votre mot de passe.</p>
              <p style="color: #374151;">Votre code de confirmation :</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #22c55e; background: #f0fdf4; padding: 16px 24px; border-radius: 12px; border: 2px dashed #22c55e;">
                  ${resetCode}
                </span>
              </div>
              <p style="color: #6b7280; font-size: 13px;">⏱ Ce code expire dans <strong>15 minutes</strong>.</p>
              <p style="color: #6b7280; font-size: 13px;">Si vous n'avez pas demandé cela, ignorez cet email.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">SmartIrrig — Gestion intelligente de l'irrigation</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.warn(`[Resend] Erreur envoi email: ${JSON.stringify(error)}`);

      if (provider !== "resend" && hasGmailConfig()) {
        try {
          const transporter = createGmailTransport();
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: to || email,
            subject: "SmartIrrig - Password reset code",
            html: `<p>Hello ${String(userName || "").trim() || "User"},</p>
<p>Your reset code is:</p>
<h1 style="letter-spacing:6px; color:#16a34a;">${resetCode}</h1>
<p>This code expires in 15 minutes.</p>`,
          });
          console.log(`Email sent via Gmail to: ${to || email}`);
          return true;
        } catch (gmailErr) {
          console.warn(`[Email][Gmail] Failed after Resend error: ${gmailErr.message}`);
        }
      }

      if (allowLogCode) {
        console.log(`[DEV] Reset code for ${to || email}: ${resetCode}`);
      }
      return false;
    }

    console.log(`Email sent via Resend to: ${to || email}`);
    return true;
  } catch (error) {
    console.warn(`[Email] Échec: ${error.message}`);
    if (allowLogCode) {
      console.log(`[DEV] Reset code for ${to || email}: ${resetCode}`);
    }
    return false;
  }
}

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  firstName:       { type: String, required: true, trim: true },
  lastName:        { type: String, required: true, trim: true },
  address:         { type: String, required: true, trim: true },
  email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:        { type: String, required: true, minlength: 8 },
  resetCode:       { type: String, default: null },
  resetCodeExpiry: { type: Date,   default: null },
  isActive:        { type: Boolean, default: true },
  createdAt:       { type: Date,    default: Date.now },
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

const adminSchema = new mongoose.Schema({
  fullName:    { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true, minlength: 8 },
  lastLoginAt: { type: Date, default: null },
  createdAt:   { type: Date, default: Date.now },
});

const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function ensureKCData() {
  try {
    const count = await KCReference.countDocuments();
    if (count === 0) {
      await KCReference.insertMany(KC_DATA);
      console.log(`✅ KCReference auto-initialisée: ${KC_DATA.length} cultures FAO-56 chargées`);
    }
  } catch (err) {
    console.warn(`⚠️  ensureKCData: ${err.message}`);
  }
}

async function ensureAdminAccount() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD non définis.");
    return;
  }
  if (ADMIN_PASSWORD.length < 8) {
    console.warn("ADMIN_PASSWORD doit contenir au moins 8 caractères.");
    return;
  }
  const existingAdmin = await Admin.findOne({ email: ADMIN_EMAIL });
  if (existingAdmin) return;
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await Admin.create({ fullName: ADMIN_NAME, email: ADMIN_EMAIL, password: hashedPassword });
  console.log(`Admin créé: ${ADMIN_EMAIL}`);
}

async function requireAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token manquant." });
    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ message: "Token invalide." }); }
    if (!decoded || decoded.role !== "admin") return res.status(403).json({ message: "Accès admin requis." });
    let admin = await Admin.findById(decoded.id).catch(() => null);
    if (!admin) {
      req.admin = { _id: decoded.id, email: "admin@smartirrig.com" };
      return next();
    }
    req.admin = admin;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalide." });
  }
}

// ✅ NOUVEAU : Vérifier un idToken Google (mobile Android/iOS)
async function verifyGoogleIdToken(idToken) {
  for (const clientId of GOOGLE_CLIENT_IDS) {
    try {
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_IDS, // accepte tous les client IDs
      });
      if (ticket) {
        console.log(`✅ idToken vérifié avec clientId: ${clientId}`);
        return ticket.getPayload();
      }
    } catch (err) {
      console.warn(`[Google] Échec vérification avec clientId ${clientId}: ${err.message}`);
    }
  }
  return null;
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use("/api/weather",        weatherRoutes);
app.use("/api/kc",             kcRoutes);
app.use("/api/cultures",       cultureRoutes);
app.use("/api/irrigations",    irrigationRoutes);
app.use("/api/fertilisations", fertilisationRoutes);
app.use("/api/admin",          adminRoutes);
app.use("/api/users",          userRoutes);
app.use("/api/messages",       messageRoutes);

// PATCH /api/admin/profile — update admin fullName
app.patch("/api/admin/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token manquant." });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.role !== "admin") return res.status(403).json({ message: "Accès admin requis." });
    const { fullName } = req.body;
    if (!fullName || !fullName.trim()) return res.status(400).json({ message: "Nom requis." });
    const admin = await Admin.findByIdAndUpdate(decoded.id, { fullName: fullName.trim() }, { new: true });
    if (!admin) return res.status(404).json({ message: "Admin non trouvé." });
    res.json({ success: true, admin: { id: admin._id, fullName: admin.fullName, email: admin.email } });
  } catch (e) {
    res.status(500).json({ message: "Erreur mise à jour." });
  }
});

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, address, email, password } = req.body;
    if (!firstName || !lastName || !address || !email || !password) {
      return res.status(400).json({ message: "Tous les champs sont requis." });
    }
    if (password.length < 8) return res.status(400).json({ message: "Mot de passe min 8 caractères." });
    const existing = await User.findOne({ email: normalizeEmail(email) });
    if (existing) return res.status(409).json({ message: "Cet email est déjà utilisé." });
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      firstName: firstName.trim(), lastName: lastName.trim(),
      address: address.trim(), email: normalizeEmail(email), password: hashed,
    });
    const token = jwt.sign({ id: user._id, role: "user" }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({
      message: "Compte créé.", token, role: "user",
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email },
    });
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ message: "Erreur lors de l'inscription." });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email et mot de passe requis." });
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(401).json({ message: "Identifiants incorrects." });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Identifiants incorrects." });
    if (!user.isActive) return res.status(403).json({ message: "Compte désactivé." });
    const token = jwt.sign({ id: user._id, role: "user" }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      message: "Connexion réussie.", token, role: "user",
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la connexion." });
  }
});

// POST /api/admin/login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email et mot de passe requis." });
    const admin = await Admin.findOne({ email: normalizeEmail(email) });
    if (!admin) return res.status(401).json({ message: "Identifiants incorrects." });
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ message: "Identifiants incorrects." });
    admin.lastLoginAt = new Date();
    await admin.save();
    const token = jwt.sign({ id: admin._id, role: "admin" }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      message: "Connexion admin réussie.", token, role: "admin",
      admin: { id: admin._id, fullName: admin.fullName, email: admin.email },
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur connexion admin." });
  }
});

// GET /api/auth/profile
app.get("/api/auth/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token manquant." });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password -resetCode -resetCodeExpiry");
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé." });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(401).json({ message: "Token invalide." });
  }
});

// POST /api/auth/forgot-password
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "L'email est requis." });
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.json({ message: "Si cet email est associé à un compte, vous recevrez un code." });
    }
    const resetCode = crypto.randomBytes(3).toString("hex").toUpperCase();
    const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
    user.resetCode = resetCode;
    user.resetCodeExpiry = resetCodeExpiry;
    await user.save();
    await sendResetCodeEmail(email, resetCode, user.firstName);
    console.log(`Password reset initiated for: ${email}`);
    res.json({ message: "Si cet email est associé à un compte, vous recevrez un code." });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({ message: "Erreur lors de la réinitialisation." });
  }
});

// POST /api/auth/verify-code
app.post("/api/auth/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email et code requis." });
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé." });
    if (!user.resetCode || !user.resetCodeExpiry) return res.status(400).json({ message: "Aucune demande en cours." });
    if (user.resetCodeExpiry < new Date()) return res.status(400).json({ message: "Le code a expiré." });
    if (user.resetCode !== code.toUpperCase()) return res.status(401).json({ message: "Code incorrect." });
    res.json({ message: "Code vérifié avec succès." });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la vérification." });
  }
});

// POST /api/auth/reset-password
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ message: "Email, code et nouveau mot de passe requis." });
    if (newPassword.length < 8) return res.status(400).json({ message: "Mot de passe min 8 caractères." });
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé." });
    if (!user.resetCode || !user.resetCodeExpiry) return res.status(400).json({ message: "Aucune demande en cours." });
    if (user.resetCodeExpiry < new Date()) return res.status(400).json({ message: "Le code a expiré." });
    if (user.resetCode !== code.toUpperCase()) return res.status(401).json({ message: "Code incorrect." });
    user.password = await bcrypt.hash(newPassword, 12);
    user.resetCode = null;
    user.resetCodeExpiry = null;
    await user.save();
    console.log(`Password reset for: ${email}`);
    res.json({ message: "Mot de passe réinitialisé avec succès." });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la réinitialisation." });
  }
});

// ✅ POST /api/auth/google — CORRIGÉ pour Web ET Mobile (Android/iOS)
app.post("/api/auth/google", async (req, res) => {
  try {
    const { accessToken, idToken } = req.body;

    if (!accessToken && !idToken) {
      return res.status(400).json({ message: "accessToken ou idToken requis." });
    }

    let profile;

    // ── Cas 1 : idToken → Mobile Android / iOS ──────────────────────────────
    if (idToken) {
      console.log("[Google] Tentative avec idToken (mobile)...");

      if (GOOGLE_CLIENT_IDS.length === 0) {
        return res.status(500).json({ message: "GOOGLE_CLIENT_ID non configuré sur le serveur." });
      }

      profile = await verifyGoogleIdToken(idToken);

      if (!profile) {
        return res.status(401).json({ message: "idToken Google invalide ou expiré." });
      }

      console.log(`[Google] Profil mobile récupéré: ${profile.email}`);
    }

    // ── Cas 2 : accessToken → Web ────────────────────────────────────────────
    else if (accessToken) {
      console.log("[Google] Tentative avec accessToken (web)...");
      try {
        const axios = require("axios");
        const r = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 8000,
        });
        profile = r.data;
        console.log(`[Google] Profil web récupéré: ${profile.email}`);
      } catch (e) {
        console.error("[Google] accessToken invalide:", e.message);
        return res.status(401).json({ message: "accessToken Google invalide." });
      }
    }

    // ── Créer ou récupérer l'utilisateur ─────────────────────────────────────
    const { email, given_name, family_name, name } = profile;
    if (!email) return res.status(400).json({ message: "Email Google non disponible." });

    const normalizedEmail = normalizeEmail(email);
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Décompose le nom complet si given_name/family_name absents (cas idToken)
      let firstName = given_name || (name ? name.split(" ")[0] : "Google");
      let lastName  = family_name || (name ? name.split(" ").slice(1).join(" ") : "User") || "User";

      const hashed = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 12);
      user = await User.create({
        firstName,
        lastName,
        address:  "Non renseigné",
        email:    normalizedEmail,
        password: hashed,
        isActive: true,
      });
      console.log(`[Google] Nouvel utilisateur créé: ${normalizedEmail}`);
    } else {
      console.log(`[Google] Utilisateur existant connecté: ${normalizedEmail}`);
    }

    const token = jwt.sign({ id: user._id, role: "user" }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({
      message: "Connexion Google réussie.",
      token,
      role: "user",
      user: {
        id:        user._id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
      },
    });

  } catch (e) {
    console.error("Google auth error:", e.message);
    res.status(500).json({ message: "Erreur connexion Google." });
  }
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
async function startServer() {
  try {
    console.log("Starting SmartIrrig Backend...");
    await connectAllMongo();
    await ensureAdminAccount();
    await ensureKCData();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      if (!process.env.RESEND_API_KEY) {
        console.warn("⚠️  RESEND_API_KEY non configuré — les emails ne seront pas envoyés");
      } else {
        console.log("✅ Resend email service configuré");
      }
      if (GOOGLE_CLIENT_IDS.length === 0) {
        console.warn("⚠️  GOOGLE_CLIENT_ID non configuré — Google Auth désactivé");
      } else {
        console.log(`✅ Google Auth configuré (${GOOGLE_CLIENT_IDS.length} client ID(s))`);
      }
    });
  } catch (error) {
    console.error("Failed to start:", error.message);
    process.exit(1);
  }
}

startServer();
