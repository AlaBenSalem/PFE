// models/Irrigation.js — Version mise à jour avec champs RFU/sol
const mongoose = require('mongoose');

const irrigationSchema = new mongoose.Schema({
  cultureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Culture',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  mode: {
    type: String,
    enum: ['goutte-à-goutte', 'aspersion', 'gravitaire'],
    required: true
  },
  duree:     { type: Number, required: true, min: 0 },   // en minutes
  volume:    { type: Number, required: true, min: 0 },   // en litres
  debit:     { type: Number, required: true },           // L/h
  et0:       { type: Number, required: true },           // mm/j
  etc:       { type: Number, required: true },           // mm/j
  kc:        { type: Number, required: true },
  surface:   { type: Number, required: true },           // m²
  efficacite:{ type: Number, default: 0.9, min: 0, max: 1 },
  eauMm:     { type: Number, required: true },           // mm apportés
  debitMmh:  { type: Number, required: true },           // mm/h

  // ✅ NOUVEAUX CHAMPS RFU / Sol
  typeSol: {
    type: String,
    enum: ['sableux', 'limono_sableux', 'limoneux', 'argilo_limoneux', 'argileux'],
    default: null,
  },
  ru: { type: Number, default: null },       // Réserve Utile calculée (mm)
  rfu: { type: Number, default: null },      // Réserve Facilement Utilisable (mm)
  doseNetteMm: { type: Number, default: null }, // Dose nette recommandée (mm)
  frequenceJours: { type: Number, default: null }, // Intervalle optimal (jours)
  prochaineDate: { type: Date, default: null },    // Date optimale prochaine irrigation

  notes: { type: String, maxLength: 500 },
  completed: { type: Boolean, default: true },
  meteo: {
    temperature: Number,
    humidity: Number,
    windSpeed: Number
  }
}, {
  timestamps: true
});

irrigationSchema.index({ cultureId: 1, date: -1 });
irrigationSchema.index({ date: -1 });

module.exports = mongoose.model('Irrigation', irrigationSchema);