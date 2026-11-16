import { describe, it, expect, vi, afterEach } from "vitest";
import {
  applyThemeToDOM,
  CODESTASH_LIGHT_MODERN_THEME,
  CODESTASH_ONEDARK_THEME,
  CODESTASH_SPACEGRAY_THEME,
  ONE_DARK_THEME,
} from "../themes";
import type { ThemeDefinition } from "../types";

describe("themes menu contrast and window background sync", () => {
  afterEach(() => {
    delete window.electronAPI;
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
  });

  it("defines distinct --menu-bg and --menu-hover-bg tokens across Light Modern and dark themes", () => {
    for (const theme of [
      CODESTASH_LIGHT_MODERN_THEME,
      CODESTASH_ONEDARK_THEME,
      CODESTASH_SPACEGRAY_THEME,
      ONE_DARK_THEME,
    ]) {
      applyThemeToDOM(theme);
      const style = document.documentElement.style;
      const menuBg = style.getPropertyValue("--menu-bg").trim().toLowerCase();
      const menuHoverBg = style.getPropertyValue("--menu-hover-bg").trim().toLowerCase();
      const baseBg = style.getPropertyValue("--ayu-base").trim().toLowerCase();

      expect(menuBg).not.toBe("");
      expect(menuHoverBg).not.toBe("");
      expect(menuHoverBg).not.toBe(menuBg);
      expect(menuHoverBg).not.toBe(baseBg);
      expect(style.getPropertyValue("--editor-tag-item-hover-bg").trim().toLowerCase()).toBe(
        menuHoverBg
      );
    }
  });

  it("derives dynamic menu hover tokens for imported custom light and dark themes", () => {
    const customLight: ThemeDefinition = {
      ...CODESTASH_LIGHT_MODERN_THEME,
      id: "custom-light",
      name: "Custom Light",
      isDark: false,
    };

    applyThemeToDOM(customLight);
    const hover = document.documentElement.style.getPropertyValue("--menu-hover-bg").trim();
    expect(hover).toContain("color-mix");
    expect(hover).toContain("12%");
  });

  it("syncs Electron native BrowserWindow backgroundColor when applying themes", () => {
    const setWindowBackgroundColor = vi.fn().mockResolvedValue({ success: true });
    window.electronAPI = {
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn(),
      setWindowBackgroundColor,
      getAppearanceConfigPath: vi.fn(),
      readAppearanceConfig: vi.fn(),
      writeAppearanceConfig: vi.fn(),
      openAppearanceConfigFile: vi.fn(),
      chooseThemeFile: vi.fn(),
      openExternalUrl: vi.fn(),
    };

    applyThemeToDOM(CODESTASH_LIGHT_MODERN_THEME);
    expect(setWindowBackgroundColor).toHaveBeenLastCalledWith("#F9F9F9");

    applyThemeToDOM(CODESTASH_ONEDARK_THEME);
    expect(setWindowBackgroundColor).toHaveBeenLastCalledWith("#282c34");

    applyThemeToDOM(CODESTASH_SPACEGRAY_THEME);
    expect(setWindowBackgroundColor).toHaveBeenLastCalledWith("#242e3a");
  });

  it("matches statusbar footer color and border to the editor panel background across all themes", () => {
    const customTheme: ThemeDefinition = {
      ...ONE_DARK_THEME,
      id: "custom-dark-uniform",
      name: "Custom Uniform",
      colors: {
        ...ONE_DARK_THEME.colors,
        base: "#121316",
        lift: "#1b1d24",
        editorPanelBg: "#1b1d24",
        statusbarBg: "#0d0e11",
      },
    };

    for (const theme of [
      CODESTASH_LIGHT_MODERN_THEME,
      CODESTASH_ONEDARK_THEME,
      CODESTASH_SPACEGRAY_THEME,
      ONE_DARK_THEME,
      customTheme,
    ]) {
      applyThemeToDOM(theme);
      const style = document.documentElement.style;
      const editorPanelBg = style.getPropertyValue("--editor-panel-bg").trim().toLowerCase();
      const statusbarBg = style.getPropertyValue("--statusbar-bg").trim().toLowerCase();
      const statusbarBorder = style.getPropertyValue("--statusbar-border").trim().toLowerCase();

      expect(editorPanelBg).not.toBe("");
      expect(statusbarBg).toBe(editorPanelBg);
      expect(statusbarBorder).toBe(editorPanelBg);
    }
  });
});
