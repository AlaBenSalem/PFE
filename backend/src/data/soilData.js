/**
 * soilData.js — Données pédologiques FAO-56
 * Source: FAO Irrigation and Drainage Paper No. 56, Table 5 (Allen et al., 1998)
 *
 * θ_FC  = Teneur en eau à la capacité au champ (cm³/cm³)
 * θ_WP  = Teneur en eau au point de flétrissement (cm³/cm³)
 * RU    = θ_FC - θ_WP   (mm/m de profondeur)
 * p     = Fraction de dépletion tolérable (fraction d'eau facilement utilisable)
 * RFU   = p × RU
 *
 * Profondeur racinaire effective Ze par type de culture (FAO-56 Table 22)
 */

// ─── Paramètres sol FAO-56 Table 5 ───────────────────────────────────────────
const SOIL_PARAMS = {
  sableux: {
    thetaFC:  0.10,   // cm³/cm³
    thetaWP:  0.04,   // cm³/cm³
    ruMmParM: 60,     // mm/m  (θFC - θWP) × 1000
    tauxInfiltration: 50,  // mm/h
    emoji:  '🏖️',
    couleur: '#f59e0b',
    description: 'Sableux — Drainage très rapide, irrigation fréquente',
  },
  limono_sableux: {
    thetaFC:  0.18,
    thetaWP:  0.09,
    ruMmParM: 90,
    tauxInfiltration: 25,
    emoji:  '🌾',
    couleur: '#84cc16',
    description: 'Limono-sableux — Bonne structure, drainage modéré',
  },
  limoneux: {
    thetaFC:  0.26,
    thetaWP:  0.14,
    ruMmParM: 120,
    tauxInfiltration: 12,
    emoji:  '🌱',
    couleur: '#22c55e',
    description: 'Limoneux — Sol équilibré, idéal pour cultures',
  },
  argilo_limoneux: {
    thetaFC:  0.30,
    thetaWP:  0.16,
    ruMmParM: 140,
    tauxInfiltration: 6,
    emoji:  '🏔️',
    couleur: '#8b5cf6',
    description: 'Argilo-limoneux — Forte rétention, drainage lent',
  },
  argileux: {
    thetaFC:  0.36,
    thetaWP:  0.21,
    ruMmParM: 150,
    tauxInfiltration: 2,
    emoji:  '🪨',
    couleur: '#ef4444',
    description: 'Argileux — Très forte rétention, risque engorgement',
  },
};

// ─── Profondeur racinaire effective Ze (m) par type de culture (FAO-56 Table 22) ─
// Valeur médiane de la fourchette FAO. Peut être overridée par culture.profondeurRacinaire
const PROFONDEUR_RACINAIRE = {
  agrume:    0.90,   // 0.9–1.5 m
  fruit:     1.00,   // 0.7–1.3 m (pommier, poirier, pêcher…)
  legume:    0.50,   // 0.3–0.6 m (tomate, poivron, courgette…)
  cereale:   1.00,   // 0.9–1.5 m (blé, orge, maïs…)
  default:   0.60,
};

// ─── Facteur de dépletion p par culture (FAO-56 Table 22) ─────────────────────
// p = fraction de l'eau facilement utilisable avant stress hydrique
// Valeurs pour ETc ≈ 5 mm/j ; ajustement si ETc ≠ 5 selon FAO-56 eq. 84 :
//   p_adj = p + 0.04 × (5 - ETc)   clamped [0.1, 0.8]
const P_PAR_CULTURE = {
  agrume:    0.50,
  fruit:     0.50,
  legume:    0.40,
  cereale:   0.55,
  default:   0.50,
};

/**
 * Calcule RU, RFU et les paramètres d'irrigation optimaux.
 *
 * @param {string} typeSol         - clé de SOIL_PARAMS
 * @param {string} typeCulture     - clé de P_PAR_CULTURE
 * @param {number} etcMmJ          - ETc du jour (mm/j) — pour ajustement p
 * @param {number|null} zOverride  - profondeur racinaire custom (m), ou null
 * @returns {Object}
 */
function calculerRFU(typeSol, typeCulture, etcMmJ = 5, zOverride = null) {
  const sol     = SOIL_PARAMS[typeSol]  || SOIL_PARAMS.limoneux;
  const pBase   = P_PAR_CULTURE[typeCulture] ?? P_PAR_CULTURE.default;
  const z       = zOverride || PROFONDEUR_RACINAIRE[typeCulture] || PROFONDEUR_RACINAIRE.default;

  // ── FAO-56 Eq. 84 : ajustement de p selon ETc ────────────────────────────
  const pAdj = Math.min(0.8, Math.max(0.1, pBase + 0.04 * (5 - etcMmJ)));

  // ── Réserve Utile totale (mm) ─────────────────────────────────────────────
  // RU = (θFC - θWP) × z × 1000
  const ru = parseFloat((sol.ruMmParM * z).toFixed(1));

  // ── Réserve Facilement Utilisable (mm) ───────────────────────────────────
  // RFU = p × RU
  const rfu = parseFloat((pAdj * ru).toFixed(1));

  // ── Dose nette recommandée = RFU (on irrigue quand RFU épuisée) ───────────
  const doseNetteMm = rfu;

  // ── Fréquence optimale d'irrigation (jours) ───────────────────────────────
  // f = RFU / ETc
  const frequenceJours = etcMmJ > 0
    ? parseFloat((rfu / etcMmJ).toFixed(2))
    : 7;

  const frequenceJoursArrondi = Math.max(1, Math.round(frequenceJours));

  // ── Prochaine date d'irrigation ───────────────────────────────────────────
  const prochaineDate = new Date();
  prochaineDate.setDate(prochaineDate.getDate() + frequenceJoursArrondi);

  return {
    // Sol
    typeSol,
    thetaFC:  sol.thetaFC,
    thetaWP:  sol.thetaWP,
    ruMmParM: sol.ruMmParM,
    tauxInfiltration: sol.tauxInfiltration,
    emoji:    sol.emoji,
    couleur:  sol.couleur,
    description: sol.description,
    // Culture
    typeCulture,
    profondeurRacinaire: z,
    p:    pAdj,
    pBase,
    // Résultats
    ru,
    rfu,
    rfuTiers: parseFloat((rfu / 3).toFixed(1)), // seuil alerte précoce
    doseNetteMm,
    frequenceJours,
    frequenceJoursArrondi,
    prochaineDate,
  };
}

module.exports = { SOIL_PARAMS, PROFONDEUR_RACINAIRE, P_PAR_CULTURE, calculerRFU };