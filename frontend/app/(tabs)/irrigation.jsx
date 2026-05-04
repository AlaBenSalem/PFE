// app/(tabs)/irrigation.jsx
import React from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Modal, FlatList, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BrandHeader } from "@components/BrandHeader";
import NotificationBell from "@components/NotificationBell";
import { useIrrigationNotifications } from "@hooks/useNotifications";
import { useLanguage } from "@context/LanguageContext";
import { translateCropName } from "@utils/cropNames";
import ETcHistory from "@components/ETcHistory";
import WeatherAlert from "@components/WeatherAlert";
import AutoRecommendation from "@components/AutoRecommendation";
import * as Notifications from "expo-notifications";
import { useIrrigationData, PERTE_PAR_MODE, DEFAULT_BESOINS } from "@hooks/useIrrigationData";
import { useIrrigationSession } from "@hooks/useIrrigationSession";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ── UI-only constants ─────────────────────────────────────────────────────────
const MODE_EMOJI = {
  "goutte-à-goutte": "💧",
  aspersion: "💦",
  gravitaire: "🌊",
};
const SOL_LABELS = {
  sableux: "Sableux 🏖️",
  limono_sableux: "Limono-sableux 🌾",
  limoneux: "Limoneux 🌱",
  argilo_limoneux: "Argilo-limoneux 🏔️",
  argileux: "Argileux 🪨",
};
const TAB_LABELS = {
  needs:   { fr: "Besoins",    en: "Needs",   ar: "الاحتياجات", tr: "İhtiyaçlar" },
  history: { fr: "Historique", en: "History", ar: "السجل",      tr: "Geçmiş" },
};
const ALERT_TXT = {
  fr: { count: "alerte(s) en cours", tap: "Appuyez sur 🔔 pour les détails" },
  en: { count: "active alert(s)",    tap: "Tap 🔔 for details" },
  ar: { count: "تنبيهات نشطة",       tap: "اضغط على 🔔 للتفاصيل" },
  tr: { count: "aktif uyarı",        tap: "Detaylar için 🔔 ye dokunun" },
};
const MOIS_LABELS_FR = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

// ── Pure UI helpers ───────────────────────────────────────────────────────────
const fmtTemps = (minutes) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? String(minutes % 60).padStart(2, "0") : ""}`
    : `${minutes} min`;

const fmtDate = (date) => {
  try {
    const diff = (Date.now() - new Date(date).getTime()) / 60000;
    if (diff < 1)    return "À l'instant";
    if (diff < 60)   return `${Math.floor(diff)} min`;
    if (diff < 1440) return `${Math.floor(diff / 60)} h`;
    return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  } catch { return "Date inconnue"; }
};

const fmtAujourdhui = () =>
  new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

const fmtDateIrrig = (date) => {
  if (!date) return fmtAujourdhui();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d - today) / 86400000);
  if (diff <= 0) return fmtAujourdhui();
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
};

function getPlantUnit(cropName) {
  if (!cropName) return "arbre";
  const n = cropName.toLowerCase();
  const HERBS = [
    "tomate","poivron","piment","aubergine","concombre","courgette",
    "laitue","salade","melon","pastèque","fraise","haricot","pois",
    "carotte","oignon","ail","épinard","chou","brocoli","céleri",
    "fenouil","basilic","menthe","persil","coriandre","poireau",
    "navet","radis","betterave","artichaut","asperge","courge",
  ];
  if (HERBS.some((h) => n.includes(h))) return "plant";
  if (n.includes("vigne") || n.includes("raisin")) return "pied";
  return "arbre";
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function IrrigationPage() {
  const { t, language } = useLanguage();
  const lang = language || "fr";

  // ── Data hook — calculateNeeds(mode) accepts mode as argument ───────────────
  const {
    cultures,
    selectedCulture,
    loading,
    error,
    historyItems,
    loadingWeatherRegion,
    kcDynamique,
    kcStade,
    loadingKc,
    debitMissing,
    calculateNeeds,
    selectCulture,
    fetchHistory,
    retry,
  } = useIrrigationData();

  // ── Session hook — internally calls calculateNeeds(selectedMode) ─────────────
  const {
    selectedMode,
    isCompleted,
    etcHistoryKey,
    cultureModalVisible,
    activeTab,
    exporting,
    exportingPDF,
    rainReduction,
    setIsCompleted,
    setEtcHistoryKey,
    setCultureModalVisible,
    setActiveTab,
    setRainReduction,
    handleFaitPress,
    handleModeChange,
    exportIrrigation,
    handleExportPDF,
    resetCompletion,
  } = useIrrigationSession({
    selectedCulture,
    calculateNeeds,
    fetchHistory,
    historyItems,
    cultures,
    t,
  });

  // ── Notifications ───────────────────────────────────────────────────────────
  const { notifications, markRead, markAllRead } = useIrrigationNotifications(
    cultures ?? [], historyItems ?? [], null, lang,
  );
  const urgentCount = (notifications ?? []).filter(
    (n) => !n.read && (n.type === "urgent" || n.type === "warning")
  ).length;

  const getModeLabel = (mode) => {
    if (mode === "goutte-à-goutte") return t("irrigation.drip") || "Goutte-à-goutte";
    if (mode === "aspersion")       return t("irrigation.sprinkler") || "Aspersion";
    return t("irrigation.gravity") || "Gravitaire";
  };

  const handleSelectCulture = (culture) => {
    selectCulture(culture);
    resetCompletion();
    setCultureModalVisible(false);
  };

  // ── Loading / error guards ──────────────────────────────────────────────────
  if (loading)
    return (
      <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center">
        <ActivityIndicator size="large" color="#4CAF50" />
      </SafeAreaView>
    );

  if (error && cultures.length === 0)
    return (
      <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center p-5">
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text className="mt-4 text-base text-gray-500 text-center">{error}</Text>
        <TouchableOpacity
          className="mt-5 bg-green-500 px-5 py-3 rounded-xl"
          onPress={retry}
        >
          <Text className="text-white font-semibold">Réessayer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );

  const besoins    = selectedCulture ? calculateNeeds(selectedMode) : DEFAULT_BESOINS;
  const alertTxt   = ALERT_TXT[lang] || ALERT_TXT.fr;
  const hasData    = selectedCulture && besoins.eauMm !== "0.0";
  const moisActuel = MOIS_LABELS_FR[new Date().getMonth()];
  const plantUnit  = getPlantUnit(selectedCulture?.nom);

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <BrandHeader
        title={t("irrigation.title")}
        right={
          <View className="flex-row items-center gap-2">
            {historyItems.length > 0 && (
              <TouchableOpacity
                className="flex-row items-center gap-1 bg-green-50 border border-green-300 px-2.5 py-1.5 rounded-full"
                onPress={exportIrrigation} activeOpacity={0.8} disabled={exporting}
              >
                {exporting ? <ActivityIndicator size="small" color="#16a34a" /> : (
                  <>
                    <Ionicons name="download-outline" size={15} color="#16a34a" />
                    <Text className="text-[12px] font-bold text-green-600">{t("irrigation.exporter")}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="flex-row items-center gap-1 bg-amber-50 border border-amber-300 px-2.5 py-1.5 rounded-full"
              onPress={handleExportPDF} activeOpacity={0.8} disabled={exportingPDF}
            >
              {exportingPDF ? <ActivityIndicator size="small" color="#d97706" /> : (
                <>
                  <Ionicons name="document-text-outline" size={15} color="#d97706" />
                  <Text className="text-[12px] font-bold text-amber-600">PDF</Text>
                </>
              )}
            </TouchableOpacity>
            <NotificationBell
              notifications={notifications ?? []}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              lang={lang}
            />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {urgentCount > 0 && (
          <View className="flex-row items-start gap-2 bg-red-100 border border-red-200 rounded-2xl px-3.5 py-3 mb-4">
            <Ionicons name="alert-circle" size={16} color="#dc2626" />
            <View className="flex-1">
              <Text className="text-[13px] font-bold text-red-600">{urgentCount} {alertTxt.count}</Text>
              <Text className="text-[11px] text-red-500 mt-0.5">{alertTxt.tap}</Text>
            </View>
          </View>
        )}

        {debitMissing && selectedCulture && (
          <View className="flex-row items-start gap-2 bg-amber-50 border border-amber-300 rounded-2xl px-3.5 py-3 mb-4">
            <Ionicons name="warning-outline" size={16} color="#d97706" />
            <View className="flex-1">
              <Text className="text-[13px] font-bold text-amber-700">Débit non configuré</Text>
              <Text className="text-[11px] text-amber-600 mt-0.5">
                La culture "{selectedCulture.nom}" n'a pas de débit défini. Le calcul utilise 1000 L/h par défaut.
                Configurez le débit dans "Mes cultures" pour un résultat précis.
              </Text>
            </View>
          </View>
        )}

        <WeatherAlert
          city={selectedCulture?.region || "Tunis"}
          onReductionChange={setRainReduction}
        />

        {activeTab === "needs" && selectedCulture && (
          <AutoRecommendation
            besoins={besoins}
            historyItems={historyItems}
            rainReduction={rainReduction}
          />
        )}

        <TouchableOpacity
          className="flex-row items-center justify-between bg-white rounded-2xl p-4 mb-4 shadow-sm elevation-2"
          onPress={() => setCultureModalVisible(true)}
        >
          <View className="flex-1">
            <Text className="text-[13px] text-gray-500 mb-1">Culture</Text>
            {selectedCulture ? (
              <>
                <Text className="text-[20px] font-semibold text-gray-900">
                  {translateCropName(selectedCulture.nom, language)}
                </Text>
                <Text className="text-[13px] text-gray-500 mt-1">
                  {selectedCulture.parcelle} · {selectedCulture.surface} m²
                  {selectedCulture.nombreArbres ? ` · ${selectedCulture.nombreArbres} ${plantUnit}s` : ""}
                  {selectedCulture.region ? ` · 🌍 ${selectedCulture.region}` : ""}
                </Text>
              </>
            ) : (
              <Text className="text-[20px] text-gray-400 italic font-normal">
                {cultures.length === 0 ? "Aucune culture disponible" : "Sélectionner une culture"}
              </Text>
            )}
          </View>
          <Ionicons name={cultureModalVisible ? "chevron-up" : "chevron-down"} size={24} color="#4CAF50" />
        </TouchableOpacity>

        <View className="flex-row bg-slate-100 rounded-2xl p-1 mb-5">
          {["needs", "history"].map((tab) => (
            <TouchableOpacity
              key={tab}
              className={`flex-1 py-2.5 rounded-xl items-center ${activeTab === tab ? "bg-white shadow-sm elevation-2" : ""}`}
              onPress={() => setActiveTab(tab)}
            >
              <Text className={`text-[14px] ${activeTab === tab ? "font-bold text-gray-900" : "font-medium text-gray-400"}`}>
                {(TAB_LABELS[tab] || {})[lang] || TAB_LABELS[tab].fr}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "needs" && (
          <>
            <Text className="text-base font-semibold text-gray-600 mb-3">
              {t("irrigation.mode") || "Mode d'irrigation"}
            </Text>

            <View className="flex-row bg-white rounded-2xl p-3 mb-4 shadow-sm elevation-2 gap-1">
              {["goutte-à-goutte", "aspersion", "gravitaire"].map((mode) => {
                const active = selectedMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    className={`flex-1 items-center py-3 px-1 rounded-xl border-[1.5px] ${active ? "bg-green-50 border-green-300" : "border-transparent"}`}
                    onPress={() => handleModeChange(mode)}
                  >
                    <Text className="text-[24px] mb-1">{MODE_EMOJI[mode]}</Text>
                    <Text className={`text-[11px] text-center ${active ? "font-bold text-green-800" : "font-medium text-gray-600"}`}>
                      {getModeLabel(mode)}
                    </Text>
                    <Text className="text-[10px] text-gray-400 mt-0.5">η = {Math.round((1 - PERTE_PAR_MODE[mode]) * 100)}%</Text>
                    <Text className="text-[10px] text-red-400 mt-0.5">+{Math.round(PERTE_PAR_MODE[mode] * 100)}%</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {hasData && !isCompleted && (
              <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm elevation-3 border-l-4 border-sky-500">
                <View className="flex-row items-center gap-2 mb-2">
                  <Ionicons name="information-circle" size={18} color="#0369a1" />
                  <Text className="text-[14px] font-bold text-sky-700 flex-1">
                    {t("irrigation.faoAdvice") || "Conseil d'irrigation FAO-56"}
                  </Text>
                  {loadingWeatherRegion && <ActivityIndicator size="small" color="#0369a1" />}
                </View>

                <Text className="text-[13px] text-gray-700 leading-5 mb-3">
                  {t("irrigation.cultureLabel") || "Culture"}{" "}
                  <Text className="font-bold text-gray-900">
                    {translateCropName(selectedCulture.nom, language)} ({selectedCulture.variete})
                  </Text>
                  {" · "}{SOL_LABELS[besoins.typeSol] || besoins.typeSol}
                  {selectedCulture.region ? ` · 🌍 ${selectedCulture.region}` : ""}
                </Text>

                <View className="flex-row items-center bg-slate-50 rounded-xl p-2.5 mb-3.5">
                  {[
                    { label: `ET₀${besoins.sourceRegion ? ` (${selectedCulture.region})` : ""}`, val: besoins.et0, unit: "mm/j", color: "text-blue-600" },
                    { label: besoins.kcLabel || "Kc (FAO-56)", val: besoins.kc, unit: kcStade || moisActuel, color: "text-violet-600", loading: loadingKc },
                    { label: "ETc",          val: besoins.etc, unit: "mm/j", color: "text-green-600" },
                    { label: t("irrigation.rfuSoil") || "RFU sol", val: besoins.rfu, unit: "mm", color: "text-violet-600" },
                  ].map((item, i, arr) => (
                    <React.Fragment key={item.label}>
                      <View className="flex-1 items-center">
                        <Text className="text-[10px] text-gray-500 mb-1 text-center">{item.label}</Text>
                        {item.loading
                          ? <ActivityIndicator size="small" color="#7c3aed" style={{ marginVertical: 4 }} />
                          : <Text className={`text-[18px] font-bold ${item.color}`}>{item.val}</Text>
                        }
                        <Text className="text-[10px] text-gray-400 mt-0.5">{item.unit}</Text>
                      </View>
                      {i < arr.length - 1 && <View className="w-px h-9 bg-gray-200" />}
                    </React.Fragment>
                  ))}
                </View>

                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    <Text className="text-[13px] text-gray-500 mb-1">
                      {t("irrigation.volumeToApply") || "Volume à apporter"}
                    </Text>
                    <Text className="text-[42px] font-bold text-green-600 leading-[46px]">
                      {besoins.eauM3}{" "}
                      <Text className="text-[20px] font-semibold text-green-600">m³</Text>
                    </Text>
                    {besoins.volumeM3Ha && (
                      <Text className="text-[25px] font-bold text-teal-600 leading-[42px] mt-0.5">
                        ≈ {besoins.volumeM3Ha}{" "}
                        <Text className="text-[18px] font-semibold text-teal-600">m³/ha</Text>
                      </Text>
                    )}
                    <Text className="text-[11px] text-gray-400 mt-1">
                      {t("irrigation.etcTheoretical") || "ETc théorique"}: {besoins.eauTheoriqueMm} mm
                      {" · "}{t("irrigation.losses") || "pertes"}: {besoins.perteMm} mm ({besoins.pourcentagePerte}%)
                    </Text>
                    {besoins.litresParArbre && (
                      <Text className="text-[11px] text-green-600 mt-1">
                        ≈ {besoins.litresParArbre} L/{plantUnit}
                        {besoins.volumeLitres
                          ? ` · ${besoins.volumeLitres.toLocaleString("fr-FR")} L ${t("irrigation.onSurface") || "sur"} ${besoins.surface} m²`
                          : ""}
                      </Text>
                    )}
                  </View>
                  <View className="items-end">
                    <Text className="text-[12px] text-gray-500 mb-1">{t("irrigation.totalFlow") || "Débit total"}</Text>
                    <Text className="text-[14px] font-semibold text-gray-700 mt-0.5">{besoins.debitM3h} m³/h</Text>
                    <Text className="text-[14px] font-semibold text-gray-700 mt-0.5">{fmtTemps(besoins.temps)}</Text>
                    <Text className="text-[14px] font-semibold text-green-600 mt-0.5">
                      {besoins.eta}% {t("irrigation.effShort") || "eff."}
                    </Text>
                    {besoins.debitGoutteur > 0 && (
                      <Text className="text-[10px] text-gray-400 mt-0.5">
                        {besoins.debitGoutteur} L/h × {besoins.nbGoutteursParArbre} goutteurs/{plantUnit}
                      </Text>
                    )}
                  </View>
                </View>

                <View className="flex-row items-start gap-2 bg-violet-50 border border-violet-200 px-2.5 py-2 rounded-xl mb-2">
                  <Text className="text-[13px] mt-0.5">🧪</Text>
                  <View className="flex-1">
                    <View className="flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
                      <Text className="text-[12px] text-violet-700">
                        <Text className="font-bold">θcc = {besoins.thetaCcDisplay ?? "—"}</Text>
                        <Text className="text-violet-500"> cm³/cm³</Text>
                      </Text>
                      <Text className="text-[12px] text-violet-700">
                        <Text className="font-bold">θpf = {besoins.thetaPfDisplay ?? "—"}</Text>
                        <Text className="text-violet-500"> cm³/cm³</Text>
                      </Text>
                      <View className={`rounded-full px-2 py-0.5 ${
                        besoins.thetaSource === "saxton_rawls" ? "bg-blue-100"
                        : besoins.thetaSource === "mesure" ? "bg-green-100"
                        : "bg-violet-100"
                      }`}>
                        <Text className={`text-[10px] font-semibold ${
                          besoins.thetaSource === "saxton_rawls" ? "text-blue-700"
                          : besoins.thetaSource === "mesure" ? "text-green-700"
                          : "text-violet-500"
                        }`}>
                          {besoins.thetaSource === "saxton_rawls" ? "🔬 Saxton & Rawls"
                           : besoins.thetaSource === "mesure" ? "✓ Mesure"
                           : "FAO-56 std"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* ── Stock hydrique ── */}
                {(() => {
                  const isWarn = besoins.stockAlert === "warning";
                  const isCrit = besoins.stockAlert === "critical";
                  const bg     = isCrit ? "bg-red-50 border-red-300"
                               : isWarn ? "bg-orange-50 border-orange-300"
                               : "bg-emerald-50 border-emerald-200";
                  const barClr = isCrit ? "bg-red-500" : isWarn ? "bg-orange-400" : "bg-emerald-500";
                  const txtClr = isCrit ? "text-red-700" : isWarn ? "text-orange-700" : "text-emerald-700";
                  const icon   = isCrit ? "alert-circle" : isWarn ? "warning" : "water";
                  const iconClr= isCrit ? "#dc2626" : isWarn ? "#ea580c" : "#059669";
                  const pct    = Math.max(0, Math.min(100, besoins.stockPct ?? 100));
                  return (
                    <View className={`border rounded-xl px-2.5 py-2 mb-2 ${bg}`}>
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <Ionicons name={icon} size={13} color={iconClr} />
                        <Text className={`text-[11px] font-bold flex-1 ${txtClr}`}>
                          Stock sol : {besoins.W_current?.toFixed(1)} mm / {besoins.W_cc?.toFixed(0)} mm
                          {besoins.peff > 0 ? `  🌧 Peff=${besoins.peff?.toFixed(1)} mm` : ""}
                          {isCrit ? "  ⚠ Critique — sol proche du flétrissement"
                          : isWarn ? "  ⚠ Seuil RFU atteint — irrigation requise"
                          : "  ✓ Réserve suffisante"}
                        </Text>
                      </View>
                      <View className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                        <View className={`h-full rounded-full ${barClr}`} style={{ width: `${pct}%` }} />
                      </View>
                      <Text className="text-[10px] text-gray-500">
                        W_cc = {besoins.W_cc?.toFixed(0)} mm · seuil RFU = {besoins.W_seuil?.toFixed(0)} mm · W_pf = {besoins.W_pf_mm?.toFixed(0)} mm · stock = {besoins.W_current?.toFixed(1)} mm ({pct}% RU){besoins.rainRaw > 0 ? `  · 🌧 pluie = ${besoins.rainRaw?.toFixed(1)} mm → Peff = ${besoins.peff?.toFixed(1)} mm` : ""}
                      </Text>
                    </View>
                  );
                })()}

                {/* ── Instruction vanne avec date exacte ── */}
                <View className={`border p-2.5 rounded-xl mb-2 ${
                  besoins.isIrrigationDue ? "bg-blue-50 border-blue-400" : "bg-slate-50 border-slate-200"
                }`}>
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Ionicons name="calendar" size={13} color={besoins.isIrrigationDue ? "#1d4ed8" : "#64748b"} />
                    <Text className={`text-[12px] font-bold capitalize flex-1 ${besoins.isIrrigationDue ? "text-blue-700" : "text-slate-600"}`}>
                      {fmtDateIrrig(besoins.dateProchaine)}
                    </Text>
                    {besoins.isIrrigationDue ? (
                      <View className="bg-red-100 rounded-full px-2 py-0.5">
                        <Text className="text-[10px] font-bold text-red-600">À irriguer</Text>
                      </View>
                    ) : (
                      <View className="bg-slate-100 rounded-full px-2 py-0.5">
                        <Text className="text-[10px] font-semibold text-slate-500">dans {besoins.joursAvantIrrig} j</Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-start gap-2">
                    <Ionicons
                      name={besoins.isIrrigationDue ? "time-outline" : "checkmark-circle-outline"}
                      size={15}
                      color={besoins.isIrrigationDue ? "#2563eb" : "#16a34a"}
                      style={{ marginTop: 1 }}
                    />
                    {besoins.isIrrigationDue ? (
                      <Text className="flex-1 text-[13px] leading-5 text-blue-800">
                        {besoins.stockDue
                          ? "Irriguer aujourd'hui pour revenir à la capacité au champ — "
                          : "Ouvrez la vanne pendant "}
                        <Text className="font-bold">{fmtTemps(besoins.temps)}</Text>
                        {" à "}
                        <Text className="font-bold">{besoins.debitM3h} m³/h</Text>
                        {` (${besoins.eta}% eff.) · `}
                        <Text className="font-bold">{besoins.eauM3} m³</Text>
                        {" sur "}
                        <Text className="font-bold">{besoins.surface.toLocaleString("fr-FR")} m²</Text>
                      </Text>
                    ) : (
                      <Text className="flex-1 text-[13px] leading-5 text-green-700 font-semibold">
                        Pas d'irrigation à l'instant — prochain apport dans{" "}
                        <Text className="font-bold">{besoins.joursAvantIrrig} j</Text>
                      </Text>
                    )}
                  </View>
                </View>

                {/* ── Programme FAO-56 ── */}
                <View className="flex-row items-start gap-2 bg-violet-50 border border-violet-300 p-2.5 rounded-xl mb-2">
                  <Ionicons name="calendar-outline" size={15} color="#7c3aed" />
                  <Text className="flex-1 text-[13px] leading-5 text-violet-700">
                    RU = {besoins.ru} mm · RFU = {besoins.rfu} mm (p={besoins.pAdj}, z={besoins.z} m) · déficit = {besoins.deficitMm} mm.{" "}
                    <Text className="font-bold">
                      Fréquence : tous les {besoins.frequenceJours} j
                    </Text>
                    {" · Prochaine : "}
                    <Text className="font-bold">{fmtDateIrrig(besoins.dateProchaine)}</Text>
                    {besoins.joursAvantIrrig > 0 ? ` (J+${besoins.joursAvantIrrig}).` : " (aujourd'hui)."}
                  </Text>
                </View>

                <TouchableOpacity
                  className="bg-green-50 border-2 border-green-700 rounded-full py-3.5 items-center mt-1"
                  onPress={handleFaitPress}
                >
                  <Text className="text-[17px] font-semibold text-green-800">
                    {t("irrigation.done") || "Fait"} ✓
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {isCompleted && selectedCulture && (
              <View className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 mb-4 items-center">
                <MaterialCommunityIcons name="check-circle" size={50} color="#4CAF50" />
                <Text className="text-[20px] font-semibold text-green-800 mt-2">
                  {t("irrigation.completed") || "Irrigation enregistrée !"}
                </Text>
                <Text className="text-[22px] font-bold text-gray-900 mt-1.5">
                  {translateCropName(selectedCulture.nom, language)}
                </Text>
                <Text className="text-[42px] font-bold text-green-600 leading-[46px] mt-2">
                  {besoins.eauM3}{" "}<Text className="text-[20px] font-semibold">m³</Text>
                </Text>
                <Text className="text-[15px] text-green-600 mt-1">
                  {t("irrigation.onSurface") || "sur"} {selectedCulture.surface} m²
                </Text>
                {besoins.litresParArbre && (
                  <Text className="text-[15px] text-green-600 mt-1">≈ {besoins.litresParArbre} L/{plantUnit}</Text>
                )}
                <Text className="text-[15px] text-green-600 mt-1">
                  {besoins.debitM3h} m³/h · {fmtTemps(besoins.temps)}
                </Text>
                <Text className="text-[13px] text-gray-500 mt-1 text-center">
                  Déficit : {besoins.deficitMm} mm · ETc = {besoins.etc} mm/j · ET₀ {besoins.et0} × Kc {besoins.kc} · η = {besoins.eta}%
                </Text>
              </View>
            )}

            {selectedCulture && (
              <View className="mb-6">
                <ETcHistory
                  key={etcHistoryKey}
                  cultureId={selectedCulture._id}
                  cultureName={selectedCulture.nom}
                  todayEtc={parseFloat(besoins.etc)}
                  todayEt0={parseFloat(besoins.et0)}
                  todayKc={parseFloat(besoins.kc)}
                />
              </View>
            )}
          </>
        )}

        {activeTab === "history" && (
          <View className="bg-white rounded-2xl p-5 shadow-sm elevation-2 mb-4">
            {historyItems.length === 0 ? (
              <View className="items-center py-10">
                <Text className="text-5xl mb-3">📋</Text>
                <Text className="text-[15px] text-gray-400 italic">
                  {t("irrigation.noHistory") || "Aucune irrigation enregistrée"}
                </Text>
              </View>
            ) : (
              historyItems.map((item, idx) => {
                const surface     = item.surface || 100;
                const eauMmVal    = item.eauMm != null ? Number(item.eauMm) : (item.volume / surface);
                const eauM3Val    = ((eauMmVal * surface) / 1000).toFixed(2);
                const debitLhVal  = item.debit || 1000;
                const debitM3hVal = (debitLhVal / 1000).toFixed(3);
                return (
                  <View key={item._id}>
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-[14px] font-semibold text-orange-500">
                        {translateCropName(item.nom || item.cultureId?.nom, language)}
                      </Text>
                      <Text className="text-[13px] text-gray-400">{fmtDate(item.date)}</Text>
                    </View>
                    <View className="bg-gray-100 px-3 py-1 rounded-full self-start mb-1">
                      <Text className="text-[12px] text-gray-600">{MODE_EMOJI[item.mode]} {getModeLabel(item.mode)}</Text>
                    </View>
                    <View className="flex-row items-center mt-1 flex-wrap gap-1">
                      <Text className="text-[18px] font-bold text-green-600">{eauM3Val} m³</Text>
                      <Text className="text-[14px] text-gray-500 mx-2">·</Text>
                      <Text className="text-[14px] text-gray-600">{debitM3hVal} m³/h</Text>
                      <Text className="text-[14px] text-gray-500 mx-2">·</Text>
                      <Text className="text-[14px] text-gray-600">{item.duree || item.temps} min</Text>
                    </View>
                    {item.et0 != null && item.etc != null && (
                      <View className="flex-row mt-1 gap-3 flex-wrap">
                        <Text className="text-[11px] text-gray-500">ET₀: {Number(item.et0).toFixed(2)} mm/j</Text>
                        <Text className="text-[11px] text-green-600">ETc: {Number(item.etc).toFixed(2)} mm/j</Text>
                        <Text className="text-[11px] text-violet-600">Kc: {Number(item.kc).toFixed(2)}</Text>
                      </View>
                    )}
                    {idx < historyItems.length - 1 && <View className="h-px bg-gray-200 my-3" />}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={cultureModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCultureModalVisible(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/40"
          activeOpacity={1}
          onPress={() => setCultureModalVisible(false)}
        >
          <SafeAreaView
            edges={["bottom", "left", "right"]}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl"
          >
            <View className="flex-row justify-between items-center px-5 py-4 border-b border-gray-100">
              <Text className="text-[17px] font-bold text-gray-900">
                {t("irrigation.chooseCrop") || "Choisir une culture"}
              </Text>
              <TouchableOpacity onPress={() => setCultureModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {cultures.length === 0 ? (
              <View className="items-center py-10">
                <Text className="text-[40px] mb-2">🌱</Text>
                <Text className="text-[15px] text-gray-400 italic">
                  {t("irrigation.noCulture") || "Aucune culture disponible"}
                </Text>
              </View>
            ) : (
              <FlatList
                data={cultures}
                keyExtractor={(item) => item._id}
                style={{ maxHeight: 380 }}
                contentContainerStyle={{ paddingVertical: 8 }}
                renderItem={({ item }) => {
                  const isSelected = selectedCulture?._id === item._id;
                  const kcAffichéModal = isSelected
                    ? (kcDynamique?.toFixed(2) ?? parseFloat(item.kcActuel || 0.65).toFixed(2))
                    : parseFloat(item.kcActuel || 0.65).toFixed(2);
                  const itemDebitMissing = !parseFloat(item.irrigation?.debit);
                  return (
                    <TouchableOpacity
                      className={`flex-row items-center mx-4 my-1 p-4 rounded-xl border ${
                        isSelected ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100"
                      }`}
                      onPress={() => handleSelectCulture(item)}
                    >
                      <View className="flex-1">
                        <Text className={`text-[15px] font-semibold ${isSelected ? "text-green-700" : "text-gray-900"}`}>
                          {translateCropName(item.nom, language)}
                        </Text>
                        <Text className="text-[13px] text-gray-500 mt-0.5">{item.parcelle} · {item.variete}</Text>
                        <View className="flex-row flex-wrap mt-1.5 gap-1.5">
                          <View className="bg-white border border-gray-200 rounded-full px-2 py-0.5">
                            <Text className="text-[11px] text-gray-600">{item.surface} m²</Text>
                          </View>
                          {item.nombreArbres && (
                            <View className="bg-white border border-gray-200 rounded-full px-2 py-0.5">
                              <Text className="text-[11px] text-gray-600">
                                {item.nombreArbres} {getPlantUnit(item.nom)}s
                              </Text>
                            </View>
                          )}
                          <View className="bg-white border border-gray-200 rounded-full px-2 py-0.5">
                            <Text className="text-[11px] font-semibold text-violet-600">
                              Kc: {kcAffichéModal}{isSelected && kcStade ? ` · ${kcStade}` : ""}
                            </Text>
                          </View>
                          {itemDebitMissing && (
                            <View className="bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                              <Text className="text-[11px] font-semibold text-amber-600">
                                ⚠ {t("irrigation.flowMissing") || "Débit non défini"}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <View className="h-6" />
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
