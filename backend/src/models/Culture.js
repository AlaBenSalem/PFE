// models/Culture.js — Version avec typeSol (RFU) + region
const mongoose = require('mongoose');

const cultureSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  parcelle: { type: String, default: null },

  // ✅ NOUVEAU: Région géographique de la culture
  region: { type: String, default: null },

  nom: { type: String, required: true },
  variete: { type: String, required: true },
  type: { type: String, enum: ['agrume', 'cereale', 'legume', 'fruit'] },
  datePlantation: { type: Date, default: null },
  surface: { type: Number, default: null }, // en m²
  nombreArbres: { type: Number, default: null },
  densite: Number, // arbres/ha
  stadeActuel: String,
  kcActuel: Number,

  // Type de sol pour calcul RFU (FAO-56)
  typeSol: {
    type: String,
    enum: ['sableux', 'limono_sableux', 'limoneux', 'argilo_limoneux', 'argileux'],
    default: 'limoneux',
  },

  // Profondeur racinaire effective (m) — z dans FAO-56
  profondeurRacinaire: { type: Number, default: null },

  // Fraction de dépletion (p) — FAO-56 §3.1 : RFU = p × RU (typique 0.3–0.7)
  p: { type: Number, default: null },

  // Kc manuel (remplace FAO-56 si renseigné)
  kcManuel: {
    ini: { type: Number, default: null },
    mid: { type: Number, default: null },
    end: { type: Number, default: null },
  },

  // Système d'irrigation (FAO-56 §7)
  debitGoutteur:      { type: Number, default: null }, // L/h par goutteur
  nbGoutteursParArbre:{ type: Number, default: null }, // nb goutteurs/arbre
  densitePlantation:  { type: Number, default: null }, // arbres/ha (saisie manuelle)

  // Paramètres hydriques sol (FAO-56 §3.1) — optionnels, mesurés par l'utilisateur
  thetaCc: { type: Number, default: null }, // θcc : capacité au champ (m³/m³)
  thetaPf: { type: Number, default: null }, // θpf : point de flétrissement (m³/m³)

  // Texture du sol (Saxton & Rawls) — optionnel
  sableFraction:  { type: Number, default: null }, // fraction sable (0–1)
  argileFraction: { type: Number, default: null }, // fraction argile (0–1)
  matOrganique:   { type: Number, default: null }, // matière organique (%)
  thetaSource:    { type: String, enum: ['manuel', 'saxton_rawls', null], default: null },

  irrigation: {
    type: { type: String, enum: ['goutte-a-goutte', 'aspersion', 'gravitaire'] },
    efficacite: { type: Number, default: 0.9 },
    debit: Number // L/h
  },
  besoinsEau: [{
    date: Date,
    et0: Number,
    kc: Number,
    etc: Number,
    volume: Number,
    volumeParArbre: Number
  }],
  historiqueIrrigation: [{
    date: Date,
    volume: Number,
    duree: Number,
    mode: String,
    et0: Number,
    etc: Number,
    eauMm: Number,
    debitMmh: Number,
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Culture', cultureSchema);