const mongoose = require('mongoose');

const weatherSchema = new mongoose.Schema({
  location: {
    city: { type: String, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    country: String
  },
  date: { type: Date, required: true, default: Date.now },
  temperature: {
    current: Number,
    min: Number,
    max: Number,
    avg: Number
  },
  humidity: {
    current: Number,
    min: Number,
    max: Number,
    avg: Number
  },
  wind: {
    speed: Number,
    gust: Number
  },
  pressure: Number,
  precipitation: {
    rain: Number,
    snow: Number
  },
  solarRadiation: Number, // Rs en MJ/m²/j
  et0: Number, // Évapotranspiration de référence
  description: String,
  icon: String,
  forecast: [{
    date: Date,
    temp: Number,
    humidity: Number,
    et0: Number
  }]
}, {
  timestamps: true
});

weatherSchema.index({ 'location.city': 1, date: -1 });
weatherSchema.index({ date: -1 });

module.exports = mongoose.model('Weather', weatherSchema);
