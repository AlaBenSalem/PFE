// src/routes/messageRoutes.js
const express         = require('express');
const router          = express.Router();
const nodemailer      = require('nodemailer');
const { Resend }      = require('resend');
const Message         = require('../models/Message');
const User            = require('../models/User');
const { requireUser } = require('../middleware/auth');
const { validate, messageValidators } = require('../middleware/validate');

const EMAIL_FROM           = process.env.EMAIL_FROM || 'SmartIrrig <onboarding@resend.dev>';
const ADMIN_NOTIFY_EMAIL   = String(process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();

function shouldSendAdminEmail() {
  const flag = String(process.env.ENABLE_ADMIN_MESSAGE_EMAIL || 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0' && flag !== 'no';
}

async function sendAdminMessageEmail({ senderName, senderEmail, subject, body, createdAt }) {
  if (!shouldSendAdminEmail() || !ADMIN_NOTIFY_EMAIL) return;

  const safeSubject = subject?.trim() || 'New message';
  const title       = `SmartIrrig — New message from ${senderName || senderEmail || 'user'}`;
  const when        = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();
  const html        = `
    <div style="font-family:Arial,sans-serif;background:#f4f6f8;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;padding:24px;border:1px solid #e5e7eb;">
        <h2 style="margin:0;color:#16a34a;">${title}</h2>
        <p style="color:#64748b;margin-top:8px;">Received at: <strong>${when}</strong></p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
        <p style="margin:0;color:#0f172a;"><strong>From:</strong> ${senderName || ''} ${senderEmail ? `&lt;${senderEmail}&gt;` : ''}</p>
        <p style="margin:10px 0 0;color:#0f172a;"><strong>Subject:</strong> ${safeSubject}</p>
        <div style="margin-top:14px;padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;white-space:pre-wrap;color:#0f172a;">${String(body || '').replace(/</g, '&lt;')}</div>
      </div>
    </div>`;

  const provider = String(process.env.EMAIL_PROVIDER || 'auto').trim().toLowerCase();
  const useGmail = provider === 'gmail' || !process.env.RESEND_API_KEY;

  if (!useGmail && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: EMAIL_FROM, to: ADMIN_NOTIFY_EMAIL, subject: `SmartIrrig — ${safeSubject}`, html });
    if (!error) { console.log(`[AdminEmail] Sent via Resend to: ${ADMIN_NOTIFY_EMAIL}`); return; }
    console.warn(`[AdminEmail][Resend] Failed: ${JSON.stringify(error)}`);
  }

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    await transporter.sendMail({ from: `SmartIrrig <${process.env.EMAIL_USER}>`, to: ADMIN_NOTIFY_EMAIL, subject: `SmartIrrig — ${safeSubject}`, html });
    console.log(`[AdminEmail] Sent via Gmail to: ${ADMIN_NOTIFY_EMAIL}`);
  }
}

// POST /api/messages
router.post('/', requireUser, messageValidators, validate, async (req, res) => {
  try {
    const body    = String(req.body?.body ?? req.body?.message ?? '').trim();
    const subject = String(req.body?.subject ?? '').trim();
    if (!body) return res.status(400).json({ message: 'Message requis.' });

    const user = await User.findById(req.userId).select('firstName lastName email');
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    const senderName  = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    const senderEmail = String(user.email || '').trim().toLowerCase();
    const message     = await Message.create({ userId: user._id, senderName, senderEmail, subject, body });

    sendAdminMessageEmail({ senderName, senderEmail, subject, body, createdAt: message.createdAt })
      .catch(e => console.warn('[AdminEmail] Failed:', e.message));

    return res.status(201).json({ success: true, data: { id: message._id, createdAt: message.createdAt } });
  } catch {
    return res.status(500).json({ message: 'Erreur envoi message.' });
  }
});

module.exports = router;
