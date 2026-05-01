// components/AdminShell.jsx
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { authAPI } from "@api/auth";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { APP_ROUTES, AUTH_ROUTES } from "@constants/routes";
import { LANGUAGE_OPTIONS, useLanguage } from "@context/LanguageContext";

const SPRING = { damping: 22, stiffness: 260, mass: 0.75 };
const EDGE_WIDTH = 28;
const DRAWER_RATIO = 0.78;
const MAIN_SCALE_MIN = 0.92;
const MAIN_RADIUS = 20;
const OPEN_VELOCITY = 720;
const CLOSE_VELOCITY = -720;

function getInitials(value) {
  const parts = String(value || "")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (parts.length === 0) return "A";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function formatDate(locale) {
  try {
    return new Date().toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return new Date().toDateString();
  }
}

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

// Drawer Content Component
function DrawerContent({
  profile,
  navItems,
  activeKey,
  language,
  currentLanguage,
  languageDropdownOpen,
  setLanguageDropdownOpen,
  handleSelectLanguage,
  handleSignOut,
  onEditProfile,
  closeDrawer,
  t,
  isRTL,
  unreadCount,
}) {
  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Profile Card */}
      <View className="mt-2 mb-[18px] rounded-2xl bg-green-50 p-4">
        <View className="mb-2.5 flex-row items-start justify-between">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
            <Text className="text-xl font-bold text-green-600">
              {getInitials(profile.name)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onEditProfile}
            activeOpacity={0.8}
            className="flex-row items-center rounded-[10px] border border-green-200 bg-white px-2.5 py-1.5"
          >
            <Ionicons name="pencil-outline" size={13} color="#16a34a" />
            <Text className="ml-1 text-xs font-semibold text-green-600">
              {t("drawer.editProfile")}
            </Text>
          </TouchableOpacity>
        </View>
        <Text className="text-[17px] font-bold text-slate-900">
          {profile.name || t("admin.manager")}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500">{profile.email}</Text>
        <View className="mt-2.5 self-start rounded-xl bg-white px-2.5 py-1">
          <Text className="text-[11px] font-bold text-green-600">
            {t("drawer.roleAdmin")}
          </Text>
        </View>
      </View>

      {/* Menu Items */}
      <View className="mb-[18px] gap-2">
        {navItems.map((item) => {
          const selected = item.key === activeKey;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.85}
              onPress={() => {
                router.push(item.route);
                closeDrawer?.();
              }}
              className={`flex-row items-center justify-between rounded-xl border px-3 py-2.5 ${
                selected
                  ? "border-green-100 bg-green-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <View className="flex-1 flex-row items-center gap-2">
                <View className="h-7 w-7 items-center justify-center rounded-[10px] bg-white">
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={18}
                    color={selected ? "#16a34a" : "#64748b"}
                  />
                </View>
                <Text
                  className={`text-sm font-semibold ${
                    selected ? "text-green-600" : "text-slate-900"
                  }`}
                >
                  {item.label}
                </Text>
              </View>
              {item.key === "messages" && unreadCount > 0 && (
                <View className="min-w-5 h-5 items-center justify-center rounded-full bg-blue-500 px-1.5">
                  <Text className="text-[10px] font-extrabold text-white">
                    {unreadCount > 99 ? "99+" : String(unreadCount)}
                  </Text>
                </View>
              )}
              {selected && item.key !== "messages" && (
                <MaterialCommunityIcons
                  name="check"
                  size={18}
                  color="#16a34a"
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Language Section */}
      <View className="mb-[18px]">
        <Text
          className={`mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 ${
            isRTL ? "text-right" : "text-left"
          }`}
        >
          {t("drawer.languageTitle")}
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setLanguageDropdownOpen((prev) => !prev)}
          className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
        >
          <View className="flex-row items-center gap-2">
            <View className="h-7 w-7 items-center justify-center rounded-[10px] bg-white">
              <Text className="text-xs font-bold text-slate-500">
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

        {languageDropdownOpen && (
          <View className="mt-2 gap-1.5">
            {LANGUAGE_OPTIONS.map((option) => {
              const selected = option.code === language;
              return (
                <TouchableOpacity
                  key={option.code}
                  activeOpacity={0.85}
                  onPress={() => {
                    handleSelectLanguage(option.code);
                    setLanguageDropdownOpen(false);
                  }}
                  className={`flex-row items-center justify-between rounded-xl border px-3 py-2.5 ${
                    selected
                      ? "border-green-100 bg-green-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <View className="flex-row items-center gap-2">
                    <View className="h-7 w-7 items-center justify-center rounded-[10px] bg-white">
                      <Text
                        className={`text-xs font-bold ${
                          selected ? "text-green-600" : "text-slate-500"
                        }`}
                      >
                        {option.short}
                      </Text>
                    </View>
                    <Text
                      className={`text-sm font-semibold ${
                        selected ? "text-green-600" : "text-slate-900"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {selected && (
                    <MaterialCommunityIcons
                      name="check"
                      size={18}
                      color="#16a34a"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Footer */}
      <View className="mt-2">
        <TouchableOpacity
          className="mb-[18px] flex-row items-center justify-center rounded-2xl bg-green-600 py-3"
          activeOpacity={0.9}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text className="ml-2 font-bold text-white">
            {t("drawer.signOut")}
          </Text>
        </TouchableOpacity>
        <View className="items-start">
          <Text className="text-lg font-extrabold">
            <Text className="text-green-500">Smart</Text>
            <Text className="text-blue-500">Irrig</Text>
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// Main Shell Component
export function AdminShell({
  activeKey,
  title,
  subtitle,
  loading = false,
  onRefresh,
  children,
}) {
  const insets = useSafeAreaInsets();
  const { language, setLanguage, isRTL, t } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();

  const drawerWidth = Math.round(screenWidth * DRAWER_RATIO);

  const drawerWidthSV = useSharedValue(drawerWidth);
  const isRTLShared = useSharedValue(isRTL ? 1 : 0);
  const progress = useSharedValue(0);
  const startProgress = useSharedValue(0);

  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState({ name: "Admin", email: "" });
  const [unreadCount, setUnreadCount] = useState(0);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [editNameModal, setEditNameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    drawerWidthSV.value = drawerWidth;
  }, [drawerWidth]);
  useEffect(() => {
    isRTLShared.value = isRTL ? 1 : 0;
  }, [isRTL]);

  useAnimatedReaction(
    () => progress.value,
    (v, prev) => {
      const open = v > 0.5;
      const wasOpen = prev != null && prev > 0.5;
      if (open !== wasOpen) runOnJS(setIsOpen)(open);
    },
  );

  const navItems = useMemo(
    () => [
      {
        key: "dashboard",
        label: t("admin.navDashboard"),
        icon: "view-dashboard-outline",
        route: APP_ROUTES.adminDashboard,
      },
      {
        key: "addculture",
        label: t("admin.navAddCulture"),
        icon: "plus-box-outline",
        route: APP_ROUTES.adminAddCulture,
      },
      {
        key: "utilisateurs",
        label: t("admin.navUsers"),
        icon: "account-group-outline",
        route: APP_ROUTES.adminUsers,
      },
      {
        key: "messages",
        label: t("admin.navMessages"),
        icon: "email-outline",
        route: APP_ROUTES.adminMessages,
      },
    ],
    [t],
  );

  const currentLanguage = useMemo(
    () =>
      LANGUAGE_OPTIONS.find((o) => o.code === language) || LANGUAGE_OPTIONS[0],
    [language],
  );

  const loadProfile = async () => {
    const admin = await authAPI.getAdmin();
    if (admin?.email) {
      setProfile({ name: admin.fullName || admin.email, email: admin.email });
      return;
    }
    setProfile({ name: "Admin", email: "" });
  };

  const loadUnreadCount = async () => {
    try {
      const res = await apiFetch(API_ENDPOINTS.admin.messagesUnreadCount);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) setUnreadCount(Number(json.count) || 0);
    } catch {}
  };

  useEffect(() => {
    loadProfile();
  }, []);
  useEffect(() => {
    if (isOpen) loadProfile();
  }, [isOpen]);
  useEffect(() => {
    loadUnreadCount();
  }, [activeKey]);

  async function handleSelectLanguage(lang) {
    await setLanguage(lang);
  }
  async function handleSignOut() {
    await authAPI.logout();
    router.replace(AUTH_ROUTES.login);
  }

  const openEditName = () => {
    setNewName(profile.name || "");
    setNameError("");
    setEditNameModal(true);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) { setNameError(t("drawer.firstNameRequired")); return; }
    setSavingName(true);
    setNameError("");
    try {
      const token = await authAPI.getAdminToken();
      const res = await apiFetch(API_ENDPOINTS.admin.adminProfile, {
        method: "PATCH",
        body: JSON.stringify({ fullName: newName.trim() }),
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) { setNameError(json?.message || "Erreur"); return; }
      const updatedAdmin = json.admin;
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const adminData = await AsyncStorage.getItem("adminData");
      const parsed = adminData ? JSON.parse(adminData) : {};
      await AsyncStorage.setItem("adminData", JSON.stringify({ ...parsed, fullName: updatedAdmin.fullName }));
      setProfile(p => ({ ...p, name: updatedAdmin.fullName }));
      setEditNameModal(false);
    } catch (e) {
      setNameError(e?.message || "Erreur serveur");
    } finally {
      setSavingName(false);
    }
  };

  const closeDrawer = () => {
    progress.value = withSpring(0, SPRING);
  };
  const toggleDrawer = () => {
    progress.value = withSpring(progress.value > 0.5 ? 0 : 1, SPRING);
  };

  const edgePan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          startProgress.value = progress.value;
        })
        .onUpdate((e) => {
          const w = drawerWidthSV.value;
          const rtl = isRTLShared.value === 1;
          const delta = e.translationX / w;
          const next = rtl
            ? startProgress.value - delta
            : startProgress.value + delta;
          progress.value = Math.max(0, Math.min(1, next));
        })
        .onEnd((e) => {
          snapOpenState(progress, e.velocityX, isRTLShared.value === 1);
        }),
    [drawerWidthSV, isRTLShared, progress, startProgress],
  );

  const mainPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-14, 14])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          startProgress.value = progress.value;
        })
        .onUpdate((e) => {
          if (startProgress.value < 0.02) return;
          const w = drawerWidthSV.value;
          const rtl = isRTLShared.value === 1;
          const delta = e.translationX / w;
          const next = rtl
            ? startProgress.value - delta
            : startProgress.value + delta;
          progress.value = Math.max(0, Math.min(1, next));
        })
        .onEnd((e) => {
          if (startProgress.value < 0.02) return;
          snapOpenState(progress, e.velocityX, isRTLShared.value === 1);
        }),
    [drawerWidthSV, isRTLShared, progress, startProgress],
  );

  const drawerAnim = useAnimatedStyle(() => {
    const w = drawerWidthSV.value;
    const rtl = isRTLShared.value === 1;
    return {
      transform: [
        {
          translateX: rtl ? w * (1 - progress.value) : w * (progress.value - 1),
        },
      ],
    };
  });

  const mainAnim = useAnimatedStyle(() => {
    const w = drawerWidthSV.value;
    const rtl = isRTLShared.value === 1;
    const p = progress.value;
    return {
      transform: [
        { translateX: rtl ? -w * p : w * p },
        { scale: 1 - (1 - MAIN_SCALE_MIN) * p },
      ],
      borderRadius: MAIN_RADIUS * p,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: -4, height: 0 },
      shadowOpacity: 0.1 + 0.18 * p,
      shadowRadius: 10 + 16 * p,
      elevation: 4 + 10 * p,
    };
  });

  const overlayAnim = useAnimatedStyle(() => ({
    opacity: 0.38 * progress.value,
    backgroundColor: "#000",
  }));

  const topPad = insets.top + 8;
  const contentTopPad = insets.top + 18;
  const drawerSide = isRTL ? { right: 0 } : { left: 0 };
  const edgeSide = isRTL
    ? { right: 0, width: EDGE_WIDTH }
    : { left: 0, width: EDGE_WIDTH };

  const drawerProps = {
    profile,
    navItems,
    activeKey,
    language,
    currentLanguage,
    languageDropdownOpen,
    setLanguageDropdownOpen,
    handleSelectLanguage,
    handleSignOut,
    t,
    isRTL,
    unreadCount,
  };

  const PageHeader = ({ withMenuBtn = false }) => (
    <View className="mb-3.5 flex-row items-center justify-between">
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        {withMenuBtn && (
          <TouchableOpacity
            className="h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-green-50"
            onPress={toggleDrawer}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isOpen ? "close" : "menu"}
              size={22}
              color="#16a34a"
            />
          </TouchableOpacity>
        )}
        <View className="min-w-0 flex-1">
          <Text
            className="text-[22px] font-bold leading-7 text-slate-900"
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text className="mt-0.5 text-[13px] text-slate-500" numberOfLines={1}>
            {subtitle || formatDate(language)}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2.5">
        <TouchableOpacity
          className="relative h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-200 bg-white"
          onPress={() => router.push(APP_ROUTES.adminMessages)}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons
            name="email-outline"
            size={20}
            color="#64748b"
          />
          {unreadCount > 0 && (
            <View className="absolute -right-1.5 -top-1.5 min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-blue-500 px-1.5 py-px">
              <Text className="text-[10px] font-extrabold text-white">
                {unreadCount > 99 ? "99+" : String(unreadCount)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {onRefresh && (
          <TouchableOpacity
            className="h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-200 bg-white"
            onPress={onRefresh}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={20} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="flex-1 bg-[#0b1220]">
        <View className="absolute inset-0 bg-[#0b1220]" />

        {/* Drawer */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              zIndex: 0,
              width: drawerWidth,
              paddingTop: topPad,
              backgroundColor: "#ffffff",
              borderWidth: 0.5,
              borderColor: "#dceee3",
            },
            drawerSide,
            drawerAnim,
          ]}
        >
          <DrawerContent {...drawerProps} closeDrawer={closeDrawer} onEditProfile={openEditName} />
        </Animated.View>

        {/* Main Content */}
        <GestureDetector gesture={mainPan}>
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1,
              },
              mainAnim,
            ]}
            className="bg-white"
          >
            <View
              className="flex-1 bg-white px-[18px]"
              style={{ paddingTop: contentTopPad }}
            >
              <PageHeader withMenuBtn={true} />
              {loading ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator size="large" color="#16a34a" />
                </View>
              ) : (
                <ScrollView
                  className="flex-1"
                  contentContainerStyle={{ paddingBottom: 32 }}
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>
              )}
            </View>

            {/* Dim Overlay */}
            <Animated.View
              style={[
                overlayAnim,
                {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 100,
                },
              ]}
              pointerEvents={isOpen ? "auto" : "none"}
            >
              <Pressable className="absolute inset-0" onPress={closeDrawer} />
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        {/* Edge Gesture Area */}
        <GestureDetector gesture={edgePan}>
          <View
            className="absolute top-0 bottom-0 z-50"
            style={edgeSide}
            pointerEvents="box-only"
          />
        </GestureDetector>
      </View>

      {/* Admin name edit modal */}
      <Modal visible={editNameModal} transparent animationType="fade" onRequestClose={() => setEditNameModal(false)}>
        <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.45)", alignItems:"center", justifyContent:"center", paddingHorizontal:24 }}>
          <View style={{ backgroundColor:"#fff", borderRadius:20, padding:24, width:"100%", maxWidth:400 }}>
            <Text style={{ fontSize:16, fontWeight:"700", color:"#111827", marginBottom:16 }}>{t("drawer.editProfile")}</Text>
            <Text style={{ fontSize:12, color:"#6b7280", fontWeight:"600", marginBottom:6 }}>{t("drawer.firstName") + " / " + t("drawer.lastName")}</Text>
            <TextInput
              style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:12, paddingHorizontal:14, paddingVertical:12, fontSize:14, color:"#111827", backgroundColor:"#f9fafb" }}
              value={newName}
              onChangeText={v => { setNewName(v); setNameError(""); }}
              placeholder="Ex: Jean Dupont"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
            />
            {!!nameError && <Text style={{ color:"#ef4444", fontSize:12, marginTop:6 }}>{nameError}</Text>}
            <View style={{ flexDirection:"row", gap:10, marginTop:20 }}>
              <TouchableOpacity style={{ flex:1, paddingVertical:13, borderRadius:12, borderWidth:1, borderColor:"#e5e7eb", alignItems:"center", backgroundColor:"#f9fafb" }} onPress={() => setEditNameModal(false)} activeOpacity={0.8}>
                <Text style={{ fontSize:14, fontWeight:"600", color:"#6b7280" }}>{t("drawer.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex:1, paddingVertical:13, borderRadius:12, alignItems:"center", backgroundColor:"#16a34a", opacity: savingName ? 0.7 : 1 }} onPress={handleSaveName} disabled={savingName} activeOpacity={0.85}>
                {savingName ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize:14, fontWeight:"700", color:"#fff" }}>{t("drawer.save")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}