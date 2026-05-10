// backend/controllers/weatherController.js
const weatherService = require('../services/weatherService');
const Weather = require('../models/Weather');
const etoCalculator = require('../services/etoCalculator');

/**
 * Seuils de validité pour l'ET₀
 * Configurables via variables d'environnement :
 * - ET0_MIN_VALID : seuil minimum (défaut: 0.1 mm/j)
 * - ET0_MAX_VALID : seuil maximum (défaut: 30 mm/j, supporte les régions arides)
 */
const ET0_MIN_VALID = parseFloat(process.env.ET0_MIN_VALID) || 0.1;
const ET0_MAX_VALID = parseFloat(process.env.ET0_MAX_VALID) || 30;

/**
 * Vérifie si une valeur d'ET₀ est valide
 * @param {number} et0 - Valeur d'ET₀ à vérifier
 * @returns {boolean} - true si valide
 */
const isET0Valid = (et0) => {
  return et0 && et0 > ET0_MIN_VALID && et0 < ET0_MAX_VALID;
};

/**
 * GET /api/weather/current?city=Tunis
 * ✅ Cache invalidé si ET₀ est nul ou aberrant (seuils configurables)
 */
exports.getCurrentWeather = async (req, res) => {
  try {
    const { city, lat, lon } = req.query;

    if (!city && !lat && !lon) {
      return res.status(400).json({
        success: false,
        error: "Veuillez spécifier une ville (city) ou des coordonnées (lat, lon)"
      });
    }

    if (city) {
      const latestData = await weatherService.getLatestWeather(city);

      if (latestData) {
        const minutesDiff = (new Date() - new Date(latestData.date)) / (1000 * 60);
        const et0Valid = isET0Valid(latestData.et0);

        if (minutesDiff < 30 && et0Valid) {
          console.log(`✅ Cache valide pour ${city} (${minutesDiff.toFixed(0)} min) — ET₀: ${latestData.et0} mm/j`);
          return res.json({
            success: true,
            data: latestData,
            source: 'cache',
            age: `${minutesDiff.toFixed(0)} min`
          });
        } else {
          if (!et0Valid) {
            console.log(`⚠️ Cache invalidé pour ${city} — ET₀ aberrant (${latestData.et0}), seuils: [${ET0_MIN_VALID}, ${ET0_MAX_VALID}]`);
          } else {
            console.log(`🔄 Cache expiré pour ${city} (${minutesDiff.toFixed(0)} min)`);
          }
        }
      }
    }

    console.log(`🌐 Récupération nouvelles données pour ${city || `${lat},${lon}`}`);
    const weatherData = await weatherService.saveWeatherData(city, lat, lon);

    res.json({
      success: true,
      data: weatherData,
      source: 'live'
    });
  } catch (error) {
    console.error("❌ Erreur dans getCurrentWeather:", error);

    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      if (status === 404 || message.includes('city not found')) {
        return res.status(404).json({
          success: false,
          error: "Ville non trouvée. Vérifiez l'orthographe ou essayez avec le nom anglais."
        });
      }
      if (status === 401) {
        return res.status(500).json({ success: false, error: "Erreur de configuration API." });
      }
      if (status === 429) {
        return res.status(429).json({ success: false, error: "Trop de requêtes. Réessayez dans quelques minutes." });
      }
    }

    if (city) {
      try {
        const fallbackData = await weatherService.getLatestWeather(city);
        if (fallbackData) {
          return res.json({
            success: true,
            data: fallbackData,
            source: 'fallback',
            warning: "Données non actualisées (problème de connexion)"
          });
        }
      } catch {}
    }

    res.status(500).json({ success: false, error: "Erreur lors de la récupération des données météo." });
  }
};

exports.getForecast = async (req, res) => {
  try {
    const { city, lat, lon } = req.query;

    if (!city && !lat && !lon) {
      return res.status(400).json({ success: false, error: "Ville ou coordonnées requises" });
    }

    const forecastData = await weatherService.getForecast(city, lat, lon);

    if (!forecastData || !forecastData.list) {
      return res.status(404).json({ success: false, error: "Prévisions non disponibles" });
    }

    const forecast = forecastData.list.slice(0, 8).map(item => ({
      date:        new Date(item.dt * 1000),
      temp:        Math.round(item.main.temp),
      temp_min:    Math.round(item.main.temp_min),
      temp_max:    Math.round(item.main.temp_max),
      humidity:    item.main.humidity,
      description: item.weather[0].description,
      icon:        item.weather[0].icon,
      wind:        item.wind.speed.toFixed(1),
      rain:        item.rain ? (item.rain['3h'] || 0) : 0
    }));

    res.json({
      success: true,
      data: {
        city:     forecastData.city?.name || city,
        country:  forecastData.city?.country || '',
        forecast: forecast
      },
      source: 'live'
    });
  } catch (error) {
    console.error("❌ Erreur dans getForecast:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération des prévisions" });
  }
};

exports.getWeatherHistory = async (req, res) => {
  try {
    const { city, days } = req.query;
    if (!city) return res.status(400).json({ success: false, error: "Ville requise" });

    const nbDays  = parseInt(days) || 7;
    const history = await weatherService.getWeatherHistory(city, nbDays);

    res.json({ success: true, data: history, count: history.length, period: `${nbDays} jours`, city });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * ✅ GET /api/weather/by-city?city=Tunis&country=TN
 * Récupère les données météo pour une ville spécifique
 * Utilisé par la page Irrigation pour la météo dynamique
 */
exports.getWeatherByCity = async (req, res) => {
  try {
    const { city, country = 'TN' } = req.query;
    
    if (!city) {
      return res.status(400).json({ 
        success: false, 
        error: 'Le paramètre "city" est requis' 
      });
    }
    
    const fullCityName = country ? `${city},${country}` : city;
    
    // Vérifier le cache dans la base de données
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const cachedWeather = await Weather.findOne({
      ville: { $regex: new RegExp(`^${city}$`, 'i') },
      date: { $gte: today, $lt: tomorrow }
    });
    
    // Utilisation de la nouvelle fonction isET0Valid
    if (cachedWeather && isET0Valid(cachedWeather.et0)) {
      console.log(`✅ [by-city] Cache valide pour ${city} — ET₀: ${cachedWeather.et0} mm/j`);
      return res.json({
        success: true,
        data: {
          ville: city,
          pays: country,
          temperature: cachedWeather.temperature?.avg,
          humidity: cachedWeather.humidity?.avg,
          windSpeed: cachedWeather.wind?.speed,
          pressure: cachedWeather.pressure,
          et0: cachedWeather.et0,
          date: cachedWeather.date,
          source: 'cache'
        }
      });
    }
    
    // Tentative via OpenWeather API
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (apiKey && apiKey !== 'your_openweather_api_key_here') {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(fullCityName)}&appid=${apiKey}&units=metric`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        const temp = data.main.temp;
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed;
        const pressure = data.main.pressure;
        
        // Calcul de l'ET₀ (formule Hargreaves simplifiée)
        let et0 = 4.0;
        if (temp) {
          et0 = parseFloat((0.0023 * (temp + 17.8) * Math.sqrt(8)).toFixed(2));
          et0 = Math.max(ET0_MIN_VALID, Math.min(ET0_MAX_VALID, et0));
        }
        
        // Sauvegarder dans la base de données
        await Weather.findOneAndUpdate(
          { 
            ville: city,
            date: { $gte: today, $lt: tomorrow }
          },
          {
            ville: city,
            date: today,
            temperature: { avg: temp, min: temp - 2, max: temp + 2 },
            humidity: { avg: humidity },
            wind: { speed: windSpeed },
            pressure: pressure,
            et0: et0,
            source: 'openweather'
          },
          { upsert: true, new: true }
        );
        
        return res.json({
          success: true,
          data: {
            ville: city,
            pays: country,
            temperature: temp,
            humidity: humidity,
            windSpeed: windSpeed,
            pressure: pressure,
            et0: et0,
            date: new Date(),
            source: 'openweather'
          }
        });
      }
    }
    
    // Dernier recours : valeurs par défaut
    return res.json({
      success: true,
      data: {
        ville: city,
        pays: country,
        temperature: 22,
        humidity: 60,
        windSpeed: 12,
        et0: ET0_MAX_VALID * 0.15, // Valeur par défaut raisonnable (4.5 si max=30)
        date: new Date(),
        source: 'default'
      }
    });
    
  } catch (error) {
    console.error('❌ [by-city] Erreur:', error);
    
    return res.json({
      success: true,
      data: {
        ville: req.query.city || 'Tunis',
        pays: req.query.country || 'TN',
        temperature: 22,
        humidity: 60,
        windSpeed: 12,
        et0: ET0_MAX_VALID * 0.15,
        date: new Date(),
        source: 'fallback'
      }
    });
  }
};

exports.calculateET0 = async (req, res) => {
  try {
    const { tmax, tmin, hrmax, hrmin, windSpeed, solarRadiation, altitude, latitude } = req.body;

    if (!tmax || !tmin || !windSpeed) {
      return res.status(400).json({ success: false, error: "tmax, tmin, windSpeed requis" });
    }

    const et0 = etoCalculator.calculatePenmanMonteith({
      tmax:           parseFloat(tmax),
      tmin:           parseFloat(tmin),
      hrmax:          parseFloat(hrmax || 80),
      hrmin:          parseFloat(hrmin || 60),
      windSpeed:      parseFloat(windSpeed),
      solarRadiation: parseFloat(solarRadiation || 20),
      altitude:       parseFloat(altitude || 0),
      latitude:       parseFloat(latitude || 36.8),
      dayOfYear:      Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000),
    });

    res.json({ success: true, data: { et0: parseFloat(et0.toFixed(2)), params: req.body } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.calculateETc = async (req, res) => {
  try {
    const { et0, kc, surface, efficacite } = req.body;
    if (!et0 || !kc) return res.status(400).json({ success: false, error: "ET₀ et Kc requis" });

    const etc     = etoCalculator.calculateETc(parseFloat(et0), parseFloat(kc));
    const volumes = surface
      ? etoCalculator.convertToVolume(etc, parseFloat(surface), parseFloat(efficacite || 0.9))
      : null;

    res.json({ success: true, data: { et0: parseFloat(et0), kc: parseFloat(kc), etc, volumes } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getWeatherByCoords = async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ success: false, error: "Latitude et longitude requises" });

    const weatherData = await weatherService.saveWeatherData(null, lat, lon);
    res.json({ success: true, data: weatherData, source: 'live' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAllLatestWeather = async (req, res) => {
  try {
    const cities = await Weather.aggregate([
      { $sort: { date: -1 } },
      { $group: { _id: "$location.city", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } }
    ]);
    res.json({ success: true, data: cities, count: cities.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.cleanupOldData = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const result = await Weather.deleteMany({ date: { $lt: thirtyDaysAgo } });
    res.json({ success: true, message: `${result.deletedCount} entrées supprimées`, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// =============================================
// ✅ ROUTES PROXY POUR OPENWEATHER
// =============================================

/**
 * Proxy pour les données météo actuelles d'OpenWeather
 * GET /api/weather/openweather/current?city=Tunis
 * GET /api/weather/openweather/current?lat=36.8&lon=10.18
 * 
 * Cette route sert de proxy sécurisé vers l'API OpenWeather.
 * La clé API n'est jamais exposée au client.
 */
exports.getOpenWeatherCurrent = async (req, res) => {
  try {
    const { city, lat, lon } = req.query;

    if (!city && (!lat || !lon)) {
      return res.status(400).json({
        success: false,
        error: "Veuillez spécifier une ville (city) ou des coordonnées (lat, lon)"
      });
    }

    console.log(`🔄 [PROXY] OpenWeather Current: ${city || `lat=${lat}, lon=${lon}`}`);
    
    const weatherData = await weatherService.getCurrentWeather(city, lat, lon);

    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      success: true,
      data: weatherData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ [PROXY] Erreur OpenWeather current:", error.message);
    
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      if (status === 404 || message.includes('city not found')) {
        return res.status(404).json({
          success: false,
          error: "Ville non trouvée. Vérifiez l'orthographe."
        });
      }
      
      if (status === 401) {
        return res.status(500).json({
          success: false,
          error: "Erreur de configuration API (clé invalide)."
        });
      }
      
      if (status === 429) {
        return res.status(429).json({
          success: false,
          error: "Limite de requêtes atteinte. Réessayez dans quelques minutes."
        });
      }
      
      return res.status(status).json({
        success: false,
        error: message
      });
    }

    res.status(500).json({
      success: false,
      error: "Erreur lors de la communication avec le service météo."
    });
  }
};

/**
 * Proxy pour les prévisions météo d'OpenWeather
 * GET /api/weather/openweather/forecast?city=Tunis
 * GET /api/weather/openweather/forecast?lat=36.8&lon=10.18
 */
exports.getOpenWeatherForecast = async (req, res) => {
  try {
    const { city, lat, lon } = req.query;

    if (!city && (!lat || !lon)) {
      return res.status(400).json({
        success: false,
        error: "Veuillez spécifier une ville (city) ou des coordonnées (lat, lon)"
      });
    }

    console.log(`🔄 [PROXY] OpenWeather Forecast: ${city || `lat=${lat}, lon=${lon}`}`);
    
    const forecastData = await weatherService.getForecast(city, lat, lon);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: forecastData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ [PROXY] Erreur OpenWeather forecast:", error.message);
    
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      if (status === 404) {
        return res.status(404).json({
          success: false,
          error: "Ville non trouvée."
        });
      }
      
      if (status === 429) {
        return res.status(429).json({
          success: false,
          error: "Limite de requêtes atteinte. Réessayez plus tard."
        });
      }
      
      return res.status(status).json({
        success: false,
        error: message
      });
    }

    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des prévisions."
    });
  }
};

/**
 * GET /api/weather/openweather/combined?city=Tunis
 * Route combinée qui retourne à la fois les données actuelles ET les prévisions
 */
exports.getOpenWeatherCombined = async (req, res) => {
  try {
    const { city, lat, lon } = req.query;

    if (!city && (!lat || !lon)) {
      return res.status(400).json({
        success: false,
        error: "Ville ou coordonnées requises"
      });
    }

    console.log(`🔄 [PROXY] OpenWeather Combined: ${city || `${lat},${lon}`}`);
    
    const [currentData, forecastData] = await Promise.all([
      weatherService.getCurrentWeather(city, lat, lon),
      weatherService.getForecast(city, lat, lon)
    ]);

    res.set('Cache-Control', 'public, max-age=600');
    res.json({
      success: true,
      data: {
        current: currentData,
        forecast: forecastData
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ [PROXY] Erreur OpenWeather combined:", error.message);
    
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des données combinées."
    });
  }
};

exports.geocodeSearch = async (req, res) => {
  try {
    const { q, limit = 6 } = req.query;
    if (!q || String(q).trim().length < 2) {
      return res.status(400).json({ success: false, error: "Requête trop courte" });
    }
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q.trim())}&format=json&limit=${limit}&addressdetails=1&accept-language=fr`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SmartIrrig/1.0 (smartirrigservice@gmail.com)' }
    });
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: "Erreur geocoding" });
    }
    const data = await response.json();
    const seen = new Set();
    const results = data
      .filter(item => item.lat && item.lon)
      .map(item => {
        const addr    = item.address || {};
        const name    = addr.village || addr.town || addr.city || addr.municipality || addr.county || item.display_name.split(',')[0];
        const state   = addr.state || addr.county || null;
        const country = addr.country_code?.toUpperCase() || '';
        const label   = [name, state, country].filter(Boolean).join(', ');
        return { name, state, country, lat: parseFloat(item.lat), lon: parseFloat(item.lon), label };
      })
      .filter(item => { const k = item.label; if (seen.has(k)) return false; seen.add(k); return true; });

    res.set('Cache-Control', 'public, max-age=86400');
    res.json({ success: true, data: results });
  } catch (error) {
    console.error("❌ [GEOCODE] Erreur:", error.message);
    res.status(500).json({ success: false, error: "Erreur serveur geocoding" });
  }
};

// Export des constantes pour utilisation éventuelle dans d'autres fichiers
module.exports.ET0_MIN_VALID = ET0_MIN_VALID;
module.exports.ET0_MAX_VALID = ET0_MAX_VALID;
module.exports.isET0Valid = isET0Valid;