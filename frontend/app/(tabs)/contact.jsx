import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { BrandHeader } from "@components/BrandHeader";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { authAPI } from "@api/auth";
import { useLanguage } from "@context/LanguageContext";
import { SafeScreen } from "@components/SafeScreen";

const COLORS = {
  greenDark: "#16a34a",
  greenSoft: "#e8f8ed",
  muted: "#64748b",
  border: "#e2e8f0",
};

const SPRING = { damping: 16, stiffness: 220, mass: 0.8 };

export default function ContactAdmin() {
  const { t, isRTL } = useLanguage();
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const iconScale = useSharedValue(1);
  const iconRotate = useSharedValue(0);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${iconRotate.value}deg` },
      { scale: iconScale.value },
    ],
  }));

  const animateSend = () => {
    iconRotate.value = withSpring(-10, SPRING, () => {
      iconRotate.value = withSpring(0, SPRING);
    });
    iconScale.value = withSpring(1.12, SPRING, () => {
      iconScale.value = withSpring(1, SPRING);
    });
  };

  const loadProfile = async () => {
    try {
      const user = await authAPI.getUser();
      const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
      setProfile({
        name: name || user?.email || "",
        email: user?.email || "",
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
    iconScale.value = withSpring(1.08, SPRING, () => {
      iconScale.value = withSpring(1, SPRING);
    });
  }, []);

  const canSend = useMemo(() => body.trim().length >= 10 && !sending, [body, sending]);

  const onSend = async () => {
    const trimmedBody = body.trim();
    const trimmedSubject = subject.trim();

    if (trimmedBody.length < 10) {
      Alert.alert(t("common.error"), t("messages.tooShort"));
      return;
    }

    setSending(true);
    animateSend();

    try {
      const res = await apiFetch(API_ENDPOINTS.messages.create, {
        method: "POST",
        body: JSON.stringify({
          subject: trimmedSubject,
          body: trimmedBody,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || json?.error || "Erreur envoi.");
      }

      setSubject("");
      setBody("");
      Alert.alert(t("messages.sentTitle"), t("messages.sentBody"));
    } catch (error) {
      const isTimeout = error?.name === "AbortError" || error?.name === "TimeoutError";
      Alert.alert(
        t("common.error"),
        isTimeout
          ? "Serveur en démarrage. Veuillez réessayer dans quelques instants."
          : error.message || "Erreur envoi."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeScreen className="flex-1 bg-[#F4F6F8]">
      <BrandHeader
        title={t("messages.contactTitle")}
        showMenu
        right={
          <Animated.View style={iconStyle}>
            <View className="h-[34px] rounded-full border border-slate-200 bg-green-50 px-2.5 items-center justify-center">
              <Ionicons name="mail-outline" size={18} color={COLORS.greenDark} />
            </View>
          </Animated.View>
        }
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            className="rounded-[18px] border bg-white p-4"
            style={{
              borderColor: COLORS.border,
              shadowColor: "#000",
              shadowOpacity: 0.06,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 2,
            }}
          >
            <Text
              className="text-lg font-extrabold text-slate-900"
              style={{ textAlign: isRTL ? "right" : "left" }}
            >
              {t("messages.writeToAdmin")}
            </Text>
            <Text
              className="mt-1 text-[13px] leading-[18px] text-slate-500"
              style={{ textAlign: isRTL ? "right" : "left" }}
            >
              {t("messages.subtitle")}
            </Text>

            <View className="mt-3 flex-row items-center gap-2 rounded-[14px] border border-slate-100 bg-slate-50 px-3 py-2.5">
              <Ionicons name="person-circle-outline" size={18} color={COLORS.muted} />
              {loadingProfile ? (
                <ActivityIndicator size="small" color={COLORS.muted} />
              ) : (
                <Text className="min-w-0 flex-1 text-[13px] text-slate-900" numberOfLines={1}>
                  {profile.name || t("messages.unknownUser")}
                  {profile.email ? `  •  ${profile.email}` : ""}
                </Text>
              )}
            </View>

            <Text
              className="mb-1.5 mt-3.5 text-[13px] font-bold text-slate-900"
              style={{ textAlign: isRTL ? "right" : "left" }}
            >
              {t("messages.subject")}
            </Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder={t("messages.subjectPlaceholder")}
              placeholderTextColor="#94a3b8"
              className="rounded-[14px] border bg-white px-3 py-2.5 text-sm text-slate-900"
              style={{
                borderColor: COLORS.border,
                textAlign: isRTL ? "right" : "left",
              }}
              maxLength={140}
            />

            <Text
              className="mb-1.5 mt-3.5 text-[13px] font-bold text-slate-900"
              style={{ textAlign: isRTL ? "right" : "left" }}
            >
              {t("messages.message")}
            </Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={t("messages.messagePlaceholder")}
              placeholderTextColor="#94a3b8"
              className="min-h-[130px] rounded-[14px] border bg-white px-3 py-3 text-sm text-slate-900"
              style={{
                borderColor: COLORS.border,
                textAlign: isRTL ? "right" : "left",
              }}
              multiline
              textAlignVertical="top"
              maxLength={5000}
            />

            <TouchableOpacity
              onPress={onSend}
              disabled={!canSend}
              activeOpacity={0.9}
              className={`mt-4 h-12 items-center justify-center rounded-[14px] bg-green-600 ${
                isRTL ? "flex-row-reverse" : "flex-row"
              }`}
              style={{
                gap: 10,
                opacity: canSend ? 1 : 0.55,
                shadowColor: COLORS.greenDark,
                shadowOpacity: 0.22,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 2,
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
              <Text className="text-sm font-extrabold tracking-[0.2px] text-white">
                {sending ? t("messages.sending") : t("messages.send")}
              </Text>
            </TouchableOpacity>

            <View className="mt-3 flex-row items-center gap-2">
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color={COLORS.muted}
              />
              <Text className="min-w-0 flex-1 text-xs leading-4 text-slate-500">
                {t("messages.hint")}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}
