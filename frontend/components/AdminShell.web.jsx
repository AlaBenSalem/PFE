// components/AdminShell.web.jsx
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { authAPI } from "@api/auth";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { APP_ROUTES, AUTH_ROUTES } from "@constants/routes";
import { LANGUAGE_OPTIONS, useLanguage } from "@context/LanguageContext";

function getInitials(value) {
  const parts = String(value || "").trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "A";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatDate(locale) {
  const today = new Date();
  try {
    return today.toLocaleDateString(locale, {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return today.toDateString();
  }
}

export function AdminShell({ activeKey, title, subtitle, loading = false, onRefresh, children }) {
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState({ name: "Admin", email: "" });
  const [unreadCount, setUnreadCount] = useState(0);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);

  // ✅ Utilisation des traductions dynamiques via t()
  const navItems = useMemo(() => [
    { key: "dashboard",    label: t("admin.navDashboard"),   icon: "view-dashboard-outline", route: APP_ROUTES.adminDashboard },
    { key: "addculture",   label: t("admin.navAddCulture"),  icon: "plus-box-outline",        route: APP_ROUTES.adminAddCulture },
    { key: "utilisateurs", label: t("admin.navUsers"),       icon: "account-group-outline",   route: APP_ROUTES.adminUsers },
    { key: "messages",     label: t("admin.navMessages"),    icon: "email-outline",           route: APP_ROUTES.adminMessages },
  ], [t]);

  const currentLanguage = useMemo(
    () => LANGUAGE_OPTIONS.find((option) => option.code === language) || LANGUAGE_OPTIONS[0],
    [language],
  );

  const loadProfile = async () => {
    const admin = await authAPI.getAdmin();
    if (admin?.email) setProfile({ name: admin.fullName || admin.email, email: admin.email });
  };

  useEffect(() => { loadProfile(); }, []);

  const loadUnreadCount = async () => {
    try {
      const res = await apiFetch(API_ENDPOINTS.admin.messagesUnreadCount);
      const json = await res.json();
      if (res.ok && json?.success) setUnreadCount(Number(json.count) || 0);
    } catch {}
  };

  useEffect(() => { loadUnreadCount(); }, [activeKey]);

  const handleSelectLanguage = async (nextLanguage) => { await setLanguage(nextLanguage); };
  const handleSignOut = async () => { await authAPI.logout(); router.replace(AUTH_ROUTES.login); };

  return (
    <View className="flex-1 flex-row min-h-screen bg-gray-100">
      {/* ── Sidebar ── */}
      <View className="w-72 border-r border-gray-200 bg-white min-h-screen">
        <ScrollView className="px-4 pb-6">

          {/* Carte profil */}
          <View className="bg-green-50 rounded-2xl p-4 mt-2 mb-5">
            <View className="w-14 h-14 rounded-full bg-white items-center justify-center mb-2.5">
              <Text className="text-xl font-bold text-green-700">{getInitials(profile.name)}</Text>
            </View>
            <Text className="text-lg font-bold text-gray-900">{profile.name || t("admin.manager")}</Text>
            <Text className="text-xs text-gray-500 mt-0.5">{profile.email}</Text>
            <View className="bg-white rounded-xl px-2.5 py-1 mt-2.5 self-start">
              <Text className="text-xs font-bold text-green-700">{t("drawer.roleAdmin")}</Text>
            </View>
          </View>

          {/* Navigation */}
          <View className="gap-2 mb-5">
            {navItems.map((item) => {
              const selected = item.key === activeKey;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => router.push(item.route)}
                  className={`flex-row items-center justify-between py-2.5 px-3 rounded-xl border ${selected ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}
                >
                  <View className="flex-row items-center gap-2">
                    <View className="w-7 h-7 rounded-xl bg-white items-center justify-center">
                      <MaterialCommunityIcons name={item.icon} size={18} color={selected ? "#27ae60" : "#64748b"} />
                    </View>
                    <Text className={`text-sm font-semibold ${selected ? "text-green-700" : "text-gray-700"}`}>{item.label}</Text>
                  </View>
                  {selected && <MaterialCommunityIcons name="check" size={18} color="#27ae60" />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sélecteur de langue */}
          <View className="mb-5">
            <Text className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              {t("drawer.languageTitle")}
            </Text>
            <TouchableOpacity
              onPress={() => setLanguageDropdownOpen(prev => !prev)}
              className="flex-row items-center justify-between py-2.5 px-3 rounded-xl border border-gray-200 bg-gray-50 mt-2"
            >
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-xl bg-white items-center justify-center">
                  <Text className="text-xs font-bold text-gray-500">{currentLanguage.short}</Text>
                </View>
                <Text className="text-sm font-semibold text-gray-900">{currentLanguage.label}</Text>
              </View>
              <Ionicons name={languageDropdownOpen ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
            </TouchableOpacity>
            {languageDropdownOpen && (
              <View className="mt-2 gap-2">
                {LANGUAGE_OPTIONS.map((option) => {
                  const selected = option.code === language;
                  return (
                    <TouchableOpacity
                      key={option.code}
                      onPress={() => { handleSelectLanguage(option.code); setLanguageDropdownOpen(false); }}
                      className={`flex-row items-center justify-between py-2.5 px-3 rounded-xl border ${selected ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}
                    >
                      <Text className={`text-sm font-medium ${selected ? "text-green-700" : "text-gray-700"}`}>{option.label}</Text>
                      {selected && <MaterialCommunityIcons name="check" size={18} color="#27ae60" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Déconnexion + branding */}
          <View className="mt-2">
            <TouchableOpacity
              className="bg-green-700 rounded-xl py-3 flex-row items-center justify-center mb-5"
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={18} color="#fff" />
              <Text className="text-white font-bold ml-2">{t("drawer.signOut")}</Text>
            </TouchableOpacity>
            <Text className="text-lg font-extrabold">
              <Text className="text-green-500">Smart</Text>
              <Text className="text-blue-500">Irrig</Text>
            </Text>
          </View>

        </ScrollView>
      </View>

      {/* ── Contenu principal ── */}
      <View className="flex-1 bg-white">
        <View className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-gray-200 bg-white">
          <View className="flex-1 mr-3">
            <Text className="text-2xl font-bold text-gray-900">{title}</Text>
            <Text className="text-sm text-gray-500 mt-0.5">{subtitle || formatDate(language)}</Text>
          </View>
          <View className="flex-row gap-2.5">
            <TouchableOpacity
              className="w-10 h-10 rounded-xl border border-gray-200 items-center justify-center bg-white"
              onPress={() => router.push(APP_ROUTES.adminMessages)}
            >
              <MaterialCommunityIcons name="email-outline" size={20} color="#64748b" />
              {unreadCount > 0 && (
                <View className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-blue-500 items-center justify-center border-2 border-white">
                  <Text className="text-white text-[10px] font-bold">
                    {unreadCount > 99 ? "99+" : String(unreadCount)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {onRefresh && (
              <TouchableOpacity
                className="w-10 h-10 rounded-xl border border-gray-200 items-center justify-center bg-white"
                onPress={onRefresh}
              >
                <Ionicons name="refresh" size={20} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center p-6">
            <ActivityIndicator size="large" color="#27ae60" />
          </View>
        ) : (
          <ScrollView
            className="flex-1 px-6 bg-white"
            contentContainerStyle={{ paddingBottom: 32, paddingTop: 18 }}
          >
            {children}
          </ScrollView>
        )}
      </View>
    </View>
  );
}