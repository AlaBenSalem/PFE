// hooks/useCultures.js — data hook for cultures list management
import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import cultureService from "../api/cultureService";
import { useLanguage } from "@context/LanguageContext";

// ── Fallback list (mirrors KC_CULTURES_FALLBACK in the screen) ───────────────
const KC_CULTURES_FALLBACK = [
  { nom: "Orange", variete: "Navel Washington" },
  { nom: "Citron", variete: "Eureka / Lisbon" },
  { nom: "Mandarine", variete: "Clémentine" },
  { nom: "Pamplemousse", variete: "Standard" },
  { nom: "Olivier", variete: "Chemlali / Chetoui" },
  { nom: "Grenadier", variete: "Standard" },
  { nom: "Figuier", variete: "Standard" },
  { nom: "Pommier", variete: "Golden / Red" },
  { nom: "Poirier", variete: "Williams / Conference" },
  { nom: "Pêcher", variete: "Standard" },
  { nom: "Abricotier", variete: "Standard" },
  { nom: "Vigne", variete: "Table / Vin" },
  { nom: "Dattier", variete: "Deglet Nour" },
  { nom: "Tomate", variete: "Cœur de bœuf / Ronde" },
  { nom: "Pomme de terre", variete: "Standard" },
  { nom: "Poivron", variete: "Standard" },
  { nom: "Oignon", variete: "Standard" },
  { nom: "Concombre", variete: "Standard" },
  { nom: "Courgette", variete: "Standard" },
  { nom: "Laitue", variete: "Standard" },
  { nom: "Haricot", variete: "Standard" },
  { nom: "Melon", variete: "Standard" },
  { nom: "Artichaut", variete: "Standard" },
  { nom: "Blé", variete: "Dur / Tendre" },
  { nom: "Orge", variete: "Standard" },
  { nom: "Maïs", variete: "Standard" },
  { nom: "Tournesol", variete: "Standard" },
  // Nouvelles cultures ajoutées
  { nom: "Citrus", variete: "Générique" },
  { nom: "Amandier", variete: "Standard" },
  { nom: "Cerisier", variete: "Standard" },
  { nom: "Fraisier", variete: "Standard" },
  { nom: "Aubergine", variete: "Standard" },
  { nom: "Carotte", variete: "Standard" },
  { nom: "Pastèque", variete: "Standard" },
  { nom: "Betterave sucrière", variete: "Standard" },
  { nom: "Pois chiche", variete: "Standard" },
  { nom: "Sorgho", variete: "Standard" },
  { nom: "Luzerne", variete: "Standard" },
];

export function useCultures() {
  const { t } = useLanguage();

  // ── List state ──────────────────────────────────────────────────────────────
  const [cultures, setCultures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ visible: false, id: null });

  // ── Available cultures / suggestions ────────────────────────────────────────
  const [availableCultures, setAvailableCultures] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // ── Load user cultures ───────────────────────────────────────────────────────
  const loadCultures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await cultureService.getAllCultures();
      setCultures(result?.success ? result.data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load available crop suggestions (DB + fallback) ─────────────────────────
  const loadAllAvailableCultures = useCallback(async () => {
    try {
      setLoadingSuggestions(true);
      const response = await apiFetch(API_ENDPOINTS.kc.search);
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const fromDB = result.data.map((item) => ({
            nom: item.culture,
            variete: item.variete || "Standard",
          }));
          const merged = [
            ...fromDB,
            ...KC_CULTURES_FALLBACK.filter(
              (local) =>
                !fromDB.some(
                  (db) => db.nom.toLowerCase() === local.nom.toLowerCase(),
                ),
            ),
          ].sort((a, b) => a.nom.localeCompare(b.nom));
          setAvailableCultures(merged);
        }
      }
    } catch {
      setAvailableCultures(KC_CULTURES_FALLBACK);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // ── Auto-load when screen comes into focus ───────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      loadCultures();
      loadAllAvailableCultures();
    }, [loadCultures, loadAllAvailableCultures]),
  );

  // ── Delete flow ──────────────────────────────────────────────────────────────
  const deleteCulture = useCallback(
    (id) => setConfirmDelete({ visible: true, id }),
    [],
  );

  const doConfirmedDelete = useCallback(async () => {
    const id = confirmDelete.id;
    setConfirmDelete({ visible: false, id: null });
    setDeletingId(id);
    try {
      const result = await cultureService.deleteCulture(id);
      if (result.success) {
        setCultures((prev) => prev.filter((c) => c._id !== id));
      } else {
        Alert.alert(
          t("common.errorTitle"),
          result?.error || result?.message || t("cultures.modal.errorDelete"),
        );
      }
    } catch (e) {
      Alert.alert(
        t("common.errorTitle"),
        e?.message || t("cultures.modal.errorDelete"),
      );
    } finally {
      setDeletingId(null);
    }
  }, [confirmDelete.id, t]);

  // ── Derived helpers ──────────────────────────────────────────────────────────
  const allCultures =
    availableCultures.length > 0 ? availableCultures : KC_CULTURES_FALLBACK;
  const nomSuggestions = allCultures.map((c) => c.nom);
  const allVarietes = [...new Set(allCultures.map((c) => c.variete))];
  const totalCulturesDisponibles = allCultures.length;

  return {
    // list
    cultures,
    loading,
    error,
    loadCultures,
    // delete
    deletingId,
    confirmDelete,
    setConfirmDelete,
    deleteCulture,
    doConfirmedDelete,
    // suggestions
    availableCultures: allCultures,
    nomSuggestions,
    allVarietes,
    totalCulturesDisponibles,
    loadingSuggestions,
  };
}
