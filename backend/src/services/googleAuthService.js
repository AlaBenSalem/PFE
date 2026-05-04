// src/services/googleAuthService.js
const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_IDS = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter(Boolean);

async function verifyGoogleIdToken(idToken) {
  for (const clientId of GOOGLE_CLIENT_IDS) {
    try {
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_IDS });
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

module.exports = { GOOGLE_CLIENT_IDS, verifyGoogleIdToken };
