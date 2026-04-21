const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  "@components": path.resolve(__dirname, "components"),
  "@api": path.resolve(__dirname, "api"),
  "@context": path.resolve(__dirname, "context"),
  "@hooks": path.resolve(__dirname, "hooks"),
  "@utils": path.resolve(__dirname, "utils"),
  "@constants": path.resolve(__dirname, "constants"),
  "@assets": path.resolve(__dirname, "assets"),
};

module.exports = withNativeWind(config, { input: "./global.css" });
