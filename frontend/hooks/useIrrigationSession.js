// hooks/useIrrigationSession.js
// Session hook: manages irrigation mode, save-session, export (CSV + PDF)
import { useState } from "react";
import { Alert, Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { exportPDFReport } from "@utils/pdfReport";
import { EFF_PAR_MODE } from "@hooks/useIrrigationData";

export function useIrrigationSession({
  selectedCulture,
  calculateNeeds,
  fetchHistory,
  fetchCultures,
  historyItems,
  cultures,
  t,
}) {
  const [selectedMode,        setSelectedMode]        = useState("goutte-à-goutte");
  const [isCompleted,         setIsCompleted]         = useState(false);
  const [completedNeeds,      setCompletedNeeds]      = useState(null);
  const [etcHistoryKey,       setEtcHistoryKey]       = useState(0);
  const [cultureModalVisible, setCultureModalVisible] = useState(false);
  const [activeTab,           setActiveTab]           = useState("needs");
  const [exporting,           setExporting]           = useState(false);
  const [exportingPDF,        setExportingPDF]        = useState(false);
  const [rainReduction,       setRainReduction]       = useState(0);

  // ── Save completed irrigation ─────────────────────────────────────────────
  const handleFaitPress = async () => {
    if (!selectedCulture) {
      Alert.alert("Erreur", "Veuillez sélectionner une culture");
      return;
    }
    if (isCompleted) return;

    const needs = calculateNeeds(selectedMode, rainReduction);

    if (!needs.volumeLitres || needs.volumeLitres <= 0) {
      Alert.alert(
        "Configuration incomplète",
        "Le volume calculé est 0. Vérifiez que la culture a un débit et une surface configurés."
      );
      return;
    }
    if (!needs.temps || needs.temps < 1) {
      Alert.alert(
        "Configuration incomplète",
        "La durée calculée est nulle. Vérifiez le débit de la culture."
      );
      return;
    }

    try {
      const res = await apiFetch(API_ENDPOINTS.irrigations.base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cultureId: selectedCulture._id,
          mode: selectedMode,
          duree: needs.temps,
          volume: needs.volumeLitres,
          debit: selectedCulture.irrigation?.debit || 1000,
          et0: parseFloat(needs.et0),
          etc: parseFloat(needs.etc),
          kc: parseFloat(needs.kc),
          surface: needs.surface,
          efficacite: EFF_PAR_MODE[selectedMode],
          eauMm: parseFloat(needs.eauMm),
          debitMmh: parseFloat(needs.debitMmh),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) {
        setCompletedNeeds(needs);
        await Promise.all([fetchHistory(), fetchCultures?.()]);
        setIsCompleted(true);
        setEtcHistoryKey((p) => p + 1);
        Alert.alert("Succès", "Irrigation enregistrée avec succès");
      } else throw new Error(result.message || "Échec de l'enregistrement");
    } catch (err) {
      console.error("useIrrigationSession.handleFaitPress:", err.message);
      Alert.alert("Erreur", "Impossible d'enregistrer l'irrigation.");
    }
  };

  // ── Reset completed state when mode changes ───────────────────────────────
  const handleModeChange = (mode) => {
    setSelectedMode(mode);
    setIsCompleted(false);
  };

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportIrrigation = async () => {
    try {
      setExporting(true);
      if (!historyItems?.length) { Alert.alert("Information", "Aucune donnée à exporter"); return; }
      const headers = ["Date","Culture","Parcelle","Mode","Eau (m³)","Durée (min)","Débit (m³/h)","ET₀ (mm/j)","ETc (mm/j)","Kc","Surface (m²)","Efficacité (%)"];
      const rows = historyItems.map((item) => {
        const culture    = cultures.find((c) => c._id === (item.cultureId?._id || item.cultureId));
        const surface    = item.surface || culture?.surface || 100;
        const eauMmVal   = item.eauMm != null ? Number(item.eauMm) : (item.volume / surface);
        const eauM3Val   = ((eauMmVal * surface) / 1000).toFixed(2);
        const debitLhVal  = item.debit || 1000;
        const debitM3hVal = (debitLhVal / 1000).toFixed(3);
        return [
          new Date(item.date).toLocaleDateString("fr-FR"),
          item.nom || culture?.nom || item.cultureId?.nom || "—",
          culture?.parcelle || "—",
          item.mode || "—",
          eauM3Val,
          item.duree || item.temps || "—",
          debitM3hVal,
          item.et0  != null ? Number(item.et0).toFixed(2) : "—",
          item.etc  != null ? Number(item.etc).toFixed(2) : "—",
          item.kc   != null ? Number(item.kc).toFixed(2)  : "—",
          surface,
          item.efficacite != null ? Math.round(item.efficacite * 100) : "—",
        ];
      });
      const escape = (v) => {
        const s = v == null ? "" : String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const csv = "﻿" + [
        headers.map(escape).join(","),
        ...rows.map((r) => r.map(escape).join(",")),
      ].join("\r\n");
      const filename = `SmartIrrig_Irrigation_${new Date().toISOString().split("T")[0]}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement("a"), {
          href: url, download: filename, style: "display:none",
        });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        if (!baseDir) {
          Alert.alert("Erreur", "Stockage inaccessible. Redémarrez l'application et réessayez.");
          return;
        }
        const fileUri = baseDir + filename;
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        const sharingAvailable = await Sharing.isAvailableAsync();
        if (sharingAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: t("irrigation.exporter") || "Exporter l'irrigation",
            UTI: "public.comma-separated-values-text",
          });
        } else {
          Alert.alert("Information", `Fichier sauvegardé : ${filename}`);
        }
      }
    } catch (err) {
      console.error("useIrrigationSession.exportIrrigation:", err.message);
      Alert.alert("Erreur", "Impossible d'exporter les données");
    } finally {
      setExporting(false);
    }
  };

  // ── PDF export ────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      setExportingPDF(true);
      await exportPDFReport({
        irrigations: historyItems,
        fertilisations: [],
        cultureName: selectedCulture?.nom || "",
      });
    } catch (e) {
      Alert.alert("Erreur", "Impossible de générer le rapport PDF.");
    } finally {
      setExportingPDF(false);
    }
  };

  // ── Reset completion when culture changes ─────────────────────────────────
  const resetCompletion = () => {
    setIsCompleted(false);
    setCompletedNeeds(null);
    setEtcHistoryKey((p) => p + 1);
  };

  return {
    // State
    selectedMode,
    isCompleted,
    completedNeeds,
    etcHistoryKey,
    cultureModalVisible,
    activeTab,
    exporting,
    exportingPDF,
    rainReduction,
    // Setters
    setSelectedMode,
    setIsCompleted,
    setEtcHistoryKey,
    setCultureModalVisible,
    setActiveTab,
    setRainReduction,
    // Actions
    handleFaitPress,
    handleModeChange,
    exportIrrigation,
    handleExportPDF,
    resetCompletion,
  };
}
