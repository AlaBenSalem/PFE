// app/(tabs)/cultures.jsx — Merge V1 (interface) + V2 (Type de Sol / RFU)
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Alert,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BrandHeader } from "@components/BrandHeader";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import cultureService from "../../api/cultureService";
import { useLanguage } from "@context/LanguageContext";

// ══════════════════════════════════════════════════════════════════════════════
// DONNÉES TYPES DE SOL (depuis V2)
// ══════════════════════════════════════════════════════════════════════════════
const getTypesSol = (t) => [
  {
    key: "sableux",
    nom: t("cultures.modal.soilTypes.sableux.nom"),
    emoji: "🏖️",
    description: t("cultures.modal.soilTypes.sableux.description"),
    couleur: "#f59e0b",
    fondCouleur: "#fffbeb",
    ruInfo: "60 mm/m • RFU: 40%",
  },
  {
    key: "limono_sableux",
    nom: t("cultures.modal.soilTypes.limono_sableux.nom"),
    emoji: "🌾",
    description: t("cultures.modal.soilTypes.limono_sableux.description"),
    couleur: "#84cc16",
    fondCouleur: "#f7fee7",
    ruInfo: "90 mm/m • RFU: 45%",
  },
  {
    key: "limoneux",
    nom: t("cultures.modal.soilTypes.limoneux.nom"),
    emoji: "🌱",
    description: t("cultures.modal.soilTypes.limoneux.description"),
    couleur: "#22c55e",
    fondCouleur: "#f0fdf4",
    ruInfo: "120 mm/m • RFU: 50%",
  },
  {
    key: "argilo_limoneux",
    nom: t("cultures.modal.soilTypes.argilo_limoneux.nom"),
    emoji: "🏔️",
    description: t("cultures.modal.soilTypes.argilo_limoneux.description"),
    couleur: "#8b5cf6",
    fondCouleur: "#f5f3ff",
    ruInfo: "140 mm/m • RFU: 55%",
  },
  {
    key: "argileux",
    nom: t("cultures.modal.soilTypes.argileux.nom"),
    emoji: "🪨",
    description: t("cultures.modal.soilTypes.argileux.description"),
    couleur: "#ef4444",
    fondCouleur: "#fef2f2",
    ruInfo: "150 mm/m • RFU: 60%",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// KC CULTURES FALLBACK (depuis V1)
// ══════════════════════════════════════════════════════════════════════════════
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
];

// ══════════════════════════════════════════════════════════════════════════════
// CONFIRM MODAL (V1 — inchangé)
// ══════════════════════════════════════════════════════════════════════════════
function ConfirmModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  danger = true,
  t,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <SafeAreaView
        className="flex-1 items-center justify-center bg-black/40 px-6"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="w-full max-w-[400px] rounded-2xl bg-white p-7 shadow-2xl">
          <View
            className={`mb-4 h-[52px] w-[52px] self-center rounded-full ${danger ? "bg-red-50" : "bg-blue-50"} items-center justify-center`}
          >
            <Ionicons
              name={danger ? "trash-outline" : "help-circle-outline"}
              size={26}
              color={danger ? "#ef4444" : "#3b82f6"}
            />
          </View>
          <Text className="mb-2 text-center text-[17px] font-bold text-gray-900">
            {title}
          </Text>
          <Text className="mb-6 text-center text-sm leading-5 text-gray-500">
            {message}
          </Text>
          <View className="flex-row gap-2.5">
            <TouchableOpacity
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-3.5"
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text className="text-center text-sm font-semibold text-gray-700">
                {t("cultures.modal.cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-xl py-3.5 ${danger ? "bg-red-500" : "bg-blue-500"}`}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text className="text-center text-sm font-bold text-white">
                {danger
                  ? t("cultures.modal.delete")
                  : t("cultures.modal.confirm")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SELECT PICKER MODAL (V1 — avec search bar et icônes)
// ══════════════════════════════════════════════════════════════════════════════
function SelectPickerModal({
  visible,
  title,
  items,
  selectedValue,
  onSelect,
  onClose,
  loading = false,
  loadingText = "Chargement...",
}) {
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);

  const filtered = items.filter((item) =>
    item.toLowerCase().includes(search.toLowerCase()),
  );

  const handleClose = () => {
    setSearch("");
    onClose();
  };
  const handleSelect = (item) => {
    setSearch("");
    onSelect(item);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end bg-transparent">
        <TouchableOpacity
          className="absolute inset-0 bg-black/45"
          activeOpacity={1}
          onPress={handleClose}
        />
        <View className="max-h-[78%] min-h-[360px] rounded-t-3xl bg-white shadow-2xl">
          <View className="items-center pb-1 pt-2.5">
            <View className="h-1 w-9 rounded-full bg-gray-200" />
          </View>
          <View className="flex-row items-center justify-between border-b border-gray-100 px-5 pb-3.5 pt-1">
            <Text className="text-base font-bold text-gray-900">{title}</Text>
            <TouchableOpacity
              onPress={handleClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-gray-100"
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <View className="mx-4 mb-1.5 mt-3.5 flex-row items-center rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5">
            <Ionicons
              name="search-outline"
              size={16}
              color="#9ca3af"
              className="mr-2"
            />
            <TextInput
              ref={searchRef}
              className="flex-1 p-0 text-sm text-gray-900"
              placeholder="Rechercher..."
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={16} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
          <View className="px-5 pb-2">
            <Text className="text-[11px] font-medium text-gray-400">
              {loading
                ? loadingText
                : `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
          {loading ? (
            <View className="flex-1 items-center justify-center py-10">
              <ActivityIndicator size="large" color="#16a34a" />
              <Text className="mt-3 text-[13px] text-gray-500">
                {loadingText}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item, i) => `${item}-${i}`}
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => {
                const isSelected = item === selectedValue;
                return (
                  <TouchableOpacity
                    className={`flex-row items-center gap-3 border-b border-gray-50 px-4 py-3.5 ${isSelected ? "bg-green-50" : ""}`}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.75}
                  >
                    <View
                      className={`h-7 w-7 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-green-600 bg-green-600" : "border-green-200 bg-green-50"}`}
                    >
                      <Ionicons
                        name={isSelected ? "checkmark" : "leaf-outline"}
                        size={14}
                        color={isSelected ? "#fff" : "#16a34a"}
                      />
                    </View>
                    <Text
                      className={`flex-1 text-sm ${isSelected ? "font-bold text-green-700" : "text-gray-700"}`}
                      numberOfLines={1}
                    >
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#16a34a"
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View className="items-center py-10">
                  <Ionicons name="search-outline" size={36} color="#d1d5db" />
                  <Text className="mt-2.5 text-sm text-gray-400">
                    Aucun résultat
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SOL PICKER MODAL (depuis V2)
// ══════════════════════════════════════════════════════════════════════════════
function SolPickerModal({ visible, selectedKey, onSelect, onClose, t, typesSol }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/45">
        <TouchableOpacity
          className="flex-1"
          activeOpacity={1}
          onPress={onClose}
        />
        <View className="rounded-t-3xl bg-white pb-8">
          <View className="items-center pb-2 pt-3">
            <View className="h-1 w-10 rounded-full bg-gray-200" />
          </View>
          <View className="flex-row items-center justify-between border-b border-gray-100 px-5 pb-4">
            <View>
              <Text className="text-lg font-bold text-gray-900">
                🌍 {t("cultures.modal.sol_title") || "Type de Sol"}
              </Text>
              <Text className="mt-0.5 text-xs text-gray-500">
                {t("cultures.modal.sol_subtitle") || "Influence la fréquence d'irrigation (RFU)"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              className="p-1"
            >
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>
          {(typesSol || []).map((sol) => {
            const isSelected = sol.key === selectedKey;
            return (
              <TouchableOpacity
                key={sol.key}
                onPress={() => {
                  onSelect(sol.key);
                  onClose();
                }}
                activeOpacity={0.75}
                className={`mx-3 mt-2 flex-row items-center rounded-2xl px-5 py-3.5 ${
                  isSelected ? "border-2" : "border"
                }`}
                style={{
                  backgroundColor: isSelected ? sol.fondCouleur : "#f9fafb",
                  borderColor: isSelected ? sol.couleur : "#f3f4f6",
                }}
              >
                <Text className="mr-3.5 text-2xl">{sol.emoji}</Text>
                <View className="flex-1">
                  <Text
                    className={`text-[15px] ${isSelected ? "font-bold" : "font-semibold"}`}
                    style={{ color: isSelected ? sol.couleur : "#1f2937" }}
                  >
                    {sol.nom}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-500">
                    {sol.description}
                  </Text>
                  <Text
                    className="mt-0.5 text-[11px] font-semibold"
                    style={{ color: sol.couleur }}
                  >
                    {sol.ruInfo}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={sol.couleur}
                  />
                )}
              </TouchableOpacity>
            );
          })}
          <View className="mx-5 mt-4 rounded-xl bg-blue-50 p-3">
            <Text className="text-[11px] leading-4 text-blue-500">
              📖 <Text className="font-bold">FAO-56 :</Text>{" "}
              {t("cultures.modal.sol_fao_note") || "La RFU (Réserve Facilement Utilisable) = fraction p × RU. Elle détermine le seuil critique avant stress hydrique et la fréquence optimale d'irrigation."}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SELECT FIELD (V1 — inchangé)
// ══════════════════════════════════════════════════════════════════════════════
function SelectField({
  label,
  required,
  value,
  placeholder,
  onPress,
  hasError = false,
  loading = false,
}) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-semibold text-gray-700">
        {label}
        {required && <Text className="text-red-500"> *</Text>}
      </Text>
      <TouchableOpacity
        className={`h-12 flex-row items-center rounded-xl border bg-gray-50 px-3.5 ${
          hasError ? "border-red-500 bg-red-50" : "border-gray-300"
        }`}
        onPress={onPress}
        activeOpacity={0.75}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#16a34a" className="mr-2" />
        ) : (
          <Ionicons
            name="leaf-outline"
            size={16}
            color={value ? "#16a34a" : "#9ca3af"}
            className="mr-2"
          />
        )}
        <Text
          className={`flex-1 text-sm ${!value ? "text-gray-400" : "text-gray-900"}`}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#9ca3af" />
      </TouchableOpacity>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CULTURE CARD (V1 + badge sol de V2)
// ══════════════════════════════════════════════════════════════════════════════
function CultureCard({ item, deletingId, onDelete, formatDate, t, typesSol }) {
  const solData = (typesSol || []).find((sol) => sol.key === item.typeSol) || null;

  return (
    <View className="mb-2.5 flex-row items-start rounded-2xl bg-white p-4 shadow-sm">
      <View className="flex-1">
        <View className="mb-1.5 flex-row flex-wrap items-center gap-2">
          <Text className="text-[17px] font-bold text-green-700">
            {item.nom}
          </Text>
          {item.kcActuel != null && (
            <View className="rounded-full bg-green-50 px-2.5 py-1">
              <Text className="text-[11px] font-bold text-green-600">
                Kc {item.kcActuel.toFixed(2)}
                {item.stadeActuel ? ` · ${item.stadeActuel}` : ""}
              </Text>
            </View>
          )}
        </View>
        <Text className="mb-0.5 text-[13px] text-gray-500">
          🌿 {t("cultures.card.variety")} :{" "}
          <Text className="font-semibold text-gray-700">{item.variete}</Text>
        </Text>
        {item.parcelle && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            📍 {t("cultures.card.parcel")} :{" "}
            <Text className="font-semibold text-gray-700">{item.parcelle}</Text>
          </Text>
        )}
        {item.region && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            🌍 Région :{" "}
            <Text className="font-semibold text-gray-700">{item.region}</Text>
          </Text>
        )}
        {item.datePlantation && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            📅 {t("cultures.card.planted")} :{" "}
            <Text className="font-semibold text-gray-700">
              {formatDate(item.datePlantation)}
            </Text>
          </Text>
        )}
        {item.surface != null && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            📐 {t("cultures.card.surface")} :{" "}
            <Text className="font-semibold text-gray-700">
              {item.surface} m²
            </Text>
          </Text>
        )}
        {item.nombreArbres != null && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            🌳 {t("cultures.card.trees")} :{" "}
            <Text className="font-semibold text-gray-700">
              {item.nombreArbres}
            </Text>
          </Text>
        )}
        {/* ✅ Nouveaux champs système d'irrigation */}
        {item.debitGoutteur != null && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            💧 Débit goutteur :{" "}
            <Text className="font-semibold text-gray-700">
              {item.debitGoutteur} L/h × {item.nbGoutteursParArbre ?? "?"} goutteurs/arbre
            </Text>
          </Text>
        )}
        {item.densitePlantation != null && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            🌿 Densité :{" "}
            <Text className="font-semibold text-gray-700">
              {item.densitePlantation} arb/ha
            </Text>
          </Text>
        )}
        {(item.thetaCc != null || item.thetaPf != null) && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            🧪 θcc/θpf :{" "}
            <Text className="font-semibold text-violet-700">
              {item.thetaCc ?? "—"} / {item.thetaPf ?? "—"} m³/m³
            </Text>
          </Text>
        )}

        {/* ✅ Badge Type de Sol — nouveau depuis V2 */}
        {solData && (
          <View className="mt-1.5 flex-row items-center">
            <View
              className="flex-row items-center gap-1.5 rounded-full border px-2.5 py-1"
              style={{
                backgroundColor: solData.fondCouleur,
                borderColor: solData.couleur,
              }}
            >
              <Text className="text-xs">{solData.emoji}</Text>
              <Text
                className="text-[11px] font-bold"
                style={{ color: solData.couleur }}
              >
                {solData.nom}
              </Text>
              <Text
                className="text-[10px] font-medium opacity-80"
                style={{ color: solData.couleur }}
              >
                {solData.ruInfo}
              </Text>
            </View>
          </View>
        )}

        <Text className="mt-1.5 text-[11px] italic text-gray-400">
          {t("cultures.card.addedOn")} {formatDate(item.createdAt)}
        </Text>
      </View>
      <Pressable
        className={`ml-2 p-1.5 ${deletingId === item._id ? "opacity-40" : ""}`}
        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        onPress={() => onDelete(item._id)}
        disabled={deletingId === item._id}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {deletingId === item._id ? (
          <ActivityIndicator size="small" color="#ef4444" />
        ) : (
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        )}
      </Pressable>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function CulturesPage() {
  const { t } = useLanguage();
  const TYPES_SOL = getTypesSol(t);

  const [cultures, setCultures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState({
    visible: false,
    id: null,
  });
  const [availableCultures, setAvailableCultures] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Pickers state
  const [nomPickerVisible, setNomPickerVisible] = useState(false);
  const [varietePickerVisible, setVarietePickerVisible] = useState(false);
  const [solPickerVisible, setSolPickerVisible] = useState(false); // ✅ NOUVEAU

  const [newCulture, setNewCulture] = useState({
    parcelle: "",
    nom: "",
    variete: "",
    datePlantation: null,
    surface: "",
    nombreArbres: "",
    typeSol: "limoneux",
    region: "",
    // ✅ NOUVEAUX — Système d'irrigation (obligatoires)
    debitGoutteur: "",      // L/h par goutteur (FAO-56 recommande 2–8 L/h)
    nbGoutteursParArbre: "", // nb goutteurs/arbre (FAO-56: 2–4 pour arbre fruitier)
    densitePlantation: "",   // arbres/ha (calculé auto si surface+arbres, sinon manuel)
    // ✅ NOUVEAUX — Paramètres hydriques sol (optionnels, FAO-56 §3.1)
    thetaCc: "",  // θcc : teneur volumique à capacité au champ (m³/m³)
    thetaPf: "",  // θpf : teneur volumique au point de flétrissement (m³/m³)
  });

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const allCultures =
    availableCultures.length > 0 ? availableCultures : KC_CULTURES_FALLBACK;
  const nomSuggestions = allCultures.map((c) => c.nom);
  const allVarietes = [...new Set(allCultures.map((c) => c.variete))];
  const totalCulturesDisponibles = allCultures.length;

  // Sol sélectionné pour affichage dans le formulaire
  const selectedSolData =
    TYPES_SOL.find((s) => s.key === newCulture.typeSol) || TYPES_SOL[2];

  const renderCard = useCallback(
    ({ item }) => (
      <CultureCard
        item={item}
        deletingId={deletingId}
        onDelete={deleteCulture}
        formatDate={formatDate}
        t={t}
        typesSol={TYPES_SOL}
      />
    ),
    [deletingId, TYPES_SOL],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAllAvailableCultures = async () => {
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
    } catch (err) {
      setAvailableCultures(KC_CULTURES_FALLBACK);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const loadCultures = async () => {
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
  };

  useFocusEffect(
    useCallback(() => {
      loadCultures();
      loadAllAvailableCultures();
    }, []),
  );

  const handleNomSelect = (selectedNom) => {
    const found = allCultures.find(
      (c) => c.nom.toLowerCase() === selectedNom.toLowerCase(),
    );
    setNewCulture((prev) => ({
      ...prev,
      nom: selectedNom,
      variete: found ? found.variete : prev.variete || "Standard",
    }));
    setFieldErrors((prev) => ({ ...prev, nom: null, variete: null }));
    setNomPickerVisible(false);
  };

  const handleVarieteSelect = (selectedVariete) => {
    setNewCulture((prev) => ({ ...prev, variete: selectedVariete }));
    setFieldErrors((prev) => ({ ...prev, variete: null }));
    setVarietePickerVisible(false);
  };

  const validate = () => {
    const errs = {};
    if (!newCulture.parcelle.trim())
      errs.parcelle = t("cultures.modal.parcelRequired");
    if (!newCulture.nom.trim()) errs.nom = t("cultures.modal.nomRequired");
    if (!newCulture.variete.trim())
      errs.variete = t("cultures.modal.varietyRequired");
    if (!newCulture.datePlantation)
      errs.datePlantation = t("cultures.modal.dateRequired");
    if (!newCulture.surface.trim()) {
      errs.surface = t("cultures.modal.surfaceRequired");
    } else if (
      isNaN(parseFloat(newCulture.surface)) ||
      parseFloat(newCulture.surface) <= 0
    ) {
      errs.surface = t("cultures.modal.surfaceInvalid");
    }
    // ✅ Nombre d'arbres — obligatoire
    if (!newCulture.nombreArbres?.trim()) {
      errs.nombreArbres = t("cultures.modal.treesRequired");
    } else {
      const n = parseInt(newCulture.nombreArbres);
      if (isNaN(n) || n <= 0)
        errs.nombreArbres = t("cultures.modal.treesInvalid");
    }
    // ✅ Débit goutteur — obligatoire (FAO-56 : base du calcul temps d'irrigation)
    if (!newCulture.debitGoutteur.trim()) {
      errs.debitGoutteur = t("cultures.modal.drip_flow_required") || "Débit du goutteur requis (L/h)";
    } else {
      const dg = parseFloat(newCulture.debitGoutteur);
      if (isNaN(dg) || dg <= 0 || dg > 20)
        errs.debitGoutteur = t("cultures.modal.drip_flow_invalid") || "Débit invalide (plage FAO-56 : 0.5–20 L/h)";
    }
    // ✅ Nb goutteurs/arbre — obligatoire
    if (!newCulture.nbGoutteursParArbre.trim()) {
      errs.nbGoutteursParArbre = t("cultures.modal.drip_nb_required") || "Nombre de goutteurs par arbre requis";
    } else {
      const ng = parseInt(newCulture.nbGoutteursParArbre);
      if (isNaN(ng) || ng <= 0 || ng > 20)
        errs.nbGoutteursParArbre = t("cultures.modal.drip_nb_invalid") || "Valeur invalide (1–20 goutteurs/arbre)";
    }
    // ✅ Densité de plantation — obligatoire (arbres/ha)
    if (!newCulture.densitePlantation.trim()) {
      errs.densitePlantation = t("cultures.modal.density_required") || "Densité de plantation requise (arbres/ha)";
    } else {
      const dp = parseFloat(newCulture.densitePlantation);
      if (isNaN(dp) || dp <= 0 || dp > 10000)
        errs.densitePlantation = t("cultures.modal.density_invalid") || "Densité invalide (1–10 000 arbres/ha)";
    }
    // ✅ θcc et θpf — optionnels mais si renseignés, cohérence requise
    if (newCulture.thetaCc.trim()) {
      const cc = parseFloat(newCulture.thetaCc);
      if (isNaN(cc) || cc <= 0 || cc > 0.6)
        errs.thetaCc = t("cultures.modal.thetaCc_invalid") || "θcc invalide (0.05–0.60 m³/m³)";
    }
    if (newCulture.thetaPf.trim()) {
      const pf = parseFloat(newCulture.thetaPf);
      if (isNaN(pf) || pf <= 0 || pf > 0.4)
        errs.thetaPf = t("cultures.modal.thetaPf_invalid") || "θpf invalide (0.02–0.40 m³/m³)";
    }
    if (newCulture.thetaCc.trim() && newCulture.thetaPf.trim()) {
      const cc = parseFloat(newCulture.thetaCc);
      const pf = parseFloat(newCulture.thetaPf);
      if (!isNaN(cc) && !isNaN(pf) && pf >= cc)
        errs.thetaPf = t("cultures.modal.thetaPf_lt_cc") || "θpf doit être inférieur à θcc";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const addCulture = async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      // ✅ Calcul débit total = debitGoutteur × nbGoutteursParArbre × nombreArbres
      const debitGoutteurVal    = parseFloat(newCulture.debitGoutteur);
      const nbGoutteursVal      = parseInt(newCulture.nbGoutteursParArbre);
      const nbArbresVal         = parseInt(newCulture.nombreArbres);
      // débit total parcelle (L/h) — utilisé par le moteur d'irrigation
      const debitTotal = debitGoutteurVal * nbGoutteursVal * nbArbresVal;

      const result = await cultureService.addCulture({
        parcelle: newCulture.parcelle.trim(),
        nom: newCulture.nom.trim(),
        variete: newCulture.variete.trim(),
        datePlantation: newCulture.datePlantation.toISOString(),
        surface: parseFloat(newCulture.surface),
        nombreArbres: nbArbresVal,
        typeSol: newCulture.typeSol,
        region: newCulture.region?.trim() || undefined,
        // ✅ Nouveaux champs irrigation
        irrigation: {
          type: "goutte-a-goutte",
          debit: debitTotal,
          efficacite: 0.9,
        },
        debitGoutteur: debitGoutteurVal,
        nbGoutteursParArbre: nbGoutteursVal,
        densitePlantation: parseFloat(newCulture.densitePlantation),
        // ✅ Paramètres hydriques optionnels (FAO-56 §3.1)
        thetaCc: newCulture.thetaCc.trim() ? parseFloat(newCulture.thetaCc) : undefined,
        thetaPf: newCulture.thetaPf.trim() ? parseFloat(newCulture.thetaPf) : undefined,
      });
      if (result.success) {
        setModalVisible(false);
        resetForm();
        loadCultures();
        Alert.alert(t("common.successTitle"), t("cultures.modal.successAdd"));
      } else {
        Alert.alert(
          t("common.errorTitle"),
          result.error || t("cultures.modal.errorAdd"),
        );
      }
    } catch (err) {
      Alert.alert(
        t("common.errorTitle"),
        err.message || t("cultures.modal.errorServer"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCulture = (id) => setConfirmDelete({ visible: true, id });

  const doConfirmedDelete = async () => {
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
  };

  const resetForm = () => {
    setNewCulture({
      parcelle: "",
      nom: "",
      variete: "",
      datePlantation: null,
      surface: "",
      nombreArbres: "",
      typeSol: "limoneux",
      region: "",
      debitGoutteur: "",
      nbGoutteursParArbre: "",
      densitePlantation: "",
      thetaCc: "",
      thetaPf: "",
    });
    setFieldErrors({});
    setNomPickerVisible(false);
    setVarietePickerVisible(false);
    setSolPickerVisible(false);
  };

  if (loading && cultures.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <BrandHeader
        title={t("cultures.title")}
        right={
          <TouchableOpacity
            className="flex-row items-center gap-1 rounded-xl bg-green-700 px-3.5 py-2"
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text className="text-sm font-bold text-white">
              {t("cultures.add")}
            </Text>
          </TouchableOpacity>
        }
      />

      {loading && cultures.length > 0 && (
        <View className="flex-row items-center gap-2 bg-green-50 px-4 py-1.5">
          <ActivityIndicator size="small" color="#16a34a" />
          <Text className="text-xs text-green-600">
            {t("cultures.refreshing")}
          </Text>
        </View>
      )}

      {error && !loading && (
        <View className="flex-row items-center gap-2 border-b border-red-300 bg-red-100 px-4 py-2.5">
          <Ionicons name="wifi-outline" size={16} color="#ef4444" />
          <Text className="flex-1 text-xs text-red-500">{error}</Text>
          <TouchableOpacity onPress={loadCultures}>
            <Text className="text-xs font-bold text-red-500 underline">
              {t("cultures.retry")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={cultures}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        ListEmptyComponent={
          !loading && (
            <View className="items-center gap-3 py-16">
              <Ionicons name="leaf-outline" size={52} color="#d1d5db" />
              <Text className="text-[15px] text-gray-400">
                {t("cultures.empty")}
              </Text>
            </View>
          )
        }
        renderItem={renderCard}
      />

      <ConfirmModal
        visible={confirmDelete.visible}
        title={t("cultures.modal.deleteTitle")}
        message={t("cultures.modal.deleteMsg")}
        onConfirm={doConfirmedDelete}
        onCancel={() => setConfirmDelete({ visible: false, id: null })}
        danger
        t={t}
      />

      {/* ─── MODAL AJOUT CULTURE ─────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <SafeAreaView
          className="flex-1 justify-end bg-black/45"
          edges={["top", "left", "right", "bottom"]}
        >
          <View className="max-h-[92%] rounded-t-3xl bg-white">
            <View className="flex-row items-center justify-between rounded-t-3xl bg-green-700 px-5 py-4">
              <Text className="text-lg font-bold text-white">
                {t("cultures.modal.addTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="p-5"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Parcelle */}
              <View className="mb-4">
                <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                  {t("cultures.modal.parcelLabel")}{" "}
                  <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className={`rounded-xl border bg-gray-50 px-3.5 py-3 text-sm text-gray-900 ${
                    fieldErrors.parcelle
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  }`}
                  placeholder={t("cultures.modal.parcelPlaceholder")}
                  value={newCulture.parcelle}
                  onChangeText={(v) => {
                    setNewCulture({ ...newCulture, parcelle: v });
                    setFieldErrors((p) => ({ ...p, parcelle: null }));
                  }}
                />
                {fieldErrors.parcelle && (
                  <Text className="mt-1 text-[11px] font-medium text-red-500">
                    {fieldErrors.parcelle}
                  </Text>
                )}
              </View>

              {/* Région */}
              <View className="mb-4">
                <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                  🌍 {t("cultures.modal.regionLabel") || "Région"}{" "}
                  <Text className="text-xs font-normal text-gray-400">
                    {t("cultures.modal.regionOptional") || "(optionnel)"}
                  </Text>
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-3 text-sm text-gray-900"
                  placeholder={t("cultures.modal.regionPlaceholder") || "ex: Tunis, Sfax, Nabeul, Sousse…"}
                  placeholderTextColor="#9ca3af"
                  value={newCulture.region}
                  onChangeText={(v) =>
                    setNewCulture({ ...newCulture, region: v })
                  }
                  autoCapitalize="words"
                />
                <Text className="mt-1 text-[11px] text-gray-400">
                  {t("cultures.modal.regionHint") || "Utilisée pour récupérer la météo locale et calculer l'ET₀ précis"}
                </Text>
              </View>

              <SelectField
                label={t("cultures.modal.nomLabel")}
                required
                value={newCulture.nom}
                placeholder={t("cultures.modal.nomPlaceholder")}
                onPress={() => setNomPickerVisible(true)}
                hasError={!!fieldErrors.nom}
                loading={loadingSuggestions && !newCulture.nom}
              />
              {fieldErrors.nom && (
                <Text className="-mt-2 mb-2.5 text-[11px] font-medium text-red-500">
                  {fieldErrors.nom}
                </Text>
              )}

              {totalCulturesDisponibles > 0 && !loadingSuggestions && (
                <View className="-mt-2 mb-3 flex-row items-center gap-1 px-1">
                  <Ionicons name="list-outline" size={12} color="#16a34a" />
                  <Text className="text-[11px] font-medium text-green-600">
                    {totalCulturesDisponibles} {t("cultures.modal.available")}
                  </Text>
                </View>
              )}

              {/* Variété */}
              <SelectField
                label={t("cultures.modal.varietyLabel")}
                required
                value={newCulture.variete}
                placeholder={t("cultures.modal.varietyPlaceholder")}
                onPress={() => setVarietePickerVisible(true)}
                hasError={!!fieldErrors.variete}
                loading={loadingSuggestions && !newCulture.variete}
              />
              {fieldErrors.variete && (
                <Text className="-mt-2 mb-2.5 text-[11px] font-medium text-red-500">
                  {fieldErrors.variete}
                </Text>
              )}

              {/* ✅ TYPE DE SOL — NOUVEAU */}
              <View className="mb-4">
                <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                  🌍 {t("cultures.modal.sol_title") || "Type de Sol"} <Text className="text-red-500">*</Text>
                  <Text className="text-[11px] font-normal text-gray-400">
                    {" "}{t("cultures.modal.sol_label_hint") || "(pour calcul RFU)"}
                  </Text>
                </Text>
                <TouchableOpacity
                  className="h-[58px] flex-row items-center rounded-xl border-1.5 bg-gray-50 px-3.5"
                  style={{
                    borderColor: selectedSolData.couleur,
                    borderWidth: 1.5,
                  }}
                  onPress={() => setSolPickerVisible(true)}
                  activeOpacity={0.75}
                >
                  <Text className="mr-2.5 text-xl">
                    {selectedSolData.emoji}
                  </Text>
                  <View className="flex-1">
                    <Text
                      className="text-sm font-bold"
                      style={{ color: selectedSolData.couleur }}
                    >
                      {selectedSolData.nom}
                    </Text>
                    <Text className="mt-0.5 text-[11px] text-gray-400">
                      {selectedSolData.description}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#9ca3af" />
                </TouchableOpacity>
                <View className="mt-1.5 flex-row items-center gap-1.5 px-1">
                  <Ionicons
                    name="information-circle-outline"
                    size={13}
                    color="#3b82f6"
                  />
                  <Text className="text-[11px] text-blue-500">
                    {selectedSolData.ruInfo} — {t("cultures.modal.sol_determines") || "Détermine quand irriguer"}
                  </Text>
                </View>
              </View>

              {/* Date */}
              <View className="mb-4">
                <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                  {t("cultures.modal.dateLabel")}{" "}
                  <Text className="text-red-500">*</Text>
                </Text>
                {Platform.OS === "web" ? (
                  <input
                    type="date"
                    value={
                      newCulture.datePlantation
                        ? newCulture.datePlantation.toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) => {
                      setNewCulture({
                        ...newCulture,
                        datePlantation: e.target.value
                          ? new Date(e.target.value)
                          : null,
                      });
                      setFieldErrors((p) => ({ ...p, datePlantation: null }));
                    }}
                    style={{
                      width: "100%",
                      border: fieldErrors.datePlantation
                        ? "1px solid #ef4444"
                        : "1px solid #d1d5db",
                      borderRadius: 10,
                      padding: "12px",
                      fontSize: 14,
                      backgroundColor: fieldErrors.datePlantation
                        ? "#fff8f8"
                        : "#f9fafb",
                    }}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      className={`rounded-xl border bg-gray-50 px-3.5 py-3 ${
                        fieldErrors.datePlantation
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300"
                      }`}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text
                        className={
                          newCulture.datePlantation
                            ? "text-gray-900"
                            : "text-gray-400"
                        }
                      >
                        {newCulture.datePlantation
                          ? formatDate(newCulture.datePlantation)
                          : t("cultures.modal.datePlaceholder")}
                      </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={newCulture.datePlantation || new Date()}
                        mode="date"
                        onChange={(event, date) => {
                          setShowDatePicker(false);
                          if (date) {
                            setNewCulture({
                              ...newCulture,
                              datePlantation: date,
                            });
                            setFieldErrors((p) => ({
                              ...p,
                              datePlantation: null,
                            }));
                          }
                        }}
                      />
                    )}
                  </>
                )}
                {fieldErrors.datePlantation && (
                  <Text className="mt-1 text-[11px] font-medium text-red-500">
                    {fieldErrors.datePlantation}
                  </Text>
                )}
              </View>

              {/* Surface */}
              <View className="mb-4">
                <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                  {t("cultures.modal.surfaceLabel")}{" "}
                  <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className={`rounded-xl border bg-gray-50 px-3.5 py-3 text-sm text-gray-900 ${
                    fieldErrors.surface
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  }`}
                  placeholder={t("cultures.modal.surfacePlaceholder")}
                  keyboardType="numeric"
                  value={newCulture.surface}
                  onChangeText={(v) => {
                    setNewCulture({ ...newCulture, surface: v });
                    setFieldErrors((p) => ({ ...p, surface: null }));
                  }}
                />
                {fieldErrors.surface && (
                  <Text className="mt-1 text-[11px] font-medium text-red-500">
                    {fieldErrors.surface}
                  </Text>
                )}
              </View>

              {/* Arbres */}
              <View className="mb-4">
                <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                  {t("cultures.modal.treesLabel")}{" "}
                  <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className={`rounded-xl border bg-gray-50 px-3.5 py-3 text-sm text-gray-900 ${
                    fieldErrors.nombreArbres
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  }`}
                  placeholder={t("cultures.modal.treesPlaceholder")}
                  keyboardType="numeric"
                  value={newCulture.nombreArbres}
                  onChangeText={(v) => {
                    setNewCulture({ ...newCulture, nombreArbres: v });
                    setFieldErrors((p) => ({ ...p, nombreArbres: null }));
                    // Auto-calcul densité si surface disponible
                    const arbres = parseInt(v);
                    const surface = parseFloat(newCulture.surface);
                    if (!isNaN(arbres) && arbres > 0 && !isNaN(surface) && surface > 0) {
                      const densite = Math.round((arbres / surface) * 10000);
                      setNewCulture((prev) => ({ ...prev, nombreArbres: v, densitePlantation: String(densite) }));
                    }
                  }}
                />
                {fieldErrors.nombreArbres ? (
                  <Text className="mt-1 text-[11px] font-medium text-red-500">
                    {fieldErrors.nombreArbres}
                  </Text>
                ) : (
                  <Text className="mt-1 text-[11px] text-gray-400">
                    {t("cultures.modal.treesHint")}
                  </Text>
                )}
              </View>

              {/* ═══════════════════════════════════════════════════════ */}
              {/* SECTION SYSTÈME D'IRRIGATION (FAO-56) — OBLIGATOIRE    */}
              {/* ═══════════════════════════════════════════════════════ */}
              <View className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <View className="mb-3 flex-row items-center gap-2">
                  <Text className="text-base">💧</Text>
                  <Text className="text-[14px] font-bold text-blue-800">
                    {t("cultures.modal.irrigationSectionTitle") || "Système d'irrigation"}
                  </Text>
                  <View className="rounded-full bg-blue-200 px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-blue-700">FAO-56</Text>
                  </View>
                </View>

                {/* Débit goutteur */}
                <View className="mb-3">
                  <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                    {t("cultures.modal.drip_flow_label") || "Débit par goutteur (L/h)"} <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className={`rounded-xl border bg-white px-3.5 py-3 text-sm text-gray-900 ${
                      fieldErrors.debitGoutteur ? "border-red-500 bg-red-50" : "border-gray-300"
                    }`}
                    placeholder={t("cultures.modal.drip_flow_placeholder") || "ex: 2, 4, 8 L/h"}
                    keyboardType="numeric"
                    value={newCulture.debitGoutteur}
                    onChangeText={(v) => {
                      setNewCulture({ ...newCulture, debitGoutteur: v });
                      setFieldErrors((p) => ({ ...p, debitGoutteur: null }));
                    }}
                  />
                  {fieldErrors.debitGoutteur ? (
                    <Text className="mt-1 text-[11px] font-medium text-red-500">
                      {fieldErrors.debitGoutteur}
                    </Text>
                  ) : (
                    <Text className="mt-1 text-[11px] text-blue-600">
                      {t("cultures.modal.drip_flow_hint") || "FAO-56 §7 : goutteur standard 2–8 L/h selon type de sol"}
                    </Text>
                  )}
                </View>

                {/* Nb goutteurs par arbre */}
                <View className="mb-3">
                  <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                    {t("cultures.modal.drip_nb_label") || "Nb goutteurs / arbre"} <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className={`rounded-xl border bg-white px-3.5 py-3 text-sm text-gray-900 ${
                      fieldErrors.nbGoutteursParArbre ? "border-red-500 bg-red-50" : "border-gray-300"
                    }`}
                    placeholder={t("cultures.modal.drip_nb_placeholder") || "ex: 2, 4 goutteurs/arbre"}
                    keyboardType="numeric"
                    value={newCulture.nbGoutteursParArbre}
                    onChangeText={(v) => {
                      setNewCulture({ ...newCulture, nbGoutteursParArbre: v });
                      setFieldErrors((p) => ({ ...p, nbGoutteursParArbre: null }));
                    }}
                  />
                  {fieldErrors.nbGoutteursParArbre ? (
                    <Text className="mt-1 text-[11px] font-medium text-red-500">
                      {fieldErrors.nbGoutteursParArbre}
                    </Text>
                  ) : (
                    <Text className="mt-1 text-[11px] text-blue-600">
                      {t("cultures.modal.drip_nb_hint") || "FAO-56 §7 : 2–4 goutteurs/arbre pour arbres fruitiers"}
                    </Text>
                  )}
                </View>

                {/* Densité de plantation */}
                <View className="mb-0">
                  <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                    {t("cultures.modal.density_label") || "Densité de plantation (arbres/ha)"} <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className={`rounded-xl border bg-white px-3.5 py-3 text-sm text-gray-900 ${
                      fieldErrors.densitePlantation ? "border-red-500 bg-red-50" : "border-gray-300"
                    }`}
                    placeholder={t("cultures.modal.density_placeholder") || "ex: 400 (5×5m), 833 (4×3m)"}
                    keyboardType="numeric"
                    value={newCulture.densitePlantation}
                    onChangeText={(v) => {
                      setNewCulture({ ...newCulture, densitePlantation: v });
                      setFieldErrors((p) => ({ ...p, densitePlantation: null }));
                    }}
                  />
                  {fieldErrors.densitePlantation ? (
                    <Text className="mt-1 text-[11px] font-medium text-red-500">
                      {fieldErrors.densitePlantation}
                    </Text>
                  ) : (
                    <Text className="mt-1 text-[11px] text-blue-600">
                      {newCulture.nombreArbres && newCulture.surface
                        ? `${t("cultures.modal.density_hint_auto") || "Auto-calculé depuis vos données"} (${newCulture.densitePlantation} arb/ha)`
                        : t("cultures.modal.density_hint_manual") || "Ex : 5m×5m = 400 arb/ha · 4m×3m = 833 arb/ha"}
                    </Text>
                  )}
                </View>
              </View>

              {/* ═══════════════════════════════════════════════════════ */}
              {/* SECTION PARAMÈTRES HYDRIQUES (FAO-56 §3.1) — OPTIONNEL */}
              {/* ═══════════════════════════════════════════════════════ */}
              <View className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <View className="mb-1 flex-row items-center gap-2">
                  <Text className="text-base">🧪</Text>
                  <Text className="text-[14px] font-bold text-violet-800">
                    {t("cultures.modal.hydric_title") || "Paramètres hydriques du sol"}
                  </Text>
                  <View className="rounded-full bg-violet-200 px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-violet-700">
                      {t("cultures.modal.hydric_optional") || "optionnel"}
                    </Text>
                  </View>
                </View>
                <Text className="mb-3 text-[11px] leading-4 text-violet-600">
                  {t("cultures.modal.hydric_desc") || "FAO-56 §3.1 : Si vous avez fait une analyse de sol, entrez θcc et θpf pour un calcul RU plus précis. Sinon, les valeurs standard du type de sol seront utilisées."}
                </Text>

                <View className="flex-row gap-3">
                  {/* θcc */}
                  <View className="flex-1">
                    <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                      θcc (m³/m³)
                    </Text>
                    <TextInput
                      className={`rounded-xl border bg-white px-3.5 py-3 text-sm text-gray-900 ${
                        fieldErrors.thetaCc ? "border-red-500 bg-red-50" : "border-gray-300"
                      }`}
                      placeholder="ex: 0.30"
                      keyboardType="numeric"
                      value={newCulture.thetaCc}
                      onChangeText={(v) => {
                        setNewCulture({ ...newCulture, thetaCc: v });
                        setFieldErrors((p) => ({ ...p, thetaCc: null, thetaPf: null }));
                      }}
                    />
                    {fieldErrors.thetaCc && (
                      <Text className="mt-1 text-[10px] font-medium text-red-500">
                        {fieldErrors.thetaCc}
                      </Text>
                    )}
                    <Text className="mt-1 text-[10px] text-violet-500">
                      {t("cultures.modal.thetaCc_hint") || "Capacité au champ"}
                    </Text>
                  </View>

                  {/* θpf */}
                  <View className="flex-1">
                    <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                      θpf (m³/m³)
                    </Text>
                    <TextInput
                      className={`rounded-xl border bg-white px-3.5 py-3 text-sm text-gray-900 ${
                        fieldErrors.thetaPf ? "border-red-500 bg-red-50" : "border-gray-300"
                      }`}
                      placeholder="ex: 0.12"
                      keyboardType="numeric"
                      value={newCulture.thetaPf}
                      onChangeText={(v) => {
                        setNewCulture({ ...newCulture, thetaPf: v });
                        setFieldErrors((p) => ({ ...p, thetaPf: null }));
                      }}
                    />
                    {fieldErrors.thetaPf && (
                      <Text className="mt-1 text-[10px] font-medium text-red-500">
                        {fieldErrors.thetaPf}
                      </Text>
                    )}
                    <Text className="mt-1 text-[10px] text-violet-500">
                      {t("cultures.modal.thetaPf_hint") || "Point de flétrissement"}
                    </Text>
                  </View>
                </View>

                {/* Aperçu RU calculé */}
                {newCulture.thetaCc && newCulture.thetaPf &&
                  !isNaN(parseFloat(newCulture.thetaCc)) &&
                  !isNaN(parseFloat(newCulture.thetaPf)) &&
                  parseFloat(newCulture.thetaCc) > parseFloat(newCulture.thetaPf) && (
                  <View className="mt-3 rounded-xl bg-violet-100 p-2.5">
                    <Text className="text-[11px] font-semibold text-violet-700">
                      ✓ {t("cultures.modal.ru_preview") || "RU calculé"} :{" "}
                      {(() => {
                        const cc = parseFloat(newCulture.thetaCc);
                        const pf = parseFloat(newCulture.thetaPf);
                        const z = 0.6;
                        const ru = ((cc - pf) * z * 1000).toFixed(0);
                        return `(${cc} − ${pf}) × ${z} m × 1000 = ${ru} mm`;
                      })()}
                    </Text>
                    <Text className="text-[10px] text-violet-500 mt-0.5">
                      {t("cultures.modal.ru_formula") || "FAO-56 Eq. 3.1 : RU = (θcc − θpf) × z × 1000"}
                    </Text>
                  </View>
                )}
              </View>

              {/* Boutons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-100 py-3.5"
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text className="text-center text-sm font-bold text-gray-700">
                    {t("cultures.modal.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 rounded-xl bg-green-700 py-3.5 ${submitting ? "opacity-70" : ""}`}
                  onPress={addCulture}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-center text-sm font-bold text-white">
                      {t("cultures.modal.addBtn")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* ─── PICKERS — INSIDE the main Modal ──────────────────────────────── */}
          <SelectPickerModal
            visible={nomPickerVisible}
            title={t("cultures.modal.nomLabel")}
            items={nomSuggestions}
            selectedValue={newCulture.nom}
            onSelect={handleNomSelect}
            onClose={() => setNomPickerVisible(false)}
            loading={loadingSuggestions}
            loadingText={t("cultures.modal.loading")}
          />
          <SelectPickerModal
            visible={varietePickerVisible}
            title={t("cultures.modal.varietyLabel")}
            items={allVarietes}
            selectedValue={newCulture.variete}
            onSelect={handleVarieteSelect}
            onClose={() => setVarietePickerVisible(false)}
            loading={loadingSuggestions}
            loadingText={t("cultures.modal.loading")}
          />
          {/* ✅ SOL PICKER */}
          <SolPickerModal
            visible={solPickerVisible}
            selectedKey={newCulture.typeSol}
            onSelect={(key) => setNewCulture((p) => ({ ...p, typeSol: key }))}
            onClose={() => setSolPickerVisible(false)}
            t={t}
            typesSol={TYPES_SOL}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}