import { View, Image, Text } from "react-native";
import logoImage from "@assets/images/logo.png";

const SIZE_MAP = {
  xs: { logoWidth: 72, logoHeight: 44, wordmarkSize: 22 },
  sm: { logoWidth: 140, logoHeight: 84, wordmarkSize: 40 },
  md: { logoWidth: 180, logoHeight: 108, wordmarkSize: 48 },
  lg: { logoWidth: 220, logoHeight: 132, wordmarkSize: 56 },
};

export function Logo({ size = "md", withWordmark = true, compact = false }) {
  const selected = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <View className={`items-center ${compact ? "" : "mb-8"}`}>
      {withWordmark ? (
        <View className="flex-row items-end -mb-0.5">
          <Text
            style={{
              fontSize: selected.wordmarkSize,
              lineHeight: selected.wordmarkSize,
            }}
            className="text-[#4CAF50] font-semibold tracking-tight"
          >
            Smart
          </Text>
          <Text
            style={{
              fontSize: selected.wordmarkSize,
              lineHeight: selected.wordmarkSize,
            }}
            className="text-[#2196F3] font-semibold tracking-tight"
          >
            Irrig
          </Text>
        </View>
      ) : null}

      <Image
        source={logoImage}
        style={{ width: selected.logoWidth, height: selected.logoHeight }}
        resizeMode="contain"
      />
    </View>
  );
}
