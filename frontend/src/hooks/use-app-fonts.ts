import Constants, { ExecutionEnvironment } from "expo-constants";
import { useFonts } from "expo-font";

// Load Barlow Condensed (display) + Manrope (body) from fontsource CDN.
// Non-blocking: if the CDN is unreachable the app still boots with system fonts.
const cdn = (family: string, weight: string) =>
  `https://cdn.jsdelivr.net/fontsource/fonts/${family}@latest/latin-${weight}-normal.ttf`;

const APP_FONTS: Record<string, string> = {
  "BarlowCondensed-Medium": cdn("barlow-condensed", "500"),
  "BarlowCondensed-SemiBold": cdn("barlow-condensed", "600"),
  "BarlowCondensed-Bold": cdn("barlow-condensed", "700"),
  "Manrope-Regular": cdn("manrope", "400"),
  "Manrope-Medium": cdn("manrope", "500"),
  "Manrope-SemiBold": cdn("manrope", "600"),
  "Manrope-Bold": cdn("manrope", "700"),
};

export const useAppFonts = (): readonly [boolean, Error | null] =>
  useFonts(
    // Web can't reliably preload remote ttf via expo-font; skip and fall back.
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
      Constants.executionEnvironment === ExecutionEnvironment.Standalone
      ? APP_FONTS
      : APP_FONTS
  );
