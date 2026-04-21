// backend/routes/weatherRoutes.js
const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');

// Routes existantes
router.get('/current',       weatherController.getCurrentWeather);
router.get('/forecast',      weatherController.getForecast);
router.get('/history',       weatherController.getWeatherHistory);
router.get('/by-coords',     weatherController.getWeatherByCoords);
router.get('/latest-all',    weatherController.getAllLatestWeather);
router.post('/calculate-et0', weatherController.calculateET0);
router.post('/calculate-etc', weatherController.calculateETc);
router.delete('/cleanup',    weatherController.cleanupOldData);

// ✅ Nouvelles routes proxy pour OpenWeather (sécurisées)
router.get('/openweather/current',  weatherController.getOpenWeatherCurrent);
router.get('/openweather/forecast', weatherController.getOpenWeatherForecast);
router.get('/openweather/combined', weatherController.getOpenWeatherCombined);

module.exports = router;