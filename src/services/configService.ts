import { AppearanceConfigFile } from "@/features/settings/types";
import { APPEARANCE_CONFIG_FILE_NAME } from "@/features/settings/constants";
import { getThemeTemplateJson } from "@/features/settings/themes";

const LOCAL_STORAGE_CONFIG_KEY = "codestash_appearance_config";

export const configService = {
  /**
   * Retrieves the absolute or relative path to appearance-config.json
   */
  async getConfigFilePath(): Promise<string> {
    if (window.electronAPI?.getAppearanceConfigPath) {
      try {
        return await window.electronAPI.getAppearanceConfigPath();
      } catch (e) {
        console.warn("[ConfigService] Could not get config path via Electron:", e);
      }
    }
    return `./${APPEARANCE_CONFIG_FILE_NAME}`;
  },

  /**
   * Loads the appearance-config.json file from the application folder.
   * If on web or Electron fallback, checks localStorage.
   */
  async loadAppearanceConfig(): Promise<AppearanceConfigFile | null> {
    if (window.electronAPI?.readAppearanceConfig) {
      try {
        const res = await window.electronAPI.readAppearanceConfig();
        if (res.success && res.exists && res.data) {
          return res.data;
        }
      } catch (e) {
        console.warn("[ConfigService] Error reading config from Electron:", e);
      }
    }

    // Web / local storage fallback
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
      if (stored) {
        return JSON.parse(stored) as AppearanceConfigFile;
      }
    } catch (e) {
      console.error("[ConfigService] Error loading config from localStorage:", e);
    }

    return null;
  },

  /**
   * Persists appearance configuration to appearance-config.json in the application folder.
   */
  async saveAppearanceConfig(config: AppearanceConfigFile): Promise<string> {
    let savedPath = `./${APPEARANCE_CONFIG_FILE_NAME}`;

    if (window.electronAPI?.writeAppearanceConfig) {
      try {
        const res = await window.electronAPI.writeAppearanceConfig(config);
        if (res.success && res.path) {
          savedPath = res.path;
        }
      } catch (e) {
        console.warn("[ConfigService] Error writing config to Electron:", e);
      }
    }

    // Keep localStorage in sync as well
    try {
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(config, null, 2));
    } catch (e) {
      console.error("[ConfigService] Error syncing config to localStorage:", e);
    }

    return savedPath;
  },

  /**
   * Opens the folder or file in the native file explorer
   */
  async openConfigFileLocation(): Promise<void> {
    if (window.electronAPI?.openAppearanceConfigFile) {
      try {
        await window.electronAPI.openAppearanceConfigFile();
      } catch (e) {
        console.warn("[ConfigService] Could not open file location:", e);
      }
    }
  },

  /**
   * Opens native file dialog or browser file input to select a theme JSON file
   */
  async promptThemeFile(): Promise<{ content: string; filePath?: string } | null> {
    // 1. Try native electron dialog
    if (window.electronAPI?.chooseThemeFile) {
      try {
        const res = await window.electronAPI.chooseThemeFile();
        if (!res.canceled && res.content) {
          return { content: res.content, filePath: res.filePath };
        }
        return null;
      } catch (e) {
        console.warn("[ConfigService] Electron chooseThemeFile error, falling back to input:", e);
      }
    }

    // 2. Browser fallback: Create dynamic <input type="file" />
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.style.display = "none";

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const text = await file.text();
          resolve({ content: text, filePath: file.name });
        } catch (err) {
          console.error("[ConfigService] File read error:", err);
          resolve(null);
        } finally {
          document.body.removeChild(input);
        }
      };

      input.oncancel = () => {
        resolve(null);
        document.body.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();
    });
  },

  /**
   * Downloads a sample JSON template for customizing themes
   */
  downloadThemeTemplate(): void {
    const jsonStr = getThemeTemplateJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "custom-theme-template.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
