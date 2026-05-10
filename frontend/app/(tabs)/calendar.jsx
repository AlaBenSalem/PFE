// app/(tabs)/calendar.jsx
// Affiche uniquement les données climatiques (température, humidité, vent, pluie, ET₀)
// • Aujourd'hui  : météo actuelle
// • Jours futurs : prévisions jusqu'à 5 jours
// • Jours passés : aucune donnée historique disponible (API gratuite)

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import {
  getOpenWeatherBundle,
  getWeatherForecastWithET0,
  prefetchCurrentWeather,
} from "@api/weather";
import { BrandHeader } from "@components/BrandHeader";
import { useLanguage } from "@context/LanguageContext";
import { API_BASE_URL, apiFetch } from "@api/client";
import CitySearchInput from "@components/CitySearchInput";

// ── Helpers ─────────────────────────────────────────────────────────────────

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildDay(tMin, tMax, tCur, humidity, wind, gust, rain, description, et0, location, type) {
  return {
    temp_min:    Math.round(tMin),
    temp_max:    Math.round(tMax),
    temp_current: Math.round(tCur),
    humidity:    Math.round(humidity),
    humidity_min: Math.max(Math.round(humidity) - 10, 0),
    humidity_max: Math.min(Math.round(humidity) + 10, 100),
    wind:        Number(wind).toFixed(1),
    wind_gust:   Number(gust).toFixed(1),
    rain:        Number(rain).toFixed(1),
    et0:         Number(et0).toFixed(2),
    description: description || "--",
    location,
    type,
  };
}

function estimateET0Fallback(tMax, tMin, humidity) {
  const tMoy   = (tMax + tMin) / 2;
  const tRange = Math.max(tMax - tMin, 1);
  const Rs     = 18 * (1 - humidity / 200);
  const et0    = 0.0135 * (tMoy + 17.8) * Math.sqrt(tRange) * Math.sqrt(Rs / 10);
  return Math.max(0.5, Math.min(12, parseFloat(et0.toFixed(2))));
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { t, language } = useLanguage();
  const s = styles;
  const today = getLocalDateString();

  const [selectedDate, setSelectedDate] = useState(today);
  const [dayMap,       setDayMap]       = useState({});
  const [loading,      setLoading]      = useState(false);
  const [city,         setCity]         = useState("Tunis");
  const [coords,       setCoords]       = useState({ lat: null, lon: null });
  const [fetchKey,     setFetchKey]     = useState(0);
  const [fetchError,   setFetchError]   = useState(null); // null | "server" | "city"
  const autoRetryRef  = useRef(null);
  const retryCountRef = useRef(0);

  const fetchAll = useCallback(async (cityName, lat = null, lon = null) => {
    if (!cityName?.trim()) {
      Alert.alert(t("common.error"), t("calendar.invalidCity"));
      return;
    }
    try {
      setLoading(true);
      setFetchError(null);
      if (autoRetryRef.current) { clearTimeout(autoRetryRef.current); autoRetryRef.current = null; }
      const map = {};
      const owLang = { fr: "fr", en: "en", ar: "ar", tr: "tr" }[language] || "fr";
      const { current, currentResponse, forecast, backendET0 } =
        await getOpenWeatherBundle(cityName, owLang, lat, lon);

      if (!currentResponse?.ok || !current) {
        const isServerDown = !currentResponse || currentResponse.status >= 500 || currentResponse.status === 0;
        setFetchError(isServerDown ? "server" : "city");
        if (isServerDown && retryCountRef.current < 1) {
          retryCountRef.current += 1;
          autoRetryRef.current = setTimeout(() => fetchAll(cityName, lat, lon), 12000);
        }
        setLoading(false);
        return;
      }

      const latitude        = current.coord?.lat || 36.8;
      const location        = { city: current.name, country: current.sys?.country || "" };
      const currentMin      = current.main?.temp_min  ?? current.main?.temp ?? 0;
      const currentMax      = current.main?.temp_max  ?? current.main?.temp ?? 0;
      const currentTemp     = current.main?.temp      ?? 0;
      const currentHumidity = current.main?.humidity  ?? 60;
      const currentWind     = current.wind?.speed     || 0;
      const currentGust     = current.wind?.gust      || currentWind;
      const currentRain     =
        (current.rain?.["1h"] || 0) + (current.rain?.["3h"] || 0) + (current.snow?.["1h"] || 0);

      let finalET0 = backendET0;
      if (!finalET0) {
        try {
          const r = await apiFetch(`${API_BASE_URL}/weather/calculate-et0`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tmax: currentMax, tmin: currentMin,
              hrmax: Math.min(currentHumidity + 15, 100),
              hrmin: Math.max(currentHumidity - 15, 0),
              windSpeed: currentWind, latitude,
            }),
          });
          if (r.ok) {
            const d = await r.json();
            if (d.success && d.data.et0 > 0) finalET0 = d.data.et0;
          }
        } catch {}
        if (!finalET0) finalET0 = estimateET0Fallback(currentMax, currentMin, currentHumidity);
      }

      const todayLocal = getLocalDateString();
      map[todayLocal] = buildDay(
        currentMin, currentMax, currentTemp, currentHumidity,
        currentWind, currentGust, currentRain,
        current.weather?.[0]?.description, finalET0 || 0, location, "current"
      );

      let forecastET0Map = {};
      try {
        const d = await getWeatherForecastWithET0(cityName, 7, lat, lon);
        if (d?.et0Map) forecastET0Map = d.et0Map;
      } catch {}

      if (forecast?.list?.length) {
        const grouped = {};
        forecast.list.forEach((item) => {
          const key = getLocalDateString(new Date(item.dt * 1000));
          if (key >= todayLocal) {
            grouped[key] = grouped[key] || [];
            grouped[key].push(item);
          }
        });

        if (grouped[todayLocal]) {
          const rainSum = grouped[todayLocal].reduce(
            (s, i) => s + (i.rain?.["3h"] || 0) + (i.rain?.["1h"] || 0) + (i.snow?.["3h"] || 0), 0
          );
          const total = Math.max(currentRain, rainSum);
          if (total > parseFloat(map[todayLocal].rain))
            map[todayLocal] = { ...map[todayLocal], rain: Number(total).toFixed(1) };
        }

        Object.entries(grouped).forEach(([key, items]) => {
          if (key === todayLocal) return;
          const tMin  = Math.min(...items.map((i) => i.main.temp_min));
          const tMax  = Math.max(...items.map((i) => i.main.temp_max));
          const tMean = items.reduce((s, i) => s + i.main.temp, 0) / items.length;
          const hum   = items.reduce((s, i) => s + i.main.humidity, 0) / items.length;
          const wind  = items.reduce((s, i) => s + (i.wind?.speed || 0), 0) / items.length;
          const gust  = Math.max(...items.map((i) => i.wind?.gust || i.wind?.speed || 0));
          const rain  = items.reduce(
            (s, i) => s + (i.rain?.["3h"] || 0) + (i.rain?.["1h"] || 0) + (i.snow?.["3h"] || 0), 0
          );
          const mid   = items.find((i) => new Date(i.dt * 1000).getHours() === 12)
                     || items[Math.floor(items.length / 2)];
          const et0   = forecastET0Map[key] || estimateET0Fallback(tMax, tMin, hum);
          map[key] = buildDay(tMin, tMax, tMean, hum, wind, gust, rain,
            mid?.weather?.[0]?.description, et0, location, "forecast");
        });
      }

      setDayMap(map);
      try { await prefetchCurrentWeather(cityName); } catch {}
    } catch (err) {
      console.error("Calendar - fetchAll:", err.message);
      setFetchError("server");
      if (retryCountRef.current < 1) {
        retryCountRef.current += 1;
        autoRetryRef.current = setTimeout(() => fetchAll(cityName, lat, lon), 12000);
      }
    } finally {
      setLoading(false);
    }
  }, [t, language]);

  useEffect(() => { if (city?.trim()) fetchAll(city, coords.lat, coords.lon); }, [city, coords, fetchKey, fetchAll]);

  const handleSelectCity = (cityName, lat, lon) => {
    if (cityName?.trim()) {
      retryCountRef.current = 0;
      setCoords({ lat: lat ?? null, lon: lon ?? null });
      setCity(cityName.trim());
      setFetchKey(k => k + 1);
    }
  };

  const formatDate = (value) => {
    try {
      return new Date(value).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      });
    } catch { return "Date invalide"; }
  };

  const getIcon = (description = "") => {
    const d = description.toLowerCase();
    if (d.includes("pluie") || d.includes("rain") || d.includes("drizzle") || d.includes("bruine")) return "rainy";
    if (d.includes("orage") || d.includes("thunder")) return "thunderstorm";
    if (d.includes("nuage") || d.includes("cloud") || d.includes("couvert") || d.includes("overcast")) return "cloudy";
    if (d.includes("degage") || d.includes("clear")) return "sunny";
    return "partly-sunny";
  };

  // ── Calendar markers ─────────────────────────────────────────────────────
  const todayLocal = getLocalDateString();
  const marked = {};

  Object.entries(dayMap).forEach(([dateKey, data]) => {
    const color = dateKey === todayLocal ? "#4CAF50" : "#3b82f6";
    marked[dateKey] = {
      dots: [{ key: "weather", color, selectedDotColor: "#fff" }],
    };
  });

  marked[selectedDate] = {
    ...(marked[selectedDate] || {}),
    selected: true,
    selectedColor: "#4CAF50",
    selectedTextColor: "#fff",
  };

  const dayWeather = dayMap[selectedDate] || null;
  const isPast     = selectedDate < todayLocal;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <BrandHeader title={t("calendar.title")} />

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>

        {/* Barre de recherche ville */}
        <View style={{ zIndex: 9999 }}>
          <CitySearchInput
            placeholder={t("calendar.searchPlaceholder") || "Entrer une ville..."}
            onSelectCity={handleSelectCity}
          />
        </View>

        {dayWeather && (
          <View style={s.locationRow}>
            <Ionicons name="location" size={16} color="#666" />
            <Text style={s.locationText}>
              {city} — {dayWeather.location?.country || "TN"}
            </Text>
          </View>
        )}

        {/* Calendrier */}
        <Calendar
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={marked}
          markingType="multi-dot"
          theme={{
            calendarBackground: '#ffffff',
            todayTextColor: "#4CAF50",
            arrowColor: "#4CAF50",
            selectedDayBackgroundColor: "#4CAF50",
            selectedDayTextColor: "#fff",
            monthTextColor: '#333',
            textMonthFontWeight: "bold",
            dayTextColor: '#1f2937',
            textDisabledColor: '#d1d5db',
            backgroundColor: '#ffffff',
          }}
          style={{ marginHorizontal: 8, marginBottom: 4 }}
        />

        {/* Légende */}
        <View style={s.legendRow}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: "#4CAF50" }]} />
            <Text style={s.legendText}>Aujourd'hui</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: "#3b82f6" }]} />
            <Text style={s.legendText}>Prévisions</Text>
          </View>
        </View>

        {/* Contenu */}
        {loading ? (
          <View style={{ marginTop: 32, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={{ marginTop: 8, color: "#6b7280" }}>{t("common.loading") || "Chargement..."}</Text>
          </View>

        ) : isPast ? (
          /* ── Jour passé : pas de données historiques ── */
          <View style={s.noDataCard}>
            <Ionicons name="time-outline" size={48} color="#d1d5db" />
            <Text style={s.noDataTitle}>{formatDate(selectedDate)}</Text>
            <Text style={s.noDataText}>
              Les données météo historiques ne sont pas disponibles.{"\n"}
              Sélectionnez aujourd'hui ou un jour futur.
            </Text>
          </View>

        ) : dayWeather ? (
          /* ── Météo disponible ── */
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Ionicons name={getIcon(dayWeather.description)} size={28} color="#f4b400" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={s.cardTitle}>
                  {t("calendar.weatherFor") || "Météo du"} {formatDate(selectedDate)}
                </Text>
                <Text style={s.cardDesc}>{dayWeather.description}</Text>
              </View>
            </View>

            <View style={s.gridRow}>
              <View style={s.gridCell}>
                <MaterialCommunityIcons name="thermometer" size={28} color="#ff5252" />
                <Text style={s.gridVal}>{dayWeather.temp_min}° / {dayWeather.temp_max}°C</Text>
                <Text style={s.gridLabel}>{t("calendar.minmax")}</Text>
                <Text style={s.gridSub}>{t("calendar.current")}: {dayWeather.temp_current}°C</Text>
              </View>
              <View style={s.gridCell}>
                <Ionicons name="water" size={28} color="#03a9f4" />
                <Text style={s.gridVal}>{dayWeather.humidity}%</Text>
                <Text style={s.gridLabel}>{t("calendar.humidity")}</Text>
                <Text style={s.gridSub}>{dayWeather.humidity_min} – {dayWeather.humidity_max}%</Text>
              </View>
            </View>

            <View style={s.gridRow}>
              <View style={s.gridCell}>
                <FontAwesome5 name="wind" size={24} color="#555" />
                <Text style={s.gridVal}>{dayWeather.wind} m/s</Text>
                <Text style={s.gridLabel}>{t("calendar.wind")}</Text>
                <Text style={s.gridSub}>{t("calendar.gusts")}: {dayWeather.wind_gust} m/s</Text>
              </View>
              <View style={s.gridCell}>
                <Ionicons name="rainy" size={28} color="#2196f3" />
                <Text style={[s.gridVal, parseFloat(dayWeather.rain) > 0 && { color: "#2196f3" }]}>
                  {dayWeather.rain} mm
                </Text>
                <Text style={s.gridLabel}>{t("calendar.rain")}</Text>
                <Text style={s.gridSub}>
                  {parseFloat(dayWeather.rain) > 0 ? `⛈ ${t("home.precipitation")}` : t("home.precipitation")}
                </Text>
              </View>
            </View>

            <View style={s.et0Row}>
              <Ionicons name="leaf-outline" size={16} color="#16a34a" />
              <Text style={s.et0Text}>ET₀ = {dayWeather.et0} mm/j</Text>
            </View>
          </View>

        ) : (
          /* ── Erreur / pas encore chargé ── */
          <View style={s.noDataCard}>
            <Ionicons
              name={fetchError === "city" ? "location-outline" : "cloud-offline-outline"}
              size={48}
              color="#d1d5db"
            />
            <Text style={s.noDataText}>
              {fetchError === "city"
                ? "Ville non trouvée.\nVérifiez le nom et réessayez."
                : fetchError === "server"
                ? "Serveur en démarrage...\nRéessai automatique dans quelques instants."
                : t("calendar.noData") || "Aucune donnée"}
            </Text>
            {fetchError === "server" && (
              <ActivityIndicator size="small" color="#22c55e" style={{ marginTop: 10 }} />
            )}
            <TouchableOpacity
              style={[s.retryBtn, { marginTop: fetchError === "server" ? 10 : 16 }]}
              onPress={() => fetchAll(city)}
            >
              <Text style={s.retryBtnText}>{t("common.retry") || "Réessayer"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((() => {
  const card   = '#ffffff';
  const cell   = '#f9fafb';
  const border = '#f3f4f6';
  const text   = '#1f2937';
  const muted  = '#6b7280';
  const faint  = '#9ca3af';
  const locTxt = '#4b5563';

  return {
    locationRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8 },
    locationText: { marginLeft: 4, color: locTxt, fontSize: 13 },
    legendRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 10, gap: 16 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: muted },
    card: {
      backgroundColor: card, marginHorizontal: 16, marginTop: 4, padding: 20,
      borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    cardHeader: {
      flexDirection: "row", alignItems: "center", marginBottom: 16,
      paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: border,
    },
    cardTitle: { fontWeight: "700", color: text, fontSize: 14 },
    cardDesc:  { color: muted, fontSize: 13, textTransform: "capitalize", marginTop: 2 },
    gridRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    gridCell:  {
      backgroundColor: cell, width: "48%", padding: 14,
      borderRadius: 12, borderWidth: 1, borderColor: border, alignItems: "center",
    },
    gridVal:   { fontWeight: "700", fontSize: 18, color: text, marginTop: 6 },
    gridLabel: { fontSize: 12, color: muted, marginTop: 2 },
    gridSub:   { fontSize: 11, color: faint, marginTop: 2 },
    et0Row: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      backgroundColor: '#f0fdf4', borderRadius: 10, paddingVertical: 8, marginTop: 4,
    },
    et0Text: { marginLeft: 6, fontSize: 13, fontWeight: "700", color: "#16a34a" },
    noDataCard: {
      backgroundColor: card, marginHorizontal: 16, marginTop: 8,
      padding: 32, borderRadius: 16, alignItems: "center",
    },
    noDataTitle:  { marginTop: 12, fontWeight: "700", color: text, fontSize: 15, textAlign: "center" },
    noDataText:   { marginTop: 8, color: muted, fontSize: 13, textAlign: "center", lineHeight: 20 },
    retryBtn:     { marginTop: 16, backgroundColor: "#22c55e", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 99 },
    retryBtnText: { color: "#fff", fontWeight: "700" },
  };
})());
