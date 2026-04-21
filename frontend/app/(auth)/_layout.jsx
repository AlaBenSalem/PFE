import { Stack } from "expo-router";
import { SafeScreen } from "@components/SafeScreen";

export default function AuthLayout() {
  return (
    <SafeScreen>
      <Stack
        initialRouteName="login"
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
          contentStyle: { backgroundColor: "#ffffff" },
        }}
      >
        <Stack.Screen name="index" options={{ href: null }} />
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="confirm-code" />
        <Stack.Screen name="new-password" />
        <Stack.Screen name="password-success" />
      </Stack>
    </SafeScreen>
  );
}
