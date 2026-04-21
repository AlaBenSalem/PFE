import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_ENDPOINTS, apiFetch } from "@api/client";

export default function ETcHistory({
  cultureId,
  cultureName,
  todayEtc,
  todayEt0,
  todayKc,
}) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cultureId) fetchETcHistory();
  }, [cultureId]);

  const fetchETcHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch(
        `${API_ENDPOINTS.irrigations.base}/etc-history/${cultureId}?days=30`,
      );
      const result = await response.json();
      if (result.success) {
        setHistory(result.data);
        setStats(result.stats);
      } else {
        setError(result.error || "Erreur chargement");
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const toLocalDateStr = (date) => {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  };

  const todayLocalStr = toLocalDateStr(new Date());
  const isToday = (date) => toLocalDateStr(date) === todayLocalStr;

  const formatDateLabel = (date) => {
    const value = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (toLocalDateStr(value) === toLocalDateStr(today)) return "Aujourd'hui";
    if (toLocalDateStr(value) === toLocalDateStr(yesterday)) return "Hier";

    return value.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  };

  const applyTodayPatch = (day) => {
    if (!isToday(day.date) || todayEtc == null) return day;

    return {
      ...day,
      et0: String(parseFloat(todayEt0).toFixed(2)),
      kc: String(parseFloat(todayKc).toFixed(2)),
      etc: String(parseFloat(todayEtc).toFixed(2)),
    };
  };

  const getBarColor = (etc, irrigated) => {
    if (irrigated) return "#22c55e";

    const value = parseFloat(etc);
    if (value > 5) return "#ef4444";
    if (value > 3) return "#f97316";
    if (value > 1) return "#eab308";
    return "#3b82f6";
  };

  if (loading) {
    return (
      <View className="items-center py-5">
        <ActivityIndicator size="small" color="#4CAF50" />
      </View>
    );
  }

  if (error && history.length === 0) {
    return (
      <View className="mb-4 items-center rounded-2xl bg-white p-4 shadow-sm">
        <Ionicons name="alert-circle" size={40} color="#FF6B6B" />
        <Text className="mt-2 text-center text-red-500">{error}</Text>
        <TouchableOpacity
          onPress={fetchETcHistory}
          className="mt-3 rounded-full bg-blue-500 px-4 py-2"
        >
          <Text className="text-[13px] text-white">Reessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const patchedHistory = history.map(applyTodayPatch);
  const displayHistory = expanded ? patchedHistory : patchedHistory.slice(0, 7);

  return (
    <View className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="calendar" size={20} color="#4CAF50" />
          <Text className="ml-1 text-[15px] font-semibold text-slate-800">
            ETc - {cultureName || ""}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setExpanded((value) => !value)}>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#666"
          />
        </TouchableOpacity>
      </View>

      {stats ? (
        <View className="mb-3 items-center rounded-xl bg-slate-50 p-3">
          <Text className="text-xs text-slate-500">Jours irrigues</Text>
          <Text className="text-2xl font-bold text-violet-600">
            {stats.irrigatedDays}/30
          </Text>
          <Text className="mt-0.5 text-[11px] text-slate-400">
            {stats.avgEfficacite}% du temps
          </Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row">
          {displayHistory.map((day, index) => {
            const color = getBarColor(day.etc, day.irrigated);

            return (
              <TouchableOpacity
                key={index}
                className="mr-2 w-[72px] items-center rounded-xl border px-2.5 py-2.5"
                style={{
                  borderColor: `${color}60`,
                  backgroundColor: `${color}15`,
                }}
                onPress={() =>
                  Alert.alert(
                    formatDateLabel(day.date),
                    `ET0: ${day.et0} mm\nKc: ${day.kc}\nETc: ${day.etc} mm\n${
                      day.irrigated ? "Irrigue" : "Non irrigue"
                    }${day.volume ? `\nVolume: ${day.volume} L` : ""}`,
                  )
                }
              >
                <Text className="mb-1 text-[11px] font-medium text-slate-600">
                  {formatDateLabel(day.date)}
                </Text>
                <Text className="text-base font-bold" style={{ color }}>
                  {parseFloat(day.etc).toFixed(2)}
                </Text>
                <Text className="text-[11px] text-slate-500">mm</Text>
                {day.irrigated ? (
                  <View className="mt-1 rounded-full bg-green-500 px-1.5 py-0.5">
                    <Text className="text-[10px]">💧</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View className="mt-3 flex-row justify-around border-t border-slate-100 pt-2">
        {[
          ["#22c55e", "Irrigue"],
          ["#eab308", "ETc 1-3"],
          ["#ef4444", "ETc >5"],
        ].map(([color, label]) => (
          <View key={label} className="flex-row items-center">
            <View
              className="mr-1 h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <Text className="text-[11px] text-slate-500">{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
