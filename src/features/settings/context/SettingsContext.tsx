import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { AppSettings, SettingsSectionId, ThemeDefinition, AppearanceConfigFile } from "../types";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "../constants";
import {
  findThemeById,
  applyThemeToDOM,
  validateCustomTheme,
  BUILTIN_THEMES,
  CODESTASH_ONEDARK_THEME,
} from "../themes";
import { configService } from "@/services/configService";

interface ImportThemeResult {
  success: boolean;
  name?: string;
  themeId?: string;
  count?: number;
  error?: string;
}

interface SettingsContextValue {
  settings: AppSettings;
  activeTheme: ThemeDefinition;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
  isSettingsOpen: boolean;
  openSettings: (section?: SettingsSectionId) => void;
  closeSettings: () => void;
  activeSection: SettingsSectionId;
  setActiveSection: (section: SettingsSectionId) => void;

  // Custom Theme & Config File Actions
  configFilePath: string;
  importCustomThemeFromFile: () => Promise<ImportThemeResult>;
  importCustomThemeFromText: (text: string) => Promise<ImportThemeResult>;
  deleteCustomTheme: (themeId: string) => void;
  reloadConfigFromFile: () => Promise<boolean>;
  openConfigFileLocation: () => Promise<void>;
  downloadThemeTemplate: () => void;
}

// Maintain a singleton context reference across Vite HMR re-evaluations
const globalContextScope = (typeof globalThis !== "undefined" ? globalThis : window) as Record<string, unknown>;
export const SettingsContext: React.Context<SettingsContextValue | undefined> =
  (globalContextScope.__CODESTASH_SETTINGS_CONTEXT__ as React.Context<SettingsContextValue | undefined>) ||
  ((globalContextScope.__CODESTASH_SETTINGS_CONTEXT__ =
    createContext<SettingsContextValue | undefined>(undefined)) as React.Context<SettingsContextValue | undefined>);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const filteredThemes = (Array.isArray(parsed.customThemes) ? parsed.customThemes : []).filter(
          (t: ThemeDefinition) => t.id !== "mi-tema-personalizado"
        );
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          language: parsed.language === "en" ? "en" : "es",
          theme:
            parsed.theme === "mi-tema-personalizado" || parsed.theme === "codestash-dark"
              ? DEFAULT_SETTINGS.theme
              : (parsed.theme || DEFAULT_SETTINGS.theme),
          customThemes: filteredThemes,
        };
      }
    } catch (e) {
      console.error("[SettingsContext] Failed to parse stored settings:", e);
    }
    return DEFAULT_SETTINGS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("appearance");
  const [configFilePath, setConfigFilePath] = useState<string>("appearance-config.json");

  // Compute the full active ThemeDefinition (from custom or built-in)
  const activeTheme = useMemo<ThemeDefinition>(() => {
    return findThemeById(settings.theme, settings.customThemes);
  }, [settings.theme, settings.customThemes]);

  // Apply theme to DOM and style variables whenever activeTheme, fontSize, or language changes
  useEffect(() => {
    applyThemeToDOM(activeTheme);

    const root = document.documentElement;
    root.lang = settings.language || "es";
    root.style.setProperty("--editor-font-size", `${settings.fontSize}px`);
    if (settings.fontFamily) {
      root.style.setProperty("--editor-font-family", settings.fontFamily);
    }

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error("[SettingsContext] Failed to persist settings to localStorage:", e);
    }
  }, [activeTheme, settings.fontSize, settings.fontFamily, settings.language, settings]);

  // Keep Electron native spellchecker language and enabled flag synchronized
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI?.setSpellCheckConfig) {
      return;
    }
    window.electronAPI
      .setSpellCheckConfig({
        enabled: settings.spellcheck,
        language: settings.language,
      })
      .catch((err) => {
        console.warn("[SettingsContext] Failed syncing spellchecker config:", err);
      });
  }, [settings.spellcheck, settings.language]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI?.onSpellCheckConfigChanged) {
      return;
    }
    return window.electronAPI.onSpellCheckConfigChanged(({ enabled }) => {
      setSettings((prev) =>
        prev.spellcheck === Boolean(enabled) ? prev : { ...prev, spellcheck: Boolean(enabled) }
      );
    });
  }, []);

  const lastSavedConfigJsonRef = useRef<string>("");

  // Initial load from appearance-config.json file
  useEffect(() => {
    let mounted = true;

    async function initConfigFile() {
      const detectedPath = await configService.getConfigFilePath();
      if (mounted) {
        setConfigFilePath(detectedPath);
      }

      const fileConfig = await configService.loadAppearanceConfig();
      if (fileConfig && mounted) {
        const mergedCustom = [
          ...(settings.customThemes || []),
          ...(fileConfig.customThemes || []),
        ].filter((t) => t.id !== "mi-tema-personalizado");
        const uniqueCustom = Array.from(
          new Map(mergedCustom.map((t) => [t.id, t])).values()
        );

        const loadedTheme =
          fileConfig.theme === "mi-tema-personalizado" || fileConfig.theme === "codestash-dark"
            ? DEFAULT_SETTINGS.theme
            : (fileConfig.theme || settings.theme);

        const loadedLanguage =
          fileConfig.language === "en" || fileConfig.language === "es"
            ? fileConfig.language
            : settings.language;

        const loadedSettings: AppearanceConfigFile = {
          theme: loadedTheme,
          fontSize: fileConfig.fontSize || settings.fontSize,
          fontFamily: fileConfig.fontFamily || settings.fontFamily,
          language: loadedLanguage,
          customThemes: uniqueCustom,
        };

        // Mark as already saved on disk so we never trigger a redundant write
        lastSavedConfigJsonRef.current = JSON.stringify(loadedSettings);

        setSettings((prev) => ({
          ...prev,
          language: loadedLanguage,
          theme: loadedSettings.theme,
          fontSize: loadedSettings.fontSize,
          fontFamily: loadedSettings.fontFamily,
          customThemes: uniqueCustom,
        }));
      } else if (!fileConfig && mounted) {
        // Save initial appearance-config.json to app folder so user sees it right away
        const initialConfig: AppearanceConfigFile = {
          theme: settings.theme,
          fontSize: settings.fontSize,
          fontFamily: settings.fontFamily,
          language: settings.language,
          customThemes: settings.customThemes || [],
        };
        lastSavedConfigJsonRef.current = JSON.stringify(initialConfig);
        await configService.saveAppearanceConfig(initialConfig);
      }
    }

    initConfigFile();

    return () => {
      mounted = false;
    };
  }, []);

  // Save changes to appearance-config.json on updates (only when values actually change)
  useEffect(() => {
    const currentConfig: AppearanceConfigFile = {
      theme: settings.theme,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      language: settings.language,
      customThemes: settings.customThemes || [],
    };
    const currentConfigJson = JSON.stringify(currentConfig);

    // If disk already has this exact config, do nothing
    if (!lastSavedConfigJsonRef.current || currentConfigJson === lastSavedConfigJsonRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      lastSavedConfigJsonRef.current = currentConfigJson;
      await configService.saveAppearanceConfig(currentConfig);
    }, 500);

    return () => clearTimeout(timer);
  }, [settings.theme, settings.fontSize, settings.fontFamily, settings.language, settings.customThemes]);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const openSettings = useCallback((section: SettingsSectionId = "appearance") => {
    setActiveSection(section);
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  /**
   * Helper to parse and import theme(s) from a JSON string or object
   */
  const processThemePayload = useCallback(
    async (payload: unknown): Promise<ImportThemeResult> => {
      try {
        let parsed: unknown = payload;
        if (typeof payload === "string") {
          parsed = JSON.parse(payload);
        }

        if (!parsed || typeof parsed !== "object") {
          return { success: false, error: "El contenido JSON no es válido." };
        }

        const themesToAdd: ThemeDefinition[] = [];

        // Scenario 1: Array of themes
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const res = validateCustomTheme(item);
            if (res.valid && res.theme) {
              themesToAdd.push(res.theme);
            }
          }
        }
        // Scenario 2: AppearanceConfigFile containing customThemes
        else if ("customThemes" in (parsed as Record<string, unknown>)) {
          const cfg = parsed as AppearanceConfigFile;
          if (Array.isArray(cfg.customThemes)) {
            for (const item of cfg.customThemes) {
              const res = validateCustomTheme(item);
              if (res.valid && res.theme) {
                themesToAdd.push(res.theme);
              }
            }
          }
        }
        // Scenario 3: Single ThemeDefinition
        else {
          const res = validateCustomTheme(parsed);
          if (res.valid && res.theme) {
            themesToAdd.push(res.theme);
          } else {
            return {
              success: false,
              error: res.error || "Estructura de tema no válida.",
            };
          }
        }

        if (themesToAdd.length === 0) {
          return {
            success: false,
            error: "No se encontraron temas válidos en el archivo JSON.",
          };
        }

        // Merge into customThemes
        let lastImportedId = themesToAdd[0].id;
        let lastImportedName = themesToAdd[0].name;

        setSettings((prev) => {
          const existingMap = new Map(
            prev.customThemes.map((t) => [t.id, t])
          );
          for (const t of themesToAdd) {
            existingMap.set(t.id, t);
          }
          const updatedCustom = Array.from(existingMap.values());

          return {
            ...prev,
            theme: lastImportedId,
            customThemes: updatedCustom,
          };
        });

        // Immediately persist to appearance-config.json
        const fileConfig: AppearanceConfigFile = {
          theme: lastImportedId,
          fontSize: settings.fontSize,
          fontFamily: settings.fontFamily,
          language: settings.language,
          customThemes: [
            ...settings.customThemes.filter(
              (t) => !themesToAdd.some((added) => added.id === t.id)
            ),
            ...themesToAdd,
          ],
        };
        await configService.saveAppearanceConfig(fileConfig);

        return {
          success: true,
          name: lastImportedName,
          themeId: lastImportedId,
          count: themesToAdd.length,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Error al procesar JSON: ${msg}` };
      }
    },
    [settings.fontSize, settings.fontFamily, settings.language, settings.customThemes]
  );

  /**
   * Explores and prompts user to pick a theme file from disk
   */
  const importCustomThemeFromFile = useCallback(async (): Promise<ImportThemeResult> => {
    try {
      const fileData = await configService.promptThemeFile();
      if (!fileData || !fileData.content) {
        return { success: false, error: "Selección cancelada." };
      }
      return await processThemePayload(fileData.content);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }, [processThemePayload]);

  const importCustomThemeFromText = useCallback(
    async (text: string): Promise<ImportThemeResult> => {
      return await processThemePayload(text);
    },
    [processThemePayload]
  );

  const deleteCustomTheme = useCallback(
    (themeId: string) => {
      setSettings((prev) => {
        const nextCustom = prev.customThemes.filter((t) => t.id !== themeId);
        const nextTheme = prev.theme === themeId ? BUILTIN_THEMES[0].id : prev.theme;
        return {
          ...prev,
          theme: nextTheme,
          customThemes: nextCustom,
        };
      });
    },
    []
  );

  const reloadConfigFromFile = useCallback(async (): Promise<boolean> => {
    try {
      const fileConfig = await configService.loadAppearanceConfig();
      if (fileConfig) {
        const fileCustom = (fileConfig.customThemes || []).filter(
          (t) => t.id !== "mi-tema-personalizado"
        );

        setSettings((prev) => {
          const nextTheme =
            fileConfig.theme === "mi-tema-personalizado" || fileConfig.theme === "codestash-dark"
              ? DEFAULT_SETTINGS.theme
              : (fileConfig.theme || prev.theme);
          const nextLanguage =
            fileConfig.language === "en" || fileConfig.language === "es"
              ? fileConfig.language
              : prev.language;

          return {
            ...prev,
            language: nextLanguage,
            theme: nextTheme,
            fontSize: fileConfig.fontSize || prev.fontSize,
            fontFamily: fileConfig.fontFamily || prev.fontFamily,
            customThemes: fileCustom,
          };
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error("[SettingsContext] Error reloading config:", e);
      return false;
    }
  }, []);

  const openConfigFileLocation = useCallback(async () => {
    await configService.openConfigFileLocation();
  }, []);

  const downloadThemeTemplate = useCallback(() => {
    configService.downloadThemeTemplate();
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        activeTheme,
        updateSetting,
        resetSettings,
        isSettingsOpen,
        openSettings,
        closeSettings,
        activeSection,
        setActiveSection,
        configFilePath,
        importCustomThemeFromFile,
        importCustomThemeFromText,
        deleteCustomTheme,
        reloadConfigFromFile,
        openConfigFileLocation,
        downloadThemeTemplate,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

const FALLBACK_SETTINGS_CONTEXT: SettingsContextValue = {
  settings: DEFAULT_SETTINGS,
  activeTheme: CODESTASH_ONEDARK_THEME,
  updateSetting: () => {},
  resetSettings: () => {},
  isSettingsOpen: false,
  openSettings: () => {},
  closeSettings: () => {},
  activeSection: "appearance",
  setActiveSection: () => {},
  configFilePath: "appearance-config.json",
  importCustomThemeFromFile: async () => ({ success: false, error: "Settings provider initializing" }),
  importCustomThemeFromText: async () => ({ success: false, error: "Settings provider initializing" }),
  deleteCustomTheme: () => {},
  reloadConfigFromFile: async () => false,
  openConfigFileLocation: async () => {},
  downloadThemeTemplate: () => {},
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) {
    console.warn(
      "[useSettings] Warning: useSettings called outside active SettingsProvider (e.g. during HMR update). Using safe fallback."
    );
    return FALLBACK_SETTINGS_CONTEXT;
  }
  return context;
};
