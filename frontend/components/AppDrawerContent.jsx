import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LANGUAGE_OPTIONS } from "@context/LanguageContext";

function getInitials(value) {
  const parts = String(value || "")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppDrawerContent({
  profile,
  currentLanguage,
  language,
  onSelectLanguage,
  onSignOut,
  onUpdateProfile,
  t,
}) {
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadSaved = async () => {
      try {
        const saved = await AsyncStorage.getItem("userDisplayName");
        if (saved) {
          setDisplayName(saved);
        } else if (profile.name) {
          setDisplayName(profile.name);
        }
      } catch {
        if (profile.name) setDisplayName(profile.name);
      }
    };

    loadSaved();
  }, [profile.name]);

  useEffect(() => {
    if (!profile.name) return;

    AsyncStorage.getItem("userDisplayName")
      .then((saved) => {
        if (!saved) setDisplayName(profile.name);
      })
      .catch(() => {});
  }, [profile.name]);

  const openEdit = () => {
    const parts = String(displayName || profile.name || "").trim().split(" ");
    setFirstName(parts[0] || "");
    setLastName(parts.slice(1).join(" ") || "");
    setError("");
    setSuccess(false);
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      setError(t("drawer.firstNameRequired"));
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onUpdateProfile?.(firstName.trim(), lastName.trim());

      const newFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await AsyncStorage.setItem("userDisplayName", newFullName);
      setDisplayName(newFullName);
      setSuccess(true);

      setTimeout(() => {
        setEditModalVisible(false);
        setSuccess(false);
      }, 900);
    } catch (nextError) {
      setError(nextError?.message || t("drawer.updateError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-[18px] mt-2 rounded-2xl bg-[#e8f8ed] p-4">
          <View className="mb-2.5 flex-row items-start justify-between">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
              <Text className="text-xl font-bold text-[#27ae60]">
                {getInitials(displayName || profile.name)}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openEdit}
              className="flex-row items-center rounded-[10px] border border-[#b6e8c8] bg-white px-2.5 py-1.5"
            >
              <Ionicons name="pencil-outline" size={13} color="#27ae60" />
              <Text className="ml-1 text-xs font-semibold text-[#27ae60]">
                {t("drawer.editProfile")}
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="text-[17px] font-bold text-slate-900">
            {displayName || profile.name || t("drawer.guest")}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500">{profile.email}</Text>

          <View className="mt-2.5 self-start rounded-xl bg-white px-2.5 py-1">
            <Text className="text-[11px] font-bold text-[#27ae60]">
              {profile.role === "admin"
                ? t("drawer.roleAdmin")
                : t("drawer.roleUser")}
            </Text>
          </View>
        </View>

        <View className="mb-[18px]">
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-slate-500">
            {t("drawer.languageTitle")}
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setLanguageDropdownOpen((prev) => !prev)}
            className="flex-row items-center justify-between rounded-xl border border-[#dceee3] bg-slate-50 px-3 py-2.5"
          >
            <View className="flex-row items-center gap-2">
              <View className="h-7 w-7 items-center justify-center rounded-[10px] bg-white">
                <Text className="text-[11px] font-bold text-slate-500">
                  {currentLanguage.short}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-slate-900">
                {currentLanguage.label}
              </Text>
            </View>

            <Ionicons
              name={languageDropdownOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color="#64748b"
            />
          </TouchableOpacity>

          {languageDropdownOpen ? (
            <View className="mt-2 gap-2">
              {LANGUAGE_OPTIONS.map((option) => {
                const selected = option.code === language;

                return (
                  <TouchableOpacity
                    key={option.code}
                    activeOpacity={0.85}
                    onPress={() => {
                      onSelectLanguage(option.code);
                      setLanguageDropdownOpen(false);
                    }}
                    className={`flex-row items-center justify-between rounded-xl border px-3 py-2.5 ${
                      selected
                        ? "border-[#e8f8ed] bg-[#e8f8ed]"
                        : "border-[#dceee3] bg-white"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        selected ? "text-[#27ae60]" : "text-slate-900"
                      }`}
                    >
                      {option.label}
                    </Text>
                    {selected ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color="#27ae60"
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>

        <View className="mt-2">
          <TouchableOpacity
            className="mb-[18px] flex-row items-center justify-center rounded-[14px] bg-[#27ae60] py-3"
            activeOpacity={0.9}
            onPress={onSignOut}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text className="ml-2 font-bold text-white">{t("drawer.signOut")}</Text>
          </TouchableOpacity>

          <View className="mt-3">
            <Text className="text-lg font-extrabold">
              <Text className="text-[#3ecf6e]">Smart</Text>
              <Text className="text-[#2196F3]">Irrig</Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-5">
          <View className="w-full max-w-[400px] rounded-[20px] bg-white p-6">
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="text-[17px] font-bold text-slate-900">
                {t("drawer.profileTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View className="mb-5 h-[60px] w-[60px] self-center items-center justify-center rounded-full bg-[#e8f8ed]">
              <Text className="text-[22px] font-extrabold text-[#27ae60]">
                {getInitials(`${firstName} ${lastName}`)}
              </Text>
            </View>

            <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.5px] text-slate-500">
              {t("drawer.firstName")}
            </Text>
            <TextInput
              className="rounded-xl border border-[#dceee3] bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
              value={firstName}
              onChangeText={(value) => {
                setFirstName(value);
                setError("");
              }}
              placeholder={t("drawer.firstNamePlaceholder")}
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
            />

            <Text className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.5px] text-slate-500">
              {t("drawer.lastName")}
            </Text>
            <TextInput
              className="rounded-xl border border-[#dceee3] bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
              value={lastName}
              onChangeText={(value) => {
                setLastName(value);
                setError("");
              }}
              placeholder={t("drawer.lastNamePlaceholder")}
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
            />

            {error ? (
              <Text className="mt-2.5 text-center text-xs text-red-500">{error}</Text>
            ) : null}

            {success ? (
              <View className="mt-2.5 flex-row items-center justify-center gap-1.5 rounded-[10px] bg-green-50 py-2">
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text className="text-[13px] font-semibold text-green-600">
                  {t("drawer.profileUpdated")}
                </Text>
              </View>
            ) : null}

            <View className="mt-5 flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 py-[13px]"
                activeOpacity={0.8}
                onPress={() => setEditModalVisible(false)}
              >
                <Text className="text-sm font-semibold text-slate-500">
                  {t("drawer.cancel")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-[2] flex-row items-center justify-center gap-1.5 rounded-xl bg-[#27ae60] py-[13px]"
                style={saving ? { opacity: 0.7 } : undefined}
                activeOpacity={0.85}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text className="text-sm font-bold text-white">
                      {t("drawer.save")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
