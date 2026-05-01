import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getOpenWeatherBundle } from "@api/weather";

export default function WeatherAlert({ city = "Tunis", onReductionChange }) {
  const [alertData, setAlertData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchForecast();
  }, [city]);

  async function fetchForecast() {
    setLoading(true);
    try {
      const { forecast } = await getOpenWeatherBundle(city);
      const next48h = (forecast?.list || []).slice(0, 16);

      const totalRain = next48h.reduce((sum, item) => {
        return sum + (item.rain?.["3h"] || item.rain?.["1h"] || 0);
      }, 0);
      const maxPop = Math.max(...next48h.map((item) => item.pop || 0), 0);

      if (totalRain >= 3 || maxPop >= 0.6) {
        let reduction;
        if (totalRain >= 15) reduction = 80;
        else if (totalRain >= 10) reduction = 60;
        else if (totalRain >= 5) reduction = 40;
        else reduction = 20;

        setAlertData({
          rain: Math.round(totalRain * 10) / 10,
          reduction,
          pop: Math.round(maxPop * 100),
        });
        onReductionChange?.(reduction);
      } else {
        setAlertData(null);
        onReductionChange?.(0);
      }
    } catch {
      setAlertData(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", padding: 10, marginBottom: 8 }}>
        <ActivityIndicator size="small" color="#2563eb" />
        <Text style={{ marginLeft: 8, color: "#6b7280", fontSize: 12 }}>
          Vérification météo 48h...
        </Text>
      </View>
    );
  }

  if (!alertData || dismissed) return null;

  return (
    <View
      style={{
        backgroundColor: "#eff6ff",
        borderColor: "#93c5fd",
        borderWidth: 1.5,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <Ionicons name="rainy" size={22} color="#1d4ed8" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "bold", color: "#1e40af", fontSize: 13, marginBottom: 2 }}>
          Pluie prévue dans les 48h — {alertData.rain} mm ({alertData.pop}%)
        </Text>
        <Text style={{ color: "#2563eb", fontSize: 12 }}>
          Dose d'irrigation recommandée réduite de{" "}
          <Text style={{ fontWeight: "bold" }}>{alertData.reduction}%</Text>{" "}
          automatiquement
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => {
          setDismissed(true);
          onReductionChange?.(0);
        }}
      >
        <Ionicons name="close-circle" size={18} color="#93c5fd" />
      </TouchableOpacity>
    </View>
  );
}
