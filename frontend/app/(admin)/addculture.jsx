// app/(admin)/addculture.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AdminShell } from "@components/AdminShell";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { useLanguage } from "@context/LanguageContext";

const KC_CULTURES = [
  { nom: "Orange", variete: "Navel Washington", type: "agrume" },
  { nom: "Citron", variete: "Eureka / Lisbon", type: "agrume" },
  { nom: "Mandarine", variete: "Clémentine", type: "agrume" },
  { nom: "Pamplemousse", variete: "Standard", type: "agrume" },
  { nom: "Olivier", variete: "Chemlali / Chetoui", type: "fruit" },
  { nom: "Grenadier", variete: "Standard", type: "fruit" },
  { nom: "Figuier", variete: "Standard", type: "fruit" },
  { nom: "Pommier", variete: "Golden / Red", type: "fruit" },
  { nom: "Poirier", variete: "Williams / Conference", type: "fruit" },
  { nom: "Pêcher", variete: "Standard", type: "fruit" },
  { nom: "Abricotier", variete: "Standard", type: "fruit" },
  { nom: "Vigne", variete: "Table / Vin", type: "fruit" },
  { nom: "Dattier", variete: "Deglet Nour", type: "fruit" },
  { nom: "Tomate", variete: "Cœur de bœuf / Ronde", type: "legume" },
  { nom: "Pomme de terre", variete: "Standard", type: "legume" },
  { nom: "Poivron", variete: "Standard", type: "legume" },
  { nom: "Oignon", variete: "Standard", type: "legume" },
  { nom: "Concombre", variete: "Standard", type: "legume" },
  { nom: "Courgette", variete: "Standard", type: "legume" },
  { nom: "Laitue", variete: "Standard", type: "legume" },
  { nom: "Haricot", variete: "Standard", type: "legume" },
  { nom: "Melon", variete: "Standard", type: "legume" },
  { nom: "Artichaut", variete: "Standard", type: "legume" },
  { nom: "Blé", variete: "Dur / Tendre", type: "cereale" },
  { nom: "Orge", variete: "Standard", type: "cereale" },
  { nom: "Maïs", variete: "Standard", type: "cereale" },
  { nom: "Tournesol", variete: "Standard", type: "cereale" },
];

const COLORS = {
  green: "#22c55e",
  greenDark: "#16a34a",
  greenSoft: "#e8f8ed",
  greenBorder: "#bbf7d0",
  text: "#111827",
  muted: "#6b7280",
  border: "#edf1f0",
  surface: "#ffffff",
  danger: "#ef4444",
  dangerSoft: "#fee2e2",
  dangerBorder: "#fca5a5",
  sectionBg: "#f9fafb",
  sectionBorder: "#e5e7eb",
  amber: "#f59e0b",
  amberSoft: "#fffbeb",
  amberBorder: "#fde68a",
};

const DEFAULT_KC_STADES = { ini: "", dev: "", mid: "", late: "" };

const TYPE_COLORS = {
  agrume: { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  fruit: { bg: "#fdf2f8", border: "#f0abfc", text: "#86198f" },
  legume: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  cereale: { bg: "#fefce8", border: "#fde047", text: "#a16207" },
};
const TYPE_ICONS = { agrume: "🍊", fruit: "🍎", legume: "🥬", cereale: "🌾" };

function AutocompleteInput({
  label,
  required,
  value,
  onChangeText,
  onSelectSuggestion,
  placeholder,
  suggestions,
  zIndex = 10,
  error,
}) {
  const [showList, setShowList] = useState(false);
  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes((value || "").toLowerCase()),
  );
  const showSuggestions = showList && filtered.length > 0;

  return (
    <View style={{ marginBottom: 16, zIndex, position: "relative" }}>
      <Text className="text-xs font-semibold text-gray-900 mb-1.5">
        {label}
        {required && <Text className="text-red-500"> *</Text>}
      </Text>
      <View
        style={{ borderColor: error ? "#ef4444" : "#e5e7eb", backgroundColor: error ? "#fef2f2" : "#ffffff" }}
        className="flex-row items-center border rounded-xl h-12"
      >
        <TextInput
          className="flex-1 text-base text-gray-900 px-3.5 py-0"
          placeholder={placeholder}
          placeholderTextColor="#6b7280"
          value={value}
          onChangeText={(v) => {
            onChangeText(v);
            setShowList(true);
          }}
          onFocus={() => setShowList(true)}
          onBlur={() => setTimeout(() => setShowList(false), 180)}
        />
        <TouchableOpacity
          className="px-3"
          onPress={() => setShowList((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showList ? "chevron-up" : "chevron-down"}
            size={18}
            color="#6b7280"
          />
        </TouchableOpacity>
      </View>
      {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}
      {showSuggestions && (
        <View style={{ position: "absolute", top: 78, left: 0, right: 0, zIndex: 9999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 }}>
          <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 176 }}>
            {filtered.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", backgroundColor: item === value ? "#f0fdf4" : "transparent" }}
                onPress={() => {
                  onSelectSuggestion(item);
                  setShowList(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, color: item === value ? "#15803d" : "#374151", fontWeight: item === value ? "700" : "400" }}>
                  {item}
                </Text>
                {item === value && (
                  <Ionicons name="checkmark" size={16} color="#16a34a" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function StatusBanner({ status, message, kcInfo, isNewCulture, onDismiss, t }) {
  if (!status) return null;
  const isSuccess = status === "success";
  return (
    <View
      className={`rounded-xl border p-3.5 gap-3 ${isSuccess ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
    >
      <View className="flex-row items-start gap-2.5">
        <View
          className={`w-9 h-9 rounded-full items-center justify-center ${isSuccess ? "bg-green-100" : "bg-red-100"}`}
        >
          <Ionicons
            name={isSuccess ? "checkmark-circle" : "close-circle"}
            size={22}
            color={isSuccess ? "#16a34a" : "#ef4444"}
          />
        </View>
        <View className="flex-1">
          <Text
            className={`text-sm font-bold mb-0.5 ${isSuccess ? "text-green-700" : "text-red-500"}`}
          >
            {isSuccess
              ? t("admin.addCultureSuccess")
              : t("admin.addCultureFail")}
          </Text>
          <Text className="text-xs text-gray-500 leading-5">{message}</Text>
        </View>
        <TouchableOpacity onPress={onDismiss}>
          <Ionicons name="close" size={18} color="#6b7280" />
        </TouchableOpacity>
      </View>
      {isSuccess && isNewCulture && (
        <View className="flex-row items-center gap-1.5 bg-amber-50 rounded-lg px-2.5 py-2 border border-amber-200">
          <Ionicons name="add-circle-outline" size={16} color="#f59e0b" />
          <Text className="text-xs text-amber-500 font-semibold">
            {t("admin.addCultureNewKc")}
          </Text>
        </View>
      )}
      {isSuccess && kcInfo && (
        <View className="bg-white rounded-lg border border-green-200 overflow-hidden">
          <View className="flex-row justify-between px-3 py-2 border-b border-green-200">
            <Text className="text-xs text-gray-500">
              {t("admin.addCultureKcActuel")}
            </Text>
            <Text className="text-xs font-bold text-gray-900">
              {kcInfo.kc ?? "—"}
            </Text>
          </View>
          <View className="flex-row justify-between px-3 py-2">
            <Text className="text-xs text-gray-500">
              {t("admin.addCultureStade")}
            </Text>
            <Text className="text-xs font-bold text-gray-900">
              {kcInfo.stade ?? "—"}
            </Text>
          </View>
        </View>
      )}
      {isSuccess && (
        <TouchableOpacity
          className="flex-row items-center justify-center gap-1.5 bg-green-600 rounded-lg py-2.5"
          onPress={() => router.push("/(tabs)/cultures")}
          activeOpacity={0.85}
        >
          <Ionicons name="leaf" size={16} color="#fff" />
          <Text className="text-xs font-bold text-white">
            {t("admin.addCultureSeeAll")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ConfirmModal({ visible, title, message, onConfirm, onCancel, t }) {
  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <SafeAreaView
        className="flex-1 bg-black/40 items-center justify-center px-6"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="bg-white rounded-2xl p-7 w-full max-w-[400px] shadow-2xl">
          <View className="w-13 h-13 rounded-full bg-red-50 items-center justify-center self-center mb-4">
            <Ionicons name="trash-outline" size={26} color="#ef4444" />
          </View>
          <Text className="text-base font-bold text-gray-900 text-center mb-2">
            {title}
          </Text>
          <Text className="text-sm text-gray-500 text-center mb-6 leading-5">
            {message}
          </Text>
          <View className="flex-row gap-2.5">
            <TouchableOpacity
              className="flex-1 py-3 rounded-xl border border-gray-200 items-center bg-gray-50"
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text className="text-sm font-semibold text-gray-700">
                {t("cultures.modal.cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 py-3 rounded-xl items-center bg-red-500"
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text className="text-sm font-bold text-white">
                {t("cultures.modal.delete")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Toast({ message, type = "success", visible }) {
  if (!visible) return null;
  const bg = type === "success" ? "#16a34a" : "#ef4444";
  const icon = type === "success" ? "checkmark-circle" : "close-circle";
  return (
    <View
      className="absolute top-4 right-4 z-[9999] rounded-xl px-3.5 py-2.5 flex-row items-center gap-2 max-w-72 shadow-lg"
      style={{ backgroundColor: bg }}
    >
      <Ionicons name={icon} size={16} color="#fff" />
      <Text className="text-white text-xs font-semibold flex-shrink">
        {message}
      </Text>
    </View>
  );
}

export default function AddCulturePage() {
  const { isRTL, t } = useLanguage();
  const [activeTab, setActiveTab] = useState("add");
  const [nomSuggestions, setNomSuggestions] = useState([]);
  const [allVarietes, setAllVarietes] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [nom, setNom] = useState("");
  const [variete, setVariete] = useState("");
  const [kcMode, setKcMode] = useState("auto");
  const [kcStades, setKcStades] = useState({ ...DEFAULT_KC_STADES });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [kcInfo, setKcInfo] = useState(null);
  const [isNewCulture, setIsNewCulture] = useState(false);
  const [kcList, setKcList] = useState([]);
  const [loadingKcList, setLoadingKcList] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [confirm, setConfirm] = useState({ visible: false, item: null });
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message, type });
    toastTimer.current = setTimeout(
      () => setToast((p) => ({ ...p, visible: false })),
      3000,
    );
  }, []);

  const loadSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const res = await apiFetch(API_ENDPOINTS.kc.search);
      if (res.ok) {
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
          setNomSuggestions(
            [...new Set(result.data.map((item) => item.culture))].sort(),
          );
          setAllVarietes(
            [
              ...new Set(result.data.map((item) => item.variete || "Standard")),
            ].sort(),
          );
        }
      }
    } catch (e) {
      console.error("Failed to load suggestions", e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const loadKcList = async () => {
    try {
      setLoadingKcList(true);
      const res = await apiFetch(API_ENDPOINTS.kc.search);
      if (res.ok) {
        const result = await res.json();
        if (result.success && Array.isArray(result.data))
          setKcList(
            result.data.sort((a, b) => a.culture.localeCompare(b.culture)),
          );
      }
    } catch (e) {
      console.error("Failed to load KC list", e);
    } finally {
      setLoadingKcList(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);
  useEffect(() => {
    if (activeTab === "manage") loadKcList();
  }, [activeTab]);

  const handleDeleteKc = (item) => {
    if (!item?._id) return;
    setConfirm({ visible: true, item });
  };

  const doConfirmedDeleteKc = async () => {
    const item = confirm.item;
    setConfirm({ visible: false, item: null });
    if (!item?._id) return;
    setDeletingId(item._id);
    try {
      const res = await apiFetch(API_ENDPOINTS.kc.delete(item._id), {
        method: "DELETE",
      });
      let data = {};
      try {
        data = await res.json();
      } catch {}
      if (res.ok && data?.success !== false) {
        setKcList((prev) => prev.filter((c) => c._id !== item._id));
        loadSuggestions();
        showToast(`"${item.culture}" ${t("admin.deleteKcSuccess")}`, "success");
      } else {
        showToast(
          data?.error || data?.message || `HTTP ${res.status}`,
          "error",
        );
      }
    } catch (e) {
      showToast(e.message || t("cultures.modal.errorServer"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleNomSelect = (selected) => {
    setNom(selected);
    const found = KC_CULTURES.find(
      (c) => c.nom.toLowerCase() === selected.toLowerCase(),
    );
    if (found) setVariete(found.variete);
    if (errors.nom) setErrors((prev) => ({ ...prev, nom: null }));
  };

  const handleNomChange = (value) => {
    setNom(value);
    const found = KC_CULTURES.find(
      (c) => c.nom.toLowerCase() === value.trim().toLowerCase(),
    );
    if (found) setVariete(found.variete);
    if (errors.nom) setErrors((prev) => ({ ...prev, nom: null }));
  };

  const updateKcStade = (stade, value) =>
    setKcStades((prev) => ({ ...prev, [stade]: value }));
  const dismissBanner = () => {
    setSubmitStatus(null);
    setSubmitMessage("");
    setKcInfo(null);
    setIsNewCulture(false);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!nom.trim()) newErrors.nom = t("cultures.modal.nomRequired");
    if (!variete.trim())
      newErrors.variete = t("cultures.modal.varietyRequired");
    if (kcMode === "stades") {
      const allFilled = Object.values(kcStades).every(
        (v) => v !== "" && !isNaN(parseFloat(v)),
      );
      if (!allFilled) newErrors.kcStades = t("admin.kcStadesRequired");
      else if (
        Object.values(kcStades).some(
          (v) => parseFloat(v) < 0 || parseFloat(v) > 3,
        )
      )
        newErrors.kcStades = t("admin.kcStadesRange");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    dismissBanner();
    setLoading(true);
    try {
      const nomTrimmed = nom.trim(),
        varieteTrimmed = variete.trim();
      const cultureType =
        KC_CULTURES.find(
          (c) => c.nom.toLowerCase() === nomTrimmed.toLowerCase(),
        )?.type || "legume";
      const stadesFAO =
        kcMode === "stades"
          ? [
              {
                nom: "Initial",
                kc: parseFloat(kcStades.ini),
                periode: { debut: 1, fin: 3 },
              },
              {
                nom: "Développement",
                kc: parseFloat(kcStades.dev),
                periode: { debut: 4, fin: 6 },
              },
              {
                nom: "Mi-saison",
                kc: parseFloat(kcStades.mid),
                periode: { debut: 7, fin: 9 },
              },
              {
                nom: "Fin saison",
                kc: parseFloat(kcStades.late),
                periode: { debut: 10, fin: 12 },
              },
            ]
          : [{ nom: "Annuel", kc: 0.65, periode: { debut: 1, fin: 12 } }];
      const kcMoyen =
        stadesFAO.reduce((sum, s) => sum + s.kc, 0) / stadesFAO.length;
      const kcResponse = await apiFetch(API_ENDPOINTS.kc.add, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          culture: nomTrimmed,
          aliases: [nomTrimmed.toLowerCase(), nomTrimmed],
          variete: varieteTrimmed,
          type: cultureType,
          stades: stadesFAO,
          kcMoyen: parseFloat(kcMoyen.toFixed(3)),
          references: {
            fao: false,
            source: "Ajouté par l'administrateur",
            notes: `Ajouté le ${new Date().toLocaleDateString("fr-FR")}`,
          },
        }),
      });
      const kcResult = await kcResponse.json();
      if (kcResponse.ok && kcResult.success) {
        const currentMonth = new Date().getMonth() + 1;
        const currentStade =
          stadesFAO.find(
            (s) =>
              currentMonth >= s.periode.debut && currentMonth <= s.periode.fin,
          ) || stadesFAO[0];
        setKcInfo({
          kc: currentStade?.kc ?? kcMoyen.toFixed(2),
          stade: currentStade?.nom ?? "—",
        });
        setIsNewCulture(true);
        setSubmitStatus("success");
        setSubmitMessage(`"${nomTrimmed}" ${t("admin.addCultureInfo")}`);
        setNom("");
        setVariete("");
        setKcStades({ ...DEFAULT_KC_STADES });
        setKcMode("auto");
        loadSuggestions();
        if (activeTab === "manage") loadKcList();
      } else {
        setSubmitStatus("error");
        setSubmitMessage(kcResult.error || t("cultures.modal.errorAdd"));
      }
    } catch (err) {
      setSubmitStatus("error");
      setSubmitMessage(t("cultures.modal.errorServer"));
    } finally {
      setLoading(false);
    }
  };

  const renderKcModeTabs = () => (
    <View className="flex-row gap-2 mb-4">
      {[
        { key: "auto", icon: "flash-outline", labelKey: "admin.kcModeAuto" },
        { key: "stades", icon: "leaf-outline", labelKey: "admin.kcModeStades" },
      ].map(({ key, icon, labelKey }) => (
        <TouchableOpacity
          key={key}
          className={`flex-1 py-2.5 rounded-lg border items-center flex-row justify-center gap-1 ${kcMode === key ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50"}`}
          onPress={() => setKcMode(key)}
        >
          <Ionicons
            name={icon}
            size={16}
            color={kcMode === key ? "#16a34a" : "#6b7280"}
          />
          <Text
            className={`text-xs font-semibold ${kcMode === key ? "text-green-600" : "text-gray-500"}`}
          >
            {t(labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const STADES_KEYS = [
    { key: "ini", labelKey: "admin.kcStadeIni" },
    { key: "dev", labelKey: "admin.kcStadeDev" },
    { key: "mid", labelKey: "admin.kcStadeMid" },
    { key: "late", labelKey: "admin.kcStadeLate" },
  ];

  const renderKcStades = () => (
    <View className="bg-gray-50 rounded-xl p-3.5 border border-green-200">
      <Text className="text-xs font-bold text-gray-900 mb-3">
        {t("admin.kcStadesTitle")}
      </Text>
      {STADES_KEYS.map(({ key, labelKey }) => (
        <View
          key={key}
          className="flex-row items-center justify-between mb-2.5"
        >
          <View className="flex-row items-center gap-1.5 flex-1">
            <Ionicons name="leaf-outline" size={14} color="#16a34a" />
            <Text className="text-xs text-gray-900">{t(labelKey)}</Text>
          </View>
          <TextInput
            className="w-[72px] h-10 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 text-center px-2 py-0"
            value={kcStades[key]}
            onChangeText={(v) => updateKcStade(key, v)}
            placeholder="0.00"
            keyboardType="numeric"
            textAlign="center"
          />
        </View>
      ))}
      {errors.kcStades && (
        <Text className="text-xs text-red-500 mt-1.5">{errors.kcStades}</Text>
      )}
    </View>
  );

  const renderKcAuto = () => (
    <View className="bg-gray-50 rounded-xl p-3.5 border border-green-200">
      <View className="flex-row items-start gap-2.5">
        <Ionicons name="flash" size={20} color="#16a34a" />
        <View className="flex-1">
          <Text className="text-xs font-bold text-green-600">
            {t("admin.kcAutoTitle")}
          </Text>
          <Text className="text-[11px] text-gray-500 mt-0.5">
            {t("admin.kcAutoDesc")}
          </Text>
        </View>
      </View>
    </View>
  );

  const filteredKcList = kcList.filter(
    (item) =>
      item.culture.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.type || "").toLowerCase().includes(searchFilter.toLowerCase()),
  );

  const renderManageTab = () => (
    <View className="flex-1 pb-10">
      <View className="flex-row items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-2.5">
        <Ionicons name="search-outline" size={18} color="#6b7280" />
        <TextInput
          className="flex-1 text-sm text-gray-900"
          placeholder={t("admin.searchCulture")}
          placeholderTextColor="#6b7280"
          value={searchFilter}
          onChangeText={setSearchFilter}
        />
        {searchFilter.length > 0 && (
          <TouchableOpacity onPress={() => setSearchFilter("")}>
            <Ionicons name="close-circle" size={18} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs text-gray-500 font-medium">
          {filteredKcList.length}{" "}
          {filteredKcList.length > 1
            ? t("admin.cultures2")
            : t("admin.cultures1")}
          {searchFilter
            ? " " +
              (filteredKcList.length > 1
                ? t("admin.foundPlural")
                : t("admin.foundSingle"))
            : " " + t("admin.inKcBase")}
        </Text>
        <TouchableOpacity
          onPress={loadKcList}
          className="p-1.5 rounded-lg bg-green-50 border border-green-200"
        >
          <Ionicons name="refresh-outline" size={15} color="#16a34a" />
        </TouchableOpacity>
      </View>
      {loadingKcList ? (
        <View className="items-center py-10 gap-2.5">
          <ActivityIndicator size="large" color="#22c55e" />
          <Text className="text-xs text-gray-500">{t("admin.loadingKc")}</Text>
        </View>
      ) : filteredKcList.length === 0 ? (
        <View className="items-center py-12 gap-3">
          <Ionicons name="leaf-outline" size={48} color="#e5e7eb" />
          <Text className="text-sm text-gray-500">
            {t("admin.noCultureFound")}
          </Text>
        </View>
      ) : (
        filteredKcList.map((item) => {
          const tc = TYPE_COLORS[item.type] || TYPE_COLORS.legume;
          const isDeleting = deletingId === item._id;
          return (
            <View
              key={item._id || item.culture}
              className="flex-row items-center bg-white rounded-xl border border-gray-100 p-3.5 mb-2.5 shadow-sm"
            >
              <View className="flex-1">
                <View className="flex-row items-center flex-wrap gap-2 mb-1">
                  <Text className="text-sm font-bold text-gray-900">
                    {item.culture}
                  </Text>
                  <View
                    className="px-2 py-0.5 rounded-full border"
                    style={{ backgroundColor: tc.bg, borderColor: tc.border }}
                  >
                    <Text
                      className="text-[11px] font-bold"
                      style={{ color: tc.text }}
                    >
                      {TYPE_ICONS[item.type] || "🌿"} {item.type || "—"}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-gray-500">
                  {item.variete || "—"} · Kc moy.{" "}
                  {item.kcMoyen?.toFixed(2) ?? "—"} · {item.stades?.length ?? 0}{" "}
                  stade{item.stades?.length > 1 ? "s" : ""}
                </Text>
                {item.references?.fao && (
                  <View className="flex-row items-center gap-1 mt-1.5">
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color="#16a34a"
                    />
                    <Text className="text-[11px] text-green-600 font-semibold">
                      {t("admin.faoBadge")}
                    </Text>
                  </View>
                )}
                {item.references?.source && !item.references?.fao && (
                  <View className="flex-row items-center gap-1 mt-1.5">
                    <Ionicons name="person-outline" size={12} color="#f59e0b" />
                    <Text className="text-[11px] text-amber-500 font-semibold">
                      {item.references.source}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                className={`p-2.5 rounded-lg bg-red-50 border border-red-200 ml-2 ${isDeleting ? "opacity-40" : ""}`}
                onPress={() => handleDeleteKc(item)}
                disabled={isDeleting}
                activeOpacity={0.7}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );

  return (
    <AdminShell
      activeKey="addculture"
      title={t("admin.navAddCulture")}
      loading={loading}
    >
      <View className="flex-row mx-4 mt-3 mb-1 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
        {[
          {
            key: "add",
            icon: "add-circle-outline",
            labelKey: "admin.addCultureTab",
          },
          {
            key: "manage",
            icon: "list-circle-outline",
            labelKey: "admin.manageTab",
          },
        ].map(({ key, icon, labelKey }) => (
          <TouchableOpacity
            key={key}
            className={`flex-1 flex-row items-center justify-center gap-1.5 py-3 ${activeTab === key ? "bg-green-50 border-b-2 border-green-600" : ""}`}
            onPress={() => setActiveTab(key)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={icon}
              size={18}
              color={activeTab === key ? "#16a34a" : "#6b7280"}
            />
            <Text
              className={`text-sm font-semibold ${activeTab === key ? "text-green-600" : "text-gray-500"}`}
            >
              {t(labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "add" && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <StatusBanner
            status={submitStatus}
            message={submitMessage}
            kcInfo={kcInfo}
            isNewCulture={isNewCulture}
            onDismiss={dismissBanner}
            t={t}
          />
          <View className="bg-white rounded-xl border border-gray-100 p-4">
            <View className="flex-row items-center gap-2 mb-4 pb-3 border-b border-green-200">
              <Ionicons name="leaf-outline" size={18} color="#16a34a" />
              <Text className="text-sm font-bold text-green-600">
                {t("admin.cultureInfoSection")}
              </Text>
            </View>
            <AutocompleteInput
              label={t("cultures.modal.nomLabel")}
              required
              value={nom}
              onChangeText={handleNomChange}
              onSelectSuggestion={handleNomSelect}
              placeholder="ex : Orange, Tomate..."
              suggestions={
                nomSuggestions.length
                  ? nomSuggestions
                  : KC_CULTURES.map((c) => c.nom)
              }
              zIndex={30}
              error={errors.nom}
            />
            <AutocompleteInput
              label={t("cultures.modal.varietyLabel")}
              required
              value={variete}
              onChangeText={(v) => {
                setVariete(v);
                if (errors.variete) setErrors((p) => ({ ...p, variete: null }));
              }}
              onSelectSuggestion={setVariete}
              placeholder="ex : Navel Washington"
              suggestions={allVarietes}
              zIndex={20}
              error={errors.variete}
            />
          </View>
          <View className="bg-white rounded-xl border border-gray-100 p-4">
            <View className="flex-row items-center gap-2 mb-4 pb-3 border-b border-green-200">
              <Ionicons name="stats-chart-outline" size={18} color="#16a34a" />
              <Text className="text-sm font-bold text-green-600">
                {t("admin.kcSection")}
              </Text>
            </View>
            <Text className="text-[11px] text-gray-500 mb-3">
              {t("admin.kcHint")}
            </Text>
            {renderKcModeTabs()}
            {kcMode === "auto" && renderKcAuto()}
            {kcMode === "stades" && renderKcStades()}
          </View>
          <View className="flex-row items-start gap-2 bg-blue-50 rounded-lg border border-blue-200 p-3">
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#3b82f6"
            />
            <Text className="flex-1 text-xs text-blue-700 leading-5">
              {t("admin.addCultureInfo")}
            </Text>
          </View>
          <View className={`flex-row gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <TouchableOpacity
              className="flex-1 py-3.5 rounded-xl border border-gray-200 bg-white items-center"
              onPress={() => router.back()}
            >
              <Text className="text-sm font-semibold text-gray-500">
                {t("cultures.modal.cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-[2] py-3.5 rounded-xl bg-green-600 items-center ${loading ? "opacity-60" : ""}`}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-sm font-bold text-white">
                  {t("cultures.modal.addBtn")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {activeTab === "manage" && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {renderManageTab()}
        </ScrollView>
      )}

      <ConfirmModal
        visible={confirm.visible}
        title={t("cultures.modal.deleteTitle")}
        message={`${t("cultures.modal.deleteMsg")}\n"${confirm.item?.culture}"`}
        onConfirm={doConfirmedDeleteKc}
        onCancel={() => setConfirm({ visible: false, item: null })}
        t={t}
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
      />
    </AdminShell>
  );
}
