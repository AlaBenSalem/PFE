// src/controllers/aiController.js
const axios = require('axios');
const { detectMessageLanguage, buildUserContext, callGroq, normalizeNumerals } = require('../services/aiService');

const ELEVENLABS_API_KEY  = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'cFUFIbKkO2iZFwS8cRnY';
const GROQ_MODELS         = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

// ── Greeting detection ────────────────────────────────────────────────────────
const GREETING_PATTERN = /^(bonjour|bonsoir|salam|salut|hello|hi|hey|cava|cv|winek|labas|mar7ba|ahlen|مرحبا|أهلا|سلام|صباح الخير|مساء الخير|merhaba|selam|günaydın|iyi günler)[\s!?.،,]*$/i;

const GREETING_RESPONSES = {
  TUNISIAN_ARABIC: '!أهلاً  كيفاش نعاونك اليوم؟',
  MODERN_ARABIC:   '!أهلاً بك  كيف يمكنني مساعدتك اليوم؟',
  FRENCH:          'Bonjour !  Comment puis-je vous aider ?',
  ENGLISH:         'Hello!  How can I help you today?',
  TURKISH:         'Merhaba!  Bugün size nasıl yardımcı olabilirim?',
};

function getGreetingLang(langHint) {
  if (langHint.startsWith('TUNISIAN_ARABIC')) return 'TUNISIAN_ARABIC';
  if (langHint.startsWith('MODERN_ARABIC'))   return 'MODERN_ARABIC';
  if (langHint.startsWith('ENGLISH'))         return 'ENGLISH';
  if (langHint.startsWith('TURKISH'))         return 'TURKISH';
  return 'FRENCH';
}

// ── Chat ──────────────────────────────────────────────────────────────────────
exports.chat = async (req, res) => {
  const { message, city, history = [], irrigationOverrides = {}, irrigationData = [] } = req.body;
  if (!message?.trim())
    return res.status(400).json({ success: false, error: 'Message requis.' });

  const trimmed = message.trim();

  // ✅ Greeting shortcut — skip DB calls entirely
  if (GREETING_PATTERN.test(trimmed)) {
    const langHint = detectMessageLanguage(trimmed);
    const lang     = getGreetingLang(langHint);
    return res.json({
      success: true,
      answer:  GREETING_RESPONSES[lang],
      conversationId: '',
      context: { cropCount: 0, city: city || 'Tunis' },
      provider: 'groq',
    });
  }

  try {
    const context  = await buildUserContext(req.userId, city || 'Tunis', irrigationOverrides, irrigationData);
    const langHint = detectMessageLanguage(trimmed);
    const answer   = await callGroq(trimmed, context, langHint, history);
    return res.json({
      success: true,
      answer:  normalizeNumerals(answer),
      conversationId: '',
      context: { cropCount: context.cropCount, city: context.city },
      provider: 'groq',
    });
  } catch (error) {
    const status = error.response?.status;
    const data   = error.response?.data;
    console.error(`❌ Groq error [HTTP ${status}]:`, data || error.message);
    if (status === 401) return res.status(503).json({ success: false, error: 'api_key_invalid' });
    if (status === 429) return res.status(503).json({ success: false, error: 'daily_limit_reached' });
    return res.status(503).json({ success: false, error: 'service_overloaded' });
  }
};

// ── TTS ───────────────────────────────────────────────────────────────────────
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

// ── Status ────────────────────────────────────────────────────────────────────
exports.status = (req, res) => {
  res.json({ success: true, provider: 'groq', models: GROQ_MODELS });
};