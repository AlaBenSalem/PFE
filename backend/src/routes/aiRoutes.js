// backend/src/routes/aiRoutes.js — SmartIrrig AI (Groq primary, 24/7)

const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const axios   = require('axios');
const Culture       = require('../models/Culture');
const Irrigation    = require('../models/Irrigation');
const Fertilisation = require('../models/Fertilisation');
const weatherService = require('../services/weatherService');

const JWT_SECRET   = process.env.JWT_SECRET   || 'default-secret-change-in-production';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
const GROQ_BASE    = 'https://api.groq.com/openai/v1';

// Two-model cascade: high quality → fast fallback (higher token/min limit)
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

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
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;

  // 3=ع  7=ح  9=ق used as letters in Latin-script Tunisian darija
  const hasNumLetters = /\b\w*[379]\w*\b/.test(text);

  const tunisianWords = /\b(chneya|kifesh|barsha|bhi|mrigel|ya3tik|3andek|3andi|3andha|3andhu|lazem|bech|bch|taw|famma|hnaya|sahit|yezzi|mouch|wala|kifek|labas|nheb|ma3lich|haka|9addesh|9adh|9oulha|9abel|ween|mta3|elli|yelzem|tnajem|talbek|ena|inti|brabi|chkoun|chbik|nrou7|nlawej|shniya|fih|3lih|manha|ghadi|rahi|yaani|chahed|mar7ba|ahlen|yser|w9t|b3d|kbir|sghir|zwina|behi|mrigla|nfhem|tfhem|nkhou|baba|mama|khti|khoya|7abs|7aja|7ajet|ki|wach|mich|nit|jit|besh|ma3ndich|t3abt|fehmt|mn|weld|bnet|rjel|mra)\b/gi;
  const tunisianScore = (text.match(tunisianWords) || []).length;

  if (arabicChars > 3 && !hasNumLetters && tunisianScore === 0) {
    return 'MODERN_ARABIC — Respond ONLY in Modern Standard Arabic (فصحى) using Arabic script (عربي). Never use Latin transliteration.';
  }
  if (tunisianScore >= 1 || hasNumLetters) {
    return 'TUNISIAN_ARABIC — Respond ONLY in Tunisian Arabic dialect (دارجة تونسية). Write using ARABIC LETTERS (عربي) — never Latin transliteration like "3andek". Example: write "عندك" not "3andek".';
  }
  if (arabicChars > 0) {
    return 'MODERN_ARABIC — Respond in Modern Standard Arabic (فصحى) using Arabic script.';
  }
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

  return 'TUNISIAN_ARABIC — Default. Respond in Tunisian Arabic dialect (دارجة) using Arabic script.';
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

// ── Normalise Arabic-Indic numerals → Western digits ─────────────────────────
function normalizeNumerals(text) {
  const map = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  return text.replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => map[d] || d);
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
      ? 'Aucune culture.'
      : cultures.map((c, i) => {
          const parts = [`${i + 1}. ${c.nom}`];
          if (c.variete)     parts.push(`(${c.variete})`);
          if (c.surface)     parts.push(`${c.surface}m²`);
          if (c.kcActuel)    parts.push(`Kc=${c.kcActuel}`);
          if (c.nombreArbres) parts.push(`${c.nombreArbres}arb`);
          return parts.join(' ');
        }).join(' | ');

    const irrigationSummary = irrigations.length === 0
      ? 'Aucune irrigation récente.'
      : irrigations.slice(0, 3).map(irr => {
          const name = irr.cultureId?.nom || '?';
          const date = new Date(irr.date).toLocaleDateString('fr-FR');
          return `${name}: ${irr.volume}L ${date} ETc=${irr.etc}`;
        }).join(' | ');

    const irrigationNeeds = cultures.length > 0 && weather?.et0
      ? cultures.map(c => {
          if (!c.kcActuel || !weather.et0) return null;
          const etc = (weather.et0 * c.kcActuel).toFixed(2);
          const cid = c._id.toString();
          const lastIrr = lastIrrigByCulture[cid];
          const mode = lastIrr?.mode || 'goutte-à-goutte';
          const effMap = [['goutte', 0.9], ['aspersion', 0.7], ['gravitaire', 0.6]];
          const eff = effMap.find(([k]) => mode.toLowerCase().includes(k))?.[1] ?? 0.9;
          const effPct = Math.round(eff * 100);
          const volumeM3 = c.surface > 0 ? ((parseFloat(etc) * c.surface) / 1000 / eff).toFixed(2) : null;
          const volumePerHa = (parseFloat(etc) * 10 / eff).toFixed(1);
          const soilPart = c.typeSol ? ` | Sol: ${c.typeSol}` : '';
          return `• ${c.nom} (${c.variete}): ET₀=${weather.et0} mm/j × Kc=${c.kcActuel} = ETc=${etc} mm/j${volumeM3 ? ` → Volume: ${volumeM3} m³/j (${c.surface} m²)` : ''} | ${volumePerHa} m³/ha/j | Mode: ${mode} η=${effPct}%${soilPart}`;
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

## RESPONSE STYLE — ABSOLUTE RULE
- Answer in ONE sentence maximum. No exceptions.
- Answer ONLY what was asked. Do not add extra details unless asked.
- Examples:
  • "Quel est le nombre de cultures ?" → "Vous avez 3 cultures."
  • "What are my crops?" → "Orange, Tomato, Wheat."
  • "كم عدد الثقافات؟" → "عندك 3 ثقافات."
- No greetings, no "bien sûr", no "voici", no filler words.
- Use a short list ONLY if the user explicitly asks for names/details.

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

## RULES — DATA ACCURACY ⚠️
- Use ONLY numbers from [CONTEXTE UTILISATEUR] — NEVER invent or estimate values.
- ETc, volume m³/j, volume m³/ha are already computed in the context — copy them exactly.
- If asked "combien de m³/ha": read the "X m³/ha/j" value from context and state it.
- If asked "kc": read "Kc=X" from context and state it.
- If data is missing say so in one short sentence.
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


// ── Groq call with model cascade (70b → 8b on rate limit) ───────────────────
async function callGroq(userMessage, context, langHint) {
  const contextBlock = `[CONTEXTE UTILISATEUR]
Cultures (${context.cropCount}): ${context.cropsSummary}
Irrigation récente: ${context.irrigationSummary}
Besoins ETc: ${context.irrigationNeeds}
Prochaines irrigations: ${context.nextIrrigLines}
Prochaines fertilisations: ${context.nextFertLines}
Météo à ${context.city}: ${context.weatherSummary}`;

  const body = {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + '\n\n' + contextBlock },
      { role: 'user',   content: `[LANGUE DÉTECTÉE — RÉPONDRE EN CETTE LANGUE]\n${langHint}\n\n[MESSAGE]\n${userMessage}` },
    ],
    max_tokens: 256,
    temperature: 0.1,
  };

  let lastErr;
  for (const model of GROQ_MODELS) {
    try {
      const response = await axios.post(
        `${GROQ_BASE}/chat/completions`,
        { ...body, model },
        {
          headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );
      return response.data.choices[0]?.message?.content?.trim() || '';
    } catch (err) {
      const status = err.response?.status;
      lastErr = err;
      if (status === 429 || status === 503) {
        console.warn(`⚠️ Groq ${model} rate-limited (${status}), trying next model`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
router.post('/chat', requireUser, async (req, res) => {
  const { message, city } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ success: false, error: 'Message requis.' });
  }

  try {
    const context  = await buildUserContext(req.userId, city || 'Tunis');
    const langHint = detectMessageLanguage(message.trim());
    const answer   = await callGroq(message.trim(), context, langHint);

    return res.json({
      success:        true,
      answer:         normalizeNumerals(answer),
      conversationId: '',
      context:        { cropCount: context.cropCount, city: context.city },
      provider:       'groq',
    });
  } catch (error) {
    console.error('❌ Groq error:', error.response?.data || error.message);
    return res.status(503).json({ success: false, error: 'service_overloaded' });
  }
});

// ── GET /api/ai/status ────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    success:  true,
    provider: 'groq',
    models:   GROQ_MODELS,
  });
});

// ── POST /api/ai/tts — Proxy ElevenLabs ──────────────────────────────────────
const ELEVENLABS_API_KEY  = process.env.ELEVENLABS_API_KEY  || 'sk_fd88b305d46cb875bc5570685561f801fd04e343eb2ad874';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pCKbQ4EPGE06zpEPGNvS';

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