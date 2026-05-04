import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { translations as baseTranslations } from "@constants/translations";
import { AUTH_TRANSLATIONS } from "@constants/authTranslations";

const SUPPORTED_LANGUAGES = ["fr", "en", "ar", "tr"];
const FALLBACK_LANGUAGE = "fr";
const LANGUAGE_STORAGE_KEY = "userLanguage";

export const LANGUAGE_OPTIONS = [
  { code: "fr", short: "FR", label: "Francais" },
  { code: "en", short: "EN", label: "English" },
  { code: "ar", short: "AR", label: "Arabic" },
  { code: "tr", short: "TR", label: "Turkish" },
];

function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override || {})) {
    if (
      typeof override[key] === "object" &&
      override[key] !== null &&
      !Array.isArray(override[key]) &&
      typeof base[key] === "object" &&
      base[key] !== null
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

const TRANSLATIONS = SUPPORTED_LANGUAGES.reduce((accumulator, languageCode) => {
  accumulator[languageCode] = deepMerge(
    baseTranslations[languageCode] || {},
    AUTH_TRANSLATIONS[languageCode] || {}
  );
  return accumulator;
}, {});

const LanguageContext = createContext(null);

function getValueByPath(object, path) {
  return path.split(".").reduce((accumulator, key) => accumulator?.[key], object);
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(FALLBACK_LANGUAGE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLanguage() {
      try {
        const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (storedLanguage && SUPPORTED_LANGUAGES.includes(storedLanguage)) {
          setLanguageState(storedLanguage);
        }
      } catch (error) {
        console.warn("Failed to load language:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadLanguage();
  }, []);

  const setLanguage = useCallback(async (nextLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) return;
    setLanguageState(nextLanguage);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch (error) {
      console.warn("Failed to save language:", error);
    }
  }, []);

  const value = useMemo(() => {
    const t = (key) => {
      const currentValue = getValueByPath(TRANSLATIONS[language], key);
      if (currentValue != null) return currentValue;
      const fallbackValue = getValueByPath(TRANSLATIONS[FALLBACK_LANGUAGE], key);
      return fallbackValue ?? key;
    };

    return {
      language,
      isRTL: language === "ar",
      isLoading,
      setLanguage,
      changeLanguage: setLanguage,
      t,
    };
  }, [isLoading, language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
