/**
 * Script de peuplement de l'historique météo sur 30 jours
 * Usage : node seedWeather.js
 * 
 * Lance ce script UNE FOIS pour peupler la base avec l'historique.
 * Après, le backend sauvegarde automatiquement chaque requête /weather/current.
 */
require('dotenv').config();
const axios   = require('axios');
const mongoose = require('mongoose');
const { DEFAULT_PRIMARY_URI } = require('../config/mongodbConnections');

/** Primary DB only (same as server). Use MONGODB_LOCAL_URI + app for dual setup. */
const MONGO_URI = process.env.MONGODB_URI || DEFAULT_PRIMARY_URI;
const OW_KEY    = process.env.OPENWEATHER_API_KEY;
const CITIES    = ['Tunis', 'Sfax', 'Sousse']; // villes à peupler
const DAYS      = 5; // OpenWeather free = max 5 jours forecast (pas d'historique gratuit)

// ── Modèle Weather (copié depuis models/Weather.js) ──────────────────────────
const weatherSchema = new mongoose.Schema({
  location: {
    city: String, lat: Number, lon: Number, country: String,
  },
  date: { type: Date, default: Date.now },
  temperature: { current: Number, min: Number, max: Number, avg: Number },
  humidity:    { current: Number, min: Number, max: Number, avg: Number },
  wind:        { speed: Number, gust: Number },
  pressure:    Number,
  precipitation: { rain: Number, snow: Number },
  solarRadiation: Number,
  et0:         Number,
  description: String,
  icon:        String,
  forecast:    [{ date: Date, temp: Number, humidity: Number, et0: Number }],
}, { timestamps: true });

const Weather = mongoose.models.Weather || mongoose.model('Weather', weatherSchema);

// ── Penman-Monteith simplifié ────────────────────────────────────────────────
function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}
function calcET0(tmax, tmin, hum, wind, lat, date) {
  try {
    const tmean = (tmax + tmin) / 2;
    const P     = 101.3 * Math.pow((293 - 0.0065 * 0) / 293, 5.26);
    const gamma = 0.000665 * P;
    const es_tx = 0.6108 * Math.exp(17.27 * tmax / (tmax + 237.3));
    const es_tn = 0.6108 * Math.exp(17.27 * tmin / (tmin + 237.3));
    const es    = (es_tx + es_tn) / 2;
    const ea    = es * (hum / 100);
    const delta = 4098 * es / Math.pow(tmean + 237.3, 2);
    const phi   = lat * Math.PI / 180;
    const J     = getDayOfYear(date);
    const dr    = 1 + 0.033 * Math.cos(2 * Math.PI / 365 * J);
    const decl  = 0.409 * Math.sin(2 * Math.PI / 365 * J - 1.39);
    const ws    = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(decl))));
    const Ra    = 24 * 60 / Math.PI * 0.0820 * dr * (
      ws * Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.sin(ws)
    );
    const m     = date.getMonth() + 1;
    const Rs    = ((m >= 5 && m <= 8) ? 28 : (m >= 3 && m <= 10) ? 22 : 15) * 0.75;
    const Rns   = 0.77 * Rs;
    const Rnl   = 4.903e-9 * (Math.pow(tmax+273.16,4)+Math.pow(tmin+273.16,4))/2
                * (0.34 - 0.14 * Math.sqrt(Math.max(0,ea)))
                * (1.35 * Rs / Math.max(Ra, 0.1) - 0.35);
    const Rn    = Rns - Rnl;
    const d2    = delta + gamma * (1 + 0.34 * wind);
    return Math.max(0, parseFloat(((0.408*delta*Rn)/d2 + (gamma*900/(tmean+273)*wind*(es-ea))/d2).toFixed(2)));
  } catch { return 3.5; }
}

async function seedCity(cityName) {
  console.log(`\n🌍 Peuplement pour: ${cityName}`);

  // Récupérer les données actuelles
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${OW_KEY}&units=metric&lang=fr`;
  const { data } = await axios.get(url);

  const lat  = data.coord.lat;
  const lon  = data.coord.lon;
  const loc  = { city: data.name, lat, lon, country: data.sys.country };

  // Vérifier si aujourd'hui existe déjà
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const existing = await Weather.findOne({
    'location.city': { $regex: new RegExp(`^${data.name}$`, 'i') },
    date: { $gte: todayStart },
  });

  if (!existing) {
    const tMin = data.main.temp_min;
    const tMax = data.main.temp_max;
    const tCur = data.main.temp;
    const hum  = data.main.humidity;
    const wind = data.wind?.speed || 0;
    const et0  = calcET0(tMax, tMin, hum, wind, lat, new Date());

    await Weather.create({
      location: loc,
      date:     new Date(),
      temperature: { current: tCur, min: tMin, max: tMax, avg: (tMin+tMax)/2 },
      humidity:    { current: hum, min: Math.max(hum-10,0), max: Math.min(hum+10,100), avg: hum },
      wind:        { speed: wind, gust: data.wind?.gust || wind },
      pressure:    data.main.pressure,
      precipitation: { rain: data.rain?.['1h'] || 0, snow: 0 },
      et0,
      description: data.weather?.[0]?.description || '',
      icon:        data.weather?.[0]?.icon || '01d',
    });
    console.log(`  ✅ Aujourd'hui sauvegardé — ET₀: ${et0} mm/j, T: ${tMin}°/${tMax}°C`);
  } else {
    console.log(`  ℹ️  Aujourd'hui déjà en base`);
  }
}

async function main() {
  console.log('🔌 Connexion MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connecté\n');

  for (const city of CITIES) {
    try {
      await seedCity(city);
    } catch (e) {
      console.error(`  ❌ Erreur pour ${city}:`, e.message);
    }
  }

  await mongoose.disconnect();
  console.log('\n✅ Terminé. Relancez ce script chaque jour ou ajoutez un cron job.');
}

main().catch(console.error);