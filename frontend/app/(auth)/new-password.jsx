import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BackButton } from "@components/BackButton";
import { authAPI } from "@api/auth";
import { useLanguage } from "@context/LanguageContext";
import { SafeScreen } from "@components/SafeScreen";

export default function NewPasswordScreen() {
  const { t, isRTL } = useLanguage();
  const { email, code } = useLocalSearchParams();
  const safeEmail = Array.isArray(email) ? email[0] : email;
  const safeCode = Array.isArray(code) ? code[0] : code;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      Alert.alert(t("common.errorTitle"), t("newPassword.fillFields"));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t("common.errorTitle"), t("newPassword.mismatch"));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t("common.errorTitle"), t("newPassword.minLength"));
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword({
        email: safeEmail,
        code: safeCode,
        newPassword: password,
      });
      router.replace("/(auth)/password-success");
    } catch (error) {
      Alert.alert(
        t("common.errorTitle"),
        error?.message || t("newPassword.unexpectedError"),
      );
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
        <View className="flex-1 px-6 pb-4 pt-2.5">
          <BackButton />

          <Text className="mb-6 text-2xl font-bold text-slate-800">
            {t("newPassword.title")}
          </Text>

          <Text className="mb-1 text-sm font-medium text-slate-700">
            {t("newPassword.createPassword")}
          </Text>
          <View className="relative mb-[18px]">
            <TextInput
              className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-slate-800"
              style={{ textAlign: isRTL ? "right" : "left" }}
              placeholder="........"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              className="absolute bottom-0 right-3 top-0 justify-center"
              onPress={() => setShowPassword((value) => !value)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          <Text className="mb-1 text-sm font-medium text-slate-700">
            {t("newPassword.confirmPassword")}
          </Text>
          <View className="relative mb-7">
            <TextInput
              className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-slate-800"
              style={{ textAlign: isRTL ? "right" : "left" }}
              placeholder="........"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              className="absolute bottom-0 right-3 top-0 justify-center"
              onPress={() => setShowConfirm((value) => !value)}
            >
              <Ionicons
                name={showConfirm ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className="items-center rounded-full bg-green-500 py-4"
            style={loading ? { opacity: 0.7 } : undefined}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text className="text-base font-bold text-white">
              {loading ? t("newPassword.submitLoading") : t("common.confirm")}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}
