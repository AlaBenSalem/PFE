// app/(tabs)/irrigation.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Modal, FlatList, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BrandHeader } from "@components/BrandHeader";
import NotificationBell from "@components/NotificationBell";
import { useIrrigationNotifications } from "@hooks/useNotifications";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { useLanguage } from "@context/LanguageContext";
import { translateCropName } from "@utils/cropNames";
import ETcHistory from "@components/ETcHistory";
import WeatherAlert from "@components/WeatherAlert";
import AutoRecommendation from "@components/AutoRecommendation";
import { exportPDFReport } from "@utils/pdfReport";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Notifications from "expo-notifications";

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const PERTE_PAR_MODE = {
  "goutte-à-goutte": 0.1,
  aspersion: 0.3,
  gravitaire: 0.4,
};
const EFF_PAR_MODE = {
  "goutte-à-goutte": 0.9,
  aspersion: 0.7,
  gravitaire: 0.6,
};
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
const DEFAULT_BESOINS = {
  eauMm: "0.0", eauTheoriqueMm: "0.0", perteMm: "0.0",
  pourcentagePerte: 0, temps: 0, debitMmh: "0.0", eta: 90,
  et0: "0.00", kc: "0.65", etc: "0.00",
  volumeLitres: null, litresParArbre: null, mmParArbre: null, surface: 0,
  eauM3: "0.00", debitM3h: "0.000",
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

function mmToM3(eauMm, surface) {
  return ((parseFloat(eauMm) * parseFloat(surface)) / 1000).toFixed(2);
}
function lhToM3h(lh) {
  return (parseFloat(lh) / 1000).toFixed(3);
}

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
// Saxton & Rawls (2006), SSSAJ 70:1569-1578, Table 1 — deux étapes obligatoires
function saxtonRawls(sablePct, argilePct, moPct) {
  const S  = sablePct  / 100;   // fraction (0–1)
  const C  = argilePct / 100;   // fraction (0–1)
  const OM = moPct;             // % matière organique

  // Étape 1 : estimations intermédiaires (suffixe t)
  const theta1500t = -0.024*S + 0.487*C + 0.006*OM
                   + 0.005*S*OM - 0.013*C*OM + 0.068*S*C + 0.031;

  const theta33t   = -0.251*S + 0.195*C + 0.011*OM
                   + 0.006*S*OM - 0.027*C*OM + 0.452*S*C + 0.299;

  // Étape 2 : correction (Saxton & Rawls 2006, Table 1, équations finales)
  const thetaPf = theta1500t + (0.14 * theta1500t - 0.02);
  const thetaCc = theta33t   + (1.283 * theta33t * theta33t - 0.374 * theta33t - 0.015);

  return {
    thetaPf: parseFloat(Math.max(0.01, thetaPf).toFixed(3)),
    thetaCc: parseFloat(Math.max(thetaPf + 0.01, thetaCc).toFixed(3)),
    source: "saxton_rawls"
  };
}
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

export default function IrrigationPage() {
  const { t, language } = useLanguage();
  const lang = language || "fr";

  const [cultures,             setCultures]             = useState([]);
  const [selectedCulture,      setSelectedCulture]      = useState(null);
  const [selectedMode,         setSelectedMode]         = useState("goutte-à-goutte");
  const [loading,              setLoading]              = useState(true);
  const [weatherData,          setWeatherData]          = useState(null);
  const [weatherByRegion,      setWeatherByRegion]      = useState({});
  const [loadingWeatherRegion, setLoadingWeatherRegion] = useState(false);
  const [historyItems,         setHistoryItems]         = useState([]);
  const [isCompleted,          setIsCompleted]          = useState(false);
  const [etcHistoryKey,        setEtcHistoryKey]        = useState(0);
  const [cultureModalVisible,  setCultureModalVisible]  = useState(false);
  const [activeTab,            setActiveTab]            = useState("needs");
  const [error,                setError]                = useState(null);
  const [exporting,            setExporting]            = useState(false);
  const [kcDynamique,          setKcDynamique]          = useState(null);
  const [kcStade,              setKcStade]              = useState("");
  const [loadingKc,            setLoadingKc]            = useState(false);
  const [debitMissing,         setDebitMissing]         = useState(false);
  const [rainReduction,        setRainReduction]        = useState(0);
  const [exportingPDF,         setExportingPDF]         = useState(false);
  const [now,                  setNow]                  = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const alertNotifId = useRef(null); // ID notification future planifiée
  const alertSentRef = useRef("");   // "cultureId_YYYY-MM-DD" — évite doublons immédiats

  // Demande permission notifications au premier chargement (mobile only)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.requestPermissionsAsync();
  }, []);

  // Annule la notification planifiée quand la culture change
  useEffect(() => {
    if (Platform.OS === 'web') return;
    return () => {
      if (alertNotifId.current) {
        Notifications.cancelScheduledNotificationAsync(alertNotifId.current).catch(() => {});
        alertNotifId.current = null;
      }
    };
  }, [selectedCulture?._id]);

  // Gère les alertes d'irrigation (mobile only)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!selectedCulture) return;
    const besoins = calculateNeeds();
    if (!besoins?.W_current) return;

    if (besoins.isIrrigationDue) {
      // Notification immédiate — 1 seule fois par jour par culture
      const sentKey = `${selectedCulture._id}_${new Date().toISOString().slice(0, 10)}`;
      if (alertSentRef.current === sentKey) return;

      // Annule toute notification future déjà planifiée
      if (alertNotifId.current) {
        Notifications.cancelScheduledNotificationAsync(alertNotifId.current).catch(() => {});
        alertNotifId.current = null;
      }

      Notifications.scheduleNotificationAsync({
        content: {
          title: `🚨 Irriguer maintenant — ${selectedCulture.nom}`,
          body: `Stock = ${besoins.W_current.toFixed(1)} mm ≤ seuil RFU. Ouvrez la vanne.`,
          sound: true,
        },
        trigger: null,
      }).then(() => { alertSentRef.current = sentKey; }).catch(() => {});
      return;
    }

    // Pas encore dû — planifier une alerte future (une seule fois, pas chaque minute)
    if (alertNotifId.current) return;
    const etcPerHour = (besoins.etc || 0) / 24;
    if (etcPerHour <= 0) return;
    const hoursUntilAlert = (besoins.W_current - besoins.W_seuil) / etcPerHour;
    if (hoursUntilAlert <= 0 || hoursUntilAlert > 72) return;

    Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ Irrigation requise — ${selectedCulture.nom}`,
        body: `Dans ~${Math.round(hoursUntilAlert)}h le stock atteindra le seuil RFU. Préparez-vous.`,
        sound: true,
      },
      trigger: { date: new Date(Date.now() + hoursUntilAlert * 3_600_000) },
    }).then(id => { alertNotifId.current = id; }).catch(() => {});

  }, [now, selectedCulture?._id]);

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([fetchCultures(), fetchWeather(), fetchHistory()]);
      } catch (err) {
        console.error("Irrigation.init:", err.message);
        setError("Erreur lors du chargement initial");
      }
    };
    init();
  }, []);

  const fetchCultures = async () => {
    try {
      const res = await apiFetch(API_ENDPOINTS.cultures.base);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) {
        setCultures(result.data ?? []);
        if (result.data?.length > 0) {
          setSelectedCulture(result.data[0]);
          fetchKcDynamique(result.data[0]);
          checkDebitMissing(result.data[0]);
        }
      } else throw new Error(result.message || "Réponse API invalide");
    } catch (err) {
      console.error("Irrigation.fetchCultures:", err.message);
      setError("Impossible de charger les cultures.");
      Alert.alert("Erreur", "Impossible de charger les cultures. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWeather = async (city = "Tunis") => {
    try {
      const res = await apiFetch(`${API_ENDPOINTS.weather.current}?city=${encodeURIComponent(city)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success && result.data) { setWeatherData(result.data); return result.data; }
      throw new Error("Données météo invalides");
    } catch (err) {
      console.error("Irrigation.fetchWeather:", err.message);
      const fallback = { et0: 4.48, temperature: { avg: 20 }, humidity: { avg: 60 } };
      setWeatherData(fallback);
      return fallback;
    }
  };

  const fetchWeatherForRegion = async (region) => {
    if (!region) return;
    const key = region.trim().toLowerCase();
    if (weatherByRegion[key]) return;
    setLoadingWeatherRegion(true);
    try {
      const res = await apiFetch(`${API_ENDPOINTS.weather.current}?city=${encodeURIComponent(region)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success && result.data)
        setWeatherByRegion((prev) => ({ ...prev, [key]: result.data }));
    } catch (err) {
      console.error("fetchWeatherForRegion:", err.message);
    } finally {
      setLoadingWeatherRegion(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await apiFetch(API_ENDPOINTS.irrigations.base);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) setHistoryItems(result.data ?? []);
      else throw new Error("Données historiques invalides");
    } catch (err) {
      console.error("Irrigation.fetchHistory:", err.message);
      setHistoryItems([]);
    }
  };

  const fetchKcDynamique = async (culture) => {
    if (culture?.kcManuel?.mid != null) {
      const mois = new Date().getMonth() + 1;
      let kcVal = parseFloat(culture.kcManuel.mid);
      let stade = "mi-saison";
      if (mois <= 3 && culture.kcManuel.ini != null) {
        kcVal = parseFloat(culture.kcManuel.ini);
        stade = "initial";
      } else if (mois >= 10 && culture.kcManuel.end != null) {
        kcVal = parseFloat(culture.kcManuel.end);
        stade = "fin saison";
      }
      setKcDynamique(kcVal);
      setKcStade(stade);
      setLoadingKc(false);
      return;
    }

    if (!culture?.nom) return;
    setLoadingKc(true);
    try {
      const moisCourant = new Date().getMonth() + 1;
      const endpoint    = API_ENDPOINTS.kc.current(culture.nom, moisCourant);
      const res         = await apiFetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const kcRaw = result.kc ?? result.data?.kc;
      if (result.success && kcRaw != null) {
        const kc    = parseFloat(kcRaw);
        const stade = result.stade ?? result.data?.stade ?? "";
        setKcDynamique(kc >= 0.1 && kc <= 2.0 ? kc : 0.65);
        setKcStade(stade);
      } else throw new Error(result.error || "Réponse invalide");
    } catch (err) {
      console.warn(`⚠️ fetchKcDynamique fallback pour "${culture.nom}":`, err.message);
      setKcDynamique(parseFloat(culture.kcActuel) || 0.65);
      setKcStade("");
    } finally {
      setLoadingKc(false);
    }
  };

  const checkDebitMissing = (culture) => {
    const debitLegacy   = parseFloat(culture?.irrigation?.debit);
    const debitGoutteur = parseFloat(culture?.debitGoutteur);
    const nbGoutteurs   = parseFloat(culture?.nbGoutteursParArbre);
    const hasDebit = (debitLegacy > 0) || (debitGoutteur > 0 && nbGoutteurs > 0);
    setDebitMissing(!hasDebit);
  };

  const calculateNeeds = () => {
    if (!selectedCulture || !weatherData) return { ...DEFAULT_BESOINS };
    try {
      const regionKey     = selectedCulture.region?.trim().toLowerCase();
      const activeWeather = (regionKey && weatherByRegion[regionKey]) || weatherData;
      const et0           = parseFloat(activeWeather.et0) || 4.48;
      const kc            = kcDynamique ?? parseFloat(selectedCulture.kcActuel) ?? 0.65;
      const surface       = parseFloat(selectedCulture.surface) || 100;
      const nbArbres      = selectedCulture.nombreArbres || null;

      // Débit total parcelle (L/h)
      const debitGoutteur       = parseFloat(selectedCulture.debitGoutteur) || 0;
      const nbGoutteursParArbre = parseFloat(selectedCulture.nbGoutteursParArbre) || 0;
      let debitLH;
      if (debitGoutteur > 0 && nbGoutteursParArbre > 0 && nbArbres) {
        debitLH = debitGoutteur * nbGoutteursParArbre * nbArbres;
      } else if (debitGoutteur > 0 && nbGoutteursParArbre > 0) {
        debitLH = debitGoutteur * nbGoutteursParArbre;
      } else {
        debitLH = parseFloat(selectedCulture.irrigation?.debit) || 1000;
      }

      const perte = PERTE_PAR_MODE[selectedMode] || 0.1;
      const eta   = 1 - perte;
      const etc   = et0 * kc;

      // ── 1) z, θcc, θpf — PRIORITÉS CORRIGÉES ──────────────────────────────
      const typeSol  = selectedCulture.typeSol || "limoneux";
      const typeCult = selectedCulture.type    || "legume";

      const Z_DEFAUT = { agrume: 0.9, fruit: 1.0, legume: 0.5, cereale: 1.0 };
      const P_BASE   = { agrume: 0.5, fruit: 0.5, legume: 0.4, cereale: 0.55 };

      const z = selectedCulture.profondeurRacinaire != null
        ? parseFloat(selectedCulture.profondeurRacinaire)
        : (Z_DEFAUT[typeCult] || 0.6);

      const pAdj = selectedCulture.p != null
        ? parseFloat(selectedCulture.p)
        : Math.min(0.8, Math.max(0.1, (P_BASE[typeCult] || 0.5) + 0.04 * (5 - etc)));

      const THETA_STD = {
        sableux:         { cc: 0.12, pf: 0.05 },
        limono_sableux:  { cc: 0.23, pf: 0.10 },
        limoneux:        { cc: 0.31, pf: 0.15 },
        argilo_limoneux: { cc: 0.38, pf: 0.22 },
        argileux:        { cc: 0.42, pf: 0.26 },
      };

      const thetaCc    = selectedCulture.thetaCc != null ? parseFloat(selectedCulture.thetaCc) : null;
      const thetaPf    = selectedCulture.thetaPf != null ? parseFloat(selectedCulture.thetaPf) : null;
      const stdTheta   = THETA_STD[typeSol] || THETA_STD.limoneux;
      
      // ✅ 3 PRIORITÉS - Logique claire et sans doublon
      let thetaCcEff, thetaPfEff, thetaSource;

      // Priorité 1: Mesure directe (valeurs saisies par l'utilisateur)
      if (thetaCc != null && thetaPf != null) {
        thetaCcEff  = thetaCc;
        thetaPfEff  = thetaPf;
        thetaSource = selectedCulture.thetaSource === "saxton_rawls" ? "saxton_rawls" : "mesure";
      } 
      // Priorité 2: Calcul Saxton & Rawls (à partir des fractions sable/argile/MO stockées)
      else if (
        selectedCulture.sableFraction  != null &&
        selectedCulture.argileFraction != null &&
        selectedCulture.matOrganique   != null
      ) {
        const sr   = saxtonRawls(
          selectedCulture.sableFraction  * 100,
          selectedCulture.argileFraction * 100,
          selectedCulture.matOrganique
        );
        thetaCcEff  = sr.thetaCc;
        thetaPfEff  = sr.thetaPf;
        thetaSource = "saxton_rawls";
      } 
      // Priorité 3: Standard FAO-56 (valeurs par défaut selon le type de sol)
      else {
        thetaCcEff  = stdTheta.cc;
        thetaPfEff  = stdTheta.pf;
        thetaSource = "FAO-56";
      }

      // ── 2) Bilan hydrique FAO-56 — déficit réel ────────────────────────────
      const lastIrrig = historyItems
        .filter((h) => (h.cultureId?._id || h.cultureId) === selectedCulture._id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      // Référence initiale : dernière irrigation → sinon datePlantation → sinon createdAt → sinon 1j
      const refDate = lastIrrig
        ? new Date(lastIrrig.date)
        : selectedCulture.datePlantation
          ? new Date(selectedCulture.datePlantation)
          : selectedCulture.createdAt
            ? new Date(selectedCulture.createdAt)
            : new Date(now - 86400000);

      const rawDays = Math.max(0, (now - refDate.getTime()) / 86400000);

      // Sans historique d'irrigation, plafonner à 1 cycle (RFU/ETc) pour éviter
      // une dépletion irréaliste quand la datePlantation est lointaine.
      const roughFreq = etc > 0
        ? Math.max(1, Math.round((pAdj * (thetaCcEff - thetaPfEff) * z * 1000) / etc))
        : 14;
      const joursSinceIrrig = lastIrrig ? rawDays : Math.min(rawDays, roughFreq);

      // ── 3) RU / RFU / fréquence ────────────────────────────────────────────
      const ru  = parseFloat(((thetaCcEff - thetaPfEff) * z * 1000).toFixed(1));
      const rfu = parseFloat((pAdj * ru).toFixed(1));
      const ruSource = thetaCc != null ? "θcc−θpf (manuel)" : `FAO-56 std (${typeSol})`;

      const frequenceJours = etc > 0 ? Math.max(1, Math.round(rfu / etc)) : 7;

      // ── 4) Pluie efficace (FAO-56 / Doorenbos & Pruitt, 1977) ─────────────
      // rain = précipitation récente (mm) depuis l'API météo
      const rainRaw = parseFloat(activeWeather.precipitation?.rain) || 0;
      let peff = 0;
      if (rainRaw > 5)   peff = 0.8 * rainRaw - 2;
      if (rainRaw >= 25) peff = 0.6 * rainRaw + 0.5;
      peff = Math.min(peff, ru); // borne max = RU (pas de percolation profonde)

      // ── 5) Bilan stock hydrique avec pluie ────────────────────────────────
      // W_cc = θcc × z × 1000 (mm)  ·  W_pf = θpf × z × 1000 (mm)
      // W_current = W_cc − ETc×jours + Peff  (borné à [W_pf, W_cc])
      const W_cc      = thetaCcEff * z * 1000;
      const W_pf_mm   = thetaPfEff * z * 1000;
      const W_seuil   = W_cc - rfu;
      const W_current = Math.min(W_cc, Math.max(W_pf_mm, W_cc - etc * joursSinceIrrig + peff));
      const stockPct  = ru > 0 ? Math.min(100, Math.round(((W_current - W_pf_mm) / ru) * 100)) : 100;

      // Déficit net = volume à restituer pour revenir à W_cc
      const deficitMm = Math.max(0, W_cc - W_current);
      const eauMm     = deficitMm / eta;
      const perteMm   = eauMm - deficitMm;

      // Date exacte d'irrigation = dernière irrigation + fréquence
      const baseDate = lastIrrig ? new Date(lastIrrig.date) : new Date(now);
      const dateProchaine = new Date(baseDate);
      dateProchaine.setDate(dateProchaine.getDate() + frequenceJours);
      const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
      dateProchaine.setHours(0, 0, 0, 0);
      const joursAvantIrrigDate = Math.ceil((dateProchaine - todayMidnight) / 86400000);
      // Irrigation due si la date est passée OU si le stock a atteint le seuil RFU
      const isIrrigationDue  = joursAvantIrrigDate <= 0 || W_current <= W_seuil;
      const joursAvantIrrig  = isIrrigationDue ? 0 : joursAvantIrrigDate;

      // Alerte stock : warning si stock ≤ seuil RFU, critical si proche de W_pf
      let stockAlert = null;
      if (W_current <= W_seuil)               stockAlert = "warning";
      if (W_current <= W_pf_mm + 0.15 * ru)  stockAlert = "critical";

      // ── 5) Volumes et débits ───────────────────────────────────────────────
      const debitMmh        = debitLH / surface;
      const tempsMinutes    = debitMmh > 0 ? Math.round((eauMm / debitMmh) * 60) : 0;
      const volumeLitres    = Math.round(eauMm * surface);
      const litresParArbre  = nbArbres ? Math.round((eauMm * surface) / nbArbres) : null;
      const mmParArbre      = nbArbres ? ((eauMm * surface) / nbArbres).toFixed(1) : null;
      const eauM3           = mmToM3(eauMm, surface);
      const debitM3h        = lhToM3h(debitLH);
      const volumeM3Ha      = (eauMm * 10).toFixed(1);
      const kcLabel         = selectedCulture.kcManuel?.mid != null ? "Kc manuel" : "Kc (FAO-56)";

      return {
        eauMm: eauMm.toFixed(1),
        eauM3,
        debitM3h,
        eauTheoriqueMm: etc.toFixed(1),
        perteMm: perteMm.toFixed(1),
        pourcentagePerte: Math.round(perte * 100),
        temps: tempsMinutes,
        debitMmh: debitMmh.toFixed(1),
        eta: Math.round(eta * 100),
        et0: et0.toFixed(2),
        kc: kc.toFixed(2),
        etc: etc.toFixed(2),
        mmParArbre, litresParArbre, volumeLitres, surface,
        typeSol, ru, rfu,
        pAdj: pAdj.toFixed(2), z,
        frequenceJours,
        sourceRegion: regionKey && weatherByRegion[regionKey] ? selectedCulture.region : null,
        volumeM3Ha,
        thetaCc, thetaPf, ruSource,
        thetaCcDisplay: thetaCcEff,
        thetaPfDisplay: thetaPfEff,
        thetaSource,
        debitGoutteur, nbGoutteursParArbre,
        debitLH,
        kcLabel,
        joursSinceIrrig,
        deficitMm: deficitMm.toFixed(1),
        W_cc, W_pf_mm, W_seuil, W_current, stockPct,
        peff, rainRaw,
        dateProchaine, joursAvantIrrig, isIrrigationDue, stockAlert,
      };
    } catch (err) {
      console.error("Irrigation.calculateNeeds:", err.message);
      return { ...DEFAULT_BESOINS };
    }
  };

  const handleFaitPress = async () => {
    if (!selectedCulture) {
      Alert.alert("Erreur", "Veuillez sélectionner une culture");
      return;
    }
    if (isCompleted) return;

    const needs = calculateNeeds();

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
        await fetchHistory();
        setIsCompleted(true);
        setEtcHistoryKey((p) => p + 1);
        Alert.alert("Succès", "Irrigation enregistrée avec succès");
      } else throw new Error(result.message || "Échec de l'enregistrement");
    } catch (err) {
      console.error("Irrigation.handleFaitPress:", err.message);
      Alert.alert("Erreur", "Impossible d'enregistrer l'irrigation.");
    }
  };

  const handleSelectCulture = (culture) => {
    setSelectedCulture(culture);
    setKcDynamique(null);
    setKcStade("");
    setIsCompleted(false);
    setEtcHistoryKey((p) => p + 1);
    setCultureModalVisible(false);
    checkDebitMissing(culture);
    if (culture.region) fetchWeatherForRegion(culture.region);
    fetchKcDynamique(culture);
  };

  const getModeLabel = (mode) => {
    if (mode === "goutte-à-goutte") return t("irrigation.drip") || "Goutte-à-goutte";
    if (mode === "aspersion")       return t("irrigation.sprinkler") || "Aspersion";
    return t("irrigation.gravity") || "Gravitaire";
  };

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
      const csv = "\uFEFF" + [
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
      console.error("Irrigation.exportIrrigation:", err.message);
      Alert.alert("Erreur", "Impossible d'exporter les données");
    } finally {
      setExporting(false);
    }
  };

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

  const { notifications, markRead, markAllRead } = useIrrigationNotifications(
    cultures ?? [], historyItems ?? [], weatherData ?? null, lang,
  );
  const urgentCount = (notifications ?? []).filter(
    (n) => !n.read && (n.type === "urgent" || n.type === "warning")
  ).length;

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
          onPress={() => {
            setError(null);
            setLoading(true);
            Promise.all([fetchCultures(), fetchWeather(), fetchHistory()])
              .finally(() => setLoading(false));
          }}
        >
          <Text className="text-white font-semibold">Réessayer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );

  const besoins    = selectedCulture ? calculateNeeds() : DEFAULT_BESOINS;
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
                    onPress={() => { setSelectedMode(mode); setIsCompleted(false); }}
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
                        <Text className="text-violet-500"> m³/m³</Text>
                      </Text>
                      <Text className="text-[12px] text-violet-700">
                        <Text className="font-bold">θpf = {besoins.thetaPfDisplay ?? "—"}</Text>
                        <Text className="text-violet-500"> m³/m³</Text>
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
                    <Text className="text-[11px] text-violet-500 mt-0.5">
                      RU {t("irrigation.from") || "depuis"}{" "}
                      <Text className="font-semibold">{besoins.ruSource}</Text>
                      {" · FAO-56 §3.1"}
                    </Text>
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
                        {"Ouvrez la vanne pendant "}
                        <Text className="font-bold">{fmtTemps(besoins.temps)}</Text>
                        {" à "}
                        <Text className="font-bold">{besoins.debitM3h} m³/h</Text>
                        {` (${besoins.eta}% eff.) pour irriguer `}
                        <Text className="font-bold">{translateCropName(selectedCulture.nom, language)}</Text>
                        {" · "}
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
                    {besoins.joursAvantIrrig > 0 ? ` (J+${besoins.joursAvantIrrig})` : " (aujourd'hui)"}
                    {"."}
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