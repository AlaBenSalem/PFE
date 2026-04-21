import { useEffect } from "react";
import { View, Image, Platform } from "react-native";
import { router } from "expo-router";
import { APP_ROUTES, AUTH_ROUTES } from "@constants/routes";
import { useSession } from "@hooks/useSession";

export default function SplashScreen() {
  const { isLoading, isAuthenticated } = useSession();

  useEffect(() => {
    if (isLoading) return undefined;

    const timer = setTimeout(() => {
      router.replace(isAuthenticated ? APP_ROUTES.home : AUTH_ROUTES.login);
    }, 2500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading]);

  const isWeb = Platform.OS === "web";

  return (
    <View className="flex-1 bg-white">
      <Image
        source={
          isWeb
            ? require("../../assets/images/homeweb.png")
            : require("../../assets/images/homemob.png")
        }
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
        resizeMode="cover"
      />
    </View>
  );
}