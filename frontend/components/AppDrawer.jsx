// components/AppDrawer.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authAPI } from "@api/auth";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { AUTH_ROUTES } from "@constants/routes";
import { LANGUAGE_OPTIONS, useLanguage } from "@context/LanguageContext";
import { AppDrawerContent } from "./AppDrawerContent";
import { DrawerContext } from "./AppDrawerContext";

const SPRING = { damping: 22, stiffness: 260, mass: 0.75 };
const EDGE_WIDTH = 28;
const DRAWER_RATIO = 0.78;
const MAIN_SCALE_MIN = 0.92;
const MAIN_RADIUS = 20;
const OPEN_VELOCITY = 720;
const CLOSE_VELOCITY = -720;

export { useDrawer, useOptionalDrawer } from "./AppDrawerContext";

function snapOpenState(progress, velocityX, isRTL) {
  "worklet";
  const p = progress.value;
  let target = p >= 0.5 ? 1 : 0;
  if (!isRTL) {
    if (velocityX > OPEN_VELOCITY) target = 1;
    if (velocityX < CLOSE_VELOCITY) target = 0;
  } else {
    if (velocityX < -OPEN_VELOCITY) target = 1;
    if (velocityX > -CLOSE_VELOCITY) target = 0;
  }
  progress.value = withSpring(target, SPRING);
}

export function AppDrawer({ children }) {
  const insets = useSafeAreaInsets();
  const { language, setLanguage, isRTL, t } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();

  const drawerWidth = Math.round(screenWidth * DRAWER_RATIO);
  const drawerWidthSV  = useSharedValue(drawerWidth);
  const isRTLShared    = useSharedValue(isRTL ? 1 : 0);
  const progress       = useSharedValue(0);
  const startProgress  = useSharedValue(0);

  const [isOpen,  setIsOpen]  = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", role: "user" });

  useEffect(() => { drawerWidthSV.value = drawerWidth; }, [drawerWidth]);

  useEffect(() => { isRTLShared.value = isRTL ? 1 : 0; }, [isRTL]);

  useAnimatedReaction(
    () => progress.value,
    (v, prev) => {
      const open    = v > 0.5;
      const wasOpen = prev != null && prev > 0.5;
      if (open !== wasOpen) runOnJS(setIsOpen)(open);
    },
  );

  const currentLanguage = useMemo(
    () => LANGUAGE_OPTIONS.find((o) => o.code === language) || LANGUAGE_OPTIONS[0],
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
        // Vérifier si un nom sauvegardé existe dans AsyncStorage
        const savedName = await AsyncStorage.getItem("userDisplayName");
        const nameToUse = savedName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
        setProfile({ name: nameToUse, email: user.email, role: "user" });
      }
    } catch (e) {
      console.error("loadProfile error:", e);
    }
  };

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => { if (isOpen) loadProfile(); }, [isOpen]);

  // ── handleUpdateProfile : met à jour le backend + AsyncStorage + état local ─
  const handleUpdateProfile = async (firstName, lastName) => {
    const userData = await authAPI.getUser();
    const userId   = userData?._id || userData?.id;
    const token    = await authAPI.getUserToken();

    if (!userId || !token) throw new Error(t("errors.unauthorized"));

    const res = await apiFetch(API_ENDPOINTS.users.byId(userId), {
      method: "PUT",
      body: JSON.stringify({ firstName, lastName }),
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || json?.message || t("admin.userErrServer"));

    // Mettre à jour userData dans AsyncStorage avec les nouvelles valeurs
    const updated = { ...userData, firstName, lastName };
    await AsyncStorage.setItem("userData", JSON.stringify(updated));

    // Construire le nom complet et le persister séparément
    const newFullName = `${firstName} ${lastName}`.trim();
    await AsyncStorage.setItem("userDisplayName", newFullName);

    // Mettre à jour l'état local du profil immédiatement
    setProfile((prev) => ({ ...prev, name: newFullName }));
  };

  async function handleSelectLanguage(nextLanguage) { await setLanguage(nextLanguage); }

  async function handleSignOut() {
    await authAPI.logout();
    router.replace(AUTH_ROUTES.login);
  }

  const openDrawer = () => { progress.value = withSpring(1, SPRING); };
  const closeDrawer = () => { progress.value = withSpring(0, SPRING); };
  const toggleDrawer = () => {
    progress.value = withSpring(progress.value > 0.5 ? 0 : 1, SPRING);
  };

  const edgePan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onBegin(() => { startProgress.value = progress.value; })
        .onUpdate((e) => {
          const w   = drawerWidthSV.value;
          const rtl = isRTLShared.value === 1;
          const delta = e.translationX / w;
          const next  = rtl ? startProgress.value - delta : startProgress.value + delta;
          progress.value = Math.max(0, Math.min(1, next));
        })
        .onEnd((e) => { snapOpenState(progress, e.velocityX, isRTLShared.value === 1); }),
    [drawerWidthSV, isRTLShared, progress, startProgress],
  );

  const mainPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-14, 14])
        .failOffsetY([-12, 12])
        .onBegin(() => { startProgress.value = progress.value; })
        .onUpdate((e) => {
          if (startProgress.value < 0.02) return;
          const w   = drawerWidthSV.value;
          const rtl = isRTLShared.value === 1;
          const delta = e.translationX / w;
          const next  = rtl ? startProgress.value - delta : startProgress.value + delta;
          progress.value = Math.max(0, Math.min(1, next));
        })
        .onEnd((e) => {
          if (startProgress.value < 0.02) return;
          snapOpenState(progress, e.velocityX, isRTLShared.value === 1);
        }),
    [drawerWidthSV, isRTLShared, progress, startProgress],
  );

  const drawerStyle = useAnimatedStyle(() => {
    const w   = drawerWidthSV.value;
    const rtl = isRTLShared.value === 1;
    const tx  = rtl ? w * (1 - progress.value) : w * (progress.value - 1);
    return { transform: [{ translateX: tx }] };
  });

  const mainStyle = useAnimatedStyle(() => {
    const w   = drawerWidthSV.value;
    const rtl = isRTLShared.value === 1;
    const p   = progress.value;
    const tx  = rtl ? -w * p : w * p;
    const scale = 1 - (1 - MAIN_SCALE_MIN) * p;
    return {
      transform: [{ translateX: tx }, { scale }],
      borderRadius: MAIN_RADIUS * p,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: -4, height: 0 },
      shadowOpacity: 0.1 + 0.18 * p,
      shadowRadius: 10 + 16 * p,
      elevation: 4 + 10 * p,
    };
  });

  const overlayStyle = useAnimatedStyle(() => ({ opacity: 0.38 * progress.value }));

  const topPad = insets.top + 8;
  const drawerSideStyle   = isRTL ? { right: 0 } : { left: 0 };
  const edgePositionStyle = isRTL ? { right: 0, width: EDGE_WIDTH } : { left: 0, width: EDGE_WIDTH };

  const drawerContentProps = {
    profile,
    currentLanguage,
    language,
    onSelectLanguage: handleSelectLanguage,
    onSignOut: handleSignOut,
    onUpdateProfile: handleUpdateProfile,
    t,
  };

  return (
    <DrawerContext.Provider value={{ isOpen, persistent: false, toggleDrawer, openDrawer, closeDrawer }}>
      <View className="flex-1 bg-[#0b1220]">
        <View className="absolute inset-0 bg-[#0b1220]" />

        <Animated.View
          style={[styles.drawer, drawerStyle, drawerSideStyle, { width: drawerWidth, paddingTop: topPad }]}
        >
          <AppDrawerContent {...drawerContentProps} />
        </Animated.View>

        <GestureDetector gesture={mainPan}>
          <Animated.View style={[styles.main, mainStyle]}>
            <View className="flex-1">{children}</View>
            <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents={isOpen ? "auto" : "none"}>
              <Pressable className="absolute inset-0" onPress={closeDrawer} />
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={edgePan}>
          <View style={[styles.edgeHit, edgePositionStyle]} pointerEvents="box-only" />
        </GestureDetector>
      </View>
    </DrawerContext.Provider>
  );
}

const styles = StyleSheet.create({
  drawer:    { position: "absolute", top: 0, bottom: 0, zIndex: 0, backgroundColor: "#fff", borderColor: "#dceee3", borderWidth: 0.5 },
  main:      { ...StyleSheet.absoluteFillObject, zIndex: 1, backgroundColor: "#fff" },
  overlay:   { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: "#000" },
  edgeHit:   { position: "absolute", top: 0, bottom: 0, zIndex: 50 },
});
