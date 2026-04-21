// app/(tabs)/calendar.jsx — CORRIGÉ
// Fix 1 : import statique react-native-calendars (plus de risque de null render)
// Fix 2 : date locale au lieu de UTC (évite décalage timezone Tunisie UTC+1)
// Fix 3 : formule ET₀ secours remplacée par Hargreaves-Samani simplifié

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
// ✅ FIX 1 : import statique — plus de risque de CalendarComponent null
import { Calendar } from "react-native-calendars";
import {
  getOpenWeatherBundle,
  getWeatherForecastWithET0,
  prefetchCurrentWeather,
} from "@api/weather";
import { BrandHeader } from "@components/BrandHeader";
import { useLanguage } from "@context/LanguageContext";
import { API_BASE_URL, apiFetch } from "@api/client";

// ✅ FIX 2 : date locale (évite décalage UTC+1 en Tunisie entre minuit et 1h)
function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildDay(tMin, tMax, tCur, humidity, wind, gust, rain, description, et0, location, type) {
  return {
    temp_min: Math.round(tMin),
    temp_max: Math.round(tMax),
    temp_current: Math.round(tCur),
    humidity: Math.round(humidity),
    humidity_min: Math.max(Math.round(humidity) - 10, 0),
    humidity_max: Math.min(Math.round(humidity) + 10, 100),
    wind: Number(wind).toFixed(1),
    wind_gust: Number(gust).toFixed(1),
    rain: Number(rain).toFixed(1),
    et0: Number(et0).toFixed(2),
    description: description || "--",
    location,
    type,
  };
}

// ✅ FIX 3 : ET₀ secours basé sur Hargreaves-Samani simplifié
// ET0 = 0.0135 * (Tmoy + 17.8) * sqrt(Tmax - Tmin) * Rs_estimé
// Beaucoup plus proche de Penman-Monteith que la formule précédente
function estimateET0Fallback(tMax, tMin, humidity) {
  const tMoy    = (tMax + tMin) / 2;
  const tRange  = Math.max(tMax - tMin, 1);
  // Facteur solaire simplifié selon humidité (plus sec = plus de rayonnement)
  const Rs      = 18 * (1 - humidity / 200);
  const et0     = 0.0135 * (tMoy + 17.8) * Math.sqrt(tRange) * Math.sqrt(Rs / 10);
  return Math.max(0.5, Math.min(12, parseFloat(et0.toFixed(2))));
}

export default function CalendarScreen() {
  const { t, language } = useLanguage();
  // ✅ FIX 2 : utilise la date locale
  const today         = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayMap,       setDayMap]       = useState({});
  const [loading,      setLoading]      = useState(false);
  const [city,         setCity]         = useState("Tunis");
  const [inputCity,    setInputCity]    = useState("Tunis");

  const fetchAll = useCallback(
    async (cityName) => {
      if (!cityName || cityName.trim() === "") {
        Alert.alert(t("common.error"), "Veuillez entrer un nom de ville valide");
        return;
      }

      try {
        setLoading(true);
        const map = {};

        const owLang = { fr: "fr", en: "en", ar: "ar", tr: "tr" }[language] || "fr";
        const { current, currentResponse, forecast, backendET0 } =
          await getOpenWeatherBundle(cityName, owLang);

        if (!currentResponse?.ok || !current) {
          const isServerError = !currentResponse || currentResponse.status >= 500 || currentResponse.status === 0;
          Alert.alert(
            t("common.error"),
            isServerError
              ? "Serveur inaccessible. Vérifiez votre connexion ou réessayez dans quelques instants."
              : "Ville non trouvée. Vérifiez le nom."
          );
          setLoading(false);
          return;
        }

        const latitude     = current.coord?.lat || 36.8;
        const location     = { city: current.name, country: current.sys?.country || "" };
        const currentMin   = current.main?.temp_min  ?? current.main?.temp ?? 0;
        const currentMax   = current.main?.temp_max  ?? current.main?.temp ?? 0;
        const currentTemp  = current.main?.temp      ?? 0;
        const currentHumidity = current.main?.humidity ?? 60;
        const currentWind  = current.wind?.speed     || 0;
        const currentGust  = current.wind?.gust      || currentWind;
        const currentRain  =
          (current.rain?.["1h"] || 0) +
          (current.rain?.["3h"] || 0) +
          (current.snow?.["1h"] || 0);

        let finalET0 = backendET0;

        if (!finalET0 || finalET0 === 0) {
          try {
            const et0Response = await apiFetch(`${API_BASE_URL}/weather/calculate-et0`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tmax: currentMax,
                tmin: currentMin,
                hrmax: Math.min(currentHumidity + 15, 100),
                hrmin: Math.max(currentHumidity - 15, 0),
                windSpeed: currentWind,
                latitude,
              }),
            });
            if (et0Response.ok) {
              const et0Data = await et0Response.json();
              if (et0Data.success && et0Data.data.et0 > 0) {
                finalET0 = et0Data.data.et0;
              }
            }
          } catch (error) {
            console.error("Calendar - Échec fallback ET₀:", error.message);
          }
          // ✅ FIX 3 : Si API ET₀ aussi échoue, Hargreaves-Samani simplifié
          if (!finalET0 || finalET0 === 0) {
            finalET0 = estimateET0Fallback(currentMax, currentMin, currentHumidity);
            console.log(`Calendar - ET₀ secours Hargreaves: ${finalET0} mm/j`);
          }
        }

        // ✅ FIX 2 : utilise la date locale pour la clé
        const todayLocal = getLocalDateString();
        map[todayLocal] = buildDay(
          currentMin, currentMax, currentTemp, currentHumidity,
          currentWind, currentGust, currentRain,
          current.weather?.[0]?.description,
          finalET0 || 0,
          location,
          "current"
        );

        let forecastET0Map = {};
        try {
          const forecastET0Data = await getWeatherForecastWithET0(cityName, 7);
          if (forecastET0Data?.et0Map) forecastET0Map = forecastET0Data.et0Map;
        } catch (error) {
          console.error("Calendar - ET₀ prévisions:", error.message);
        }

        if (forecast?.list?.length) {
          const groupedDays = {};
          forecast.list.forEach((item) => {
            // ✅ FIX 2 : date locale pour les prévisions aussi
            const itemDate = new Date(item.dt * 1000);
            const dateKey  = getLocalDateString(itemDate);
            if (dateKey >= todayLocal) {
              groupedDays[dateKey] = groupedDays[dateKey] || [];
              groupedDays[dateKey].push(item);
            }
          });

          if (groupedDays[todayLocal]) {
            const items = groupedDays[todayLocal];
            const forecastRainToday = items.reduce(
              (sum, item) =>
                sum + (item.rain?.["3h"] || 0) + (item.rain?.["1h"] || 0) + (item.snow?.["3h"] || 0),
              0,
            );
            const totalRainToday = Math.max(currentRain, forecastRainToday);
            if (totalRainToday > parseFloat(map[todayLocal].rain)) {
              map[todayLocal] = { ...map[todayLocal], rain: Number(totalRainToday).toFixed(1) };
            }
          }

          Object.entries(groupedDays).forEach(([dateKey, items]) => {
            if (dateKey === todayLocal) return;

            const tMin    = Math.min(...items.map((i) => i.main.temp_min));
            const tMax    = Math.max(...items.map((i) => i.main.temp_max));
            const tMean   = items.reduce((s, i) => s + i.main.temp, 0) / items.length;
            const humidity = items.reduce((s, i) => s + i.main.humidity, 0) / items.length;
            const wind    = items.reduce((s, i) => s + (i.wind?.speed || 0), 0) / items.length;
            const gust    = Math.max(...items.map((i) => i.wind?.gust || i.wind?.speed || 0));
            const rain    = items.reduce(
              (s, i) => s + (i.rain?.["3h"] || 0) + (i.rain?.["1h"] || 0) + (i.snow?.["3h"] || 0),
              0,
            );
            const midDayItem =
              items.find((i) => new Date(i.dt * 1000).getHours() === 12) ||
              items[Math.floor(items.length / 2)];

            // ✅ FIX 3 : ET₀ secours Hargreaves-Samani au lieu de la formule incorrecte
            let forecastEt0 = forecastET0Map[dateKey] || 0;
            if (forecastEt0 === 0) {
              forecastEt0 = estimateET0Fallback(tMax, tMin, humidity);
            }

            map[dateKey] = buildDay(
              tMin, tMax, tMean, humidity, wind, gust, rain,
              midDayItem?.weather?.[0]?.description,
              forecastEt0,
              location,
              "forecast"
            );
          });
        }

        setDayMap(map);
        try { await prefetchCurrentWeather(cityName); } catch {}
      } catch (error) {
        console.error("Calendar - Erreur fetchAll:", error.message);
        Alert.alert(
          t("common.error"),
          error?.message || "Une erreur est survenue lors du chargement des données météo"
        );
      } finally {
        setLoading(false);
      }
    },
    [t, today],
  );

  useEffect(() => {
    if (city && city.trim()) fetchAll(city);
  }, [city, fetchAll]);

  const searchCity = () => {
    if (inputCity && inputCity.trim()) {
      setCity(inputCity.trim());
    } else {
      Alert.alert(t("common.error"), "Veuillez entrer un nom de ville");
    }
  };

  const formatDate = (value) => {
    try {
      return new Date(value).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      });
    } catch {
      return "Date invalide";
    }
  };

  const getIcon = (description = "") => {
    const text = description.toLowerCase();
    if (text.includes("pluie") || text.includes("rain") || text.includes("drizzle") || text.includes("bruine"))
      return "rainy";
    if (text.includes("orage") || text.includes("thunder")) return "thunderstorm";
    if (text.includes("nuage") || text.includes("cloud") || text.includes("couvert") || text.includes("overcast"))
      return "cloudy";
    if (text.includes("degage") || text.includes("clear") || text.includes("ciel dégagé"))
      return "sunny";
    return "partly-sunny";
  };

  // ✅ FIX 2 : today local pour les marqueurs du calendrier
  const todayLocal = getLocalDateString();
  const marked = {};
  marked[todayLocal] = { marked: true, dotColor: "#4CAF50", today: true };
  marked[selectedDate] = {
    ...(marked[selectedDate] || {}),
    selected: true,
    selectedColor: "#4CAF50",
  };

  Object.entries(dayMap).forEach(([dateKey, data]) => {
    if (data.type === "forecast" && dateKey > todayLocal) {
      marked[dateKey] = { ...(marked[dateKey] || {}), marked: true, dotColor: "#3b82f6" };
    }
  });

  const dayWeather = dayMap[selectedDate] || null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
      <BrandHeader title={t("calendar.title")} />

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            placeholder={t("calendar.searchPlaceholder") || "Entrer une ville..."}
            value={inputCity}
            onChangeText={setInputCity}
            onSubmitEditing={searchCity}
            returnKeyType="search"
          />
          <TouchableOpacity style={s.searchBtn} onPress={searchCity}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {dayWeather ? (
          <View style={s.locationRow}>
            <Ionicons name="location" size={16} color="#666" />
            <Text style={s.locationText}>
              {dayWeather.location?.city || city} - {dayWeather.location?.country || "TN"}
            </Text>
          </View>
        ) : null}

        {/* ✅ FIX 1 : Calendar importé statiquement, plus de condition null */}
        <Calendar
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={marked}
          theme={{
            todayTextColor: "#4CAF50",
            arrowColor: "#4CAF50",
            selectedDayBackgroundColor: "#4CAF50",
            selectedDayTextColor: "#fff",
            monthTextColor: "#333",
            textMonthFontWeight: "bold",
          }}
          style={{ marginHorizontal: 8, marginBottom: 8 }}
        />

        {loading ? (
          <View style={{ marginTop: 32, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={{ marginTop: 8, color: "#6b7280" }}>
              {t("common.loading") || "Chargement..."}
            </Text>
          </View>
        ) : dayWeather ? (
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
                <Text style={s.gridVal}>{dayWeather.temp_min}°/{dayWeather.temp_max}°C</Text>
                <Text style={s.gridLabel}>{t("calendar.minmax")}</Text>
                <Text style={s.gridSub}>{t("calendar.current")}: {dayWeather.temp_current}°C</Text>
              </View>
              <View style={s.gridCell}>
                <Ionicons name="water" size={28} color="#03a9f4" />
                <Text style={s.gridVal}>{dayWeather.humidity}%</Text>
                <Text style={s.gridLabel}>{t("calendar.humidity")}</Text>
                <Text style={s.gridSub}>{dayWeather.humidity_min}-{dayWeather.humidity_max}%</Text>
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
          <View style={s.noDataCard}>
            <Ionicons name="calendar-outline" size={48} color="#ccc" />
            <Text style={s.noDataText}>{t("calendar.noData") || "Aucune donnée"}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => fetchAll(city)}>
              <Text style={s.retryBtnText}>{t("common.retry") || "Réessayer"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  searchRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, marginTop: 8 },
  searchInput: {
    flex: 1, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 10,
    borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
    borderWidth: 1, borderColor: "#e5e7eb", fontSize: 14,
  },
  searchBtn: {
    backgroundColor: "#22c55e", paddingHorizontal: 14, paddingVertical: 10,
    borderTopRightRadius: 10, borderBottomRightRadius: 10,
  },
  locationRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8 },
  locationText: { marginLeft: 4, color: "#4b5563", fontSize: 13 },
  card: {
    backgroundColor: "#fff", marginHorizontal: 16, marginTop: 4, padding: 20,
    borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center", marginBottom: 16,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  cardTitle: { fontWeight: "700", color: "#1f2937", fontSize: 14 },
  cardDesc:  { color: "#6b7280", fontSize: 13, textTransform: "capitalize", marginTop: 2 },
  gridRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  gridCell:  {
    backgroundColor: "#f9fafb", width: "48%", padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: "#f3f4f6", alignItems: "center",
  },
  gridVal:   { fontWeight: "700", fontSize: 18, color: "#1f2937", marginTop: 6 },
  gridLabel: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  gridSub:   { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  et0Row:    {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#f0fdf4", borderRadius: 10, paddingVertical: 8, marginTop: 4,
  },
  et0Text:   { marginLeft: 6, fontSize: 13, fontWeight: "700", color: "#16a34a" },
  noDataCard: {
    backgroundColor: "#fff", marginHorizontal: 16, marginTop: 8,
    padding: 32, borderRadius: 16, alignItems: "center",
  },
  noDataText:    { marginTop: 12, color: "#6b7280", fontSize: 15, textAlign: "center" },
  retryBtn:      { marginTop: 16, backgroundColor: "#22c55e", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 99 },
  retryBtnText:  { color: "#fff", fontWeight: "700" },
});
