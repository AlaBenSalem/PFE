// backend/src/models/Fertilisation.js
const mongoose = require('mongoose');

const fertilisationSchema = new mongoose.Schema({
  cultureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Culture',
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },

  // ── Produit fertilisant ───────────────────────────────────────────────────
  typeProduit: {
    type: String,
    enum: ['azote', 'phosphore', 'potassium', 'NPK', 'organique', 'autre'],
    required: true,
  },
  produit:     { type: String, required: true, trim: true }, // ex: "Urée 46%", "NPK 15-15-15"
  dose:        { type: Number, required: true, min: 0 },     // kg/ha ou L/ha
  uniteDose: {
    type: String,
    enum: ['kg/ha', 'L/ha', 'g/arbre', 'kg/arbre'],
    default: 'kg/ha',
  },

  // ── Mode d'application ────────────────────────────────────────────────────
  modeApplication: {
    type: String,
    enum: ['sol', 'foliaire', 'fertigation', 'autre'],
    required: true,
  },

  // ── Stade phénologique ────────────────────────────────────────────────────
  stadeApplication: {
    type: String,
    enum: ['dormance', 'feuillaison', 'floraison', 'nouaison', 'croissance', 'maturite', 'post-recolte', 'autre'],
    default: 'croissance',
  },

  // ── Planification prochaine fertilisation ────────────────────────────────
  frequenceJours:  { type: Number, default: null }, // intervalle recommandé (jours)
  prochaineDate:   { type: Date,   default: null }, // date optimale suivante

  // ── Surface / arbres ─────────────────────────────────────────────────────
  surface:      { type: Number, default: null }, // m²
  nombreArbres: { type: Number, default: null },

  // ── Quantité totale appliquée ─────────────────────────────────────────────
  quantiteTotale: { type: Number, default: null }, // kg ou L total

  // ── Météo au moment de l'application ─────────────────────────────────────
  meteo: {
    temperature: { type: Number, default: null },
    humidity:    { type: Number, default: null },
    windSpeed:   { type: Number, default: null },
  },

  notes:     { type: String, maxLength: 500 },
  completed: { type: Boolean, default: true },
}, {
  timestamps: true,
});

fertilisationSchema.index({ cultureId: 1, date: -1 });
fertilisationSchema.index({ date: -1 });

module.exports = mongoose.model('Fertilisation', fertilisationSchema);