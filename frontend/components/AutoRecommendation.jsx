import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@context/LanguageContext";

export default function AutoRecommendation({ besoins, historyItems = [], rainReduction = 0 }) {
  const { t } = useLanguage();

  const recommendation = useMemo(() => {
    if (!besoins?.etc || besoins.etc === "0.00") return null;

    const etc = parseFloat(besoins.etc) || 0;
    const frequenceJours = besoins.frequenceJours || 7;
    const lastIrrigation = historyItems[0];
    const daysSinceLast = lastIrrigation
      ? Math.round((Date.now() - new Date(lastIrrigation.date).getTime()) / 86400000)
      : null;

    if (rainReduction > 0) {
      const rainText = t("irrigation.recoRain").replace("{pct}", rainReduction);
      const volumePart = besoins.eauM3
        ? ` ${t("irrigation.recoRainVolume").replace("{vol}", besoins.eauM3)}`
        : "";
      return { type: "info", icon: "rainy", text: rainText + volumePart };
    }

    if (daysSinceLast !== null && daysSinceLast > frequenceJours + 2) {
      return {
        type: "danger",
        icon: "alert-circle",
        text: t("irrigation.recoUrgent")
          .replace("{days}", daysSinceLast)
          .replace("{freq}", frequenceJours),
      };
    }

    if (daysSinceLast !== null && daysSinceLast >= frequenceJours) {
      return { type: "warning", icon: "water", text: t("irrigation.recoPlan") };
    }

    const avgEtc =
      historyItems.slice(0, 10).reduce((s, i) => s + (parseFloat(i.etc) || 0), 0) /
      Math.max(1, Math.min(historyItems.length, 10));
    if (avgEtc > 0 && etc > avgEtc * 1.25) {
      return {
        type: "warning",
        icon: "thermometer",
        text: t("irrigation.recoStress")
          .replace("{etc}", etc)
          .replace("{pct}", Math.round((etc / avgEtc - 1) * 100)),
      };
    }

    if (daysSinceLast !== null) {
      const daysLeft = Math.max(0, frequenceJours - daysSinceLast);
      return {
        type: "success",
        icon: "checkmark-circle",
        text: t("irrigation.recoNormal")
          .replace("{days}", daysLeft)
          .replace("{etc}", etc),
      };
    }

    return null;
  }, [besoins, historyItems, rainReduction, t]);

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
          {t("irrigation.autoReco")}
        </Text>
        <Text style={{ fontSize: 12, color: c.text, lineHeight: 17 }}>
          {recommendation.text}
        </Text>
      </View>
    </View>
  );
}
