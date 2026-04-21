// frontend/api/weather.js
import { API_BASE_URL, apiFetch } from "@api/client";

// ❌ SUPPRIMER cette ligne - la clé ne doit JAMAIS être dans le frontend
// const OPEN_WEATHER_KEY = "2cb8eb8d3fefa584e0f6f1f7fb50303f";

/**
 * Récupère les données météo complètes (current + forecast + ET₀)
 * ✅ Passe par le backend pour TOUS les appels OpenWeather
 */
export async function getOpenWeatherBundle(cityName, language = "fr") {
  const encodedCity = encodeURIComponent(String(cityName || "").trim());
  
  try {
    // ✅ Appels PARALLÈLES aux proxies backend
    const [currentResponse, forecastResponse, backendWeatherResponse] = await Promise.all([
      apiFetch(`${API_BASE_URL}/weather/openweather/current?city=${encodedCity}`),
      apiFetch(`${API_BASE_URL}/weather/openweather/forecast?city=${encodedCity}`),
      apiFetch(`${API_BASE_URL}/weather/current?city=${encodedCity}`)
    ]);

    const currentData = await currentResponse.json();
    const forecastData = await forecastResponse.json();
    const backendData = await backendWeatherResponse.json();

    // Extraire les données
    const current = currentData.success ? currentData.data : null;
    const forecast = forecastData.success ? forecastData.data : { list: [] };
    
    // ET₀ calculé par le backend avec FAO-56
    const backendET0 = backendData.success && backendData.data ? backendData.data.et0 : 0;

    console.log('✅ Données récupérées via proxy backend:');
    console.log('  - Current weather:', current ? 'OK' : 'Failed');
    console.log('  - Forecast:', forecast.list?.length || 0, 'items');
    console.log('  - ET₀ backend:', backendET0, 'mm/j');

    return {
      current,
      currentResponse: { ok: currentResponse.ok, status: currentResponse.status },
      forecast,
      backendET0,
      backendWeatherData: backendData.success ? backendData.data : null
    };
  } catch (error) {
    console.error('❌ Erreur getOpenWeatherBundle:', error);
    
    // Retourner un objet vide en cas d'erreur
    return {
      current: null,
      currentResponse: { ok: false, status: 500 },
      forecast: { list: [] },
      backendET0: 0,
      backendWeatherData: null
    };
  }
}

/**
 * Récupère les prévisions avec ET₀ calculé
 */
export async function getWeatherForecastWithET0(cityName, days = 7) {
  const encodedCity = encodeURIComponent(String(cityName || "").trim());
  
  try {
    // Récupérer les prévisions via le proxy
    const forecastResponse = await apiFetch(
      `${API_BASE_URL}/weather/openweather/forecast?city=${encodedCity}`
    );
    const forecastData = await forecastResponse.json();
    
    if (!forecastData.success || !forecastData.data) {
      return { forecast: [], et0Map: {} };
    }

    const forecast = forecastData.data;
    const et0Map = {};
    
    // Grouper par jour
    const groupedByDay = {};
    
    if (forecast.list && Array.isArray(forecast.list)) {
      forecast.list.forEach(item => {
        const dateKey = new Date(item.dt * 1000).toISOString().split('T')[0];
        if (!groupedByDay[dateKey]) {
          groupedByDay[dateKey] = [];
        }
        groupedByDay[dateKey].push(item);
      });
      
      // Calculer ET₀ pour chaque jour
      for (const [dateKey, items] of Object.entries(groupedByDay)) {
        if (items.length === 0) continue;
        
        const tmax = Math.max(...items.map(i => i.main?.temp_max || 20));
        const tmin = Math.min(...items.map(i => i.main?.temp_min || 15));
        const avgHumidity = items.reduce((sum, i) => sum + (i.main?.humidity || 60), 0) / items.length;
        const avgWind = items.reduce((sum, i) => sum + (i.wind?.speed || 2), 0) / items.length;
        
        try {
          const et0Response = await apiFetch(`${API_BASE_URL}/weather/calculate-et0`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tmax,
              tmin,
              hrmax: Math.min(avgHumidity + 10, 100),
              hrmin: Math.max(avgHumidity - 10, 0),
              windSpeed: avgWind,
              latitude: forecast.city?.coord?.lat || 36.8
            })
          });
          const et0Data = await et0Response.json();
          
          if (et0Data.success && et0Data.data) {
            et0Map[dateKey] = et0Data.data.et0;
          }
        } catch (error) {
          console.warn(`⚠️ Pas d'ET₀ pour ${dateKey}:`, error.message);
          et0Map[dateKey] = 0;
        }
      }
    }
    
    return {
      forecast: forecast.list || [],
      et0Map
    };
  } catch (error) {
    console.error('❌ Erreur getWeatherForecastWithET0:', error);
    return { forecast: [], et0Map: {} };
  }
}

/**
 * Récupère l'historique météo
 */
export async function getWeatherHistory(cityName, days = 30) {
  const encodedCity = encodeURIComponent(String(cityName || "").trim());
  const response = await apiFetch(
    `${API_BASE_URL}/weather/history?city=${encodedCity}&days=${days}`,
  );
  return response.json();
}

/**
 * Précharge les données météo (pour le cache)
 */
export async function prefetchCurrentWeather(cityName) {
  const encodedCity = encodeURIComponent(String(cityName || "").trim());
  return apiFetch(`${API_BASE_URL}/weather/current?city=${encodedCity}`);
}

/**
 * ✅ Nouvelle fonction : Récupère UNIQUEMENT les données OpenWeather (sans ET₀)
 */
export async function getRawOpenWeatherData(cityName) {
  const encodedCity = encodeURIComponent(String(cityName || "").trim());
  
  try {
    const [currentRes, forecastRes] = await Promise.all([
      apiFetch(`${API_BASE_URL}/weather/openweather/current?city=${encodedCity}`),
      apiFetch(`${API_BASE_URL}/weather/openweather/forecast?city=${encodedCity}`)
    ]);
    
    const current = await currentRes.json();
    const forecast = await forecastRes.json();
    
    return {
      current: current.success ? current.data : null,
      forecast: forecast.success ? forecast.data : null
    };
  } catch (error) {
    console.error('❌ Erreur getRawOpenWeatherData:', error);
    return { current: null, forecast: null };
  }
}