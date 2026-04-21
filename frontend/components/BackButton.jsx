import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useLanguage } from "@context/LanguageContext";

export function BackButton({
  onPress,
  style,
  iconColor = "#16a34a",
  size = 40,
  variant = "soft",
}) {
  let isRTL = false;
  try {
    // LanguageProvider is mounted at app root; this is safe in the app.
    // Still wrapped in try/catch to keep the component usable in isolation.
    isRTL = useLanguage()?.isRTL === true;
  } catch {}

  const iconName = isRTL ? "chevron-forward" : "chevron-back";
  const bg = variant === "surface" ? "#ffffff" : "#f8fafc";
  const border = variant === "surface" ? "#e5e7eb" : "#e2e8f0";

  return (
    <Pressable
      onPress={onPress || (() => router.back())}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={10}
      className="mb-[18px] items-center justify-center border shadow-sm"
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: Math.max(12, Math.round(size * 0.36)),
          backgroundColor: bg,
          borderColor: border,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 2,
          transform: [{ scale: pressed ? 0.96 : 1 }],
          opacity: pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={iconName} size={20} color={iconColor} />
    </Pressable>
  );
}
