// components/AppDrawer.web.jsx
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authAPI } from "@api/auth";
import { AUTH_ROUTES } from "@constants/routes";
import { LANGUAGE_OPTIONS, useLanguage } from "@context/LanguageContext";
import { router } from "expo-router";
import { AppDrawerContent } from "./AppDrawerContent";
import { DrawerContext } from "./AppDrawerContext";

export { useDrawer, useOptionalDrawer } from "./AppDrawerContext";

export function AppDrawer({ children }) {
  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState({ name: "", email: "", role: "user" });

  const currentLanguage = useMemo(
    () => LANGUAGE_OPTIONS.find((option) => option.code === language) || LANGUAGE_OPTIONS[0],
    [language],
  );

  // ── loadProfile : priorise AsyncStorage pour la persistance après ctrl+R ──
  const loadProfile = async () => {
    try {
      const admin = await authAPI.getAdmin();
      if (admin?.email) {
        setProfile({ name: admin.fullName || admin.email, email: admin.email, role: "admin" });
        return;
      }

      const user = await authAPI.getUser();
      if (user?.email) {
        const savedName = await AsyncStorage.getItem("userDisplayName");
        const nameToUse = savedName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
        setProfile({ name: nameToUse, email: user.email, role: "user" });
      }
    } catch (e) {
      console.error("loadProfile error:", e);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  async function handleSelectLanguage(nextLanguage) { await setLanguage(nextLanguage); }
  async function handleSignOut() { await authAPI.logout(); router.replace(AUTH_ROUTES.login); }

  const handleUpdateProfile = async (firstName, lastName) => {
    const userData = await authAPI.getUser();
    const userId   = userData?._id || userData?.id;
    const token    = await authAPI.getUserToken();

    if (!userId || !token) throw new Error("Session expirée. Reconnectez-vous.");

    const { apiFetch, API_ENDPOINTS } = await import("@api/client");
    const res = await apiFetch(API_ENDPOINTS.users.byId(userId), {
      method: "PUT",
      body: JSON.stringify({ firstName, lastName }),
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || json?.message || "Erreur serveur.");

    // Persister dans AsyncStorage pour survivre au ctrl+R
    const updated = { ...userData, firstName, lastName };
    await AsyncStorage.setItem("userData", JSON.stringify(updated));

    const newFullName = `${firstName} ${lastName}`.trim();
    await AsyncStorage.setItem("userDisplayName", newFullName);

    setProfile((prev) => ({ ...prev, name: newFullName }));
  };

  return (
    <DrawerContext.Provider value={{ isOpen: true, persistent: true, openDrawer: () => {}, closeDrawer: () => {}, toggleDrawer: () => {} }}>
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#fff", paddingTop: insets.top }}>
        <View style={{ width: 288, backgroundColor: "#fff", overflow: "hidden" }}>
          <AppDrawerContent
            profile={profile}
            currentLanguage={currentLanguage}
            language={language}
            onSelectLanguage={handleSelectLanguage}
            onSignOut={handleSignOut}
            onUpdateProfile={handleUpdateProfile}
            t={t}
          />
        </View>
        <View style={{ flex: 1, minHeight: "100vh", overflow: "auto" }}>{children}</View>
      </View>
    </DrawerContext.Provider>
  );
}
