// src/services/emailService.js
const axios   = require('axios');
const { Resend } = require('resend');

function shouldLogResetCodes() {
  const explicit = String(process.env.LOG_RESET_CODES || '').trim().toLowerCase();
  if (explicit === 'false' || explicit === '0' || explicit === 'no') return false;
  return true;
}

// ── Brevo HTTP API (port 443 — never blocked on Render) ──────────────────────
async function sendViaBrevoAPI(to, subject, html) {
  if (!process.env.BREVO_API_KEY) throw new Error('BREVO_API_KEY non configuré');
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'smartirrigservice@gmail.com';
  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender:      { name: 'SmartIrrig', email: senderEmail },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    },
    {
      headers: {
        'api-key':      process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      timeout: 10000,
    }
  );
}

async function sendResetCodeEmail(email, resetCode, userName) {
  const to           = String(email || '').trim().toLowerCase();
  const allowLogCode = shouldLogResetCodes();

  const spacedCode = String(resetCode).split('').join('&nbsp;&nbsp;');
  const html = `
    <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:32px;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <h2 style="color:#22c55e;margin-top:0;">&#127807; SmartIrrig</h2>
        <p style="color:#374151;">Bonjour <strong>${String(userName || '').trim() || 'Utilisateur'}</strong>,</p>
        <p style="color:#374151;">Vous avez demandé une réinitialisation de votre mot de passe.</p>
        <p style="color:#374151;">Votre code de confirmation :</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
          <tr>
            <td align="center">
              <div style="display:inline-block;font-size:36px;font-weight:700;color:#22c55e;background:#f0fdf4;padding:16px 24px;border-radius:12px;border:2px dashed #22c55e;font-family:monospace;">
                ${spacedCode}
              </div>
            </td>
          </tr>
        </table>
        <p style="color:#6b7280;font-size:13px;">&#9201; Ce code expire dans <strong>15 minutes</strong>.</p>
        <p style="color:#6b7280;font-size:13px;">Si vous n'avez pas demandé cela, ignorez cet email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:12px;text-align:center;">SmartIrrig — Gestion intelligente de l'irrigation</p>
      </div>
    </body></html>`;
  const subject = 'SmartIrrig — Code de réinitialisation de mot de passe';

  try {
    // ── Brevo HTTP API (recommended — works on all cloud servers) ────────────
    if (process.env.BREVO_API_KEY) {
      await sendViaBrevoAPI(to, subject, html);
      console.log(`Email sent via Brevo API to: ${to}`);
      return true;
    }

    // ── Resend API ────────────────────────────────────────────────────────────
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'SmartIrrig <onboarding@resend.dev>', to, subject, html,
      });
      if (!error) { console.log(`Email sent via Resend to: ${to}`); return true; }
      console.warn(`[Resend] Erreur: ${JSON.stringify(error)}`);
    }

    if (allowLogCode) console.log(`[DEV] Reset code for ${to}: ${resetCode}`);
    return false;

  } catch (err) {
    console.error(`[Email] ÉCHEC ENVOI to=${to} error=${err.message}`);
    console.log(`[Email] Reset code (fallback log): ${to} → ${resetCode}`);
    return false;
  }
}

module.exports = { sendResetCodeEmail };
