import { ActivityIndicator, Image, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { AppDrawer } from "@components/AppDrawer";
import { APP_ROUTES, AUTH_ROUTES } from "@constants/routes";
import { useSession } from "@hooks/useSession";
import { Ionicons } from "@expo/vector-icons";
import AIChatFAB from "@components/AIChatScreen";
import homeIcon from "@assets/images/greenhouse.png";
import culturesIcon from "@assets/images/agri.png";
import calendarIcon from "@assets/images/calendar.png";
import irrigationIcon from "@assets/images/irrigation.png";
import fertilisationIcon from "@assets/images/fertilisation.png";

const TAB_BAR_STYLE = {
  height: 70,
  backgroundColor: "#FFFFFF",
  borderTopWidth: 1,
  borderTopColor: "#E0E0E0",
  paddingBottom: 8,
  paddingTop: 8,
};

function TabIcon({ source, iconName, focused }) {
  if (iconName) {
    return (
      <Ionicons
        name={iconName}
        size={22}
        color={focused ? "#16a34a" : "#7A7A7A"}
        style={{ opacity: focused ? 1 : 0.7 }}
      />
    );
  }

  return (
    <Image
      source={source}
      resizeMode="contain"
      style={{
        width: 22,
        height: 22,
        opacity: focused ? 1 : 0.55,
        tintColor: focused ? "#16a34a" : "#7A7A7A",
      }}
    />
  );
}

export default function TabsLayout() {
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

  if (role === "admin") {
    return <Redirect href={APP_ROUTES.adminDashboard} />;
  }

  return (
    <AppDrawer>
      {/* ✅ Wrap in View so the FAB can be positioned absolutely over everything */}
      <View className="flex-1">
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: TAB_BAR_STYLE,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Home",
              tabBarIcon: ({ focused }) => (
                <TabIcon source={homeIcon} focused={focused} />
              ),
            }}
          />
          <Tabs.Screen
            name="cultures"
            options={{
              title: "Cultures",
              tabBarIcon: ({ focused }) => (
                <TabIcon source={culturesIcon} focused={focused} />
              ),
            }}
          />
          <Tabs.Screen
            name="calendar"
            options={{
              title: "Calendar",
              tabBarIcon: ({ focused }) => (
                <TabIcon source={calendarIcon} focused={focused} />
              ),
            }}
          />
          <Tabs.Screen
            name="irrigation"
            options={{
              title: "Irrigation",
              tabBarIcon: ({ focused }) => (
                <TabIcon source={irrigationIcon} focused={focused} />
              ),
            }}
          />
          <Tabs.Screen
            name="fertilisation"
            options={{
              title: "Fertilisation",
              tabBarIcon: ({ focused }) => (
                <TabIcon source={fertilisationIcon} focused={focused} />
              ),
            }}
          />
          <Tabs.Screen
            name="contact"
            options={{
              title: "Contact",
              tabBarIcon: ({ focused }) => (
                <TabIcon iconName="mail-outline" focused={focused} />
              ),
            }}
          />
          <Tabs.Screen
            name="historique"
            options={{
              href: null,
              title: "Historique",
            }}
          />
        </Tabs>

        {/* ✅ AI Floating Action Button — visible on ALL tabs */}
        <AIChatFAB />
      </View>
    </AppDrawer>
  );
}
