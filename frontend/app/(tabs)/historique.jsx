import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BrandHeader } from "@components/BrandHeader";
import { useLanguage } from "@context/LanguageContext";
import UserActivityLog from "@components/UserActivityLog";
import IrrigationChart from "@components/IrrigationChart";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { exportPDFReport } from "@utils/pdfReport";

export default function HistoriquePage() {
  const { t } = useLanguage();
  const [irrigations, setIrrigations]       = useState([]);
  const [fertilisations, setFertilisations] = useState([]);
  const [loading, setLoading]               = useState(true);
  const [exporting, setExporting]           = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch(API_ENDPOINTS.irrigations.base).then((r) => r.json()),
      apiFetch(API_ENDPOINTS.fertilisations?.base || `${API_ENDPOINTS.irrigations.base.replace("/irrigations", "/fertilisations")}`).then((r) => r.json()).catch(() => ({ success: false, data: [] })),
    ]).then(([iData, fData]) => {
      if (iData.success) setIrrigations(iData.data ?? []);
      if (fData.success) setFertilisations(fData.data ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      await exportPDFReport({ irrigations, fertilisations });
    } catch (e) {
      Alert.alert(t("common.error"), t("history.pdfError"));
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <BrandHeader
        title={t("history.title")}
        right={
          <TouchableOpacity
            onPress={handleExportPDF}
            disabled={exporting}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: "#fef3c7",
              borderColor: "#fbbf24",
              borderWidth: 1,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#d97706" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={15} color="#d97706" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#d97706" }}>
                  PDF
                </Text>
              </>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
      >
        {/* Charts section */}
        {loading ? (
          <View style={{ alignItems: "center", padding: 24 }}>
            <ActivityIndicator size="large" color="#16a34a" />
          </View>
        ) : (
          <IrrigationChart items={irrigations} />
        )}

        {/* Stats strip */}
        {!loading && irrigations.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {[
              {
                label: t("admin.cardIrrigations"),
                value: irrigations.length,
                icon: "water",
                color: "#2563eb",
              },
              {
                label: t("admin.cardVolumeTotal"),
                value: `${(irrigations.reduce((s, i) => s + (parseFloat(i.volume) || 0), 0) / 1000).toFixed(1)} m³`,
                icon: "cube-outline",
                color: "#16a34a",
              },
              {
                label: t("fertilisation.title"),
                value: fertilisations.length,
                icon: "leaf",
                color: "#7c3aed",
              },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  backgroundColor: '#ffffff',
                  borderRadius: 12,
                  padding: 10,
                  alignItems: "center",
                  elevation: 1,
                  shadowColor: "#000",
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 1 },
                }}
              >
                <Ionicons name={stat.icon} size={18} color={stat.color} />
                <Text
                  style={{ fontWeight: "bold", fontSize: 16, color: stat.color, marginTop: 4 }}
                >
                  {stat.value}
                </Text>
                <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Activity log */}
        <UserActivityLog maxItems={15} showClear />

        {irrigations.length === 0 && !loading && (
          <View
            style={{
              alignItems: "center",
              backgroundColor: '#ffffff',
              borderRadius: 16,
              borderColor: '#edf1f0',
              borderWidth: 1,
              padding: 24,
            }}
          >
            <Ionicons name="water" size={36} color="#4CAF50" />
            <Text style={{ fontWeight: "bold", fontSize: 15, color: '#1f2937', marginTop: 12 }}>
              {t("history.irrigationHistory")}
            </Text>
            <Text style={{ color: '#6b7280', fontSize: 13, textAlign: "center", marginTop: 6 }}>
              {t("history.empty")}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
