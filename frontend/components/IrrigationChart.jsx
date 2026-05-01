import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

function getWeekLabel(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `S${weekNum}`;
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function groupData(items, period) {
  const groups = {};
  items.forEach((item) => {
    const d = new Date(item.date);
    const key =
      period === "week"
        ? `${getWeekLabel(d)}`
        : `${MONTHS[d.getMonth()]}`;
    const vol = parseFloat(item.volume) || 0;
    groups[key] = (groups[key] || 0) + vol;
  });
  const limit = period === "week" ? 8 : 6;
  return Object.entries(groups)
    .slice(-limit)
    .map(([label, value]) => ({ label, value: Math.round(value) }));
}

export default function IrrigationChart({ items = [] }) {
  const [period, setPeriod] = useState("week");

  const data = useMemo(() => groupData(items, period), [items, period]);
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const avg = data.length > 0 ? Math.round(total / data.length) : 0;

  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="bar-chart" size={18} color="#16a34a" />
          <Text style={{ fontWeight: "bold", fontSize: 15, color: "#1f2937" }}>
            Consommation eau
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#f3f4f6",
            borderRadius: 20,
            padding: 2,
          }}
        >
          {["week", "month"].map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 20,
                backgroundColor: period === p ? "#16a34a" : "transparent",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: period === p ? "#fff" : "#6b7280" }}>
                {p === "week" ? "Semaine" : "Mois"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>
          Total :{" "}
          <Text style={{ fontWeight: "bold", color: "#16a34a" }}>
            {total.toLocaleString("fr-FR")} L
          </Text>
        </Text>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>
          Moy :{" "}
          <Text style={{ fontWeight: "bold" }}>
            {avg.toLocaleString("fr-FR")} L/{period === "week" ? "sem." : "mois"}
          </Text>
        </Text>
      </View>

      {data.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Ionicons name="water-outline" size={32} color="#d1d5db" />
          <Text style={{ color: "#9ca3af", marginTop: 8, fontSize: 13 }}>
            Aucune donnée disponible
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, paddingBottom: 4 }}>
            {data.map((d, i) => {
              const barH = Math.max(6, Math.round((d.value / maxVal) * 120));
              const isMax = d.value === maxVal && d.value > 0;
              return (
                <View key={i} style={{ alignItems: "center", width: 44 }}>
                  {isMax && (
                    <Text style={{ fontSize: 9, color: "#16a34a", fontWeight: "bold", marginBottom: 2 }}>
                      MAX
                    </Text>
                  )}
                  <View
                    style={{
                      width: 30,
                      height: barH,
                      backgroundColor: isMax ? "#16a34a" : "#86efac",
                      borderRadius: 6,
                      alignItems: "center",
                      justifyContent: "flex-start",
                    }}
                  >
                    {barH > 30 && (
                      <Text style={{ fontSize: 8, color: "#fff", fontWeight: "bold", marginTop: 4 }}>
                        {d.value > 999 ? `${Math.round(d.value / 1000)}k` : d.value}
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 9, color: "#6b7280", marginTop: 4, textAlign: "center" }}>
                    {d.label}
                  </Text>
                  {barH <= 30 && d.value > 0 && (
                    <Text style={{ fontSize: 8, color: "#16a34a", fontWeight: "bold" }}>
                      {d.value}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
