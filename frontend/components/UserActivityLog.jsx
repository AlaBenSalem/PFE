import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const LOG_KEY = "smartirrig_activity_log";
const MAX_LOGS = 50;

export const LOG_TYPES = {
  IRRIGATION: "irrigation",
  CULTURE_ADD: "culture_add",
  CULTURE_DELETE: "culture_delete",
  LOGIN: "login",
  FERTILISATION: "fertilisation",
  WEATHER: "weather",
};

const LOG_CONFIG = {
  irrigation: { icon: "water", color: "#3b82f6", label: "Irrigation" },
  culture_add: { icon: "leaf", color: "#22c55e", label: "Culture ajoutee" },
  culture_delete: { icon: "trash", color: "#ef4444", label: "Culture supprimee" },
  login: { icon: "log-in", color: "#8b5cf6", label: "Connexion" },
  fertilisation: { icon: "flask", color: "#f59e0b", label: "Fertilisation" },
  weather: { icon: "partly-sunny", color: "#06b6d4", label: "Meteo" },
};

export async function addActivityLog(type, message, details = {}) {
  try {
    const existing = await AsyncStorage.getItem(LOG_KEY);
    const logs = existing ? JSON.parse(existing) : [];
    const newLog = {
      id: Date.now().toString(),
      type,
      message,
      details,
      timestamp: new Date().toISOString(),
    };
    const updated = [newLog, ...logs].slice(0, MAX_LOGS);
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn("Log error:", error);
  }
}

export async function getActivityLogs() {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearActivityLogs() {
  try {
    await AsyncStorage.removeItem(LOG_KEY);
  } catch {}
}

function formatTime(iso) {
  if (!iso) return "";
  try {
    const currentDate = new Date();
    const entryDate = new Date(iso);
    const diffMs = currentDate - entryDate;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "A l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return "Hier";

    return entryDate.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "";
  }
}

export default function UserActivityLog({ maxItems = 10, showClear = true }) {
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    const data = await getActivityLogs();
    setLogs(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleClear = async () => {
    await clearActivityLogs();
    setLogs([]);
  };

  const displayed = expanded ? logs : logs.slice(0, maxItems);

  return (
    <View className="mb-4 rounded-2xl border border-[#edf1f0] bg-white p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="time-outline" size={18} color="#6b7280" />
          <Text className="text-[15px] font-bold text-gray-900">
            Historique d'activite
          </Text>
          {logs.length > 0 ? (
            <View className="rounded-full bg-green-500 px-1.5 py-0.5">
              <Text className="text-[10px] font-bold text-white">{logs.length}</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={load}
            className="h-7 w-7 items-center justify-center rounded-lg bg-slate-50"
          >
            <Ionicons name="refresh" size={16} color="#6b7280" />
          </TouchableOpacity>

          {showClear && logs.length > 0 ? (
            <TouchableOpacity
              onPress={handleClear}
              className="h-7 w-7 items-center justify-center rounded-lg bg-slate-50"
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {logs.length === 0 ? (
        <View className="items-center gap-2 py-6">
          <Ionicons name="time-outline" size={36} color="#e5e7eb" />
          <Text className="text-[13px] text-slate-400">
            Aucune activite enregistree
          </Text>
        </View>
      ) : (
        <>
          {displayed.map((log) => {
            const config = LOG_CONFIG[log.type] || {
              icon: "ellipse",
              color: "#9ca3af",
              label: "Activite",
            };

            return (
              <View
                key={log.id}
                className="flex-row items-start gap-2.5 border-b border-slate-100 py-2"
              >
                <View
                  className="mt-0.5 h-8 w-8 items-center justify-center rounded-[10px]"
                  style={{ backgroundColor: `${config.color}20` }}
                >
                  <Ionicons name={config.icon} size={16} color={config.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-medium text-gray-900">
                    {log.message}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-slate-400">
                    {formatTime(log.timestamp)}
                  </Text>
                </View>
              </View>
            );
          })}

          {logs.length > maxItems ? (
            <TouchableOpacity
              className="flex-row items-center justify-center gap-1 pt-2.5"
              onPress={() => setExpanded((value) => !value)}
            >
              <Text className="text-[13px] font-semibold text-green-500">
                {expanded ? "Voir moins" : `Voir tout (${logs.length})`}
              </Text>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={14}
                color="#22c55e"
              />
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
}
