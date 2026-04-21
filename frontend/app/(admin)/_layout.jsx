import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { APP_ROUTES, AUTH_ROUTES } from "@constants/routes";
import { useSession } from "@hooks/useSession";

export default function AdminLayout() {
  const { isAuthenticated, isLoading, role } = useSession();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={AUTH_ROUTES.login} />;
  }

  if (role !== "admin") {
    return <Redirect href={APP_ROUTES.home} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
