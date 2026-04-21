import { useRef, useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Logo } from "@components/Logo";
import { BackButton } from "@components/BackButton";
import { authAPI } from "@api/auth";
import { useLanguage } from "@context/LanguageContext";
import { SafeScreen } from "@components/SafeScreen";

const CODE_LENGTH = 6;

export default function ConfirmCodeScreen() {
  const { t } = useLanguage();
  const { email } = useLocalSearchParams();
  const safeEmail = Array.isArray(email) ? email[0] : email;

  const [code, setCode]       = useState(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent]   = useState(false);
  const inputs = useRef([]);

  const handleChange = (text, index) => {
    // Gérer coller (paste) d'un code complet
    if (text.length > 1) {
      const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH).split("");
      const next = [...code];
      digits.forEach((d, i) => { if (index + i < CODE_LENGTH) next[index + i] = d; });
      setCode(next);
      setError("");
      const focusIdx = Math.min(index + digits.length, CODE_LENGTH - 1);
      inputs.current[focusIdx]?.focus();
      return;
    }
    const next = [...code];
    next[index] = text;
    setCode(next);
    setError("");
    if (text && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (event, index) => {
    if (event?.nativeEvent?.key === "Backspace" && !code[index] && index > 0) {
      const next = [...code];
      next[index - 1] = "";
      setCode(next);
      inputs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    setError("");
    const fullCode = code.join("");
    if (!safeEmail) { setError(t("confirmCode.emailMissing")); return; }
    if (fullCode.length < CODE_LENGTH) { setError(t("confirmCode.codeIncomplete")); return; }

    setLoading(true);
    try {
      await authAPI.verifyCode({ email: safeEmail, code: fullCode });
      router.push({ pathname: "/(auth)/new-password", params: { email: safeEmail, code: fullCode } });
    } catch (err) {
      setError(err?.message || t("confirmCode.invalidCode"));
      // Effacer les cases en cas d'erreur
      setCode(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!safeEmail) return;
    setResending(true);
    setError("");
    try {
      await authAPI.forgotPassword({ email: safeEmail });
      setResent(true);
      setCode(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
      setTimeout(() => setResent(false), 3000);
    } catch (err) {
      setError(err?.message || t("forgotPassword.unexpectedError"));
    } finally {
      setResending(false);
    }
  };

  const isFilled = code.every((d) => d !== "");

  return (
    <SafeScreen>
      <View className="flex-1 bg-white px-6 pb-6 pt-3">
        <BackButton />
        <Logo compact />

        {/* Icône + titre */}
        <View className="items-center mb-8 mt-2">
          <View className="h-16 w-16 rounded-2xl bg-green-50 items-center justify-center mb-4">
            <Ionicons name="shield-checkmark-outline" size={32} color="#16a34a" />
          </View>
          <Text className="text-xl font-bold text-slate-900 mb-1">
            {t("confirmCode.title")}
          </Text>
          <Text className="text-sm text-slate-500 text-center leading-5 px-2">
            {t("confirmCode.subtitle")}
          </Text>
          {!!safeEmail && (
            <View className="mt-2 flex-row items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full">
              <Ionicons name="mail-outline" size={13} color="#64748b" />
              <Text className="text-[12px] font-medium text-slate-600">{safeEmail}</Text>
            </View>
          )}
        </View>

        {/* Cases OTP */}
        <View className="flex-row justify-center gap-2.5 mb-3">
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputs.current[index] = ref; }}
              className="rounded-2xl border-2 text-center text-2xl font-bold text-slate-900"
              style={{
                width: 46,
                height: 56,
                borderColor: error
                  ? "#ef4444"
                  : digit
                  ? "#16a34a"
                  : index === code.findIndex((d) => d === "")
                  ? "#94a3b8"
                  : "#e5e7eb",
                backgroundColor: digit ? "#f0fdf4" : "#f8fafc",
              }}
              maxLength={6}
              keyboardType="number-pad"
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(event) => handleKeyPress(event, index)}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Erreur ou succès renvoi */}
        <View className="h-7 items-center justify-center mb-4">
          {!!error && (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="alert-circle" size={14} color="#ef4444" />
              <Text className="text-[12px] text-red-500">{error}</Text>
            </View>
          )}
          {resent && !error && (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
              <Text className="text-[12px] text-green-600">{t("confirmCode.resend")} ✓</Text>
            </View>
          )}
        </View>

        {/* Bouton confirmer */}
        <TouchableOpacity
          className="items-center justify-center rounded-full py-[15px] mb-4"
          style={{
            backgroundColor: isFilled ? "#16a34a" : "#e5e7eb",
            opacity: loading ? 0.75 : 1,
          }}
          onPress={handleSubmit}
          disabled={loading || !isFilled}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={isFilled ? "#fff" : "#9ca3af"} />
          ) : (
            <Text
              className="text-base font-bold"
              style={{ color: isFilled ? "#fff" : "#9ca3af" }}
            >
              {t("confirmCode.confirmBtn")}
            </Text>
          )}
        </TouchableOpacity>

        {/* Renvoyer le code */}
        <TouchableOpacity
          className="items-center py-2 flex-row justify-center gap-1.5"
          onPress={handleResend}
          disabled={resending}
          activeOpacity={0.7}
        >
          {resending ? (
            <ActivityIndicator size="small" color="#6b7280" />
          ) : (
            <Ionicons name="refresh" size={14} color="#6b7280" />
          )}
          <Text className="text-sm text-slate-500">
            {t("confirmCode.resend")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
}