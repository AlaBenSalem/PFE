const axios = require('axios');
const Weather = require('../models/Weather');
const etoCalculator = require('./etoCalculator');

class WeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  /**
   * Retourne le jour de l'année (1–365/366) à partir d'une date.
   */
  getDayOfYear(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  async getCurrentWeather(city, lat, lon) {
    try {
      let url;
      if (lat && lon) {
        url = `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=fr`;
      } else if (city) {
        const encodedCity = encodeURIComponent(city.trim());
        url = `${this.baseUrl}/weather?q=${encodedCity}&appid=${this.apiKey}&units=metric&lang=fr`;
      } else {
        throw new Error('Ville ou coordonnées requises');
      }

      console.log(`🌐 Appel API OpenWeather: ${url}`);
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching weather:', error.response?.data || error.message);
      throw error;
    }
  }

  async getForecast(city, lat, lon) {
    try {
      let url;
      if (lat && lon) {
        url = `${this.baseUrl}/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=fr`;
      } else if (city) {
        const encodedCity = encodeURIComponent(city.trim());
        url = `${this.baseUrl}/forecast?q=${encodedCity}&appid=${this.apiKey}&units=metric&lang=fr`;
      } else {
        throw new Error('Ville ou coordonnées requises');
      }

      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching forecast:', error.response?.data || error.message);
      return { list: [] };
    }
  }

  /**
   * Calcule ET₀ à partir des données météo OpenWeather.
   * ✅ Correction : dayOfYear calculé correctement (1–365).
   */
  calculateET0(weatherData, forecastItem = null) {
    try {
      const data = forecastItem || weatherData;

      const main   = data.main   || {};
      const wind   = data.wind   || {};
      const clouds = data.clouds || {};

      const tempCurrent = main.temp     || 20;
      const tempMin     = main.temp_min || tempCurrent - 2;
      const tempMax     = main.temp_max || tempCurrent + 2;
      const humidity    = main.humidity || 60;

      // ✅ Latitude réelle depuis les données OpenWeather
      const latitude = weatherData.coord?.lat || data.coord?.lat || 36.8;

      // ✅ Jour de l'année correct (1–365)
      const dayOfYear = this.getDayOfYear(new Date());

      const params = {
        tmax:           tempMax,
        tmin:           tempMin,
        hrmax:          Math.min(humidity + 10, 100),
        hrmin:          Math.max(humidity - 10, 20),
        windSpeed:      wind.speed || 2,
        solarRadiation: this.estimateSolarRadiation(clouds.all, data),
        altitude:       0,
        latitude:       latitude,
        dayOfYear:      dayOfYear,  // ✅ 1–365, plus getDate()
      };

      const et0 = etoCalculator.calculatePenmanMonteith(params);
      console.log(`✅ ET₀ calculé: ${et0} mm/j (lat=${latitude}, jour=${dayOfYear}, Tmax=${tempMax}°, Tmin=${tempMin}°, HR=${humidity}%, vent=${wind.speed} m/s)`);
      return et0;
    } catch (error) {
      console.error("❌ Erreur calcul ET₀:", error);
      return 3.5;
    }
  }

  estimateSolarRadiation(cloudCover, data) {
    try {
      const clouds = cloudCover ?? data?.clouds?.all ?? 50;
      const month = new Date().getMonth() + 1;
      let maxRadiation;

      if (month >= 5 && month <= 8) {
        maxRadiation = 28;
      } else if (month >= 3 && month <= 10) {
        maxRadiation = 22;
      } else {
        maxRadiation = 15;
      }

      return maxRadiation * (1 - clouds / 200);
    } catch (error) {
      return 18;
    }
  }

  async saveWeatherData(city, lat, lon) {
    try {
      console.log(`💾 Sauvegarde données météo pour: ${city || 'localisation'}`);

      const currentData  = await this.getCurrentWeather(city, lat, lon);
      const forecastData = await this.getForecast(city, lat, lon);

      const main    = currentData.main    || {};
      const wind    = currentData.wind    || {};
      const clouds  = currentData.clouds  || {};
      const rain    = currentData.rain    || {};
      const sys     = currentData.sys     || {};
      const coord   = currentData.coord   || {};
      const weather = currentData.weather?.[0] || {};

      const tempCurrent  = main.temp     || 20;
      const tempMin      = main.temp_min || tempCurrent - 2;
      const tempMax      = main.temp_max || tempCurrent + 2;
      const humidityCurr = main.humidity || 60;

      // ✅ ET₀ avec le bon dayOfYear
      const et0 = this.calculateET0(currentData);

      const forecast = forecastData.list
        ? forecastData.list.slice(0, 5).map(item => ({
            date:     new Date(item.dt * 1000),
            temp:     item.main.temp,
            humidity: item.main.humidity,
            et0:      this.calculateET0(currentData, item),
          }))
        : [];

      const weatherDoc = new Weather({
        location: {
          city:    currentData.name || city || 'Inconnue',
          lat:     coord.lat || lat || 0,
          lon:     coord.lon || lon || 0,
          country: sys.country || '',
        },
        date: new Date(),
        temperature: {
          current: tempCurrent,
          min:     tempMin,
          max:     tempMax,
          avg:     (tempMin + tempMax) / 2,
        },
        humidity: {
          current: humidityCurr,
          min:     Math.max(humidityCurr - 10, 20),
          max:     Math.min(humidityCurr + 10, 100),
          avg:     humidityCurr,
        },
        wind: {
          speed: wind.speed || 0,
          gust:  wind.gust  || 0,
        },
        pressure: main.pressure || 1013,
        precipitation: {
          rain: rain['1h'] || rain['3h'] || 0,
          snow: 0,
        },
        solarRadiation: this.estimateSolarRadiation(clouds.all, currentData),
        et0:         et0,
        description: weather.description || 'Ciel dégagé',
        icon:        weather.icon        || '01d',
        forecast:    forecast,
      });

      await weatherDoc.save();
      console.log(`✅ Météo sauvegardée: ${weatherDoc.location.city} (${weatherDoc.location.country}) — ET₀: ${et0.toFixed(2)} mm/j`);

      return weatherDoc;
    } catch (error) {
      console.error('❌ Error saving weather data:', error);
      throw error;
    }
  }

  async getLatestWeather(city) {
    try {
      return await Weather.findOne({
        'location.city': { $regex: new RegExp(`^${city}$`, 'i') },
      }).sort({ date: -1 }).exec();
    } catch (error) {
      console.error('❌ Error getting latest weather:', error);
      return null;
    }
  }

  async getWeatherHistory(city, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await Weather.find({
        'location.city': { $regex: new RegExp(`^${city}$`, 'i') },
        date: { $gte: startDate },
      }).sort({ date: -1 }).exec();
    } catch (error) {
      console.error('❌ Error getting weather history:', error);
      return [];
    }
  }
}

module.exports = new WeatherService();