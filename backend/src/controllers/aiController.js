// src/controllers/aiController.js
const axios = require('axios');
const { detectMessageLanguage, buildUserContext, callGroq, normalizeNumerals } = require('../services/aiService');

const ELEVENLABS_API_KEY  = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'cFUFIbKkO2iZFwS8cRnY';
const AZURE_SPEECH_KEY    = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'eastus';

// Voix Azure par langue
const AZURE_VOICES = {
  ar: 'ar-TN-ReemNeural',   // Tunisian Arabic (Darija) — féminine
  // ar: 'ar-TN-HediNeural', // Tunisian Arabic — masculine (alternative)
};

async function ttsAzure(text, voiceName) {
  const ssml = `<speak version='1.0' xml:lang='ar-TN'>
    <voice name='${voiceName}'>${text.replace(/[<>&'"]/g, ' ')}</voice>
  </speak>`;
  const res = await axios.post(
    `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    ssml,
    {
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      responseType: 'arraybuffer',
      timeout: 15000,
    }
  );
  return Buffer.from(res.data);
}

// ── Google Cloud TTS — Arabic (fallback si Azure non configuré) ───────────────
const GOOGLE_TTS_KEY = process.env.GOOGLE_TTS_KEY;
async function ttsGoogle(text) {
  const res = await axios.post(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`,
    {
      input: { text },
      voice: { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-B', ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9, pitch: 0 },
    },
    { timeout: 15000 }
  );
  return Buffer.from(res.data.audioContent, 'base64');
}
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
    const { text, lang } = req.body;
    if (!text?.trim())
      return res.status(400).json({ success: false, error: 'Texte requis.' });

    const cleanText = text.trim()
      .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
      .replace(/[!?⚠️📍👋•★]/g, '')
      .replace(/[*_~`#]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // ── Arabe → Azure (Tunisian) > Google (Arabic) > ElevenLabs ─────────────
    const isArabic = lang === 'ar' || lang === 'TUNISIAN_ARABIC' || lang === 'MODERN_ARABIC'
      || /[؀-ۿ]/.test(cleanText);

    if (isArabic) {
      // 1. Azure ar-TN (voix tunisienne native)
      if (AZURE_SPEECH_KEY) {
        try {
          const audio = await ttsAzure(cleanText, AZURE_VOICES.ar);
          res.set('Content-Type', 'audio/mpeg');
          res.set('Cache-Control', 'no-store');
          return res.send(audio);
        } catch (e) { console.warn('⚠️ Azure TTS:', e.message); }
      }
      // 2. Google Cloud TTS (arabe standard, gratuit 1M chars/mois)
      if (GOOGLE_TTS_KEY) {
        try {
          const audio = await ttsGoogle(cleanText);
          res.set('Content-Type', 'audio/mpeg');
          res.set('Cache-Control', 'no-store');
          return res.send(audio);
        } catch (e) { console.warn('⚠️ Google TTS:', e.message); }
      }
      // 3. ElevenLabs (fallback)
    }

    // ── Autres langues → ElevenLabs ─────────────────────────────────────────
    if (!ELEVENLABS_API_KEY)
      return res.status(503).json({ success: false, error: 'TTS non configuré.' });

    const elRes = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        text: cleanText,
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
    console.error('❌ [TTS proxy] error:', err.response?.status, detail);
    return res.status(502).json({ success: false, error: 'TTS indisponible.', detail });
  }
};

// ── Status ────────────────────────────────────────────────────────────────────
exports.status = (req, res) => {
  res.json({ success: true, provider: 'groq', models: GROQ_MODELS });
};