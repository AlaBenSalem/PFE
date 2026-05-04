// src/controllers/aiController.js
const axios = require('axios');
const { detectMessageLanguage, buildUserContext, callGroq, normalizeNumerals } = require('../services/aiService');

const ELEVENLABS_API_KEY  = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'cFUFIbKkO2iZFwS8cRnY';
const GROQ_MODELS         = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

exports.chat = async (req, res) => {
  const { message, city } = req.body;
  if (!message?.trim())
    return res.status(400).json({ success: false, error: 'Message requis.' });

  try {
    const context  = await buildUserContext(req.userId, city || 'Tunis');
    const langHint = detectMessageLanguage(message.trim());
    const answer   = await callGroq(message.trim(), context, langHint);
    return res.json({
      success: true,
      answer:  normalizeNumerals(answer),
      conversationId: '',
      context: { cropCount: context.cropCount, city: context.city },
      provider: 'groq',
    });
  } catch (error) {
    console.error('❌ Groq error:', error.response?.data || error.message);
    return res.status(503).json({ success: false, error: 'service_overloaded' });
  }
};

exports.tts = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim())
      return res.status(400).json({ success: false, error: 'Texte requis.' });

    if (!ELEVENLABS_API_KEY)
      return res.status(503).json({ success: false, error: 'TTS non configuré.' });

    const elRes = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        text: text.trim(),
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
      },
      {
        headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        responseType: 'arraybuffer',
        timeout: 15000,
      }
    );
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    return res.send(Buffer.from(elRes.data));
  } catch (err) {
    let detail = err.message;
    if (err.response?.data) {
      try { detail = Buffer.from(err.response.data).toString('utf8'); } catch {}
    }
    console.error('❌ [TTS proxy] ElevenLabs error:', err.response?.status, detail);
    return res.status(502).json({ success: false, error: 'TTS indisponible.', detail });
  }
};

exports.status = (req, res) => {
  res.json({ success: true, provider: 'groq', models: GROQ_MODELS });
};
