import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Logo } from "@components/Logo";
import { BackButton } from "@components/BackButton";
import { authAPI } from "@api/auth";
import { useLanguage } from "@context/LanguageContext";
import { SafeScreen } from "@components/SafeScreen";

export default function ForgotPasswordScreen() {
  const { t, isRTL } = useLanguage();
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [sent, setSent]       = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email.trim()) {
      setError(t("forgotPassword.emailRequired"));
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword({ email: email.trim().toLowerCase() });
      setSent(true);
      setTimeout(() => {
        router.push({ pathname: "/(auth)/confirm-code", params: { email } });
      }, 1200);
    } catch (err) {
      setError(err?.message || t("forgotPassword.unexpectedError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeScreen>
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="flex-1 px-6 pb-6 pt-3">
          <BackButton />

          {/* Logo compact */}
          <Logo compact />

          {/* Icône centrale */}
          <View className="items-center mb-6 mt-2">
            <View className="h-16 w-16 rounded-2xl bg-green-50 items-center justify-center mb-4">
              <Ionicons name="lock-closed-outline" size={32} color="#16a34a" />
            </View>
            <Text
              className="text-xl font-bold text-slate-900 mb-1"
              style={{ textAlign: isRTL ? "right" : "center" }}
            >
              {t("forgotPassword.title")}
            </Text>
            <Text
              className="text-sm text-slate-500 leading-5 px-4"
              style={{ textAlign: "center" }}
            >
              {t("forgotPassword.subtitle")}
            </Text>
          </View>

          {/* Champ e-mail */}
          <View className="mb-5">
            <Text
              className="text-sm font-semibold text-slate-700 mb-2"
              style={{ textAlign: isRTL ? "right" : "left" }}
            >
              {t("forgotPassword.emailLabel")}
            </Text>
            <View className="relative">
              <View
                className="absolute z-10 justify-center h-full"
                style={{ [isRTL ? "right" : "left"]: 14 }}
                pointerEvents="none"
              >
                <Ionicons name="mail-outline" size={18} color="#9ca3af" />
              </View>
              <TextInput
                className="rounded-xl border bg-slate-50 py-[14px] pr-4 text-sm text-slate-900"
                style={{
                  textAlign: isRTL ? "right" : "left",
                  [isRTL ? "paddingRight" : "paddingLeft"]: 44,
                  borderColor: error ? "#ef4444" : "#e5e7eb",
                }}
                placeholder={t("forgotPassword.emailPlaceholder")}
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(v) => { setEmail(v); setError(""); }}
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
              />
            </View>

            {/* Erreur */}
            {!!error && (
              <View className="mt-2 flex-row items-center gap-1.5">
                <Ionicons name="alert-circle" size={14} color="#ef4444" />
                <Text className="text-[12px] text-red-500 flex-1">{error}</Text>
              </View>
            )}
          </View>

          {/* Bouton principal */}
          <TouchableOpacity
            className="items-center justify-center rounded-full py-[15px] mb-4"
            style={{
              backgroundColor: sent ? "#22c55e" : "#16a34a",
              opacity: loading ? 0.75 : 1,
            }}
            onPress={handleSubmit}
            disabled={loading || sent}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : sent ? (
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text className="text-base font-bold text-white">
                  {t("forgotPassword.sending")}
                </Text>
              </View>
            ) : (
              <Text className="text-base font-bold text-white">
                {t("forgotPassword.sendButton")}
              </Text>
            )}
          </TouchableOpacity>

          {/* Retour connexion */}
          <TouchableOpacity
            className="items-center py-2 flex-row justify-center gap-1.5"
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={14} color="#6b7280" />
            <Text className="text-sm text-slate-500">
              {t("forgotPassword.backToLogin")}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}