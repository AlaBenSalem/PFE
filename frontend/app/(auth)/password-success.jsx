import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useLanguage } from "@context/LanguageContext";
import { SafeScreen } from "@components/SafeScreen";

export default function PasswordSuccessScreen() {
  const { t } = useLanguage();

  return (
    <SafeScreen>
      <View className="flex-1 items-center justify-center bg-white px-6 py-4">
        <View className="mb-8 h-28 w-28 items-center justify-center rounded-full bg-green-300">
          <Text className="text-4xl font-bold text-green-700">OK</Text>
        </View>
        <Text className="mb-3 text-center text-2xl font-bold text-slate-800">
          {t("passwordSuccess.title")}
        </Text>
        <Text className="mb-1 text-center text-base text-slate-500">
          {t("passwordSuccess.line1")}
        </Text>
        <Text className="text-center text-base text-slate-500">
          {t("passwordSuccess.line2")}
        </Text>
        <TouchableOpacity
          className="mt-9 w-full items-center rounded-full bg-green-500 px-8 py-4"
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text className="text-base font-bold text-white">
            {t("passwordSuccess.continue")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
}
