import { useSettings } from "@/features/settings/context/SettingsContext";
import type { AppLanguage } from "@/features/settings/types";
import { TRANSLATIONS, type TranslationDictionary } from "./translations";

export interface UseTranslationReturn {
  language: AppLanguage;
  t: TranslationDictionary;
  setLanguage: (lang: AppLanguage) => void;
}

export function useTranslation(): UseTranslationReturn {
  const settingsContext = useSettings();
  const language: AppLanguage =
    settingsContext?.settings?.language === "en" ? "en" : "es";

  const setLanguage = (lang: AppLanguage) => {
    settingsContext?.updateSetting?.("language", lang);
  };

  return {
    language,
    t: TRANSLATIONS[language],
    setLanguage,
  };
}
