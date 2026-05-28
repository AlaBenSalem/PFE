// src/services/aiService.js
const axios          = require('axios');
const Culture        = require('../models/Culture');
const Irrigation     = require('../models/Irrigation');
const Fertilisation  = require('../models/Fertilisation');
const weatherService = require('./weatherService');
const { getKcForCultureAndMonth } = require('../controllers/kcController');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE    = 'https://api.groq.com/openai/v1';
const GROQ_MODELS  = ['llama-3.1-8b-instant', 'gemma2-9b-it', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'];

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

// ── FAO-56 soil-water balance (mirrors frontend useIrrigationData) ────────────
const THETA_STD_AI = {
  sableux:         { cc: 0.12, pf: 0.05 },
  limono_sableux:  { cc: 0.23, pf: 0.10 },
  limoneux:        { cc: 0.31, pf: 0.15 },
  argilo_limoneux: { cc: 0.38, pf: 0.22 },
  argileux:        { cc: 0.42, pf: 0.26 },
};
const Z_DEFAUT_AI  = { agrume: 0.9, fruit: 1.0, legume: 0.5, cereale: 1.0 };
const P_BASE_AI    = { agrume: 0.5, fruit: 0.5, legume: 0.4, cereale: 0.55 };
const EFF_MODE_AI  = { 'goutte-à-goutte': 0.9, aspersion: 0.7, gravitaire: 0.6 };

function computeCurrentIrrigVolume(culture, et0, lastIrrig, mode = 'goutte-à-goutte', kcOverride = null) {
  try {
    const surface  = parseFloat(culture.surface) || 100;
    const kc       = kcOverride ?? parseFloat(culture.kcActuel) ?? 0.65;
    const etc      = et0 * kc;
    const typeSol  = culture.typeSol || 'limoneux';
    const typeCult = culture.type    || 'legume';

    const z = culture.profondeurRacinaire != null
      ? parseFloat(culture.profondeurRacinaire)
      : (Z_DEFAUT_AI[typeCult] || 0.6);

    const pAdj = culture.p != null
      ? parseFloat(culture.p)
      : Math.min(0.8, Math.max(0.1, (P_BASE_AI[typeCult] || 0.5) + 0.04 * (5 - etc)));

    let thetaCcEff, thetaPfEff;
    if (culture.thetaCc != null && culture.thetaPf != null) {
      thetaCcEff = parseFloat(culture.thetaCc);
      thetaPfEff = parseFloat(culture.thetaPf);
    } else {
      const std  = THETA_STD_AI[typeSol] || THETA_STD_AI.limoneux;
      thetaCcEff = std.cc;
      thetaPfEff = std.pf;
    }

    const W_cc       = thetaCcEff * z * 1000;
    const W_pf       = thetaPfEff * z * 1000;
    const etcParHeure = etc / 24;
    const now         = Date.now();

    let W_current;
    if (culture.stockEauMm != null) {
      let stock = parseFloat(culture.stockEauMm);
      if (culture.stockEauUpdatedAt) {
        const heuresManquees = Math.max(0, (now - new Date(culture.stockEauUpdatedAt).getTime()) / 3_600_000);
        if (heuresManquees > 0) stock -= etcParHeure * heuresManquees;
      }
      W_current = Math.min(W_cc, Math.max(W_pf, stock));
    } else {
      const refTs = lastIrrig
        ? new Date(lastIrrig.date).getTime()
        : culture.datePlantation
          ? new Date(culture.datePlantation).getTime()
          : now - 86_400_000;
      const heuresEcoulees = Math.max(0, now - refTs) / 3_600_000;
      W_current = Math.min(W_cc, Math.max(W_pf, W_cc - etcParHeure * heuresEcoulees));
    }

    const deficitMm = Math.max(0, W_cc - W_current);
    if (deficitMm < 0.1) return { volumeM3: 0, eauMm: 0, note: 'réserve suffisante — pas d\'irrigation requise' };

    const eta    = EFF_MODE_AI[mode] || 0.9;
    const eauMm  = deficitMm / eta;
    const volumeM3 = parseFloat(((eauMm * surface) / 1000).toFixed(2));
    return { volumeM3, eauMm: parseFloat(eauMm.toFixed(1)), note: `bilan hydrique FAO-56 (déficit=${deficitMm.toFixed(1)} mm, η=${Math.round(eta*100)}%)` };
  } catch (e) {
    console.error('computeCurrentIrrigVolume:', e.message);
    return null;
  }
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

// ── Cache contexte utilisateur (TTL 60s) ──────────────────────────────────────
const _ctxCache = new Map();
const CTX_TTL_MS = 60_000;

// ── Contexte utilisateur ──────────────────────────────────────────────────────
async function buildUserContext(userId, userCity = 'Tunis', irrigationOverrides = {}, irrigationData = []) {
  const cacheKey = `${userId}:${userCity}`;
  const cached   = _ctxCache.get(cacheKey);
  const hasLiveData = Array.isArray(irrigationData) && irrigationData.length > 0;
  if (cached && !hasLiveData && Date.now() - cached.ts < CTX_TTL_MS) return cached.ctx;
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

    // Build a lookup from culture name → frontend real-time besoins
    const liveDataMap = {};
    for (const d of (Array.isArray(irrigationData) ? irrigationData : [])) {
      if (d?.nom) liveDataMap[d.nom.toLowerCase().trim()] = d;
    }

    // Pre-fetch dynamic Kc (same API the frontend uses) for cultures missing live data
    const currentMonth = new Date().getMonth() + 1;
    const kcCache = {};
    await Promise.all(cultures.map(async c => {
      const liveKey = c.nom.toLowerCase().trim();
      if (!liveDataMap[liveKey]) {
        try {
          const kcResult = await getKcForCultureAndMonth(
            c.nom, currentMonth,
            (c.kcManuel?.mid != null || c.kcManuel?.ini != null) ? c.kcManuel : null
          );
          kcCache[c._id.toString()] = kcResult.kc;
        } catch { kcCache[c._id.toString()] = parseFloat(c.kcActuel) || 0.65; }
      }
    }));

    const irrigationNeeds = cultures.length > 0
      ? cultures.map(c => {
          const liveKey  = c.nom.toLowerCase().trim();
          const live     = liveDataMap[liveKey];

          // ── Priority: use frontend real-time values (exact same as page) ──
          if (live && parseFloat(live.volumeM3) >= 0) {
            const cid      = c._id.toString();
            const lastIrr  = lastIrrigByCulture[cid];
            const mode     = lastIrr?.mode || 'goutte-à-goutte';
            const freqJours = lastIrr?.frequenceJours || 0;
            const soilPart = c.typeSol ? ` | Sol: ${c.typeSol}` : '';
            const freqPart = freqJours > 0 ? ` | Fréquence: ${freqJours} j` : '';
            const vol      = parseFloat(live.volumeM3);
            const volPart  = vol > 0
              ? ` → Volume dose: ${vol} m³ (temps réel app, ${live.surface} m²)`
              : ` → Volume dose: 0 m³ (réserve sol suffisante)`;
            return `• ${c.nom} (${c.variete}): ET₀=${live.et0} mm/j × Kc=${live.kc} = ETc=${live.etc} mm/j${volPart} | Mode: ${mode} η=${live.eta}%${freqPart}${soilPart}`;
          }

          // ── Fallback: FAO-56 balance with dynamic Kc from same source as frontend ──
          if (!weather?.et0) return null;
          const et0      = parseFloat(weather.et0) || 0;
          const kc       = kcCache[c._id.toString()] || parseFloat(c.kcActuel) || 0.65;
          const etc      = parseFloat((et0 * kc).toFixed(2));
          const cid      = c._id.toString();
          const lastIrr  = lastIrrigByCulture[cid];
          const mode     = lastIrr?.mode || 'goutte-à-goutte';
          const effMap   = [['goutte', 0.9], ['aspersion', 0.7], ['gravitaire', 0.6]];
          const effPct   = Math.round((effMap.find(([k]) => mode.toLowerCase().includes(k))?.[1] ?? 0.9) * 100);
          const freqJours = lastIrr?.frequenceJours || 0;
          const volResult = et0 > 0 ? computeCurrentIrrigVolume(c, et0, lastIrr, mode, kc) : null;
          const volumeM3  = volResult?.volumeM3 ?? null;
          const soilPart  = c.typeSol ? ` | Sol: ${c.typeSol}` : '';
          const freqPart  = freqJours > 0 ? ` | Fréquence: ${freqJours} j` : '';
          const volumePart = volumeM3 !== null
            ? ` → Volume dose: ${volumeM3} m³ (bilan hydrique FAO-56, ${c.surface} m²)`
            : ` → Volume dose: NON DISPONIBLE — consulter page Irrigation`;
          return `• ${c.nom} (${c.variete}): ET₀=${et0} mm/j × Kc=${kc} = ETc=${etc} mm/j${volumePart} | Mode: ${mode} η=${effPct}%${freqPart}${soilPart}`;
        }).filter(Boolean).join('\n')
      : 'Calcul ETc non disponible (météo manquante).';

    // ── nextIrrigLines: aligned with fmtDateIrrig() + besoins.dateProchaine logic
    // The irrigation page computes dateProchaine as:
    //   lastIrr.date + frequenceJours days, then advances by multiples of
    //   frequenceJours until the result is >= today (same as fmtDateIrrig).
    // We replicate that here so chatbot and page always agree.
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);

    const nextIrrigLines = cultures.length === 0
      ? 'Aucune culture enregistrée.'
      : cultures.map(c => {
          const cid  = c._id.toString();
          const last = lastIrrigByCulture[cid];
          const overrideDate = irrigationOverrides[c.nom.toLowerCase().trim()]
                            || irrigationOverrides[cid];

          if (!last && !overrideDate && !liveDataMap[c.nom.toLowerCase().trim()]?.dateProchaine)
            return `• ${c.nom} (${c.variete}): aucune irrigation enregistrée`;

          // Helper: advance a date by multiples of freq until >= todayMidnight
          function advanceToFuture(baseDate, freqDays) {
            if (!baseDate || freqDays <= 0) return baseDate;
            const base = new Date(baseDate); base.setHours(0, 0, 0, 0);
            if (base >= todayMidnight) return base;
            const diff   = todayMidnight - base;
            const cycles = Math.ceil(diff / (freqDays * 86400000));
            return new Date(base.getTime() + cycles * freqDays * 86400000);
          }

          const freqJours = last?.frequenceJours || 0;
          const liveKey   = c.nom.toLowerCase().trim();
          const live      = liveDataMap[liveKey];

          // Priority: live frontend date (exact same calc as page) > override > DB prochaineDate
          // dateProchaine is sent as YYYY-MM-DD (local date) to avoid UTC timezone shift
          if (live?.dateProchaine) {
            const [yr, mo, dy] = live.dateProchaine.split('-').map(Number);
            const dateProchaine = new Date(yr, mo - 1, dy); // local midnight, no TZ ambiguity
            const joursAvant = typeof live.joursAvantIrrig === 'number'
              ? live.joursAvantIrrig
              : Math.ceil((dateProchaine - todayMidnight) / 86400000);
            const label = joursAvant <= 0 ? "aujourd'hui" : joursAvant === 1 ? "demain (J+1)" : `J+${joursAvant}`;
            return `• ${c.nom} (${c.variete}): prochaine irrigation le ${formatDate(dateProchaine)} [${label}]` +
                   (freqJours ? ` — fréquence: ${freqJours} jours` : '');
          }

          // Fallback: override > stored prochaineDate (advanced if stale) > computed from lastDate
          let dateProchaine = null;
          if (overrideDate) {
            dateProchaine = advanceToFuture(new Date(overrideDate), freqJours);
          } else if (last?.prochaineDate) {
            dateProchaine = advanceToFuture(new Date(last.prochaineDate), freqJours);
          } else if (freqJours > 0 && last?.date) {
            dateProchaine = advanceToFuture(new Date(last.date), freqJours);
          }

          if (dateProchaine) {
            const joursAvant = Math.ceil((dateProchaine - todayMidnight) / 86400000);
            const label = joursAvant <= 0 ? "aujourd'hui" : joursAvant === 1 ? "demain (J+1)" : `J+${joursAvant}`;
            return `• ${c.nom} (${c.variete}): prochaine irrigation le ${formatDate(dateProchaine)} [${label}]` +
                   (freqJours ? ` — fréquence: ${freqJours} jours` : '');
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

    const result = { cropCount: cultures.length, cropsSummary, irrigationSummary, irrigationNeeds, nextIrrigLines, nextFertLines, weatherSummary, city: userCity };
    _ctxCache.set(cacheKey, { ctx: result, ts: Date.now() });
    return result;
  } catch (error) {
    console.error('❌ Error building user context:', error.message);
    return { cropCount: 0, cropsSummary: 'Impossible de charger les cultures.', irrigationSummary: 'Impossible de charger les irrigations.', irrigationNeeds: 'Calcul non disponible.', nextIrrigLines: 'Données non disponibles.', nextFertLines: 'Données non disponibles.', weatherSummary: 'Météo non disponible.', city: userCity };
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are SmartIrrig AI, an agricultural assistant for Tunisian farmers. Expert in FAO-56 irrigation (ET₀, ETc=ET₀×Kc), soil-water balance, and crop fertilisation.

LANGUAGE: Respond ONLY in the language from [LANGUE DÉTECTÉE]. Never mix languages.
- TUNISIAN_ARABIC → دارجة in Arabic script only (never Latin like 3andek)
- MODERN_ARABIC → فصحى in Arabic script only
- FRENCH → Français | ENGLISH → English | TURKISH → Türkçe
Arabic: use "محصول/محاصيل" never "ثقافة". Crop count: "عندك X محاصيل". Always digits not words.

FORMAT:
- 1 sentence for simple facts (count, date, value). 2-3 sentences for explanations. Bullet list max 5 items only if explicitly requested.
- NO filler: never start with "Bien sûr", "Voici", "Certainly", "En tant qu'assistant".
- Numbers: always digits + units (mm/j, m³, kg/ha, °C). ETc rounded to 2 decimals, volumes to 0.
- Volume: ALWAYS use "Volume dose" from context. NEVER recalculate from ETc×1day.
- Dates: ALWAYS use exact date from "prochaine irrigation le…" in context. NEVER compute yourself.
- Date format: "lundi 5 mai 2026" (full weekday + day + month + year).

DATA: Use ONLY values from [CONTEXTE UTILISATEUR]. Never invent. If missing, say so in 1 sentence.

TRANSLATION: If user asks "en arabe"/"in English"/etc, re-state previous answer in that language only.

NAVIGATION (only when user asks where/how):
Add/view crops→📍Cultures>+ | Record irrigation→📍Irrigation>Enregistrer | Fertilisation→📍Fertilisation | Weather→📍Accueil`;

// ── Groq call with model cascade ──────────────────────────────────────────────
async function callGroq(userMessage, context, langHint, history = []) {
  const contextBlock = `════════════════════════════════════════
[CONTEXTE UTILISATEUR — DONNÉES RÉELLES]
════════════════════════════════════════
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
    max_tokens: 200,
    temperature: 0.1,
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let lastErr;
  for (let i = 0; i < GROQ_MODELS.length; i++) {
    const model = GROQ_MODELS[i];
    try {
      const response = await axios.post(
        `${GROQ_BASE}/chat/completions`,
        { ...body, model },
        { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 12000 }
      );
      return response.data.choices[0]?.message?.content?.trim() || '';
    } catch (err) {
      const status = err.response?.status;
      lastErr = err;
      if (status === 429 || status === 503) {
        console.warn(`⚠️ Groq ${model} rate-limited (${status}), trying next model`);
        if (i < GROQ_MODELS.length - 1) await sleep(800);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

module.exports = { detectMessageLanguage, buildUserContext, callGroq, normalizeNumerals };