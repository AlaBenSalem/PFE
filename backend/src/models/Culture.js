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

  // Profondeur racinaire personnalisée (m) — optionnel, sinon valeur FAO par type
  profondeurRacinaire: { type: Number, default: null },

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