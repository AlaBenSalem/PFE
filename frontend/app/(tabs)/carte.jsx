import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BrandHeader } from "@components/BrandHeader";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { useLanguage } from "@context/LanguageContext";

const { width: SCREEN_W } = Dimensions.get("window");

const TREE_ICONS = {
  orange: "🍊", citron: "🍋", mandarine: "🍊", tomate: "🍅",
  blé: "🌾", ble: "🌾", olivier: "🫒", pomme: "🍎",
  vigne: "🍇", figuier: "🌿", grenadier: "🌺",
};
function treeIcon(nom = "") {
  const k = Object.keys(TREE_ICONS).find(k => nom.toLowerCase().includes(k));
  return k ? TREE_ICONS[k] : "🌳";
}

const STATUS = {
  ok:      { color: "#22c55e", bg: "#f0fdf4", labelKey: "statusOk" },
  soon:    { color: "#f59e0b", bg: "#fffbeb", labelKey: "statusSoon" },
  overdue: { color: "#ef4444", bg: "#fef2f2", labelKey: "statusOverdue" },
  unknown: { color: "#94a3b8", bg: "#f8fafc", labelKey: "statusUnknown" },
};

function irrigStatus(culture, irrigations) {
  const last = irrigations
    .filter(i => (i.cultureId?._id || i.cultureId) === culture._id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  if (!last) return "unknown";
  const freq = culture.frequenceIrrigation || 7;
  const days = Math.round((Date.now() - new Date(last.date)) / 86400000);
  if (days < freq - 2) return "ok";
  if (days <= freq) return "soon";
  return "overdue";
}

function ParcelGrid({ count, icon, color, scaleLabel }) {
  const MAX_DISPLAY = 300;
  const displayCount = Math.min(count, MAX_DISPLAY);
  const scale = count > MAX_DISPLAY ? Math.ceil(count / MAX_DISPLAY) : 1;
  const availW = Math.min(SCREEN_W - 80, 600);
  const cols = Math.min(15, Math.max(3, Math.ceil(Math.sqrt(displayCount * 1.2))));
  const cellSize = Math.max(16, Math.min(36, Math.floor((availW - (cols - 1) * 4) / cols)));
  const fontSize = Math.round(cellSize * 0.56);

  return (
    <View>
      {scale > 1 && (
        <Text style={{ fontSize: 11, color: "#6b7280", textAlign: "center", marginBottom: 8 }}>
          {scaleLabel(scale, count)}
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {Array.from({ length: displayCount }).map((_, i) => (
          <View
            key={i}
            style={{
              width: cellSize, height: cellSize,
              borderRadius: 6,
              backgroundColor: `${color}25`,
              borderWidth: 1, borderColor: `${color}60`,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize }}>{icon}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function CartePage() {
  const { t } = useLanguage();
  const [cultures, setCultures] = useState([]);
  const [irrigations, setIrrigations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cRes, iRes] = await Promise.all([
        apiFetch(API_ENDPOINTS.cultures.base),
        apiFetch(API_ENDPOINTS.irrigations.base),
      ]);
      const cData = await cRes.json();
      const iData = await iRes.json();
      if (cData.success) {
        setCultures(cData.data ?? []);
        setSelected(prev => prev ?? cData.data?.[0] ?? null);
      }
      if (iData.success) setIrrigations(iData.data ?? []);
    } catch (e) {
      console.error("CartePage:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const status = selected ? irrigStatus(selected, irrigations) : "unknown";
  const cfg = STATUS[status];
  const icon = treeIcon(selected?.nom || "");
  const nbTrees = selected?.nombreArbres || 0;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5', alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <BrandHeader title={t("carte.title")} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#16a34a"]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Culture selector ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", gap: 8, paddingRight: 4 }}>
            {cultures.length === 0 ? (
              <View style={{ padding: 20 }}>
                <Text style={{ color: "#9ca3af", fontSize: 13 }}>{t("carte.noCulture")}</Text>
              </View>
            ) : cultures.map(c => {
              const s = irrigStatus(c, irrigations);
              const c2 = STATUS[s];
              const isSelected = selected?._id === c._id;
              return (
                <TouchableOpacity
                  key={c._id}
                  onPress={() => setSelected(c)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 14,
                    minWidth: 80,
                    alignItems: "center",
                    backgroundColor: isSelected ? "#15803d" : '#ffffff',
                    borderWidth: 2,
                    borderColor: isSelected ? "#15803d" : c2.color,
                    elevation: isSelected ? 4 : 1,
                    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{treeIcon(c.nom)}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", marginTop: 3, color: isSelected ? "#fff" : '#1f2937' }}>
                    {c.nom}
                  </Text>
                  {c.parcelle ? (
                    <Text style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.75)" : "#9ca3af" }}>
                      {c.parcelle}
                    </Text>
                  ) : null}
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c2.color, marginTop: 4 }} />
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {!selected ? (
          <View style={{ alignItems: "center", padding: 48 }}>
            <Text style={{ fontSize: 48 }}>🌿</Text>
            <Text style={{ color: "#9ca3af", marginTop: 12, fontSize: 14 }}>
              {t("carte.selectCulture")}
            </Text>
          </View>
        ) : (
          <>
            {/* ── Info card ── */}
            <View style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 16,
              marginBottom: 14,
              borderLeftWidth: 4,
              borderLeftColor: cfg.color,
              elevation: 2,
              shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
            }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <View>
                  <Text style={{ fontSize: 22, fontWeight: "bold", color: "#111827" }}>{selected.nom}</Text>
                  {selected.variete ? (
                    <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>{selected.variete}</Text>
                  ) : null}
                </View>
                <View style={{
                  backgroundColor: cfg.bg,
                  borderRadius: 20,
                  paddingHorizontal: 12, paddingVertical: 5,
                  borderWidth: 1.5, borderColor: cfg.color,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: cfg.color }}>{t(`carte.${cfg.labelKey}`)}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {[
                  { icon: "location-outline",  label: selected.parcelle || t("carte.parcelUndefined") },
                  { icon: "expand-outline",     label: selected.surface ? `${selected.surface} m²` : t("carte.surfaceNd") },
                  { icon: "leaf-outline",       label: `${nbTrees || "—"} ${t("carte.trees")}` },
                  { icon: "layers-outline",     label: selected.typeSol || t("carte.soilNd") },
                  { icon: "location-outline",   label: selected.region || t("carte.regionNd") },
                ].map((item, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name={item.icon} size={13} color="#6b7280" />
                    <Text style={{ fontSize: 11, color: "#374151" }}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Parcel visualization ── */}
            <View style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 16,
              elevation: 2,
              shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <Ionicons name="grid-outline" size={18} color="#15803d" />
                <Text style={{ fontSize: 15, fontWeight: "bold", color: "#111827", marginLeft: 7, flex: 1 }}>
                  {t("carte.parcelView")}
                </Text>
                <Text style={{ fontSize: 12, color: "#6b7280" }}>
                  {nbTrees} {nbTrees === 1 ? t("carte.tree") : t("carte.trees")}
                  {selected.surface ? ` · ${selected.surface} m²` : ""}
                </Text>
              </View>

              {/* Legend */}
              <View style={{ flexDirection: "row", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
                {Object.entries(STATUS).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: v.color }} />
                    <Text style={{ fontSize: 10, color: "#6b7280" }}>{t(`carte.${v.labelKey}`)}</Text>
                  </View>
                ))}
              </View>

              {nbTrees > 0 ? (
                <ParcelGrid
                  count={nbTrees}
                  icon={icon}
                  color={cfg.color}
                  scaleLabel={(scale, count) =>
                    t("carte.iconScale").replace("{scale}", scale).replace("{count}", count)
                  }
                />
              ) : (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <Text style={{ fontSize: 48 }}>{icon}</Text>
                  <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 8 }}>
                    {t("carte.treesNotConfigured")}
                  </Text>
                  <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 4, textAlign: "center" }}>
                    {t("carte.treesHint")}
                  </Text>
                </View>
              )}

              {/* ETc summary if known */}
              {selected.kcActuel && (
                <View style={{
                  marginTop: 14,
                  backgroundColor: "#f0fdf4",
                  borderRadius: 10,
                  padding: 10,
                  flexDirection: "row",
                  gap: 16,
                  flexWrap: "wrap",
                }}>
                  <Text style={{ fontSize: 11, color: "#15803d" }}>
                    {t("carte.kcLabel")}<Text style={{ fontWeight: "bold" }}>{selected.kcActuel}</Text>
                  </Text>
                  {selected.stadeActuel ? (
                    <Text style={{ fontSize: 11, color: "#15803d" }}>
                      {t("carte.stageLabel")}<Text style={{ fontWeight: "bold" }}>{selected.stadeActuel}</Text>
                    </Text>
                  ) : null}
                  {selected.surface && selected.kcActuel ? (
                    <Text style={{ fontSize: 11, color: "#15803d" }}>
                      {t("carte.surfaceLabel")}<Text style={{ fontWeight: "bold" }}>{(selected.surface / 10000).toFixed(3)} ha</Text>
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
