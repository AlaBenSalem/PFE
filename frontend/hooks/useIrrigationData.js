// hooks/useIrrigationData.js
// Data hook: fetches cultures, weather, history; computes irrigation needs (FAO-56)
import { useState, useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { API_ENDPOINTS, apiFetch } from "@api/client";

// ── Constants ────────────────────────────────────────────────────────────────
export const PERTE_PAR_MODE = {
  "goutte-à-goutte": 0.1,
  aspersion: 0.3,
  gravitaire: 0.4,
};

export const EFF_PAR_MODE = {
  "goutte-à-goutte": 0.9,
  aspersion: 0.7,
  gravitaire: 0.6,
};

export const DEFAULT_BESOINS = {
  eauMm: "0.0", eauTheoriqueMm: "0.0", perteMm: "0.0",
  pourcentagePerte: 0, temps: 0, debitMmh: "0.0", eta: 90,
  et0: "0.00", kc: "0.65", etc: "0.00",
  volumeLitres: null, litresParArbre: null, mmParArbre: null, surface: 0,
  eauM3: "0.00", debitM3h: "0.000",
};

// ── Pure helpers ─────────────────────────────────────────────────────────────
function mmToM3(eauMm, surface) {
  return ((parseFloat(eauMm) * parseFloat(surface)) / 1000).toFixed(2);
}
function lhToM3h(lh) {
  return (parseFloat(lh) / 1000).toFixed(3);
}

// Saxton & Rawls (2006), SSSAJ 70:1569-1578, Table 1
function saxtonRawls(sablePct, argilePct, moPct) {
  const S  = sablePct  / 100;
  const C  = argilePct / 100;
  const OM = moPct;

  const theta1500t = -0.024*S + 0.487*C + 0.006*OM
                   + 0.005*S*OM - 0.013*C*OM + 0.068*S*C + 0.031;
  const theta33t   = -0.251*S + 0.195*C + 0.011*OM
                   + 0.006*S*OM - 0.027*C*OM + 0.452*S*C + 0.299;

  const thetaPf = theta1500t + (0.14 * theta1500t - 0.02);
  const thetaCc = theta33t   + (1.283 * theta33t * theta33t - 0.374 * theta33t - 0.015);

  return {
    thetaPf: parseFloat(Math.max(0.01, thetaPf).toFixed(3)),
    thetaCc: parseFloat(Math.max(thetaPf + 0.01, thetaCc).toFixed(3)),
    source: "saxton_rawls",
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────
// Note: selectedMode is NOT a hook parameter — instead calculateNeeds(mode)
// accepts it at call time, breaking the circular dependency with useIrrigationSession.
export function useIrrigationData() {
  const [cultures,             setCultures]             = useState([]);
  const [selectedCulture,      setSelectedCulture]      = useState(null);
  const [loading,              setLoading]              = useState(true);
  const [weatherData,          setWeatherData]          = useState(null);
  const [weatherByRegion,      setWeatherByRegion]      = useState({});
  const [loadingWeatherRegion, setLoadingWeatherRegion] = useState(false);
  const [historyItems,         setHistoryItems]         = useState([]);
  const [error,                setError]                = useState(null);
  const [kcDynamique,          setKcDynamique]          = useState(null);
  const [kcStade,              setKcStade]              = useState("");
  const [loadingKc,            setLoadingKc]            = useState(false);
  const [debitMissing,         setDebitMissing]         = useState(false);
  const [now,                  setNow]                  = useState(Date.now());

  // Tick every minute (used by calculateNeeds and notification logic)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const alertNotifId = useRef(null);
  const alertSentRef = useRef("");

  // Request notification permissions on mount (mobile only)
  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.requestPermissionsAsync();
  }, []);

  // Cancel scheduled notification when selected culture changes
  useEffect(() => {
    if (Platform.OS === "web") return;
    return () => {
      if (alertNotifId.current) {
        Notifications.cancelScheduledNotificationAsync(alertNotifId.current).catch(() => {});
        alertNotifId.current = null;
      }
    };
  }, [selectedCulture?._id]);

  // Manage irrigation alerts (mobile only)
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!selectedCulture) return;
    const besoins = _calculateNeeds(selectedCulture, "goutte-à-goutte");
    if (!besoins?.W_current) return;

    if (besoins.isIrrigationDue) {
      const sentKey = `${selectedCulture._id}_${new Date().toISOString().slice(0, 10)}`;
      if (alertSentRef.current === sentKey) return;

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

  // Initial data load
  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([fetchCultures(), fetchWeather(), fetchHistory()]);
      } catch (err) {
        console.error("useIrrigationData.init:", err.message);
        setError("Erreur lors du chargement initial");
      }
    };
    init();
  }, []);

  // ── Fetch functions ─────────────────────────────────────────────────────────
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
      console.error("useIrrigationData.fetchCultures:", err.message);
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
      console.error("useIrrigationData.fetchWeather:", err.message);
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
      console.error("useIrrigationData.fetchWeatherForRegion:", err.message);
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
      console.error("useIrrigationData.fetchHistory:", err.message);
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

  // ── calculateNeeds (internal + exported) ────────────────────────────────────
  // Internal version accepts explicit culture + mode (used by notification effect)
  function _calculateNeeds(culture, mode) {
    if (!culture || !weatherData) return { ...DEFAULT_BESOINS };
    try {
      const regionKey     = culture.region?.trim().toLowerCase();
      const activeWeather = (regionKey && weatherByRegion[regionKey]) || weatherData;
      const et0           = parseFloat(activeWeather.et0) || 4.48;
      const kc            = kcDynamique ?? parseFloat(culture.kcActuel) ?? 0.65;
      const surface       = parseFloat(culture.surface) || 100;
      const nbArbres      = culture.nombreArbres || null;

      const debitGoutteur       = parseFloat(culture.debitGoutteur) || 0;
      const nbGoutteursParArbre = parseFloat(culture.nbGoutteursParArbre) || 0;
      let debitLH;
      if (debitGoutteur > 0 && nbGoutteursParArbre > 0 && nbArbres) {
        debitLH = debitGoutteur * nbGoutteursParArbre * nbArbres;
      } else if (debitGoutteur > 0 && nbGoutteursParArbre > 0) {
        debitLH = debitGoutteur * nbGoutteursParArbre;
      } else {
        debitLH = parseFloat(culture.irrigation?.debit) || 1000;
      }

      const perte = PERTE_PAR_MODE[mode] || 0.1;
      const eta   = 1 - perte;
      const etc   = et0 * kc;

      const typeSol  = culture.typeSol || "limoneux";
      const typeCult = culture.type    || "legume";

      const Z_DEFAUT = { agrume: 0.9, fruit: 1.0, legume: 0.5, cereale: 1.0 };
      const P_BASE   = { agrume: 0.5, fruit: 0.5, legume: 0.4, cereale: 0.55 };

      const z = culture.profondeurRacinaire != null
        ? parseFloat(culture.profondeurRacinaire)
        : (Z_DEFAUT[typeCult] || 0.6);

      const pAdj = culture.p != null
        ? parseFloat(culture.p)
        : Math.min(0.8, Math.max(0.1, (P_BASE[typeCult] || 0.5) + 0.04 * (5 - etc)));

      const THETA_STD = {
        sableux:         { cc: 0.12, pf: 0.05 },
        limono_sableux:  { cc: 0.23, pf: 0.10 },
        limoneux:        { cc: 0.31, pf: 0.15 },
        argilo_limoneux: { cc: 0.38, pf: 0.22 },
        argileux:        { cc: 0.42, pf: 0.26 },
      };

      const thetaCc  = culture.thetaCc != null ? parseFloat(culture.thetaCc) : null;
      const thetaPf  = culture.thetaPf != null ? parseFloat(culture.thetaPf) : null;
      const stdTheta = THETA_STD[typeSol] || THETA_STD.limoneux;

      let thetaCcEff, thetaPfEff, thetaSource;

      if (thetaCc != null && thetaPf != null) {
        thetaCcEff  = thetaCc;
        thetaPfEff  = thetaPf;
        thetaSource = culture.thetaSource === "saxton_rawls" ? "saxton_rawls" : "mesure";
      } else if (
        culture.sableFraction  != null &&
        culture.argileFraction != null &&
        culture.matOrganique   != null
      ) {
        const sr = saxtonRawls(
          culture.sableFraction  * 100,
          culture.argileFraction * 100,
          culture.matOrganique
        );
        thetaCcEff  = sr.thetaCc;
        thetaPfEff  = sr.thetaPf;
        thetaSource = "saxton_rawls";
      } else {
        thetaCcEff  = stdTheta.cc;
        thetaPfEff  = stdTheta.pf;
        thetaSource = "FAO-56";
      }

      const lastIrrig = historyItems
        .filter((h) => (h.cultureId?._id || h.cultureId) === culture._id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      const refDate = lastIrrig
        ? new Date(lastIrrig.date)
        : culture.datePlantation
          ? new Date(culture.datePlantation)
          : culture.createdAt
            ? new Date(culture.createdAt)
            : new Date(now - 86400000);

      const rawDays = Math.max(0, (now - refDate.getTime()) / 86400000);

      const roughFreq = etc > 0
        ? Math.max(1, Math.round((pAdj * (thetaCcEff - thetaPfEff) * z * 1000) / etc))
        : 14;
      const joursSinceIrrig = lastIrrig ? rawDays : Math.min(rawDays, roughFreq);

      const ru  = parseFloat(((thetaCcEff - thetaPfEff) * z * 1000).toFixed(1));
      const rfu = parseFloat((pAdj * ru).toFixed(1));
      const ruSource = thetaCc != null ? "θcc−θpf (manuel)" : `FAO-56 std (${typeSol})`;

      const frequenceJours = etc > 0 ? Math.max(1, Math.round(rfu / etc)) : 7;

      const rainRaw = parseFloat(activeWeather.precipitation?.rain) || 0;
      let peff = 0;
      if (rainRaw > 5)   peff = 0.8 * rainRaw - 2;
      if (rainRaw >= 25) peff = 0.6 * rainRaw + 0.5;
      peff = Math.min(peff, ru);

      const W_cc      = thetaCcEff * z * 1000;
      const W_pf_mm   = thetaPfEff * z * 1000;
      const W_seuil   = W_cc - rfu;
      const W_current = Math.min(W_cc, Math.max(W_pf_mm, W_cc - etc * joursSinceIrrig + peff));
      const stockPct  = ru > 0 ? Math.min(100, Math.round(((W_current - W_pf_mm) / ru) * 100)) : 100;

      const deficitMm = Math.max(0, W_cc - W_current);
      const eauMm     = deficitMm / eta;
      const perteMm   = eauMm - deficitMm;

      const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
      const baseDate = lastIrrig ? new Date(lastIrrig.date) : new Date(now);
      const scheduledDate = new Date(baseDate);
      scheduledDate.setDate(scheduledDate.getDate() + frequenceJours);
      scheduledDate.setHours(0, 0, 0, 0);
      const joursAvantScheduled = Math.ceil((scheduledDate - todayMidnight) / 86400000);

      const stockDue        = W_current <= W_seuil;
      const isIrrigationDue = joursAvantScheduled <= 0 || stockDue;
      const dateProchaine   = isIrrigationDue ? new Date(todayMidnight) : scheduledDate;
      const joursAvantIrrig = isIrrigationDue ? 0 : joursAvantScheduled;

      let stockAlert = null;
      if (W_current <= W_seuil)              stockAlert = "warning";
      if (W_current <= W_pf_mm + 0.15 * ru) stockAlert = "critical";

      const debitMmh       = debitLH / surface;
      const tempsMinutes   = debitMmh > 0 ? Math.round((eauMm / debitMmh) * 60) : 0;
      const volumeLitres   = Math.round(eauMm * surface);
      const litresParArbre = nbArbres ? Math.round((eauMm * surface) / nbArbres) : null;
      const mmParArbre     = nbArbres ? ((eauMm * surface) / nbArbres).toFixed(1) : null;
      const eauM3          = mmToM3(eauMm, surface);
      const debitM3h       = lhToM3h(debitLH);
      const volumeM3Ha     = (eauMm * 10).toFixed(1);
      const kcLabel        = culture.kcManuel?.mid != null ? "Kc manuel" : "Kc (FAO-56)";

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
        sourceRegion: regionKey && weatherByRegion[regionKey] ? culture.region : null,
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
        dateProchaine, joursAvantIrrig, isIrrigationDue, stockDue, stockAlert,
      };
    } catch (err) {
      console.error("useIrrigationData._calculateNeeds:", err.message);
      return { ...DEFAULT_BESOINS };
    }
  }

  // Public calculateNeeds — caller passes the active mode (lives in useIrrigationSession)
  const calculateNeeds = (mode = "goutte-à-goutte") => _calculateNeeds(selectedCulture, mode);

  // ── Select culture ───────────────────────────────────────────────────────────
  const selectCulture = (culture, { onCompleted } = {}) => {
    setSelectedCulture(culture);
    setKcDynamique(null);
    setKcStade("");
    checkDebitMissing(culture);
    if (culture.region) fetchWeatherForRegion(culture.region);
    fetchKcDynamique(culture);
    if (onCompleted) onCompleted();
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    Promise.all([fetchCultures(), fetchWeather(), fetchHistory()])
      .finally(() => setLoading(false));
  };

  return {
    // State
    cultures,
    selectedCulture,
    loading,
    error,
    weatherData,
    weatherByRegion,
    loadingWeatherRegion,
    historyItems,
    kcDynamique,
    kcStade,
    loadingKc,
    debitMissing,
    now,
    // Actions
    fetchCultures,
    fetchWeather,
    fetchHistory,
    fetchKcDynamique,
    fetchWeatherForRegion,
    checkDebitMissing,
    selectCulture,
    retry,
    // Derived
    calculateNeeds,
  };
}
