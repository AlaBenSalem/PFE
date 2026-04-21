// components/BrandHeader.jsx
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useOptionalDrawer } from "./AppDrawerContext";
import logoImage from "@assets/images/logo.png";

export function BrandHeader({
  title,
  right,
  variant = "surface",
  showMenu = false,
  onMenuPress,
}) {
  const drawer = useOptionalDrawer();
  const shouldShowMenu = (showMenu || Boolean(drawer)) && !drawer?.persistent;
  const handleMenuPress = onMenuPress || drawer?.toggleDrawer;

  return (
    <View
      className={`px-4 pb-2.5 pt-1.5 ${
        variant === "transparent" ? "bg-transparent" : "bg-white"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          {shouldShowMenu ? (
            <TouchableOpacity
              className="h-[34px] w-[34px] items-center justify-center rounded-xl border border-slate-200 bg-green-50"
              onPress={handleMenuPress}
              activeOpacity={0.85}
            >
              <Ionicons
                name={drawer?.isOpen ? "close" : "menu"}
                size={20}
                color="#16a34a"
              />
            </TouchableOpacity>
          ) : null}

          <View className="min-w-0 shrink flex-row items-center gap-2">
            <Image
              source={logoImage}
              style={{ height: 25, width: 30 }}
              resizeMode="contain"
            />
            <Text
              className="text-[19px] font-extrabold text-slate-900"
              numberOfLines={1}
            >
              <Text className="text-green-500">Smart</Text>
              <Text className="text-blue-500">Irrig</Text>
            </Text>
          </View>
        </View>

        {right ? (
          <View className="ml-3 shrink-0 items-center justify-center">
            {right}
          </View>
        ) : null}
      </View>

      {title ? (
        <Text className="mt-2 text-lg font-bold leading-[22px] text-slate-900">
          {title}
        </Text>
      ) : null}
    </View>
  );
}
