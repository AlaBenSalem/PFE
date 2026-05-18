// app/(tabs)/cultures.jsx — Merge V1 (interface) + V2 (Type de Sol / RFU)
import React, { useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BrandHeader } from "@components/BrandHeader";
import { useLanguage } from "@context/LanguageContext";
import { useCultures } from "@hooks/useCultures";
import { useCultureForm } from "@hooks/useCultureForm";

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
// STAGE TRANSLATION HELPER
// ══════════════════════════════════════════════════════════════════════════════
function localizeStade(stade, t) {
  if (!stade) return "";
  const s = stade.toLowerCase();
  if (s.includes("ini") || s.includes("début") || s.includes("start") || s.includes("initial")) return t("cultures.card.stadeIni") || stade;
  if (s.includes("dev") || s.includes("growth") || s.includes("développe")) return t("cultures.card.stadeDev") || stade;
  if (s.includes("mid") || s.includes("moyen") || s.includes("milieu") || s.includes("mi-")) return t("cultures.card.stadeMid") || stade;
  if (s.includes("late") || s.includes("fin") || s.includes("end") || s.includes("matur")) return t("cultures.card.stadeLate") || stade;
  return stade;
}

// ══════════════════════════════════════════════════════════════════════════════
// CROP & VARIETY NAME TRANSLATIONS (fr stored in DB → display in 4 langs)
// ══════════════════════════════════════════════════════════════════════════════
const CROP_NAME_MAP = {
  "Orange":         { fr: "Orange",         en: "Orange",       ar: "البرتقال",         tr: "Portakal" },
  "Citron":         { fr: "Citron",          en: "Lemon",        ar: "الليمون",           tr: "Limon" },
  "Mandarine":      { fr: "Mandarine",       en: "Mandarin",     ar: "اليوسفي",           tr: "Mandalina" },
  "Pamplemousse":   { fr: "Pamplemousse",    en: "Grapefruit",   ar: "الجريب فروت",       tr: "Greyfurt" },
  "Olivier":        { fr: "Olivier",         en: "Olive tree",   ar: "الزيتون",           tr: "Zeytin" },
  "Grenadier":      { fr: "Grenadier",       en: "Pomegranate",  ar: "الرمان",            tr: "Nar ağacı" },
  "Figuier":        { fr: "Figuier",         en: "Fig tree",     ar: "التين",             tr: "İncir" },
  "Pommier":        { fr: "Pommier",         en: "Apple tree",   ar: "شجرة التفاح",       tr: "Elma ağacı" },
  "Poirier":        { fr: "Poirier",         en: "Pear tree",    ar: "شجرة الكمثرى",      tr: "Armut ağacı" },
  "Pêcher":         { fr: "Pêcher",          en: "Peach tree",   ar: "شجرة الخوخ",        tr: "Şeftali ağacı" },
  "Abricotier":     { fr: "Abricotier",      en: "Apricot tree", ar: "شجرة المشمش",       tr: "Kayısı ağacı" },
  "Vigne":          { fr: "Vigne",           en: "Grapevine",    ar: "العنب",             tr: "Asma" },
  "Dattier":        { fr: "Dattier",         en: "Date palm",    ar: "النخيل",            tr: "Hurma ağacı" },
  "Tomate":         { fr: "Tomate",          en: "Tomato",       ar: "الطماطم",           tr: "Domates" },
  "Pomme de terre": { fr: "Pomme de terre",  en: "Potato",       ar: "البطاطس",           tr: "Patates" },
  "Poivron":        { fr: "Poivron",         en: "Bell pepper",  ar: "الفلفل",            tr: "Biber" },
  "Oignon":         { fr: "Oignon",          en: "Onion",        ar: "البصل",             tr: "Soğan" },
  "Concombre":      { fr: "Concombre",       en: "Cucumber",     ar: "الخيار",            tr: "Salatalık" },
  "Courgette":      { fr: "Courgette",       en: "Zucchini",     ar: "الكوسا",            tr: "Kabak" },
  "Laitue":         { fr: "Laitue",          en: "Lettuce",      ar: "الخس",              tr: "Marul" },
  "Haricot":        { fr: "Haricot",         en: "Bean",         ar: "الفاصوليا",         tr: "Fasulye" },
  "Melon":          { fr: "Melon",           en: "Melon",        ar: "الشمام",            tr: "Kavun" },
  "Artichaut":      { fr: "Artichaut",       en: "Artichoke",    ar: "الأرضي شوكي",       tr: "Enginar" },
  "Blé":            { fr: "Blé",             en: "Wheat",        ar: "القمح",             tr: "Buğday" },
  "Orge":           { fr: "Orge",            en: "Barley",       ar: "الشعير",            tr: "Arpa" },
  "Maïs":           { fr: "Maïs",            en: "Corn",         ar: "الذرة",             tr: "Mısır" },
  "Tournesol":      { fr: "Tournesol",       en: "Sunflower",    ar: "عباد الشمس",        tr: "Ayçiçeği" },
  // Nouvelles cultures
  "Citrus":         { fr: "Citrus",           en: "Citrus",       ar: "الحمضيات",          tr: "Narenciye" },
  "Amandier":       { fr: "Amandier",         en: "Almond tree",  ar: "شجرة اللوز",        tr: "Badem ağacı" },
  "Cerisier":       { fr: "Cerisier",         en: "Cherry tree",  ar: "شجرة الكرز",        tr: "Kiraz ağacı" },
  "Fraisier":       { fr: "Fraisier",         en: "Strawberry",   ar: "الفراولة",          tr: "Çilek" },
  "Aubergine":      { fr: "Aubergine",        en: "Eggplant",     ar: "الباذنجان",         tr: "Patlıcan" },
  "Carotte":        { fr: "Carotte",          en: "Carrot",       ar: "الجزر",             tr: "Havuç" },
  "Pastèque":       { fr: "Pastèque",         en: "Watermelon",   ar: "البطيخ",            tr: "Karpuz" },
  "Betterave sucrière": { fr: "Betterave sucrière", en: "Sugar beet", ar: "بنجر السكر",   tr: "Şeker pancarı" },
  "Pois chiche":    { fr: "Pois chiche",      en: "Chickpea",     ar: "الحمص",             tr: "Nohut" },
  "Sorgho":         { fr: "Sorgho",           en: "Sorghum",      ar: "الذرة الرفيعة",     tr: "Sorgum" },
  "Luzerne":        { fr: "Luzerne",          en: "Alfalfa",      ar: "البرسيم الحجازي",   tr: "Yonca" },
};

const VARIETY_MAP = {
  "Standard":              { fr: "Standard",              en: "Standard",         ar: "قياسي",             tr: "Standart" },
  "Dur / Tendre":          { fr: "Dur / Tendre",          en: "Hard / Soft",      ar: "صلب / طري",         tr: "Sert / Yumuşak" },
  "Table / Vin":           { fr: "Table / Vin",           en: "Table / Wine",     ar: "مائدة / نبيذ",      tr: "Sofralık / Şarap" },
  "Golden / Red":          { fr: "Golden / Red",          en: "Golden / Red",     ar: "ذهبي / أحمر",       tr: "Altın / Kırmızı" },
  "Cœur de bœuf / Ronde": { fr: "Cœur de bœuf / Ronde", en: "Beefheart / Round",ar: "قلب الثور / مستدير", tr: "Sığır kalbi / Yuvarlak" },
};

function translateCropName(nom, lang) {
  const entry = CROP_NAME_MAP[nom];
  return entry ? (entry[lang] || entry.fr) : nom;
}

function translateVariety(variete, lang) {
  const entry = VARIETY_MAP[variete];
  return entry ? (entry[lang] || entry.fr) : variete;
}

// ══════════════════════════════════════════════════════════════════════════════
// SAXTON & RAWLS (Saxton & Rawls, 2006 — FAO pédotransfert)
// S, C ∈ [0,1]  OM en %
// θFC (à -33 kPa)  θWP (à -1500 kPa)
// ══════════════════════════════════════════════════════════════════════════════
function saxtonRawls(S, C, OM) {
  const fc = -0.251*S + 0.195*C + 0.011*OM + 0.006*S*OM - 0.027*C*OM + 0.452*S*C + 0.299;
  const wp = -0.024*S + 0.487*C + 0.006*OM + 0.005*S*OM - 0.013*C*OM + 0.068*S*C + 0.031;
  return {
    fc: Math.max(0, Math.min(0.65, parseFloat(fc.toFixed(4)))),
    wp: Math.max(0, Math.min(0.55, parseFloat(wp.toFixed(4)))),
  };
}

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
  t,
  translateItem,
}) {
  const [search, setSearch] = React.useState("");
  const searchRef = useRef(null);

  const getDisplay = (item) => (translateItem ? translateItem(item) : item);

  const filtered = items.filter((item) => {
    const s = search.toLowerCase();
    return item.toLowerCase().includes(s) || getDisplay(item).toLowerCase().includes(s);
  });

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
              placeholder={t ? t("cultures.modal.searchPlaceholder") : "Rechercher..."}
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
              {loading ? loadingText : `${filtered.length} ${t ? t("cultures.modal.available") : "résultat(s)"}`}
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
                const display = getDisplay(item);
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
                      {display}
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
                    {t ? t("cultures.modal.noResults") : "Aucun résultat"}
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
              {t("cultures.modal.sol_fao_note")}
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
function CultureCard({ item, deletingId, onDelete, formatDate, t, typesSol, language }) {
  const solData = (typesSol || []).find((sol) => sol.key === item.typeSol) || null;

  return (
    <View className="mb-2.5 flex-row items-start rounded-2xl bg-white p-4 shadow-sm">
      <View className="flex-1">
        <View className="mb-1.5 flex-row flex-wrap items-center gap-2">
          <Text className="text-[17px] font-bold text-green-700">
            {translateCropName(item.nom, language)}
          </Text>
          {item.kcManuel?.mid != null ? (
            <View className="rounded-full bg-amber-50 px-2.5 py-1 border border-amber-200">
              <Text className="text-[11px] font-bold text-amber-700">
                Kc manuel : {item.kcManuel.ini != null ? `ini ${item.kcManuel.ini} · ` : ""}mid {item.kcManuel.mid}{item.kcManuel.end != null ? ` · end ${item.kcManuel.end}` : ""}
              </Text>
            </View>
          ) : item.kcActuel != null && (
            <View className="rounded-full bg-green-50 px-2.5 py-1">
              <Text className="text-[11px] font-bold text-green-600">
                Kc {item.kcActuel.toFixed(2)}
                {item.stadeActuel ? ` · ${localizeStade(item.stadeActuel, t)}` : ""}
              </Text>
            </View>
          )}
        </View>
        <Text className="mb-0.5 text-[13px] text-gray-500">
          🌿 {t("cultures.card.variety")} :{" "}
          <Text className="font-semibold text-gray-700">{translateVariety(item.variete, language)}</Text>
        </Text>
        {item.parcelle && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            📍 {t("cultures.card.parcel")} :{" "}
            <Text className="font-semibold text-gray-700">{item.parcelle}</Text>
          </Text>
        )}
        {item.region && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            🌍 {t("cultures.card.region")} :{" "}
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
            💧 {t("cultures.card.dripFlow")} :{" "}
            <Text className="font-semibold text-gray-700">
              {item.debitGoutteur} L/h × {item.nbGoutteursParArbre ?? "?"}
            </Text>
          </Text>
        )}
        {item.densitePlantation != null && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            🌿 {t("cultures.card.density")} :{" "}
            <Text className="font-semibold text-gray-700">
              {item.densitePlantation} arb/ha
            </Text>
          </Text>
        )}
        {(item.thetaCc != null || item.thetaPf != null) && (
          <Text className="mb-0.5 text-[13px] text-gray-500">
            🧪 θcc/θpf :{" "}
            <Text className="font-semibold text-violet-700">
              {item.thetaCc ?? "—"} / {item.thetaPf ?? "—"} cm³/cm³
            </Text>
            {item.thetaSource === 'saxton_rawls' && (
              <Text className="text-[10px] text-violet-400"> (Saxton & Rawls)</Text>
            )}
            {item.p != null && (
              <Text className="text-[10px] text-violet-400">  p={item.p}  z={item.profondeurRacinaire ?? "—"}m</Text>
            )}
          </Text>
        )}
        {item.sableFraction != null && (
          <Text className="mb-0.5 text-[11px] text-gray-400">
            🏖 S={Math.round(item.sableFraction*100)}%  🪨 C={Math.round(item.argileFraction*100)}%  🌿 MO={item.matOrganique}%
            {item.thetaCc != null && item.thetaPf != null && (
              <Text>  · AWC={(item.thetaCc - item.thetaPf).toFixed(3)} m³/m³</Text>
            )}
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
  const { t, language } = useLanguage();
  const TYPES_SOL = useMemo(() => getTypesSol(t), [t]);

  // ── Data hook ────────────────────────────────────────────────────────────────
  const {
    cultures,
    loading,
    error,
    loadCultures,
    deletingId,
    confirmDelete,
    setConfirmDelete,
    deleteCulture,
    doConfirmedDelete,
    nomSuggestions,
    allVarietes,
    availableCultures,
    totalCulturesDisponibles,
    loadingSuggestions,
  } = useCultures();

  // ── Form hook ────────────────────────────────────────────────────────────────
  const {
    modalVisible,
    setModalVisible,
    showDatePicker,
    setShowDatePicker,
    step,
    setStep,
    submitting,
    nomPickerVisible,
    setNomPickerVisible,
    varietePickerVisible,
    setVarietePickerVisible,
    solPickerVisible,
    setSolPickerVisible,
    newCulture,
    setNewCulture,
    fieldErrors,
    setFieldErrors,
    handleNomSelect,
    handleVarieteSelect,
    validateStep1,
    validateStep2,
    addCulture,
    resetForm,
  } = useCultureForm({ onSuccess: loadCultures });

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

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
        language={language}
      />
    ),
    [deletingId, TYPES_SOL, language], // eslint-disable-line react-hooks/exhaustive-deps
  );

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
            {/* Header with step indicator */}
            <View className="rounded-t-3xl bg-green-700 px-5 pt-4 pb-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-lg font-bold text-white">
                  {step === 1
                    ? t("cultures.modal.step1Title")
                    : step === 2
                    ? t("cultures.modal.step2Title")
                    : t("cultures.modal.step3Title")}
                </Text>
                <TouchableOpacity
                  onPress={() => { setModalVisible(false); resetForm(); }}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View className="flex-row items-center gap-1.5">
                {[1, 2, 3].map((s) => (
                  <View
                    key={s}
                    className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-white" : "bg-green-500"}`}
                  />
                ))}
                <Text className="ml-1 text-[11px] font-semibold text-green-200">
                  {step}/3
                </Text>
              </View>
            </View>

            <ScrollView
              className="p-5"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >

            {/* ══════════════════ ÉTAPE 1 ══════════════════ */}
            {step === 1 && <>
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
                  🌍 {t("cultures.modal.regionLabel")}{" "}
                  <Text className="text-xs font-normal text-gray-400">
                    {t("cultures.modal.regionOptional")}
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

              {/* z racinaire + p dépletion */}
              <View className="mb-4 flex-row gap-2">
                <View className="flex-1">
                  <Text className="mb-1.5 text-xs font-semibold text-gray-700">{t("cultures.modal.zLabel")}</Text>
                  <TextInput
                    className="rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-3 text-sm text-gray-900"
                    placeholder={t("cultures.modal.zPlaceholder")}
                    keyboardType="numeric"
                    value={newCulture.z}
                    onChangeText={(v) => setNewCulture(prev => ({ ...prev, z: v }))}
                  />
                  <Text className="mt-0.5 text-[10px] text-gray-400">{t("cultures.modal.zHint")}</Text>
                </View>
                <View className="flex-1">
                  <Text className="mb-1.5 text-xs font-semibold text-gray-700">{t("cultures.modal.pLabel")}</Text>
                  <TextInput
                    className="rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-3 text-sm text-gray-900"
                    placeholder={t("cultures.modal.pPlaceholder")}
                    keyboardType="numeric"
                    value={newCulture.p}
                    onChangeText={(v) => setNewCulture(prev => ({ ...prev, p: v }))}
                  />
                  <Text className="mt-0.5 text-[10px] text-gray-400">{t("cultures.modal.pHint")}</Text>
                </View>
              </View>

              {/* Nombre d'arbres */}
              <View className="mb-4">
                <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                  {t("cultures.modal.treesLabel")}{" "}
                  <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className={`rounded-xl border bg-gray-50 px-3.5 py-3 text-sm text-gray-900 ${
                    fieldErrors.nombreArbres ? "border-red-500 bg-red-50" : "border-gray-300"
                  }`}
                  placeholder={t("cultures.modal.treesPlaceholder")}
                  keyboardType="numeric"
                  value={newCulture.nombreArbres}
                  onChangeText={(v) => {
                    setFieldErrors((p) => ({ ...p, nombreArbres: null }));
                    const arbres = parseInt(v);
                    const surface = parseFloat(newCulture.surface);
                    if (!isNaN(arbres) && arbres > 0 && !isNaN(surface) && surface > 0) {
                      const densite = Math.round((arbres / surface) * 10000);
                      setNewCulture((prev) => ({ ...prev, nombreArbres: v, densitePlantation: String(densite) }));
                    } else {
                      setNewCulture({ ...newCulture, nombreArbres: v });
                    }
                  }}
                />
                {fieldErrors.nombreArbres ? (
                  <Text className="mt-1 text-[11px] font-medium text-red-500">
                    {fieldErrors.nombreArbres}
                  </Text>
                ) : (
                  <Text className="mt-1 text-[11px] text-gray-400">
                    {newCulture.nombreArbres && newCulture.surface &&
                     !isNaN(parseInt(newCulture.nombreArbres)) && !isNaN(parseFloat(newCulture.surface))
                      ? t("cultures.modal.densityCalc").replace("{value}", Math.round((parseInt(newCulture.nombreArbres) / parseFloat(newCulture.surface)) * 10000))
                      : t("cultures.modal.treesHint")}
                  </Text>
                )}
              </View>

              {/* Densité de plantation */}
              <View className="mb-4">
                <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                  {t("cultures.modal.density_label")}
                </Text>
                <TextInput
                  className={`rounded-xl border bg-gray-50 px-3.5 py-3 text-sm text-gray-900 ${
                    fieldErrors.densitePlantation ? "border-red-500 bg-red-50" : "border-gray-300"
                  }`}
                  placeholder={t("cultures.modal.density_placeholder")}
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
                  <Text className="mt-1 text-[11px] text-gray-400">
                    {newCulture.densitePlantation
                      ? t("cultures.modal.densityCalc").replace("{value}", newCulture.densitePlantation)
                      : t("cultures.modal.densityStep2Hint")}
                  </Text>
                )}
              </View>

              {/* Coefficient cultural Kc */}
              <View className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <View className="mb-1 flex-row items-center gap-2">
                  <Text className="text-base">🌾</Text>
                  <Text className="text-[14px] font-bold text-amber-800">{t("cultures.modal.kcSectionTitle")}</Text>
                  <View className="rounded-full bg-amber-200 px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-amber-700">{t("cultures.modal.hydric_optional")}</Text>
                  </View>
                </View>
                <Text className="mb-3 text-[11px] leading-4 text-amber-600">
                  {t("cultures.modal.kcAutoDesc")}
                </Text>
                <View className="mb-3 flex-row overflow-hidden rounded-xl border border-amber-200">
                  <TouchableOpacity
                    className={`flex-1 items-center py-2.5 ${newCulture.kcMode === "auto" ? "bg-amber-500" : "bg-white"}`}
                    onPress={() => setNewCulture(p => ({ ...p, kcMode: "auto" }))}
                    activeOpacity={0.8}
                  >
                    <Text className={`text-[13px] font-bold ${newCulture.kcMode === "auto" ? "text-white" : "text-amber-700"}`}>
                      {t("cultures.modal.kcModeAuto")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 items-center py-2.5 ${newCulture.kcMode === "manuel" ? "bg-amber-500" : "bg-white"}`}
                    onPress={() => setNewCulture(p => ({ ...p, kcMode: "manuel" }))}
                    activeOpacity={0.8}
                  >
                    <Text className={`text-[13px] font-bold ${newCulture.kcMode === "manuel" ? "text-white" : "text-amber-700"}`}>
                      {t("cultures.modal.kcModeManuel")}
                    </Text>
                  </TouchableOpacity>
                </View>
                {newCulture.kcMode === "manuel" && (
                  <>
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Text className="mb-1 text-xs font-semibold text-gray-700">Kc ini</Text>
                        <TextInput
                          className={`rounded-lg border bg-white px-2.5 py-2.5 text-sm text-gray-900 ${fieldErrors.kcIni ? "border-red-400" : "border-gray-300"}`}
                          placeholder="ex: 0.55"
                          keyboardType="numeric"
                          value={newCulture.kcIni}
                          onChangeText={(v) => { setNewCulture(p => ({ ...p, kcIni: v })); setFieldErrors(p => ({ ...p, kcIni: null })); }}
                        />
                        <Text className="mt-0.5 text-[10px] text-amber-600">{t("cultures.modal.kcStadeIni")}</Text>
                        {fieldErrors.kcIni && <Text className="mt-0.5 text-[10px] text-red-500">{fieldErrors.kcIni}</Text>}
                      </View>
                      <View className="flex-1">
                        <Text className="mb-1 text-xs font-semibold text-gray-700">Kc mid</Text>
                        <TextInput
                          className={`rounded-lg border bg-white px-2.5 py-2.5 text-sm text-gray-900 ${fieldErrors.kcMid ? "border-red-400" : "border-gray-300"}`}
                          placeholder="ex: 0.85"
                          keyboardType="numeric"
                          value={newCulture.kcMid}
                          onChangeText={(v) => { setNewCulture(p => ({ ...p, kcMid: v })); setFieldErrors(p => ({ ...p, kcMid: null })); }}
                        />
                        <Text className="mt-0.5 text-[10px] text-amber-600">{t("cultures.modal.kcStadeMid")}</Text>
                        {fieldErrors.kcMid && <Text className="mt-0.5 text-[10px] text-red-500">{fieldErrors.kcMid}</Text>}
                      </View>
                      <View className="flex-1">
                        <Text className="mb-1 text-xs font-semibold text-gray-700">Kc end</Text>
                        <TextInput
                          className={`rounded-lg border bg-white px-2.5 py-2.5 text-sm text-gray-900 ${fieldErrors.kcEnd ? "border-red-400" : "border-gray-300"}`}
                          placeholder="ex: 0.70"
                          keyboardType="numeric"
                          value={newCulture.kcEnd}
                          onChangeText={(v) => { setNewCulture(p => ({ ...p, kcEnd: v })); setFieldErrors(p => ({ ...p, kcEnd: null })); }}
                        />
                        <Text className="mt-0.5 text-[10px] text-amber-600">{t("cultures.modal.kcStadeLate")}</Text>
                        {fieldErrors.kcEnd && <Text className="mt-0.5 text-[10px] text-red-500">{fieldErrors.kcEnd}</Text>}
                      </View>
                    </View>
                    <View className="mt-2 rounded-lg bg-amber-100 p-2">
                      <Text className="text-[10px] text-amber-700">
                        ⚡ {t("cultures.modal.kcManuelOverride")}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </>}

            {/* ══════════════════ ÉTAPE 2 ══════════════════ */}
            {step === 2 && <>
              {/* Système d'irrigation */}
              <View className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <View className="mb-3 flex-row items-center gap-2">
                  <Text className="text-base">💧</Text>
                  <Text className="text-[14px] font-bold text-blue-800">
                    {t("cultures.modal.irrigationSectionTitle")}
                  </Text>
                  <View className="rounded-full bg-blue-200 px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-blue-700">FAO-56</Text>
                  </View>
                </View>
                {/* Débit goutteur */}
                <View className="mb-3">
                  <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                    {t("cultures.modal.drip_flow_label")} <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className={`rounded-xl border bg-white px-3.5 py-3 text-sm text-gray-900 ${
                      fieldErrors.debitGoutteur ? "border-red-500 bg-red-50" : "border-gray-300"
                    }`}
                    placeholder={t("cultures.modal.drip_flow_placeholder")}
                    keyboardType="numeric"
                    value={newCulture.debitGoutteur}
                    onChangeText={(v) => {
                      setNewCulture({ ...newCulture, debitGoutteur: v });
                      setFieldErrors((p) => ({ ...p, debitGoutteur: null }));
                    }}
                  />
                  {fieldErrors.debitGoutteur ? (
                    <Text className="mt-1 text-[11px] font-medium text-red-500">{fieldErrors.debitGoutteur}</Text>
                  ) : (
                    <Text className="mt-1 text-[11px] text-blue-600">
                      {t("cultures.modal.drip_flow_hint")}
                    </Text>
                  )}
                </View>
                {/* Nb goutteurs par arbre */}
                <View className="mb-0">
                  <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                    {t("cultures.modal.drip_nb_label")} <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className={`rounded-xl border bg-white px-3.5 py-3 text-sm text-gray-900 ${
                      fieldErrors.nbGoutteursParArbre ? "border-red-500 bg-red-50" : "border-gray-300"
                    }`}
                    placeholder={t("cultures.modal.drip_nb_placeholder")}
                    keyboardType="numeric"
                    value={newCulture.nbGoutteursParArbre}
                    onChangeText={(v) => {
                      setNewCulture({ ...newCulture, nbGoutteursParArbre: v });
                      setFieldErrors((p) => ({ ...p, nbGoutteursParArbre: null }));
                    }}
                  />
                  {fieldErrors.nbGoutteursParArbre ? (
                    <Text className="mt-1 text-[11px] font-medium text-red-500">{fieldErrors.nbGoutteursParArbre}</Text>
                  ) : (
                    <Text className="mt-1 text-[11px] text-blue-600">
                      {t("cultures.modal.drip_nb_hint")}
                    </Text>
                  )}
                </View>
              </View>
            </>}

            {/* ══════════════════ ÉTAPE 3 ══════════════════ */}
            {step === 3 && <>
              {/* TYPE DE SOL */}
              <View className="mb-4">
                <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                  🌍 {t("cultures.modal.sol_title")} <Text className="text-red-500">*</Text>
                  <Text className="text-[11px] font-normal text-gray-400">
                    {" "}{t("cultures.modal.sol_label_hint")}
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
                    {selectedSolData.ruInfo} — {t("cultures.modal.sol_determines")}
                  </Text>
                </View>
              </View>

              {/* Stock initial d'eau */}
              <View className="mb-4">
                <Text className="mb-1.5 text-sm font-semibold text-gray-700">
                  💧 {t("cultures.modal.waterStockLabel")}{" "}
                  <Text className="text-xs font-normal text-gray-400">({t("cultures.modal.hydric_optional")})</Text>
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-3 text-sm text-gray-900"
                  placeholder={t("cultures.modal.waterStockPlaceholder")}
                  keyboardType="numeric"
                  value={newCulture.stockInitial}
                  onChangeText={(v) => setNewCulture(prev => ({ ...prev, stockInitial: v }))}
                />
                <Text className="mt-1 text-[11px] text-gray-400">
                  {t("cultures.modal.waterStockHint")}
                </Text>
              </View>

              <View className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <View className="mb-1 flex-row items-center gap-2">
                  <Text className="text-base">🧪</Text>
                  <Text className="text-[14px] font-bold text-violet-800">
                    {t("cultures.modal.hydric_title")}
                  </Text>
                  <View className="rounded-full bg-violet-200 px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-violet-700">
                      {t("cultures.modal.hydric_optional")}
                    </Text>
                  </View>
                </View>
                <Text className="mb-3 text-[11px] leading-4 text-violet-600">
                  {t("cultures.modal.hydric_desc")}
                </Text>
                {/* Calculateur Saxton & Rawls */}
                <View className="mb-4 rounded-xl border border-violet-300 bg-white p-3">
                  <Text className="mb-1 text-[13px] font-bold text-violet-700">
                    🔬 {t("cultures.modal.saxtonTitle")}
                  </Text>
                  <Text className="mb-2.5 text-[11px] text-violet-500">
                    {t("cultures.modal.saxtonDesc")}
                  </Text>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="mb-1 text-xs font-semibold text-gray-600">{t("cultures.modal.sandLabel")}</Text>
                      <TextInput
                        className={`rounded-lg border bg-gray-50 px-2.5 py-2.5 text-sm text-gray-900 ${fieldErrors.sablePct ? "border-red-400" : "border-gray-300"}`}
                        placeholder="ex: 40"
                        keyboardType="numeric"
                        value={newCulture.sablePct}
                        onChangeText={(v) => {
                          const updated = { ...newCulture, sablePct: v };
                          const S = parseFloat(v) / 100;
                          const C = parseFloat(updated.argilePct) / 100;
                          const OM = parseFloat(updated.om);
                          if (!isNaN(S) && !isNaN(C) && !isNaN(OM) && S >= 0 && C >= 0 && S + C <= 1 && OM > 0) {
                            const r = saxtonRawls(S, C, OM);
                            updated.thetaCc = String(r.fc);
                            updated.thetaPf = String(r.wp);
                          }
                          setNewCulture(updated);
                          setFieldErrors(p => ({ ...p, sablePct: null, thetaCc: null, thetaPf: null }));
                        }}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="mb-1 text-xs font-semibold text-gray-600">{t("cultures.modal.clayLabel")}</Text>
                      <TextInput
                        className={`rounded-lg border bg-gray-50 px-2.5 py-2.5 text-sm text-gray-900 ${fieldErrors.argilePct ? "border-red-400" : "border-gray-300"}`}
                        placeholder="ex: 25"
                        keyboardType="numeric"
                        value={newCulture.argilePct}
                        onChangeText={(v) => {
                          const updated = { ...newCulture, argilePct: v };
                          const S = parseFloat(updated.sablePct) / 100;
                          const C = parseFloat(v) / 100;
                          const OM = parseFloat(updated.om);
                          if (!isNaN(S) && !isNaN(C) && !isNaN(OM) && S >= 0 && C >= 0 && S + C <= 1 && OM > 0) {
                            const r = saxtonRawls(S, C, OM);
                            updated.thetaCc = String(r.fc);
                            updated.thetaPf = String(r.wp);
                          }
                          setNewCulture(updated);
                          setFieldErrors(p => ({ ...p, argilePct: null, thetaCc: null, thetaPf: null }));
                        }}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="mb-1 text-xs font-semibold text-gray-600">{t("cultures.modal.omLabel")}</Text>
                      <TextInput
                        className="rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-2.5 text-sm text-gray-900"
                        placeholder="ex: 1.5"
                        keyboardType="numeric"
                        value={newCulture.om}
                        onChangeText={(v) => {
                          const updated = { ...newCulture, om: v };
                          const S = parseFloat(updated.sablePct) / 100;
                          const C = parseFloat(updated.argilePct) / 100;
                          const OM = parseFloat(v);
                          if (!isNaN(S) && !isNaN(C) && !isNaN(OM) && S >= 0 && C >= 0 && S + C <= 1 && OM > 0) {
                            const r = saxtonRawls(S, C, OM);
                            updated.thetaCc = String(r.fc);
                            updated.thetaPf = String(r.wp);
                          }
                          setNewCulture(updated);
                          setFieldErrors(p => ({ ...p, thetaCc: null, thetaPf: null }));
                        }}
                      />
                    </View>
                  </View>
                  {(() => {
                    const S = parseFloat(newCulture.sablePct);
                    const C = parseFloat(newCulture.argilePct);
                    if (!isNaN(S) && !isNaN(C) && (S + C) > 100) {
                      return <Text className="mt-1.5 text-[11px] font-medium text-red-500">⚠ {t("cultures.modal.saxtonError")}</Text>;
                    }
                    return null;
                  })()}
                  {(() => {
                    const S = parseFloat(newCulture.sablePct) / 100;
                    const C = parseFloat(newCulture.argilePct) / 100;
                    const OM = parseFloat(newCulture.om);
                    if (!isNaN(S) && !isNaN(C) && !isNaN(OM) && S >= 0 && C >= 0 && S + C <= 1 && OM > 0) {
                      const r = saxtonRawls(S, C, OM);
                      return (
                        <View className="mt-2 rounded-lg bg-violet-50 p-2.5">
                          <Text className="text-[11px] font-bold text-violet-700">✓ Saxton & Rawls (2006) :</Text>
                          <Text className="mt-0.5 text-[11px] text-violet-600">
                            θFC = <Text className="font-bold">{r.fc} cm³/cm³</Text>  ·  θWP = <Text className="font-bold">{r.wp} cm³/cm³</Text>
                          </Text>
                          <Text className="mt-0.5 text-[11px] text-violet-500">
                            AWC = <Text className="font-semibold">{(r.fc - r.wp).toFixed(4)} cm³/cm³</Text>  ·  RU (z={parseFloat(newCulture.z)||0.6}m) = <Text className="font-semibold">{((r.fc - r.wp) * (parseFloat(newCulture.z)||0.6) * 1000).toFixed(0)} mm</Text>
                          </Text>
                          <Text className="mt-0.5 text-[11px] text-violet-500">
                            RFU (p={parseFloat(newCulture.p)||0.5}) = <Text className="font-semibold">{((r.fc - r.wp) * (parseFloat(newCulture.z)||0.6) * (parseFloat(newCulture.p)||0.5) * 1000).toFixed(0)} mm</Text>
                          </Text>
                          <Text className="mt-0.5 text-[10px] text-violet-400">
                            {t("cultures.modal.saxtonCopied")}
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>

                <Text className="mb-2 text-[11px] text-gray-400">
                  {t("cultures.modal.thetaManualOr")}
                </Text>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="mb-1.5 text-sm font-semibold text-gray-700">θcc (cm³/cm³)</Text>
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
                      <Text className="mt-1 text-[10px] font-medium text-red-500">{fieldErrors.thetaCc}</Text>
                    )}
                    <Text className="mt-1 text-[10px] text-violet-500">
                      {t("cultures.modal.thetaCc_hint")}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="mb-1.5 text-sm font-semibold text-gray-700">θpf (cm³/cm³)</Text>
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
                      <Text className="mt-1 text-[10px] font-medium text-red-500">{fieldErrors.thetaPf}</Text>
                    )}
                    <Text className="mt-1 text-[10px] text-violet-500">
                      {t("cultures.modal.thetaPf_hint")}
                    </Text>
                  </View>
                </View>

                {newCulture.thetaCc && newCulture.thetaPf &&
                  !isNaN(parseFloat(newCulture.thetaCc)) &&
                  !isNaN(parseFloat(newCulture.thetaPf)) &&
                  parseFloat(newCulture.thetaCc) > parseFloat(newCulture.thetaPf) && (
                  <View className="mt-3 rounded-xl bg-violet-100 p-2.5">
                    <Text className="text-[11px] font-semibold text-violet-700">
                      ✓ {t("cultures.modal.ru_preview")} :{" "}
                      {(() => {
                        const cc = parseFloat(newCulture.thetaCc);
                        const pf = parseFloat(newCulture.thetaPf);
                        const z  = parseFloat(newCulture.z)  || 0.6;
                        const p  = parseFloat(newCulture.p)  || 0.5;
                        const ru  = ((cc - pf) * z * 1000).toFixed(0);
                        const rfu = ((cc - pf) * z * p * 1000).toFixed(0);
                        return `RU = (${cc}−${pf})×${z}×1000 = ${ru} mm  |  RFU(p=${p}) = ${rfu} mm`;
                      })()}
                    </Text>
                    <Text className="text-[10px] text-violet-500 mt-0.5">
                      {t("cultures.modal.ru_formula")}
                    </Text>
                  </View>
                )}
              </View>
            </>}

            {/* Navigation */}
            <View className="flex-row gap-3 mb-4">
              <TouchableOpacity
                className="flex-1 rounded-xl border border-gray-200 bg-gray-100 py-3.5"
                onPress={() => {
                  if (step > 1) { setStep(step - 1); setFieldErrors({}); }
                  else { setModalVisible(false); resetForm(); }
                }}
              >
                <Text className="text-center text-sm font-bold text-gray-700">
                  {step > 1 ? `← ${t("common.previous")}` : t("cultures.modal.cancel")}
                </Text>
              </TouchableOpacity>
              {step < 3 ? (
                <TouchableOpacity
                  className="flex-1 rounded-xl bg-green-700 py-3.5"
                  onPress={() => {
                    const valid = step === 1 ? validateStep1() : validateStep2();
                    if (valid) { setStep(step + 1); setFieldErrors({}); }
                  }}
                >
                  <Text className="text-center text-sm font-bold text-white">{t("common.next")} →</Text>
                </TouchableOpacity>
              ) : (
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
              )}
            </View>
            </ScrollView>
          </View>

          {/* ─── PICKERS — INSIDE the main Modal ──────────────────────────────── */}
          <SelectPickerModal
            visible={nomPickerVisible}
            title={t("cultures.modal.nomLabel")}
            items={nomSuggestions}
            selectedValue={newCulture.nom}
            onSelect={(nom) => handleNomSelect(nom, availableCultures)}
            onClose={() => setNomPickerVisible(false)}
            loading={loadingSuggestions}
            loadingText={t("cultures.modal.loading")}
            t={t}
            translateItem={(nom) => translateCropName(nom, language)}
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
            t={t}
            translateItem={(v) => translateVariety(v, language)}
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
