// src/services/aiService.js
const axios          = require('axios');
const Culture        = require('../models/Culture');
const Irrigation     = require('../models/Irrigation');
const Fertilisation  = require('../models/Fertilisation');
const weatherService = require('./weatherService');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE    = 'https://api.groq.com/openai/v1';
const GROQ_MODELS  = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

// ── Langue ────────────────────────────────────────────────────────────────────
function detectMessageLanguage(text = '') {
  const arabicChars    = (text.match(/[؀-ۿ]/g) || []).length;
  const hasNumLetters  = /\b\w*[379]\w*\b/.test(text);
  const tunisianWords  = /\b(chneya|kifesh|barsha|bhi|mrigel|ya3tik|3andek|3andi|3andha|3andhu|lazem|bech|bch|taw|famma|hnaya|sahit|yezzi|mouch|wala|kifek|labas|nheb|ma3lich|haka|9addesh|9adh|9oulha|9abel|ween|mta3|elli|yelzem|tnajem|talbek|ena|inti|brabi|chkoun|chbik|nrou7|nlawej|shniya|fih|3lih|manha|ghadi|rahi|yaani|chahed|mar7ba|ahlen|yser|w9t|b3d|kbir|sghir|zwina|behi|mrigla|nfhem|tfhem|nkhou|baba|mama|khti|khoya|7abs|7aja|7ajet|ki|wach|mich|nit|jit|besh|ma3ndich|t3abt|fehmt|mn|weld|bnet|rjel|mra)\b/gi;
  const tunisianScore  = (text.match(tunisianWords) || []).length;

  if (arabicChars > 3 && !hasNumLetters && tunisianScore === 0)
    return 'MODERN_ARABIC — Respond ONLY in Modern Standard Arabic (فصحى) using Arabic script (عربي). Never use Latin transliteration.';
  if (tunisianScore >= 1 || hasNumLetters)
    return 'TUNISIAN_ARABIC — Respond ONLY in Tunisian Arabic dialect (دارجة تونسية). Write using ARABIC LETTERS (عربي) — never Latin transliteration like "3andek". Example: write "عندك" not "3andek".';
  if (arabicChars > 0)
    return 'MODERN_ARABIC — Respond in Modern Standard Arabic (فصحى) using Arabic script.';
  if (/[şğüöçıİŞĞÜÖÇ]/i.test(text) || /\b(merhaba|teşekkür|nasıl|tamam|evet|hayır|ne|bu|bir|var|yok|benim|senin|kültür|sulama|gübre|bitki|hava|tarih|sonraki|toplam|kaç|isim|isimler|listesi|kadar|değil)\b/i.test(text))
    return 'TURKISH — Respond in Turkish.';
  if (/[àâçéèêëîïôœùûü]/i.test(text) || /\b(le|la|les|de|du|des|pour|avec|bonjour|salut|merci|comment|quand|pourquoi|oui|non|je|tu|nous|vous|est|bien|pas|mais|mon|ton|une|sur|dans|qui|que|si|aussi|très|votre|notre|faire|aller|eau|plante|culture|irrigation|météo|fertilisation|date|suivant)\b/i.test(text))
    return 'FRENCH — Respond in French.';
  if (/\b(the|is|are|and|for|with|your|you|this|have|will|hello|hi|how|what|when|why|yes|no|ok|please|thanks|help|need|want|my|can|crop|plant|water|weather|irrigation|farm|soil|harvest|next|date)\b/i.test(text))
    return 'ENGLISH — Respond in English.';
  return 'TUNISIAN_ARABIC — Default. Respond in Tunisian Arabic dialect (دارجة) using Arabic script.';
}

// ── Météo (cache 30 min) ──────────────────────────────────────────────────────
async function getLiveWeather(city = 'Tunis') {
  try {
    const cached = await weatherService.getLatestWeather(city);
    if (cached) {
      const mins = (new Date() - new Date(cached.date)) / 60000;
      if (mins < 30 && cached.et0 > 0.1 && cached.et0 < 20) return cached;
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
  const key = Object.keys(FERT_FAO).find(k => k !== '_default' && nom.toLowerCase().includes(k.toLowerCase()));
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeNumerals(text) {
  const map = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  return text.replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => map[d] || d);
}

function formatDate(date) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function joursLabel(prochaineDate) {
  if (!prochaineDate) return null;
  const diff = Math.ceil((new Date(prochaineDate) - new Date()) / 86400000);
  if (diff > 0)   return `dans ${diff} jour(s)`;
  if (diff === 0) return "aujourd'hui";
  return `en retard de ${Math.abs(diff)} jour(s)`;
}

// ── Contexte utilisateur ──────────────────────────────────────────────────────
async function buildUserContext(userId, userCity = 'Tunis', irrigationOverrides = {}) {
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
          const etc       = (weather.et0 * c.kcActuel).toFixed(2);
          const cid       = c._id.toString();
          const lastIrr   = lastIrrigByCulture[cid];
          const mode      = lastIrr?.mode || 'goutte-à-goutte';
          const effMap    = [['goutte', 0.9], ['aspersion', 0.7], ['gravitaire', 0.6]];
          const eff       = effMap.find(([k]) => mode.toLowerCase().includes(k))?.[1] ?? 0.9;
          const effPct    = Math.round(eff * 100);
          const volumeM3  = c.surface > 0 ? ((parseFloat(etc) * c.surface) / 1000 / eff).toFixed(2) : null;
          const volumeHa  = (parseFloat(etc) * 10 / eff).toFixed(1);
          const soilPart  = c.typeSol ? ` | Sol: ${c.typeSol}` : '';
          return `• ${c.nom} (${c.variete}): ET₀=${weather.et0} mm/j × Kc=${c.kcActuel} = ETc=${etc} mm/j${volumeM3 ? ` → Volume: ${volumeM3} m³/j (${c.surface} m²)` : ''} | ${volumeHa} m³/ha/j | Mode: ${mode} η=${effPct}%${soilPart}`;
        }).filter(Boolean).join('\n')
      : 'Calcul ETc non disponible (météo manquante).';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextIrrigLines = cultures.length === 0
      ? 'Aucune culture enregistrée.'
      : cultures.map(c => {
          const cid  = c._id.toString();
          const last = lastIrrigByCulture[cid];
          const overrideDate = irrigationOverrides[c.nom.toLowerCase().trim()]
                            || irrigationOverrides[cid];

          // Raw candidate date (override > stored prochaineDate)
          let rawDate = overrideDate
            ? new Date(overrideDate)
            : last?.prochaineDate ? new Date(last.prochaineDate) : null;

          // ⚠️ If the stored prochaineDate is in the past, recompute from last
          // irrigation date + frequency so the AI never surfaces a stale date.
          if (rawDate && rawDate < today && last?.frequenceJours > 0) {
            const lastDate = new Date(last.date);
            // Advance by multiples of frequency until we reach a future date
            const freq = last.frequenceJours * 86400000;
            const diff = today - lastDate;
            const cycles = Math.ceil(diff / freq);
            rawDate = new Date(lastDate.getTime() + cycles * freq);
          }

          if (!last && !overrideDate) return `• ${c.nom} (${c.variete}): aucune irrigation enregistrée`;
          if (rawDate && rawDate >= today)
            return `• ${c.nom} (${c.variete}): prochaine irrigation le ${formatDate(rawDate)} [${joursLabel(rawDate)}]` +
                   (last?.frequenceJours ? ` — fréquence: ${last.frequenceJours} jours` : '');
          if (last?.frequenceJours > 0) {
            const lastDate = new Date(last.date);
            const freq     = last.frequenceJours * 86400000;
            const diff     = today - lastDate;
            const cycles   = Math.ceil(diff / freq);
            const next     = new Date(lastDate.getTime() + cycles * freq);
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
      ? [`Ville: ${weather.location?.city || userCity}`,
          `Température: ${weather.temperature?.current}°C (min ${weather.temperature?.min}°C / max ${weather.temperature?.max}°C)`,
          `Humidité: ${weather.humidity?.current}%`, `Vent: ${weather.wind?.speed} m/s`,
          `ET₀: ${weather.et0} mm/j`, `Conditions: ${weather.description || 'N/A'}`,
          `MAJ: ${new Date(weather.date).toLocaleTimeString('fr-FR')}`,
        ].join(' | ')
      : 'Données météo non disponibles.';

    return { cropCount: cultures.length, cropsSummary, irrigationSummary, irrigationNeeds, nextIrrigLines, nextFertLines, weatherSummary, city: userCity };
  } catch (error) {
    console.error('❌ Error building user context:', error.message);
    return { cropCount: 0, cropsSummary: 'Impossible de charger les cultures.', irrigationSummary: 'Impossible de charger les irrigations.', irrigationNeeds: 'Calcul non disponible.', nextIrrigLines: 'Données non disponibles.', nextFertLines: 'Données non disponibles.', weatherSummary: 'Météo non disponible.', city: userCity };
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are SmartIrrig AI — an expert agricultural assistant specialised in FAO-56 irrigation scheduling, soil-water balance, and crop nutrition. You are embedded inside the SmartIrrig mobile app used by Tunisian farmers.

════════════════════════════════════════
  1. IDENTITY & EXPERTISE
════════════════════════════════════════
You have deep knowledge of:
- FAO-56 Penman-Monteith method (ET₀, ETc = ET₀ × Kc)
- Soil water balance (RU, RFU, θCC, θPF, Saxton-Rawls model)
- Irrigation scheduling (dose, frequency, volume, duration)
- Crop phenological stages and Kc curves (initial → mid → end)
- Fertilisation programmes (N, P, K timing by crop and stage)
- Drip / sprinkler / gravity irrigation efficiency (90% / 70% / 60%)
- Tunisian climate, crops (orange, olive, tomato, wheat, etc.)

════════════════════════════════════════
  1b. GREETINGS — STRICT RULE ⚠️
════════════════════════════════════════
If the user message is ONLY a greeting with NO agricultural question
(e.g. bonjour, bonsoir, salam, salut, hello, hi, hey, cava, winek, labas,
mar7ba, ahlen, مرحبا, أهلا, سلام, صباح الخير, مساء الخير, merhaba, selam):
- Reply ONLY with a short warm greeting and ask how you can help.
- DO NOT mention crops count, irrigation dates, fertilisation, or weather.
- FORBIDDEN: referencing any context data in a greeting reply.
- Example FR : "Bonjour ! 👋 Comment puis-je vous aider ?"
- Example AR : "!أهلاً 👋 كيفاش نعاونك اليوم؟"
- Example EN : "Hello! 👋 How can I help you today?"
- Example TR : "Merhaba! 👋 Bugün size nasıl yardımcı olabilirim?"

════════════════════════════════════════
  2. RESPONSE FORMAT — STRICT RULES
════════════════════════════════════════
RULE A — LENGTH:
- Simple factual question (count, date, value) → 1 sentence, no list.
- Question requiring explanation → 2–3 sentences max.
- Explicit request for a list or plan → bullet list, max 5 items.
- NEVER write more than needed. No padding, no filler.

RULE B — TONE:
- Direct, professional, zero filler words.
- FORBIDDEN: "Bien sûr !", "Voici", "Certainement", "Je suis là pour vous aider", "En tant qu'assistant".
- Start the answer immediately with the relevant information.

RULE C — NUMBERS:
- Always use digits (2, 3.5, 120) never words (deux, ثلاثة).
- Always include units: mm/j, m³, L, kg/ha, °C, %.
- Round to 2 decimal places for ETc/ET₀, 0 decimals for volumes.

RULE D — CROP REFERENCES:
- Always name the crop when answering about irrigation, ETc, fertilisation, or Kc.
- Example: "L'orange a besoin de 18 L/j." not "Votre culture a besoin de 18 L/j."

RULE E — LISTS:
- Use a bullet list ONLY when the user explicitly asks for names, details, or a programme.
- For "how many" questions → single sentence with digit only.

════════════════════════════════════════
  3. LANGUAGE — NON-NEGOTIABLE ⚠️
════════════════════════════════════════
Respond EXCLUSIVELY in the language specified in [LANGUE DÉTECTÉE].
Never mix languages in one response.

- TUNISIAN_ARABIC → دارجة تونسية casual. Write in Arabic script ONLY. Never use Latin (3andek, bch, etc.).
- MODERN_ARABIC   → فصحى formal. Arabic script only.
- FRENCH          → Français standard.
- ENGLISH         → Standard English.
- TURKISH         → Türkçe standard.

Arabic vocabulary rules (دارجة + فصحى):
- Crop count: "عندك X محاصيل" — NEVER "ثقافتين / ثقافتان / اثنتان".
- "محصول / محاصيل" only — NEVER "ثقافة / ثقافات".
- Numbers always as digits: 2، 3 — NEVER as words.

════════════════════════════════════════
  4. DATA USAGE — ACCURACY RULES ⚠️
════════════════════════════════════════
- Use ONLY values from [CONTEXTE UTILISATEUR]. NEVER invent, estimate, or hallucinate.
- If a value is missing: say so in one sentence and suggest where to add it in the app.
- If ET₀ is 0 or unavailable: say "ET₀ indisponible actuellement" and do not compute ETc.
- If no crops registered: say so and guide user to add one (📍 Cultures > +).
- Dates: always format as "lundi 5 mai 2026" (full weekday + day + month + year).
- ⚠️ PAST DATES FORBIDDEN: If a "prochaine irrigation" or "prochaine fertilisation" date
  is BEFORE today's date, DO NOT cite it. Instead say the date has passed and the user
  should record a new irrigation (📍 Irrigation > Enregistrer) to recalculate.

════════════════════════════════════════
  5. AGRONOMIC REASONING
════════════════════════════════════════
When the user asks for advice (not just a value), apply this reasoning:
1. Read ETc and RFU from context to determine urgency.
2. Compare last irrigation date vs. recommended frequency.
3. Factor in soil type (sandy soils need more frequent irrigation).
4. Factor in crop stage (mid-season has highest Kc, needs most water).
5. Give ONE clear recommendation with the key number (volume or date).

Irrigation urgency levels (use when relevant):
- URGENT: last irrigation > frequency days → "Irrigation requise aujourd'hui."
- NORMAL: within schedule → give next date.
- EXCESS: irrigated recently → "Pas d'irrigation nécessaire avant [date]."

Fertilisation advice logic:
- Check next FAO-56 application date from context.
- Specify product, dose, and application mode.
- Warn if overdue (joursLabel contains "retard").

════════════════════════════════════════
  6. TRANSLATION REQUESTS
════════════════════════════════════════
If the user says "en arabe", "in English", "بالفرنسية", "translate", "répète en français",
"بالعربي", "in Arabic", "Türkçe söyle" or any equivalent:
- Re-state your PREVIOUS answer translated into the requested language.
- Do NOT answer a new question. Do NOT add new information.
- Keep the same content, just change the language.
- Example:
  User: "prochaine date de irrigation de tomate"
  You:  "La prochaine irrigation de la tomate est le mercredi 6 mai 2026."
  User: "en arabe"
  You:  "الري القادم للطماطم هو يوم الأربعاء 6 ماي 2026."

════════════════════════════════════════
  7. APP NAVIGATION
════════════════════════════════════════
Add a 📍 path ONLY when the user asks WHERE or HOW TO DO something.

- Add / view crops        → 📍 Cultures > +
- Record irrigation       → 📍 Irrigation > Enregistrer
- View irrigation history → 📍 Irrigation > Historique
- Fertilisation calendar  → 📍 Fertilisation
- Live weather / ET₀      → 📍 Accueil
- Edit profile            → 📍 Menu ☰ > Profil > ✏️
- Contact admin           → 📍 Contact

════════════════════════════════════════
  8. EXAMPLES — CORRECT vs WRONG
════════════════════════════════════════
Q: "bonjour"
✅ "Bonjour ! 👋 Comment puis-je vous aider ?"
❌ "Vous avez 2 cultures. La prochaine irrigation..."

Q: "أهلا"
✅ "!أهلاً 👋 كيفاش نعاونك اليوم؟"
❌ "عندك 2 محاصيل..."

Q: "9adh 3andi mn culture?"
✅ "عندك 3 محاصيل."
❌ "عندك ثقافتين هما البرتقال والتوم."

Q: "Quand irriguer mon orange ?"
✅ "La prochaine irrigation de l'orange est le jeudi 8 mai 2026 (dans 2 jours)."
❌ "Bien sûr ! Voici les informations concernant l'irrigation de votre culture d'orange..."

Q: "Combien d'eau pour ma tomate ?"
✅ "La tomate nécessite 12 L/j (ETc = 4.2 mm/j × 3 m²)."
❌ "En tant qu'assistant agricole, je vais vous expliquer le calcul ETc..."

Q: "What is ETc for my wheat ?"
✅ "Wheat ETc = 3.8 mm/day (ET₀ 5.1 × Kc 0.75)."
❌ "The ETc value is calculated using the FAO-56 formula ETc = ET₀ × Kc, where..."`;

// ── Groq call with model cascade ──────────────────────────────────────────────
async function callGroq(userMessage, context, langHint, history = []) {
  const contextBlock = `════════════════════════════════════════
[CONTEXTE UTILISATEUR — DONNÉES RÉELLES]
════════════════════════════════════════
DATE AUJOURD'HUI : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
Cultures (${context.cropCount}): ${context.cropsSummary}
Irrigation récente   : ${context.irrigationSummary}
Besoins ETc          : ${context.irrigationNeeds}
Prochaines irrigations:
${context.nextIrrigLines}
Prochaines fertilisations:
${context.nextFertLines}
Météo à ${context.city}: ${context.weatherSummary}
════════════════════════════════════════`;

  // Sanitize and cap history to last 6 messages (3 exchanges)
  const historyMessages = (Array.isArray(history) ? history : [])
    .slice(-6)
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim() }));

  const body = {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + '\n\n' + contextBlock },
      ...historyMessages,
      { role: 'user',   content: `[LANGUE DÉTECTÉE — RÉPONDRE UNIQUEMENT DANS CETTE LANGUE]\n${langHint}\n\n[RÈGLE ARABIC — RAPPEL CRITIQUE]\nSi question sur le nombre de محاصيل/cultures → UNIQUEMENT "عندك X محاصيل". INTERDIT: ثقافتين / lister les noms.\n\n[MESSAGE UTILISATEUR]\n${userMessage}` },
    ],
    max_tokens: 300,
    temperature: 0.15,
  };

  let lastErr;
  for (const model of GROQ_MODELS) {
    try {
      const response = await axios.post(
        `${GROQ_BASE}/chat/completions`,
        { ...body, model },
        { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
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

module.exports = { detectMessageLanguage, buildUserContext, callGroq, normalizeNumerals };