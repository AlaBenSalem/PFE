import { useEffect, useRef } from "react";
import { View, Text, Animated, Image, StyleSheet } from "react-native";
import { router } from "expo-router";
import { AUTH_ROUTES } from "@constants/routes";

export default function AnimatedSplash() {

  const scale = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  // Fade-in on mount
  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Continuous pulse on logo
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.18,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Redirect to login after animation (login handles auth state)
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(AUTH_ROUTES.login);
    }, 2600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Pulsing logo */}
      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: logoOpacity, transform: [{ scale }] },
        ]}
      >
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* App name + tagline */}
      <Animated.View style={{ opacity: textOpacity, alignItems: "center" }}>
        <Text style={styles.title}>SmartIrrig</Text>
        <Text style={styles.subtitle}>Agriculture intelligente</Text>
      </Animated.View>

      {/* Dots loader */}
      <Animated.View style={[styles.dotsRow, { opacity: textOpacity }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.dot} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#15803d",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  logoWrapper: {
    width: 130,
    height: 130,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  logo: {
    width: 90,
    height: 90,
  },
  title: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginTop: 4,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
});
