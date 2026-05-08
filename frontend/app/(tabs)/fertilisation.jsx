// app/(user)/fertilisation.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { BrandHeader } from "@components/BrandHeader";
import NotificationBell from "@components/NotificationBell";
import { useFertilisationNotifications } from "@hooks/useNotifications";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { useLanguage } from "@context/LanguageContext";
import { translateCropName } from "@utils/cropNames";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

// ─── Données FAO-56 ───────────────────────────────────────────────────────────
const FERT = {
  Orange: [
    {
      jour: 15,
      mois: 1,
      produit: "KNO₃",
      doseParArbre: "2 kg/arbre",
      doseParHa: "800 kg/ha",
    },
    {
      jour: 15,
      mois: 3,
      produit: "Urée",
      doseParArbre: "0.5 kg/arbre",
      doseParHa: "200 kg/ha",
    },
    {
      jour: 15,
      mois: 5,
      produit: "NPK",
      doseParArbre: "1.5 kg/arbre",
      doseParHa: "600 kg/ha",
    },
    {
      jour: 15,
      mois: 9,
      produit: "K₂SO₄",
      doseParArbre: "1 kg/arbre",
      doseParHa: "400 kg/ha",
    },
  ],
  Citron: [
    {
      jour: 10,
      mois: 2,
      produit: "Urée",
      doseParArbre: "0.4 kg/arbre",
      doseParHa: "160 kg/ha",
    },
    {
      jour: 10,
      mois: 5,
      produit: "NPK",
      doseParArbre: "1.2 kg/arbre",
      doseParHa: "480 kg/ha",
    },
    {
      jour: 10,
      mois: 10,
      produit: "K₂SO₄",
      doseParArbre: "0.8 kg/arbre",
      doseParHa: "320 kg/ha",
    },
  ],
  Mandarine: [
    {
      jour: 12,
      mois: 2,
      produit: "Urée",
      doseParArbre: "0.4 kg/arbre",
      doseParHa: "160 kg/ha",
    },
    {
      jour: 12,
      mois: 5,
      produit: "NPK",
      doseParArbre: "1 kg/arbre",
      doseParHa: "400 kg/ha",
    },
    {
      jour: 12,
      mois: 9,
      produit: "K₂SO₄",
      doseParArbre: "0.7 kg/arbre",
      doseParHa: "280 kg/ha",
    },
  ],
  Tomate: [
    {
      jour: 5,
      mois: 3,
      produit: "DAP",
      doseParArbre: null,
      doseParHa: "150 kg/ha",
    },
    {
      jour: 5,
      mois: 4,
      produit: "Urée",
      doseParArbre: null,
      doseParHa: "80 kg/ha",
    },
    {
      jour: 5,
      mois: 5,
      produit: "NPK",
      doseParArbre: null,
      doseParHa: "200 kg/ha",
    },
    {
      jour: 5,
      mois: 6,
      produit: "Ca(NO₃)₂",
      doseParArbre: null,
      doseParHa: "100 kg/ha",
    },
  ],
  Blé: [
    {
      jour: 1,
      mois: 11,
      produit: "DAP",
      doseParArbre: null,
      doseParHa: "120 kg/ha",
    },
    {
      jour: 1,
      mois: 2,
      produit: "Urée x1",
      doseParArbre: null,
      doseParHa: "100 kg/ha",
    },
    {
      jour: 1,
      mois: 3,
      produit: "Urée x2",
      doseParArbre: null,
      doseParHa: "80 kg/ha",
    },
  ],
  Olivier: [
    {
      jour: 20,
      mois: 2,
      produit: "Urée",
      doseParArbre: "0.3 kg/arbre",
      doseParHa: "60 kg/ha",
    },
    {
      jour: 20,
      mois: 5,
      produit: "NPK",
      doseParArbre: "0.8 kg/arbre",
      doseParHa: "160 kg/ha",
    },
    {
      jour: 20,
      mois: 8,
      produit: "K₂SO₄",
      doseParArbre: "0.5 kg/arbre",
      doseParHa: "100 kg/ha",
    },
  ],
  Pomme: [
    {
      jour: 10,
      mois: 2,
      produit: "Urée",
      doseParArbre: "0.4 kg/arbre",
      doseParHa: "200 kg/ha",
    },
    {
      jour: 10,
      mois: 4,
      produit: "NPK",
      doseParArbre: "1 kg/arbre",
      doseParHa: "500 kg/ha",
    },
    {
      jour: 10,
      mois: 7,
      produit: "K₂SO₄",
      doseParArbre: "0.8 kg/arbre",
      doseParHa: "400 kg/ha",
    },
  ],
  _default: [
    {
      jour: 15,
      mois: 3,
      produit: "NPK",
      doseParArbre: null,
      doseParHa: "100 kg/ha",
    },
    {
      jour: 15,
      mois: 7,
      produit: "K₂SO₄",
      doseParArbre: null,
      doseParHa: "60 kg/ha",
    },
  ],
};

function getFertData(nom) {
  if (!nom) return FERT._default;
  const k = Object.keys(FERT).find(
    (key) =>
      key !== "_default" && nom.toLowerCase().includes(key.toLowerCase()),
  );
  return k ? FERT[k] : FERT._default;
}

function getDoseLabel(ev, culture, t) {
  const nbArbres = culture?.nombreArbres;
  const surface = culture?.surface;
  const surfaceHa = surface ? surface / 10000 : null;
  const treesLabel = t ? t("cultures.details.trees") : "arbres";

  let lines = [];

  if (ev.doseParArbre) {
    let line = ev.doseParArbre;
    if (nbArbres) {
      const numKg = parseFloat(ev.doseParArbre);
      if (!isNaN(numKg)) {
        line = `${ev.doseParArbre} (${nbArbres} ${treesLabel})`;
      }
    }
    lines.push(line);
  }

  if (ev.doseParHa) {
    let line = ev.doseParHa;
    if (surfaceHa) {
      const numKg = parseFloat(ev.doseParHa);
      if (!isNaN(numKg)) {
        line = `${ev.doseParHa} (${surfaceHa.toFixed(2)} ha)`;
      }
    }
    lines.push(line);
  }

  return lines;
}

const MOIS_COURTS = {
  fr: [
    "janv",
    "févr",
    "mars",
    "avr",
    "mai",
    "juin",
    "juil",
    "août",
    "sept",
    "oct",
    "nov",
    "déc",
  ],
  en: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  ar: [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ],
  tr: [
    "Oca",
    "Şub",
    "Mar",
    "Nis",
    "May",
    "Haz",
    "Tem",
    "Ağu",
    "Eyl",
    "Eki",
    "Kas",
    "Ara",
  ],
};

const ALERT_TXT = {
  fr: { count: "alerte(s) à traiter", tap: "Appuyez sur 🔔 pour les détails" },
  en: { count: "alert(s) pending", tap: "Tap 🔔 for details" },
  ar: { count: "تنبيهات", tap: "اضغط على 🔔 للتفاصيل" },
  tr: { count: "uyarı", tap: "Detaylar için 🔔 ye dokunun" },
};

export default function FertilisationPage() {
  const { language, t } = useLanguage();
  const lang = language || "fr";

  const [cultures, setCultures] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pickModal, setPickModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [activeTab, setActiveTab] = useState("calendar");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [confirmedEvents, setConfirmedEvents] = useState(new Set());
  const [confirmingKey, setConfirmingKey] = useState(null);

  const year = new Date().getFullYear();
  const moisCourts = MOIS_COURTS[lang] || MOIS_COURTS.fr;

  useEffect(() => {
    apiFetch(API_ENDPOINTS.cultures.base)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setCultures(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const culturesToShow = selected ? [selected] : cultures;

  const { notifications, markRead, markAllRead } =
    useFertilisationNotifications(culturesToShow, getFertData, lang);
  const urgentCount = notifications.filter(
    (n) => !n.read && n.type !== "done",
  ).length;

  const allEvents = culturesToShow.flatMap((c) =>
    getFertData(c.nom).map((ev) => ({
      ...ev,
      cultureName: c.nom,
      parcelle: c.parcelle || "",
      culture: c,
      dateStr: `${year}-${String(ev.mois).padStart(2, "0")}-${String(ev.jour).padStart(2, "0")}`,
    })),
  );

  const markedDates = {};
  allEvents.forEach((ev) => {
    if (!markedDates[ev.dateStr])
      markedDates[ev.dateStr] = { marked: true, dots: [] };
    if (markedDates[ev.dateStr].dots.length === 0)
      markedDates[ev.dateStr].dots.push({ color: "#16A34A", key: "fert" });
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const finalMarked = {
    ...markedDates,
    [todayStr]: { ...(markedDates[todayStr] || {}), today: true },
    [selectedDate]: {
      ...(markedDates[selectedDate] || {}),
      selected: true,
      selectedColor: "#16A34A",
    },
  };

  const selectedMonth = parseInt(selectedDate.split("-")[1]);
  const eventsThisMonth = allEvents
    .filter((ev) => ev.mois === selectedMonth)
    .sort((a, b) => a.jour - b.jour);

  const getTypeProduit = (produit) => {
    if (!produit) return "autre";
    const p = produit.toLowerCase();
    if (p.includes("npk")) return "NPK";
    if (p.includes("urée") || p.includes("uree") || p.includes("dap") || p.includes("azote")) return "azote";
    if (p.includes("phosphore") || p.includes("superphosphate")) return "phosphore";
    if (p.includes("k₂so₄") || p.includes("k2so4") || p.includes("kno") || p.includes("potassium") || p.includes("kcl")) return "potassium";
    if (p.includes("fumier") || p.includes("compost") || p.includes("organique")) return "organique";
    return "autre";
  };

  const handleConfirmFert = async (ev) => {
    const key = `${ev.culture?._id}_${ev.mois}_${ev.jour}`;
    if (confirmedEvents.has(key)) return;
    setConfirmingKey(key);
    try {
      const res = await apiFetch(API_ENDPOINTS.fertilisations.base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cultureId: ev.culture?._id,
          date: new Date(new Date().getFullYear(), ev.mois - 1, ev.jour).toISOString(),
          typeProduit: getTypeProduit(ev.produit),
          produit: ev.produit,
          dose: parseFloat(ev.doseParHa) || parseFloat(ev.doseParArbre) || 0,
          uniteDose: ev.doseParHa ? "kg/ha" : "g/arbre",
          modeApplication: "sol",
          surface: ev.culture?.surface,
          nombreArbres: ev.culture?.nombreArbres,
        }),
      });
      if (res.ok) {
        setConfirmedEvents((prev) => new Set([...prev, key]));
      } else {
        Alert.alert(t("common.error"), t("fertilisation.saveFailed"));
      }
    } catch (e) {
      console.error("handleConfirmFert:", e.message);
      Alert.alert(t("common.error"), t("errors.network"));
    } finally {
      setConfirmingKey(null);
    }
  };

  const exportFertilisation = async () => {
    try {
      setExporting(true);

      const headers = [
        "Culture",
        "Parcelle",
        "Date",
        "Mois",
        "Produit",
        "Dose/arbre",
        "Dose/ha",
        "Statut",
      ];
      const today = new Date();
      const tM = today.getMonth() + 1;
      const tD = today.getDate();
      const year = new Date().getFullYear();

      const rows = [];
      culturesToShow.forEach((c) => {
        getFertData(c.nom).forEach((ev) => {
          let statut = t("fertilisation.inDays").replace("{{count}}", "?");
          if (ev.mois < tM || (ev.mois === tM && ev.jour <= tD))
            statut = t("fertilisation.past");
          if (ev.mois === tM) statut = t("fertilisation.thisMonth");
          rows.push([
            c.nom,
            c.parcelle || "—",
            `${String(ev.jour).padStart(2, "0")}/${String(ev.mois).padStart(2, "0")}/${year}`,
            moisCourts[ev.mois - 1],
            ev.produit,
            ev.doseParArbre || "—",
            ev.doseParHa || "—",
            statut,
          ]);
        });
      });

      const escape = (v) => {
        const s = String(v ?? "");
        return s.includes(",") || s.includes('"')
          ? '"' + s.replace(/"/g, '""') + '"'
          : s;
      };

      const csv =
        "\uFEFF" +
        [
          headers.map(escape).join(","),
          ...rows.map((r) => r.map(escape).join(",")),
        ].join("\r\n");

      const filename = `SmartIrrig_Fertilisation_${year}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
        if (!baseDir) { Alert.alert(t("common.error"), t("fertilisation.storageUnavailable")); return; }
        const fileUri = baseDir + filename;
        await FileSystem.writeAsStringAsync(fileUri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: t("fertilisation.exporter") || "Exporter la fertilisation",
            UTI: "public.comma-separated-values-text",
          });
        } else {
          Alert.alert(t("common.information"), t("fertilisation.fileSaved").replace("{filename}", filename));
        }
      }
    } catch (e) {
      console.error("Export error:", e);
      Alert.alert(
        t("common.error") || "Erreur",
        t("fertilisation.exportError") ||
          "Erreur lors de l'exportation. Veuillez réessayer.",
      );
    } finally {
      setExporting(false);
    }
  };

  const alertTxt = ALERT_TXT[lang] || ALERT_TXT.fr;

  if (loading)
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator size="large" color="#4CAF50" />
      </SafeAreaView>
    );

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <BrandHeader
        title={t("fertilisation.title")}
        right={
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              className="flex-row items-center gap-1.5 rounded-full border border-green-300 bg-green-50 px-2.5 py-1.5"
              onPress={exportFertilisation}
              activeOpacity={0.8}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#16a34a" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={15} color="#16a34a" />
                  <Text className="text-xs font-bold text-green-600">
                    {t("fertilisation.exporter")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <NotificationBell
              notifications={notifications}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              lang={lang}
            />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 36,
          paddingTop: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {urgentCount > 0 && (
          <View className="mb-4 flex-row items-start gap-2 rounded-2xl border border-red-200 bg-red-100 px-3.5 py-3">
            <Ionicons name="alert-circle" size={16} color="#dc2626" />
            <View className="flex-1">
              <Text className="text-[13px] font-bold text-red-600">
                {urgentCount} {alertTxt.count}
              </Text>
              <Text className="mt-0.5 text-[11px] text-red-500">
                {alertTxt.tap}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          className="mb-4 flex-row items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
          onPress={() => setPickModal(true)}
        >
          <View className="flex-1">
            <Text className="mb-0.5 text-[11px] uppercase tracking-wider text-gray-500">
              {t("common.culture").toUpperCase()}
            </Text>
            <Text className="text-lg font-bold text-gray-800">
              {selected ? translateCropName(selected.nom, language) : t("fertilisation.allCrops")}
            </Text>
            {selected?.parcelle && (
              <Text className="mt-0.5 text-xs text-gray-500">
                {selected.parcelle}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={22} color="#4CAF50" />
        </TouchableOpacity>

        <View className="mb-5 flex-row rounded-2xl bg-slate-100 p-1">
          {["calendar", "list"].map((tab) => (
            <TouchableOpacity
              key={tab}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-2.5 ${
                activeTab === tab ? "bg-white shadow-sm" : ""
              }`}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={tab === "calendar" ? "calendar-outline" : "list-outline"}
                size={15}
                color={activeTab === tab ? "#111827" : "#9ca3af"}
                className="mr-1.5"
              />
              <Text
                className={`text-sm font-medium ${activeTab === tab ? "font-bold text-gray-900" : "text-gray-400"}`}
              >
                {tab === "calendar"
                  ? t("fertilisation.tab_calendar")
                  : t("fertilisation.tab_list")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ════ TAB CALENDRIER ════ */}
        {activeTab === "calendar" && (
          <>
            <View className="mb-5 overflow-hidden rounded-2xl bg-white shadow-sm">
              <Calendar
                current={selectedDate}
                markingType="multi-dot"
                markedDates={finalMarked}
                onDayPress={(day) => setSelectedDate(day.dateString)}
                theme={{
                  todayTextColor: "#16A34A",
                  arrowColor: "#16A34A",
                  selectedDayBackgroundColor: "#16A34A",
                  selectedDayTextColor: "white",
                  monthTextColor: "#1F2937",
                  textMonthFontWeight: "bold",
                  textMonthFontSize: 15,
                  calendarBackground: "white",
                }}
              />
            </View>

            <Text className="mb-3 text-[15px] font-bold text-gray-700">
              {moisCourts[selectedMonth - 1]} {year}
              <Text className="text-[13px] font-normal text-gray-400">
                {" "}
                · {eventsThisMonth.length} {t("fertilisation.applications")}
              </Text>
            </Text>

            {eventsThisMonth.length === 0 ? (
              <View className="items-center gap-2.5 py-12">
                <Ionicons name="leaf-outline" size={44} color="#d1d5db" />
                <Text className="text-sm text-gray-400">
                  {t("fertilisation.nothingMonth")}
                </Text>
              </View>
            ) : (
              eventsThisMonth.map((ev) => {
                const evDate = new Date(year, ev.mois - 1, ev.jour);
                const todayDate = new Date();
                todayDate.setHours(0, 0, 0, 0);
                const diff = Math.round((evDate - todayDate) / 86400000);
                const isToday = diff === 0;
                const isSoon = diff > 0 && diff <= 3;
                const isPast = diff < 0;
                const doseLines = getDoseLabel(ev, ev.culture, t);

                return (
                  <View
                    key={`${ev.culture?._id ?? "x"}_${ev.mois}_${ev.jour}_${ev.produit ?? ""}`}
                    className={`mb-2.5 flex-row items-start rounded-2xl border p-3.5 shadow-sm ${
                      isToday
                        ? "border-red-200 bg-red-50"
                        : isSoon
                          ? "border-amber-200 bg-amber-50"
                          : isPast
                            ? "border-gray-100 bg-white opacity-60"
                            : "border-gray-100 bg-white"
                    }`}
                  >
                    <View
                      className={`mr-3 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        isToday
                          ? "bg-red-500"
                          : isSoon
                            ? "bg-amber-500"
                            : isPast
                              ? "bg-gray-300"
                              : "bg-green-600"
                      }`}
                    />
                    <View className="flex-1">
                      <View className="mb-1 flex-row items-center gap-1.5">
                        {isToday && (
                          <Ionicons
                            name="alert-circle"
                            size={13}
                            color="#ef4444"
                          />
                        )}
                        {isSoon && (
                          <Ionicons
                            name="warning-outline"
                            size={13}
                            color="#f59e0b"
                          />
                        )}
                        <Text
                          className={`text-sm font-bold ${isToday ? "text-red-600" : "text-gray-800"}`}
                        >
                          {translateCropName(ev.cultureName, language)}
                        </Text>
                        {ev.parcelle && (
                          <Text className="text-xs text-gray-400">
                            · {ev.parcelle}
                          </Text>
                        )}
                      </View>

                      {doseLines.map((line, li) => (
                        <Text
                          key={li}
                          className={`${li === 0 ? "mb-1 text-[15px] font-bold text-green-600" : "text-xs font-medium text-gray-500"}`}
                        >
                          {line}
                        </Text>
                      ))}

                      <View className="mt-1 flex-row flex-wrap gap-1.5">
                        <View className="rounded-full bg-green-50 px-2 py-0.5">
                          <Text className="text-[11px] font-bold text-green-600">
                            {ev.produit}
                          </Text>
                        </View>
                        {isToday && (
                          <View className="rounded-full bg-red-100 px-2 py-0.5">
                            <Text className="text-[11px] font-bold text-red-600">
                              {t("fertilisation.todayLabel")}
                            </Text>
                          </View>
                        )}
                        {isSoon && (
                          <View className="rounded-full bg-amber-100 px-2 py-0.5">
                            <Text className="text-[11px] font-bold text-amber-600">
                              {t("fertilisation.inDays").replace(
                                "{{count}}",
                                String(diff),
                              )}
                            </Text>
                          </View>
                        )}
                        {isPast && (
                          <View className="rounded-full bg-gray-100 px-2 py-0.5">
                            <Text className="text-[11px] font-bold text-gray-400">
                              {t("fertilisation.past")}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text className="ml-2 text-[13px] font-semibold text-gray-500">
                      {String(ev.jour).padStart(2, "0")}/
                      {String(ev.mois).padStart(2, "0")}
                    </Text>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ════ TAB LISTE ANNUELLE ════ */}
        {activeTab === "list" &&
          (allEvents.length === 0 ? (
            <View className="items-center gap-2.5 py-12">
              <Ionicons name="leaf-outline" size={52} color="#d1d5db" />
              <Text className="text-sm text-gray-400">
                {t("fertilisation.noCropSelected")}
              </Text>
            </View>
          ) : (
            (() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const sorted = [...allEvents].sort((a, b) =>
                a.mois !== b.mois ? a.mois - b.mois : a.jour - b.jour,
              );
              let lastMonth = null;
              return sorted.map((ev) => {
                const showHeader = ev.mois !== lastMonth;
                lastMonth = ev.mois;
                const evDate = new Date(year, ev.mois - 1, ev.jour);
                const diff = Math.round((evDate - today) / 86400000);
                const isPast = diff < 0;
                const doseLines = getDoseLabel(ev, ev.culture, t);
                return (
                  <View key={`list_${ev.culture?._id ?? "x"}_${ev.mois}_${ev.jour}_${ev.produit ?? ""}`}>
                    {showHeader && (
                      <Text className="mb-2 mt-4 text-xs font-bold tracking-wider text-gray-400">
                        {moisCourts[ev.mois - 1].toUpperCase()} {year}
                      </Text>
                    )}
                    <View
                      className={`mb-2 flex-row items-center justify-between rounded-2xl bg-white p-3.5 shadow-sm ${isPast ? "opacity-55" : ""}`}
                    >
                      <View className="flex-1">
                        <Text className="mb-0.5 text-sm font-bold text-gray-800">
                          {translateCropName(ev.cultureName, language)}
                        </Text>
                        {doseLines.map((line, li) => (
                          <Text
                            key={li}
                            className={`${li === 0 ? "text-[13px] font-semibold text-green-600" : "text-[11px] font-normal text-gray-500"}`}
                          >
                            {li === 0 ? line : line}
                            {li === 0 ? " " : ""}
                            <Text className="text-xs font-normal text-gray-500">
                              {li === 0 ? `(${ev.produit})` : ""}
                            </Text>
                          </Text>
                        ))}
                      </View>
                      <View className="items-end gap-1">
                        <Text className="mb-0.5 text-[13px] font-semibold text-gray-700">
                          {String(ev.jour).padStart(2, "0")}{" "}
                          {moisCourts[ev.mois - 1]}
                        </Text>
                        {isPast ? (
                          <Text className="text-[11px] font-bold text-gray-400">
                            {t("fertilisation.past")}
                          </Text>
                        ) : diff === 0 ? (
                          <Text className="text-[11px] font-bold text-red-600">
                            {t("fertilisation.todayLabel")}
                          </Text>
                        ) : (
                          <Text className="text-[11px] font-bold text-green-600">
                            {t("fertilisation.inDays").replace("{{count}}", String(diff))}
                          </Text>
                        )}
                        {!isPast && (() => {
                          const key = `${ev.culture?._id}_${ev.mois}_${ev.jour}`;
                          const done = confirmedEvents.has(key);
                          const loading2 = confirmingKey === key;
                          return (
                            <TouchableOpacity
                              onPress={() => handleConfirmFert(ev)}
                              disabled={done || loading2}
                              style={{
                                flexDirection: "row", alignItems: "center", gap: 3,
                                backgroundColor: done ? "#f0fdf4" : "#16a34a",
                                borderRadius: 20,
                                paddingHorizontal: 10, paddingVertical: 4,
                                marginTop: 2,
                                opacity: done ? 0.8 : 1,
                              }}
                            >
                              {loading2 ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Ionicons
                                  name={done ? "checkmark-circle" : "checkmark"}
                                  size={12}
                                  color={done ? "#16a34a" : "#fff"}
                                />
                              )}
                              <Text style={{
                                fontSize: 11, fontWeight: "700",
                                color: done ? "#16a34a" : "#fff",
                              }}>
                                {done ? "Fait ✓" : "Confirmer"}
                              </Text>
                            </TouchableOpacity>
                          );
                        })()}
                      </View>
                    </View>
                  </View>
                );
              });
            })()
          ))}
      </ScrollView>

      {/* Modal sélection culture */}
      <Modal
        visible={pickModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPickModal(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/45"
          activeOpacity={1}
          onPress={() => setPickModal(false)}
        >
          <SafeAreaView
            edges={["bottom", "left", "right"]}
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white"
          >
            <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4">
              <Text className="text-[17px] font-bold text-gray-800">
                {t("fertilisation.chooseCrop")}
              </Text>
              <TouchableOpacity onPress={() => setPickModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[
                { _id: null, nom: t("fertilisation.allCrops"), parcelle: "" },
                ...cultures,
              ]}
              keyExtractor={(item) => item._id ?? "all"}
              style={{ maxHeight: 400 }}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => {
                const isActive =
                  selected?._id === item._id ||
                  (item._id === null && selected === null);
                return (
                  <TouchableOpacity
                    className={`mb-2 flex-row items-center rounded-2xl border p-3.5 ${
                      isActive
                        ? "border-green-200 bg-green-50"
                        : "border-transparent bg-gray-50"
                    }`}
                    onPress={() => {
                      setSelected(item._id === null ? null : item);
                      setPickModal(false);
                    }}
                  >
                    <Text className="mr-3 text-xl">
                      {item._id === null ? "🌍" : "🌿"}
                    </Text>
                    <View className="flex-1">
                      <Text
                        className={`text-[15px] font-bold ${isActive ? "text-green-700" : "text-gray-800"}`}
                      >
                        {translateCropName(item.nom, language)}
                      </Text>
                      {item.parcelle && (
                        <Text className="mt-0.5 text-xs text-gray-400">
                          {item.parcelle}
                        </Text>
                      )}
                      {item.nombreArbres && (
                        <Text className="mt-0.5 text-xs text-purple-600">
                          {item.nombreArbres} {t("cultures.details.trees")} •{" "}
                          {item.surface
                            ? (item.surface / 10000).toFixed(2)
                            : "?"}{" "}
                          ha
                        </Text>
                      )}
                    </View>
                    {isActive && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#16a34a"
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            <View className="h-6" />
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
