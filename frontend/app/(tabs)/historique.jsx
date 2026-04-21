import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeScreen } from "@components/SafeScreen";
import { Ionicons } from "@expo/vector-icons";
import { BrandHeader } from "@components/BrandHeader";
import { useLanguage } from "@context/LanguageContext";
import UserActivityLog from "@components/UserActivityLog";

export default function IrrigationHistoryPage() {
  const { t } = useLanguage();

  return (
    <SafeScreen className="flex-1 bg-[#f5f5f5]">
      <BrandHeader title={t("history.title")} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <UserActivityLog maxItems={15} showClear />

        <View className="items-center rounded-2xl border border-[#edf1f0] bg-white p-6">
          <View className="mb-3">
            <Ionicons name="water" size={36} color="#4CAF50" />
          </View>
          <Text className="mb-2 text-base font-bold text-gray-900">
            {t("history.irrigationHistory")}
          </Text>
          <Text className="text-center text-sm text-slate-500">
            {t("history.empty")}
          </Text>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}