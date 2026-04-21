// backend/src/routes/aiRoutes.js
// ✅ Migration → Groq API (GRATUIT, 24h/24, ultra-rapide)
// Clé gratuite sur console.groq.com — pas de carte bancaire requise

const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const axios   = require('axios');
const Culture       = require('../models/Culture');
const Irrigation    = require('../models/Irrigation');
const Fertilisation = require('../models/Fertilisation');
const weatherService = require('../services/weatherService');

const JWT_SECRET   = process.env.JWT_SECRET   || 'default-secret-change-in-production';
const GROQ_API_KEY = process.env.GROQ_API_KEY; // ← Ajoute dans ton .env
const GROQ_MODEL   = 'llama-3.3-70b-versatile'; // Gratuit, multilingue, très bon

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token manquant.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.id) return res.status(403).json({ success: false, message: 'Accès refusé.' });
    req.userId   = decoded.id;
    req.userRole = decoded.role;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalide.' });
  }
}

// ── Détection langue ───────────────────────────────────────────────────────────
function detectMessageLanguage(text = '') {
  const tunisianWords = /\b(chneya|kifesh|barsha|bhi|mrigel|ya3tik|3andek|lazem|bech|taw|famma|hnaya|sahit|yezzi|mouch|wala|kifek|labas|nheb|ma3lich|haka|9addesh|9oulha|ween|mta3|elli|yelzem|tnajem|talbek|ena|inti|brabi|chkoun|chbik|nrou7|nlawej|shniya|fih|3lih|manha|ghadi|rahi|yaani|chahed|mar7ba|ahlen|yser|w9t|b3d|kbir|sghir|zwina|behi|mrigla|nfhem|tfhem|nkhou|baba|mama|khti|khoya)\b/gi;
  const arabicChars   = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const tunisianScore = (text.match(tunisianWords) || []).length;
  const hasLatinNums  = /\b\w*[379]\w*\b/.test(text);

  if (tunisianScore >= 1 || (arabicChars > 0 && hasLatinNums)) {
    return 'TUNISIAN_ARABIC — Respond ONLY in Tunisian Arabic dialect (دارجة تونسية). Use casual Tunisian words.';
  }
  if (arabicChars > 5) return 'MODERN_ARABIC — Respond in Modern Standard Arabic (فصحى).';
  if (/[şğüöçıİŞĞÜÖÇ]/i.test(text) ||
    /\b(merhaba|teşekkür|nasıl|tamam|evet|hayır|ne|bu|bir|var|yok|benim|senin|kültür|sulama|gübre|bitki|hava|tarih|sonraki|toplam|kaç|isim|isimler|listesi|kadar|değil)\b/i.test(text)
  ) return 'TURKISH — Respond in Turkish.';
  if (
    /[àâçéèêëîïôœùûü]/i.test(text) ||
    /\b(le|la|les|de|du|des|pour|avec|bonjour|salut|merci|comment|quand|pourquoi|oui|non|je|tu|nous|vous|est|bien|pas|mais|mon|ton|une|sur|dans|qui|que|si|aussi|très|votre|notre|faire|aller|eau|plante|culture|irrigation|météo|fertilisation|date|suivant)\b/i.test(text)
  ) return 'FRENCH — Respond in French.';
  if (
    /\b(the|is|are|and|for|with|your|you|this|have|will|hello|hi|how|what|when|why|yes|no|ok|please|thanks|help|need|want|my|can|crop|plant|water|weather|irrigation|farm|soil|harvest|next|date)\b/i.test(text)
  ) return 'ENGLISH — Respond in English.';

  return 'TUNISIAN_ARABIC — Default. Respond in Tunisian Arabic (دارجة).';
}

// ── Live weather (cache 30 min) ───────────────────────────────────────────────
async function getLiveWeather(city = 'Tunis') {
  try {
    const cached = await weatherService.getLatestWeather(city);
    if (cached) {
      const minutesDiff = (new Date() - new Date(cached.date)) / (1000 * 60);
      const et0Valid    = cached.et0 && cached.et0 > 0.1 && cached.et0 < 20;
      if (minutesDiff < 30 && et0Valid) return cached;
    }
    return await weatherService.saveWeatherData(city, null, null);
  } catch (err) {
    console.error('❌ [AI] getLiveWeather error:', err.message);
    return weatherService.getLatestWeather(city).catch(() => null);
  }
}

// ── Données FAO-56 fertilisation ──────────────────────────────────────────────
const FERT_FAO = {
  Orange:    [
    { jour:15, mois:1,  produit:'KNO₃',     doseParHa:'800 kg/ha' },
    { jour:15, mois:3,  produit:'Urée',      doseParHa:'200 kg/ha' },
    { jour:15, mois:5,  produit:'NPK',       doseParHa:'600 kg/ha' },
    { jour:15, mois:9,  produit:'K₂SO₄',    doseParHa:'400 kg/ha' },
  ],
  Citron:    [
    { jour:10, mois:2,  produit:'Urée',      doseParHa:'160 kg/ha' },
    { jour:10, mois:5,  produit:'NPK',       doseParHa:'480 kg/ha' },
    { jour:10, mois:10, produit:'K₂SO₄',    doseParHa:'320 kg/ha' },
  ],
  Mandarine: [
    { jour:12, mois:2,  produit:'Urée',      doseParHa:'160 kg/ha' },
    { jour:12, mois:5,  produit:'NPK',       doseParHa:'400 kg/ha' },
    { jour:12, mois:9,  produit:'K₂SO₄',    doseParHa:'280 kg/ha' },
  ],
  Tomate:    [
    { jour:5,  mois:3,  produit:'DAP',       doseParHa:'150 kg/ha' },
    { jour:5,  mois:4,  produit:'Urée',      doseParHa:'80 kg/ha'  },
    { jour:5,  mois:5,  produit:'NPK',       doseParHa:'200 kg/ha' },
    { jour:5,  mois:6,  produit:'Ca(NO₃)₂', doseParHa:'100 kg/ha' },
  ],
  Blé:       [
    { jour:1,  mois:11, produit:'DAP',       doseParHa:'120 kg/ha' },
    { jour:1,  mois:2,  produit:'Urée x1',   doseParHa:'100 kg/ha' },
    { jour:1,  mois:3,  produit:'Urée x2',   doseParHa:'80 kg/ha'  },
  ],
  Olivier:   [
    { jour:20, mois:2,  produit:'Urée',      doseParHa:'60 kg/ha'  },
    { jour:20, mois:5,  produit:'NPK',       doseParHa:'160 kg/ha' },
    { jour:20, mois:8,  produit:'K₂SO₄',    doseParHa:'100 kg/ha' },
  ],
  Pomme:     [
    { jour:10, mois:2,  produit:'Urée',      doseParHa:'200 kg/ha' },
    { jour:10, mois:4,  produit:'NPK',       doseParHa:'500 kg/ha' },
    { jour:10, mois:7,  produit:'K₂SO₄',    doseParHa:'400 kg/ha' },
  ],
  _default:  [
    { jour:15, mois:3,  produit:'NPK',       doseParHa:'100 kg/ha' },
    { jour:15, mois:7,  produit:'K₂SO₄',    doseParHa:'60 kg/ha'  },
  ],
};

function getFAOFertData(nom) {
  if (!nom) return FERT_FAO._default;
  const key = Object.keys(FERT_FAO).find(
    k => k !== '_default' && nom.toLowerCase().includes(k.toLowerCase())
  );
  return key ? FERT_FAO[key] : FERT_FAO._default;
}

function getNextFAOFertDate(nom) {
  const events = getFAOFertData(nom);
  const now    = new Date();
  const year   = now.getFullYear();
  const dates  = [];
  for (const ev of events) {
    dates.push({ date: new Date(year,     ev.mois - 1, ev.jour), produit: ev.produit, dose: ev.doseParHa });
    dates.push({ date: new Date(year + 1, ev.mois - 1, ev.jour), produit: ev.produit, dose: ev.doseParHa });
  }
  dates.sort((a, b) => a.date - b.date);
  return dates.find(d => d.date >= now) || dates[dates.length - 1];
}

function formatDate(date) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function joursLabel(prochaineDate) {
  if (!prochaineDate) return null;
  const diff = Math.ceil((new Date(prochaineDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (diff > 0)   return `dans ${diff} jour(s)`;
  if (diff === 0) return "aujourd'hui";
  return `en retard de ${Math.abs(diff)} jour(s)`;
}

// ── Build user context ────────────────────────────────────────────────────────
async function buildUserContext(userId, userCity = 'Tunis') {
  try {
    const cultures   = await Culture.find({ userId }).sort({ createdAt: -1 });
    const cultureIds = cultures.map(c => c._id);

    const irrigations = await Irrigation.find({ cultureId: { $in: cultureIds } })
      .sort({ date: -1 }).limit(20).populate('cultureId', 'nom variete');

    const lastIrrigByCulture = {};
    for (const irr of irrigations) {
      const cid = irr.cultureId?._id?.toString();
      if (cid && !lastIrrigByCulture[cid]) lastIrrigByCulture[cid] = irr;
    }

    const fertilisations = await Fertilisation.find({ cultureId: { $in: cultureIds } })
      .sort({ date: -1 }).limit(20).populate('cultureId', 'nom variete');

    const lastFertByCulture = {};
    for (const f of fertilisations) {
      const cid = f.cultureId?._id?.toString();
      if (cid && !lastFertByCulture[cid]) lastFertByCulture[cid] = f;
    }

    const weather = await getLiveWeather(userCity);

    const cropsSummary = cultures.length === 0
      ? 'Aucune culture enregistrée.'
      : cultures.map((c, i) => {
          const surface = c.surface      ? `${c.surface} m²`          : 'surface inconnue';
          const kc      = c.kcActuel     ? `Kc=${c.kcActuel}`         : '';
          const stade   = c.stadeActuel  ? `Stade: ${c.stadeActuel}`  : '';
          const arbres  = c.nombreArbres ? `${c.nombreArbres} arbres` : '';
          return `${i + 1}. ${c.nom} (${c.variete}) — ${surface} ${arbres} ${kc} ${stade}`.trim();
        }).join('\n');

    const irrigationSummary = irrigations.length === 0
      ? 'Aucune irrigation récente.'
      : irrigations.slice(0, 5).map(irr => {
          const name = irr.cultureId?.nom || 'Culture inconnue';
          const date = new Date(irr.date).toLocaleDateString('fr-FR');
          return `• ${name}: ${irr.volume} L le ${date} (ETc: ${irr.etc} mm/j, Mode: ${irr.mode}, Kc: ${irr.kc})`;
        }).join('\n');

    const irrigationNeeds = cultures.length > 0 && weather?.et0
      ? cultures.map(c => {
          if (!c.kcActuel || !weather.et0) return null;
          const etc    = (weather.et0 * c.kcActuel).toFixed(2);
          const volume = c.surface > 0 ? ((parseFloat(etc) * c.surface) / 1000).toFixed(2) : null;
          return `• ${c.nom}: ETc=${etc} mm/j${volume ? ` → Volume recommandé: ${volume} m³/j` : ''}`;
        }).filter(Boolean).join('\n')
      : 'Calcul ETc non disponible (météo manquante).';

    const nextIrrigLines = cultures.length === 0
      ? 'Aucune culture enregistrée.'
      : cultures.map(c => {
          const cid  = c._id.toString();
          const last = lastIrrigByCulture[cid];
          if (!last) return `• ${c.nom} (${c.variete}): aucune irrigation enregistrée`;
          if (last.prochaineDate)
            return `• ${c.nom} (${c.variete}): prochaine irrigation le ${formatDate(last.prochaineDate)} [${joursLabel(last.prochaineDate)}]` +
                   (last.frequenceJours ? ` — fréquence: ${last.frequenceJours} jours` : '');
          if (last.frequenceJours > 0) {
            const next = new Date(new Date(last.date).getTime() + last.frequenceJours * 86400000);
            return `• ${c.nom} (${c.variete}): prochaine irrigation estimée le ${formatDate(next)} [${joursLabel(next)}] — fréquence: ${last.frequenceJours} jours`;
          }
          return `• ${c.nom} (${c.variete}): dernière irrigation le ${formatDate(last.date)} — fréquence non définie`;
        }).join('\n');

    const nextFertLines = cultures.length === 0
      ? 'Aucune culture enregistrée.'
      : cultures.map(c => {
          const cid  = c._id.toString();
          const last = lastFertByCulture[cid];
          if (last?.prochaineDate)
            return `• ${c.nom} (${c.variete}): prochaine fertilisation le ${formatDate(last.prochaineDate)} [${joursLabel(last.prochaineDate)}] — produit: ${last.produit} (${last.typeProduit})` +
                   (last.frequenceJours ? ` — fréquence: ${last.frequenceJours} jours` : '');
          if (last?.frequenceJours > 0) {
            const next = new Date(new Date(last.date).getTime() + last.frequenceJours * 86400000);
            return `• ${c.nom} (${c.variete}): prochaine fertilisation estimée le ${formatDate(next)} [${joursLabel(next)}] — produit: ${last.produit} (${last.typeProduit}) — fréquence: ${last.frequenceJours} jours`;
          }
          const fao   = getNextFAOFertDate(c.nom);
          const label = last ? `dernière fertilisation: ${formatDate(last.date)} — ` : 'aucune fertilisation en base — ';
          return fao
            ? `• ${c.nom} (${c.variete}): ${label}prochaine FAO-56: ${formatDate(fao.date)} [${joursLabel(fao.date)}] — produit: ${fao.produit} (${fao.dose})`
            : `• ${c.nom} (${c.variete}): aucune donnée de fertilisation`;
        }).join('\n');

    const weatherSummary = weather
      ? [
          `Ville: ${weather.location?.city || userCity}`,
          `Température: ${weather.temperature?.current}°C (min ${weather.temperature?.min}°C / max ${weather.temperature?.max}°C)`,
          `Humidité: ${weather.humidity?.current}%`,
          `Vent: ${weather.wind?.speed} m/s`,
          `ET₀: ${weather.et0} mm/j`,
          `Conditions: ${weather.description || 'N/A'}`,
          `MAJ: ${new Date(weather.date).toLocaleTimeString('fr-FR')}`,
        ].join(' | ')
      : 'Données météo non disponibles.';

    return { cropCount: cultures.length, cropsSummary, irrigationSummary, irrigationNeeds, nextIrrigLines, nextFertLines, weatherSummary, city: userCity };

  } catch (error) {
    console.error('❌ Error building user context:', error.message);
    return {
      cropCount: 0,
      cropsSummary: 'Impossible de charger les cultures.',
      irrigationSummary: 'Impossible de charger les irrigations.',
      irrigationNeeds: 'Calcul non disponible.',
      nextIrrigLines: 'Données non disponibles.',
      nextFertLines: 'Données non disponibles.',
      weatherSummary: 'Météo non disponible.',
      city: userCity,
    };
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are SmartIrrig AI, a smart irrigation assistant embedded in the SmartIrrig mobile app.

## RESPONSE STYLE — CRITICAL
- Be SHORT and DIRECT. Max 3-4 lines per answer.
- No long explanations unless asked.
- Use bullet points only when listing multiple items.
- Never repeat what the user said.
- Be professional but friendly.

## LANGUAGES — ABSOLUTE RULE ⚠️
You MUST ALWAYS respond in the EXACT language specified in [LANGUE DÉTECTÉE — OBLIGATOIRE]. This overrides everything else. NEVER respond in French if the label says ENGLISH or TURKISH or ARABIC.

Language rules:
- TUNISIAN_ARABIC → respond ONLY in Tunisian Arabic dialect (دارجة تونسية), casual tone
- MODERN_ARABIC → respond ONLY in Modern Standard Arabic (فصحى)
- FRENCH → respond ONLY in French
- ENGLISH → respond ONLY in English
- TURKISH → respond ONLY in Turkish (e.g. "Toplam 6 ürününüz var.")

CRITICAL: Tunisian dialect uses Latin letters + numbers: "3andek"=عندك, "9oulha"=قولها, "kifesh"=كيفاش. Detect these as Tunisian Arabic.
Default for Arabic voice input: Tunisian Arabic (دارجة).

## YOUR CAPABILITIES
You have access to real user data in [CONTEXTE UTILISATEUR]:
- Their crops (name, variety, surface, Kc, growth stage)
- Irrigation history (volume, date, mode, ETc)
- Calculated water needs (ETc = ET₀ × Kc)
- Live weather (temperature, humidity, wind, ET₀)

## RULES
- Use ONLY data from [CONTEXTE UTILISATEUR] — never invent numbers.
- If data is missing, say so in one sentence.
- For water calculations: use the ETc values already computed in the context.
- For next irrigation/fertilisation date: answer directly "La prochaine irrigation est le [date]" using context data only.
- Always answer in the user's language.

## ARABIC TEXT-TO-SPEECH — CRITICAL
When responding in ANY Arabic dialect (Tunisian دارجة or Modern Standard فصحى):
- Write Arabic text naturally WITHOUT diacritics (no tashkeel/harakat).
- Keep the text simple and readable.

## NAVIGATION IN APP
Add a 📍 path ONLY when the user explicitly asks WHERE or HOW TO DO something in the app (e.g. "win...", "comment faire...", "how do I...").
NEVER add a navigation path for greetings, agricultural questions, or general answers. A "salut" or "bonjour" must NEVER trigger a path.

Navigation map (use only when relevant):
- Change name/profile → 📍 Menu ☰ > Profil > ✏️
- Add a crop → 📍 Cultures > +
- View irrigation history → 📍 Historique
- Water needs → 📍 Irrigation
- Weather → 📍 Accueil
- Fertilisation → 📍 Fertilisation
- Contact/support → 📍 Contact`;


// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
router.post('/chat', requireUser, async (req, res) => {
  try {
    const { message, conversation_id, conversationHistory, city } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: 'Message requis.' });
    }
    if (!GROQ_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'GROQ_API_KEY non configuré. Créez une clé gratuite sur console.groq.com et ajoutez-la dans votre .env',
      });
    }

    const context  = await buildUserContext(req.userId, city || 'Tunis');
    const langHint = detectMessageLanguage(message.trim());

    // Contexte injecté au 1er message, langue injectée à CHAQUE message
    const history = Array.isArray(conversationHistory) ? conversationHistory : [];
    const userContent = history.length === 0
      ? `[CONTEXTE UTILISATEUR]
Cultures (${context.cropCount}): ${context.cropsSummary}
Irrigation récente: ${context.irrigationSummary}
Besoins ETc: ${context.irrigationNeeds}
Prochaines irrigations: ${context.nextIrrigLines}
Prochaines fertilisations: ${context.nextFertLines}
Météo à ${context.city}: ${context.weatherSummary}

[LANGUE DÉTECTÉE — OBLIGATOIRE]
${langHint}

[MESSAGE]
${message.trim()}`
      : `[LANGUE DÉTECTÉE — OBLIGATOIRE]\n${langHint}\n\n[MESSAGE]\n${message.trim()}`;

    const messages = [
      ...history,
      { role: 'user', content: userContent },
    ];

    // ── Appel Groq API (compatible OpenAI) ────────────────────────────────
    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model:       GROQ_MODEL,
        messages:    [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens:  1024,
        temperature: 0.6,
      },
      {
        headers: {
          Authorization:  `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const answer = groqResponse.data.choices?.[0]?.message?.content || '';

    const updatedHistory = [
      ...messages,
      { role: 'assistant', content: answer },
    ];

    return res.json({
      success:             true,
      answer,
      conversation_id:     conversation_id || groqResponse.data.id,
      conversationHistory: updatedHistory,
      context: {
        cropCount: context.cropCount,
        city:      context.city,
      },
    });

  } catch (error) {
    console.error('❌ AI Chat error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(500).json({ success: false, error: 'Clé GROQ_API_KEY invalide.' });
    }
    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error:   'rate_limit',
        message: 'Trop de requêtes simultanées. Réessayez dans quelques secondes.',
      });
    }
    return res.status(500).json({ success: false, error: 'Service IA temporairement indisponible. Réessayez.' });
  }
});

// ── GET /api/ai/status ────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    success:    true,
    configured: !!GROQ_API_KEY,
    model:      GROQ_MODEL,
    provider:   'Groq (gratuit, 24h/24)',
  });
});

// ── POST /api/ai/tts — Proxy ElevenLabs ──────────────────────────────────────
const ELEVENLABS_API_KEY  = process.env.ELEVENLABS_API_KEY  || 'sk_fd88b305d46cb875bc5570685561f801fd04e343eb2ad874';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'cgSgspJ2msm6clMCkdW9';

router.post('/tts', requireUser, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Texte requis.' });

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
    console.error('❌ [TTS proxy] ElevenLabs error:', err.response?.status, err.message);
    return res.status(502).json({ success: false, error: 'TTS indisponible.' });
  }
});

module.exports = router;