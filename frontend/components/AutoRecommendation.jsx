import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function AutoRecommendation({ besoins, historyItems = [], rainReduction = 0 }) {
  const recommendation = useMemo(() => {
    if (!besoins?.etc || besoins.etc === "0.00") return null;

    const etc = parseFloat(besoins.etc) || 0;
    const frequenceJours = besoins.frequenceJours || 7;
    const lastIrrigation = historyItems[0];
    const daysSinceLast = lastIrrigation
      ? Math.round((Date.now() - new Date(lastIrrigation.date).getTime()) / 86400000)
      : null;

    if (rainReduction > 0) {
      return {
        type: "info",
        icon: "rainy",
        text: `Pluie prévue — volume réduit de ${rainReduction}%${besoins.eauM3 ? ` → ${besoins.eauM3} m³ à apporter` : ""}`,
      };
    }

    if (daysSinceLast !== null && daysSinceLast > frequenceJours + 2) {
      return {
        type: "danger",
        icon: "alert-circle",
        text: `Dernière irrigation il y a ${daysSinceLast}j — irrigation urgente (fréquence conseillée : ${frequenceJours}j)`,
      };
    }

    if (daysSinceLast !== null && daysSinceLast >= frequenceJours) {
      return {
        type: "warning",
        icon: "water",
        text: `Irrigation à planifier — arrosez aujourd'hui ou demain selon la météo`,
      };
    }

    const avgEtc =
      historyItems.slice(0, 10).reduce((s, i) => s + (parseFloat(i.etc) || 0), 0) /
      Math.max(1, Math.min(historyItems.length, 10));
    if (avgEtc > 0 && etc > avgEtc * 1.25) {
      return {
        type: "warning",
        icon: "thermometer",
        text: `ETc actuelle ${etc} mm/j (+${Math.round((etc / avgEtc - 1) * 100)}% vs moyenne) — surveillez le stress hydrique`,
      };
    }

    if (daysSinceLast !== null) {
      const daysLeft = Math.max(0, frequenceJours - daysSinceLast);
      return {
        type: "success",
        icon: "checkmark-circle",
        text: `Irrigation normale — prochain arrosage dans ${daysLeft}j · ETc = ${etc} mm/j`,
      };
    }

    return null;
  }, [besoins, historyItems, rainReduction]);

  if (!recommendation) return null;

  const COLORS = {
    success: { bg: "#f0fdf4", border: "#86efac", text: "#15803d", icon: "#22c55e" },
    warning: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", icon: "#f59e0b" },
    danger:  { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", icon: "#ef4444" },
    info:    { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", icon: "#3b82f6" },
  };
  const c = COLORS[recommendation.type] || COLORS.info;

  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderColor: c.border,
        borderWidth: 1.5,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Ionicons name={recommendation.icon} size={20} color={c.icon} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: c.text, marginBottom: 2 }}>
          Recommandation auto
        </Text>
        <Text style={{ fontSize: 12, color: c.text, lineHeight: 17 }}>
          {recommendation.text}
        </Text>
      </View>
    </View>
  );
}
