import { Platform } from "react-native";

const iosFonts = {
  regular: "Avenir Next",
};

const androidFonts = {
  regular: "sans-serif",
};

const webFonts = {
  regular: "Inter, Segoe UI, Arial, sans-serif",
};

export const AppFonts = Platform.select({
  ios: iosFonts,
  android: androidFonts,
  web: webFonts,
  default: androidFonts,
});
