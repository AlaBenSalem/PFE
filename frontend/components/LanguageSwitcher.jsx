import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LANGUAGE_OPTIONS, useLanguage } from "@context/LanguageContext";

export function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage } = useLanguage();
  const current = LANGUAGE_OPTIONS.find((option) => option.code === language);

  return (
    <View className="absolute right-4 top-[58px] z-50">
      <TouchableOpacity
        className="flex-row items-center rounded-2xl border border-slate-200 bg-white/95 px-3 py-2"
        onPress={() => setIsOpen((prev) => !prev)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons
          name="translate"
          size={18}
          color="#374151"
          style={{ marginRight: 8 }}
        />
        <Text className="text-xs font-semibold text-slate-700">
          {current?.short || "FR"}
        </Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={14}
          color="#9ca3af"
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>

      {isOpen && (
        <View className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {LANGUAGE_OPTIONS.map((option) => {
            const active = language === option.code;
            return (
              <TouchableOpacity
                key={option.code}
                className={`flex-row items-center justify-between px-3 py-2.5 ${
                  active ? "bg-green-50" : "bg-white"
                }`}
                onPress={() => {
                  setLanguage(option.code);
                  setIsOpen(false);
                }}
                activeOpacity={0.8}
              >
                <Text
                  className={`text-sm ${
                    active
                      ? "font-semibold text-green-700"
                      : "font-medium text-slate-700"
                  }`}
                >
                  {option.label}
                </Text>
                {active && <Ionicons name="checkmark" size={16} color="#16a34a" />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
