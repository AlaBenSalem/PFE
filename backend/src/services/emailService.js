// src/services/emailService.js
const nodemailer = require('nodemailer');
const { Resend }  = require('resend');

function shouldLogResetCodes() {
  const explicit = String(process.env.LOG_RESET_CODES || '').trim().toLowerCase();
  if (explicit === 'true' || explicit === '1' || explicit === 'yes') return true;
  return String(process.env.NODE_ENV || '').toLowerCase() !== 'production';
}

function hasGmailConfig() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function createGmailTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

async function sendResetCodeEmail(email, resetCode, userName) {
  const to           = String(email || '').trim().toLowerCase();
  const allowLogCode = shouldLogResetCodes();
  const provider     = String(process.env.EMAIL_PROVIDER || 'auto').trim().toLowerCase();
  const EMAIL_FROM   = process.env.EMAIL_FROM || 'SmartIrrig <onboarding@resend.dev>';

  const gmailHtml = `<p>Hello ${String(userName || '').trim() || 'User'},</p>
<p>Your reset code is:</p>
<h1 style="letter-spacing:6px; color:#16a34a;">${resetCode}</h1>
<p>This code expires in 15 minutes.</p>`;

  const resendHtml = `
    <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:32px;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <h2 style="color:#22c55e;margin-top:0;">🌿 SmartIrrig</h2>
        <p style="color:#374151;">Bonjour <strong>${userName}</strong>,</p>
        <p style="color:#374151;">Vous avez demandé une réinitialisation de votre mot de passe.</p>
        <p style="color:#374151;">Votre code de confirmation :</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#22c55e;background:#f0fdf4;padding:16px 24px;border-radius:12px;border:2px dashed #22c55e;">
            ${resetCode}
          </span>
        </div>
        <p style="color:#6b7280;font-size:13px;">⏱ Ce code expire dans <strong>15 minutes</strong>.</p>
        <p style="color:#6b7280;font-size:13px;">Si vous n'avez pas demandé cela, ignorez cet email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:12px;text-align:center;">SmartIrrig — Gestion intelligente de l'irrigation</p>
      </div>
    </body></html>`;

  try {
    if (!process.env.RESEND_API_KEY) {
      if (provider !== 'resend' && hasGmailConfig()) {
        await createGmailTransport().sendMail({
          from: process.env.EMAIL_USER, to,
          subject: 'SmartIrrig - Password reset code', html: gmailHtml,
        });
        console.log(`Email sent via Gmail to: ${to}`);
        return true;
      }
      if (allowLogCode) console.log(`[DEV] Reset code for ${to}: ${resetCode}`);
      else console.warn('[Email] No RESEND_API_KEY and Gmail not configured.');
      return false;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: EMAIL_FROM, to,
      subject: 'SmartIrrig — Code de réinitialisation de mot de passe',
      html: resendHtml,
    });

    if (!error) { console.log(`Email sent via Resend to: ${to}`); return true; }

    console.warn(`[Resend] Erreur: ${JSON.stringify(error)}`);
    if (provider !== 'resend' && hasGmailConfig()) {
      await createGmailTransport().sendMail({
        from: process.env.EMAIL_USER, to,
        subject: 'SmartIrrig - Password reset code', html: gmailHtml,
      });
      return true;
    }
    if (allowLogCode) console.log(`[DEV] Reset code for ${to}: ${resetCode}`);
    return false;

  } catch (err) {
    console.warn(`[Email] Échec: ${err.message}`);
    if (allowLogCode) console.log(`[DEV] Reset code for ${to}: ${resetCode}`);
    return false;
  }
}

module.exports = { sendResetCodeEmail };
