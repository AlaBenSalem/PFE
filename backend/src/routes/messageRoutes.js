const express = require("express");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const Message = require("../models/Message");
const User = require("../models/User");

const router = express.Router();

const JWT_SECRET =
  process.env.JWT_SECRET || "default-secret-change-in-production";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const EMAIL_FROM = process.env.EMAIL_FROM || "SmartIrrig <onboarding@resend.dev>";
const ADMIN_NOTIFY_EMAIL = String(
  process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || "",
)
  .trim()
  .toLowerCase();

function hasGmailConfig() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function shouldSendAdminEmail() {
  const flag = String(process.env.ENABLE_ADMIN_MESSAGE_EMAIL || "true")
    .trim()
    .toLowerCase();
  return flag !== "false" && flag !== "0" && flag !== "no";
}

async function sendAdminMessageEmail({ senderName, senderEmail, subject, body, createdAt }) {
  if (!shouldSendAdminEmail()) return;
  if (!ADMIN_NOTIFY_EMAIL) return;

  const safeSubject = subject?.trim() ? subject.trim() : "New message";
  const title = `SmartIrrig — New message from ${senderName || senderEmail || "user"}`;
  const when = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();

  const html = `
    <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:24px;">
      <div style="max-width:640px; margin:0 auto; background:#fff; border-radius:14px; padding:24px; border:1px solid #e5e7eb;">
        <h2 style="margin:0; color:#16a34a;">${title}</h2>
        <p style="color:#64748b; margin-top:8px;">Received at: <strong>${when}</strong></p>
        <hr style="border:none; border-top:1px solid #e5e7eb; margin:16px 0;" />
        <p style="margin:0; color:#0f172a;"><strong>From:</strong> ${senderName || ""} ${senderEmail ? `&lt;${senderEmail}&gt;` : ""}</p>
        <p style="margin:10px 0 0; color:#0f172a;"><strong>Subject:</strong> ${safeSubject}</p>
        <div style="margin-top:14px; padding:14px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0; white-space:pre-wrap; color:#0f172a;">${String(body || "").replace(/</g, "&lt;")}</div>
      </div>
    </div>
  `;

  // Prefer Resend on Render (no SMTP), fallback to Gmail SMTP if configured.
  if (process.env.RESEND_API_KEY) {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: ADMIN_NOTIFY_EMAIL,
      subject: `SmartIrrig — ${safeSubject}`,
      html,
    });
    if (!error) return;
    console.warn(`[AdminEmail][Resend] Failed: ${JSON.stringify(error)}`);
  }

  if (hasGmailConfig()) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: ADMIN_NOTIFY_EMAIL,
      subject: `SmartIrrig — ${safeSubject}`,
      html,
    });
  }
}

function requireUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token manquant." });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.id || decoded?.role !== "user") {
      return res.status(403).json({ message: "Acces utilisateur requis." });
    }
    req.userId = decoded.id;
    return next();
  } catch {
    return res.status(401).json({ message: "Token invalide." });
  }
}

// POST /api/messages
router.post("/", requireUser, async (req, res) => {
  try {
    const rawBody = req.body?.body ?? req.body?.message ?? "";
    const subject = String(req.body?.subject ?? "").trim();
    const body = String(rawBody).trim();

    if (!body) return res.status(400).json({ message: "Message requis." });

    const user = await User.findById(req.userId).select(
      "firstName lastName email",
    );
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });

    const senderName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
    const senderEmail = String(user.email || "").trim().toLowerCase();

    const message = await Message.create({
      userId: user._id,
      senderName,
      senderEmail,
      subject,
      body,
    });

    sendAdminMessageEmail({
      senderName,
      senderEmail,
      subject,
      body,
      createdAt: message.createdAt,
    }).catch((e) => console.warn("[AdminEmail] Failed:", e.message));

    return res.status(201).json({
      success: true,
      data: {
        id: message._id,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Erreur envoi message." });
  }
});

module.exports = router;
