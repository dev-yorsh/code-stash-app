import { ThemeDefinition, ThemeColors } from "./types";

/**
 * Official CodeStash Theme Palettes
 */

export const CODESTASH_LIGHT_MODERN_THEME: ThemeDefinition = {
  id: "codestash-light-modern",
  name: "CodeStash - Light Modern",
  description: "Tema claro moderno estilo macOS / SnippetsLab con acentos azul sistema y tipografía limpia.",
  isDark: false,
  category: "Light theme",
  colors: {
    base: "#F9F9F9",
    sunk: "#ffffff",
    lift: "#F9F9F9",
    panel: "#ffffff",
    popup: "#ffffff",
    line: "#F9F9F9",
    border: "#d1d1d6",
    fg: "#636366",
    fgSubtle: "#88888d",
    editorFg: "#1c1c1e",
    accent: "#007aff",
    accentHover: "#0062cc",
    accentOn: "#ffffff",
    error: "#ff3b30",
    success: "#34c759",
    warning: "#ff9500",
    info: "#5856d6",
    sidebarBg: "#dee3e4",
    sidebarBorder: "#cecfd1",
    searchbarBg: "#ffffff",
    titlebarBg: "#ffffff",
  },
};

export const CODESTASH_SPACEGRAY_THEME: ThemeDefinition = {
  id: "codestash-spacegray",
  name: "CodeStash - Spacegray",
  description: "Tema oscuro elegante estilo Spacegray / Base16 Ocean con contrastes azul pizarra y tipografía nítida.",
  isDark: true,
  category: "Dark theme",
  colors: {
    base: "#242e3a",
    sunk: "#1e2530",
    lift: "#242e3a",
    panel: "#2b3645",
    popup: "#202936",
    line: "#1a222d",
    border: "#323b48",
    fg: "#c0c5ce",
    fgSubtle: "#65737e",
    editorFg: "#eff1f5",
    accent: "#0a84ff",
    accentHover: "#0070eb",
    accentOn: "#ffffff",
    error: "#bf616a",
    success: "#a3be8c",
    warning: "#ebcb8b",
    info: "#8fa1b3",
    sidebarBg: "#202936",
    sidebarBorder: "#0e1724",
    sidebarHoverBg: "#1a222d",
    listBg: "#242e3a",
    listBorder: "#111a27",
    listTagBg: "#3c434f",
    listTagBorder: "transparent",
    listTagFg: "#d8dee9",
    editorPanelBg: "#242e3a",
    titlebarBg: "#202936",
    titlebarBorder: "#111a27",
    searchbarBg: "#1a222d",
    searchbarBorder: "#2c3644",
    fragmentsBg: "#202936",
    statusbarBg: "#242e3a",
    editorGutterBg: "#242e3a",
    editorGutterFg: "#65737e",
    editorActiveLineBg: "rgba(255, 255, 255, 0.04)",
  },
};

export const CODESTASH_ONEDARK_THEME: ThemeDefinition = {
  id: "codestash-onedark",
  name: "CodeStash - OneDark",
  description: "Tema oscuro estilo OneDark / SnippetsLab con sidebar carbón, selección azul acero y sintaxis vibrante.",
  isDark: true,
  category: "Dark theme",
  colors: {
    base: "#282c34",
    sunk: "#22282c",
    lift: "#282c34",
    panel: "#2f343e",
    popup: "#22282c",
    line: "#181e23",
    border: "#373c43",
    fg: "#9da1a9",
    fgSubtle: "#676d74",
    editorFg: "#eff1f5",
    accent: "#5177cc",
    accentHover: "#4365b5",
    accentOn: "#ffffff",
    error: "#e06c75",
    success: "#98c379",
    warning: "#e5c07b",
    info: "#56b6c2",
    sidebarBg: "#22282c",
    sidebarBorder: "#181e23",
    sidebarHoverBg: "#1c2125",
    listBg: "#282c34",
    listBorder: "#181a1f",
    listTagBg: "#41454b",
    listTagBorder: "transparent",
    listTagFg: "#d7dae0",
    editorPanelBg: "#282c34",
    titlebarBg: "#22282c",
    titlebarBorder: "#181e23",
    searchbarBg: "#1c2125",
    searchbarBorder: "#32383e",
    fragmentsBg: "#22282c",
    statusbarBg: "#282c34",
    editorGutterBg: "#282c34",
    editorGutterFg: "#4c5158",
    editorActiveLineBg: "rgba(255, 255, 255, 0.04)",
  },
};

export const ONE_DARK_THEME: ThemeDefinition = {
  id: "one-dark",
  name: "One Dark",
  description: "Tema icónico One Dark Pro con tonos oscuros y sintaxis balanceada.",
  isDark: true,
  category: "Dark theme",
  colors: {
    base: "#21252b",
    sunk: "#1d1f23",
    lift: "#282c34",
    panel: "#282c34",
    popup: "#21252b",
    line: "#181a1f",
    border: "#3e4452",
    fg: "#8d94a3",
    fgSubtle: "#5c6370",
    editorFg: "#abb2bf",
    accent: "#0a84ff",
    accentHover: "#0070eb",
    accentOn: "#ffffff",
    error: "#e06c75",
    success: "#98c379",
    warning: "#e5c07b",
    info: "#56b6c2",
  },
};

export const THEME_CATEGORIES = [
  "Dark theme",
  "Light theme",
] as const;

export const BUILTIN_THEMES: ThemeDefinition[] = [
  CODESTASH_ONEDARK_THEME,
  CODESTASH_SPACEGRAY_THEME,
  CODESTASH_LIGHT_MODERN_THEME,
  ONE_DARK_THEME,
];

/**
 * Searches for a theme by ID, checking custom themes first, then built-in themes.
 * Falls back to CODESTASH_ONEDARK_THEME if not found.
 */
export function findThemeById(
  themeId: string,
  customThemes: ThemeDefinition[] = []
): ThemeDefinition {
  const custom = customThemes.find((t) => t.id === themeId);
  if (custom) return custom;

  const builtin = BUILTIN_THEMES.find((t) => t.id === themeId);
  if (builtin) return builtin;

  return CODESTASH_ONEDARK_THEME;
}

/**
 * Applies a ThemeDefinition directly to the document root as CSS custom properties
 * and sets data-theme and data-theme-mode attributes.
 */
export function applyThemeToDOM(theme: ThemeDefinition): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const { colors } = theme;

  const isLightModern = theme.id === "codestash-light-modern";
  const isSpacegray = theme.id === "codestash-spacegray";
  const isCodeStashOneDark = theme.id === "codestash-onedark";
  const isOneDark = theme.id === "one-dark";
  root.setAttribute("data-theme", theme.id);
  root.setAttribute("data-is-ayu", "false");
  const mode = theme.isDark !== false ? "dark" : "light";
  root.setAttribute("data-theme-mode", mode);
  root.style.colorScheme = mode;
  const isDarkTheme = theme.isDark !== false;

  // Set all CSS variables
  root.style.setProperty("--ayu-base", colors.base);
  root.style.setProperty("--ayu-sunk", colors.sunk);
  root.style.setProperty("--ayu-lift", colors.lift);
  root.style.setProperty("--ayu-panel", colors.panel);
  root.style.setProperty("--ayu-popup", colors.popup || colors.panel);
  root.style.setProperty("--ayu-line", colors.line);
  root.style.setProperty("--ayu-border", colors.border);
  root.style.setProperty("--ayu-fg", colors.fg);
  root.style.setProperty("--ayu-fg-subtle", colors.fgSubtle || colors.fg);
  root.style.setProperty("--ayu-editor-fg", colors.editorFg);
  root.style.setProperty("--ayu-accent", colors.accent);
  root.style.setProperty("--ayu-accent-hover", colors.accentHover || colors.accent);
  root.style.setProperty("--ayu-accent-on", colors.accentOn || "#ffffff");
  root.style.setProperty("--ayu-error", colors.error || "#ff6666");
  root.style.setProperty("--ayu-success", colors.success || "#87d96c");
  root.style.setProperty("--ayu-warning", colors.warning || "#ffa659");
  root.style.setProperty("--ayu-info", colors.info || "#73d0ff");

  // Semantic mapping variables
  root.style.setProperty("--bg-canvas", colors.base);
  root.style.setProperty("--bg-surface", colors.lift);
  root.style.setProperty("--bg-surface-sunken", colors.sunk);
  root.style.setProperty("--bg-surface-raised", colors.panel);
  root.style.setProperty("--border-subtle", colors.line);
  root.style.setProperty("--border-focus", colors.border);
  root.style.setProperty("--text-primary", colors.editorFg);
  root.style.setProperty("--text-muted", colors.fg);
  root.style.setProperty("--text-subtle", colors.fgSubtle || colors.fg);
  root.style.setProperty("--accent-primary", colors.accent);
  root.style.setProperty("--accent-hover", colors.accentHover || colors.accent);
  root.style.setProperty("--accent-success", colors.success || "#87d96c");
  root.style.setProperty("--accent-warning", colors.warning || "#ffa659");
  root.style.setProperty("--accent-danger", colors.error || "#ff6666");

  // Modular component design tokens
  root.style.setProperty("--sidebar-bg", colors.sidebarBg || colors.sunk);
  root.style.setProperty("--sidebar-border", colors.sidebarBorder || colors.line);
  root.style.setProperty("--sidebar-fg", colors.fg);
  root.style.setProperty("--sidebar-fg-subtle", colors.fgSubtle || colors.fg);
  root.style.setProperty("--sidebar-footer-bg", colors.sidebarBg || colors.sunk);
  root.style.setProperty("--sidebar-footer-border", colors.sidebarBorder || colors.line);
  root.style.setProperty("--sidebar-active-bg", "var(--folder-active-bg)");
  root.style.setProperty("--sidebar-active-fg", "var(--folder-active-fg)");
  root.style.setProperty("--sidebar-active-icon", "var(--folder-active-icon)");
  root.style.setProperty(
    "--sidebar-hover-bg",
    colors.sidebarHoverBg || "color-mix(in srgb, var(--sidebar-bg), #000 12%)"
  );

  root.style.setProperty("--titlebar-bg", colors.titlebarBg || colors.base);
  root.style.setProperty("--titlebar-border", colors.titlebarBorder || colors.line);
  root.style.setProperty("--titlebar-fg", colors.editorFg);

  root.style.setProperty("--searchbar-bg", colors.searchbarBg || "color-mix(in srgb, var(--ayu-sunk) 70%, transparent)");
  root.style.setProperty("--searchbar-border", colors.searchbarBorder || colors.line);
  root.style.setProperty("--searchbar-hover-bg", colors.sunk);
  root.style.setProperty("--searchbar-focus-bg", colors.lift);
  root.style.setProperty("--searchbar-focus-border", colors.border);
  root.style.setProperty("--searchbar-fg", colors.fg);
  root.style.setProperty("--searchbar-text", colors.editorFg);
  root.style.setProperty("--searchbar-kbd-bg", colors.base);
  root.style.setProperty("--searchbar-kbd-border", colors.line);
  root.style.setProperty("--searchbar-kbd-fg", colors.fgSubtle || colors.fg);

  root.style.setProperty("--list-panel-bg", colors.listBg || colors.base);
  root.style.setProperty("--list-panel-border", colors.listBorder || colors.line);
  root.style.setProperty("--list-header-bg", colors.listBg || colors.base);
  root.style.setProperty("--list-header-border", colors.listBorder || colors.line);
  root.style.setProperty("--list-card-border", colors.line);
  root.style.setProperty("--list-card-title", colors.editorFg);
  root.style.setProperty("--list-card-sub", colors.fgSubtle || colors.fg);
  root.style.setProperty("--list-tag-bg", colors.listTagBg || colors.sunk);
  root.style.setProperty("--list-tag-border", colors.listTagBorder || colors.line);
  root.style.setProperty("--list-tag-fg", colors.listTagFg || colors.fg);

  // Tags en sidebar y badges
  root.style.setProperty("--sidebar-tag-bg", colors.sidebarTagBg || colors.sunk);
  root.style.setProperty("--sidebar-tag-border", colors.sidebarTagBorder || colors.line);
  root.style.setProperty("--sidebar-tag-fg", colors.sidebarTagFg || colors.fg);
  root.style.setProperty("--sidebar-tag-hover-bg", "color-mix(in srgb, var(--sidebar-tag-bg) 75%, var(--ayu-lift))");
  root.style.setProperty("--sidebar-tag-hover-border", colors.border);
  root.style.setProperty("--sidebar-tag-hover-fg", colors.editorFg);
  root.style.setProperty("--sidebar-tag-active-bg", colors.sidebarTagActiveBg || colors.panel);
  root.style.setProperty("--sidebar-tag-active-border", colors.sidebarTagActiveBorder || colors.border);
  root.style.setProperty("--sidebar-tag-active-fg", colors.sidebarTagActiveFg || colors.editorFg);

  root.style.setProperty("--tag-badge-bg", colors.tagBadgeBg || colors.sunk);
  root.style.setProperty("--tag-badge-border", colors.tagBadgeBorder || colors.line);
  root.style.setProperty("--tag-badge-fg", colors.tagBadgeFg || colors.fg);

  root.style.setProperty("--editor-tag-popover-bg", colors.popup || colors.panel);
  root.style.setProperty("--editor-tag-popover-border", colors.border);
  root.style.setProperty("--editor-tag-item-active-bg", colors.panel);
  root.style.setProperty("--editor-tag-item-active-fg", colors.editorFg);

  // High-visibility context menu and popover surfaces (light & dark themes)
  const menuBg = isLightModern ? "#ffffff" : colors.popup || colors.panel;
  const menuHoverBg = isLightModern
    ? "#e2e5ea"
    : isCodeStashOneDark
      ? "#383f4a"
      : isSpacegray
        ? "#323d4d"
        : isOneDark
          ? "#353b45"
          : isDarkTheme
            ? "color-mix(in srgb, var(--ayu-editor-fg) 16%, var(--ayu-popup))"
            : "color-mix(in srgb, var(--ayu-editor-fg) 12%, var(--ayu-popup))";
  root.style.setProperty("--menu-bg", menuBg);
  root.style.setProperty("--menu-hover-bg", menuHoverBg);
  root.style.setProperty(
    "--menu-active-bg",
    "color-mix(in srgb, var(--ayu-accent) 16%, var(--menu-bg))"
  );
  root.style.setProperty("--editor-tag-item-hover-bg", menuHoverBg);

  // Keep native Electron window surface aligned with active theme canvas
  const windowBackgroundColor = (colors.editorPanelBg || colors.base || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(windowBackgroundColor) && typeof window !== "undefined") {
    void window.electronAPI?.setWindowBackgroundColor?.(windowBackgroundColor);
  }

  root.style.setProperty("--snippet-header-bg", colors.base);
  root.style.setProperty("--snippet-header-border", colors.line);
  root.style.setProperty("--snippet-header-title", colors.editorFg);
  root.style.setProperty("--snippet-header-fg", colors.fgSubtle || colors.fg);
  root.style.setProperty("--snippet-header-meta-bg", colors.lift);

  root.style.setProperty("--fragments-bar-bg", colors.fragmentsBg || colors.base);
  root.style.setProperty("--fragments-bar-border", colors.line);
  root.style.setProperty(
    "--fragments-divider-height",
    colors.fragmentsDividerHeight || "50%"
  );
  root.style.setProperty("--fragments-divider-color", "var(--fragments-bar-border)");
  root.style.setProperty("--fragments-divider-width", "1px");
  root.style.setProperty("--fragment-tab-active-bg", colors.lift);
  root.style.setProperty("--fragment-tab-active-fg", colors.editorFg);
  root.style.setProperty("--fragment-tab-active-line", colors.accent);
  root.style.setProperty("--fragment-tab-inactive-bg", "color-mix(in srgb, var(--ayu-sunk) 80%, transparent)");
  root.style.setProperty("--fragment-tab-inactive-fg", colors.fgSubtle || colors.fg);

  const uniformEditorPanelBg = colors.editorPanelBg || colors.lift;
  root.style.setProperty("--editor-panel-bg", uniformEditorPanelBg);
  root.style.setProperty("--statusbar-bg", uniformEditorPanelBg);
  root.style.setProperty("--statusbar-border", uniformEditorPanelBg);
  root.style.setProperty("--statusbar-fg", colors.fgSubtle || colors.fg);

  // Selección de texto global y CodeMirror editor tokens
  root.style.setProperty(
    "--selection-bg",
    isDarkTheme ? "rgba(10, 132, 255, 0.35)" : "rgba(0, 122, 255, 0.22)"
  );
  root.style.setProperty("--selection-fg", "inherit");
  root.style.setProperty(
    "--editor-selection-bg",
    colors.editorSelectionBg || (isDarkTheme ? "rgba(56, 139, 253, 0.34)" : "rgba(0, 122, 255, 0.22)")
  );
  root.style.setProperty("--editor-selection-fg", colors.editorSelectionFg || "inherit");
  root.style.setProperty(
    "--editor-selection-match",
    colors.editorSelectionMatch || (isDarkTheme ? "rgba(56, 139, 253, 0.18)" : "rgba(0, 122, 255, 0.14)")
  );
  root.style.setProperty("--editor-cursor", colors.editorCursor || (isDarkTheme ? "#0a84ff" : "#007aff"));
  root.style.setProperty(
    "--editor-active-line-bg",
    colors.editorActiveLineBg || (isDarkTheme ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)")
  );
  root.style.setProperty("--editor-gutter-bg", colors.editorGutterBg || colors.lift);
  root.style.setProperty(
    "--editor-gutter-fg",
    colors.editorGutterFg || (isLightModern ? "#aeaeb2" : isOneDark ? "#5c6370" : (colors.fgSubtle || colors.fg))
  );
  root.style.setProperty(
    "--editor-active-gutter-fg",
    colors.editorActiveGutterFg || (isDarkTheme ? "#0a84ff" : "#007aff")
  );

  // Universal button personality (Signature CodeStash Blue adapted cleanly for dark & light)
  root.style.setProperty("--btn-primary-bg", isDarkTheme ? "#0a84ff" : "#007aff");
  root.style.setProperty("--btn-primary-hover", isDarkTheme ? "#0070eb" : "#0062cc");
  root.style.setProperty("--btn-primary-fg", "#ffffff");
  root.style.setProperty("--btn-primary-border", isDarkTheme ? "#0a84ff" : "#007aff");

  // Universal active folder personality (Consistent blue highlight with white text/icon)
  root.style.setProperty("--folder-active-bg", isDarkTheme ? "#0a84ff" : "#007aff");
  root.style.setProperty("--folder-active-fg", "#ffffff");
  root.style.setProperty("--folder-active-icon", "#ffffff");
  root.style.setProperty("--folder-active-border", "transparent");

  // Snippets selection styling: universal vibrant blue across all themes
  root.style.setProperty("--list-active-bg", isDarkTheme ? "#0a84ff" : "#007aff");
  root.style.setProperty("--list-active-fg", "#ffffff");
  root.style.setProperty("--list-active-sub", "rgba(255, 255, 255, 0.85)");
  root.style.setProperty("--list-active-badge-bg", "rgba(255, 255, 255, 0.22)");
  root.style.setProperty("--list-active-badge-fg", "#ffffff");

  // Fragment tab active indicator line
  root.style.setProperty("--fragment-tab-active-line", isDarkTheme ? "#0a84ff" : "#007aff");

  // Sidebar tags active and hover states
  root.style.setProperty("--sidebar-tag-active-bg", isDarkTheme ? "#0a84ff" : "#007aff");
  root.style.setProperty("--sidebar-tag-active-fg", "#ffffff");
  root.style.setProperty("--sidebar-tag-active-border", isDarkTheme ? "#0a84ff" : "#007aff");
  root.style.setProperty("--sidebar-tag-hover-fg", isDarkTheme ? "#0a84ff" : "#007aff");
  root.style.setProperty("--sidebar-tag-hover-border", isDarkTheme ? "#0a84ff" : "#007aff");

  if (isLightModern) {
    root.style.setProperty("--titlebar-bg", "#F9F9F9");
    root.style.setProperty("--titlebar-border", "#e7e7e7");

    // Barra de búsqueda en la parte superior
    root.style.setProperty("--searchbar-border", "#dad9d9");
    root.style.setProperty("--searchbar-hover-bg", "#ffffff");
    root.style.setProperty("--searchbar-focus-bg", "#ffffff");

    // Pastilla (Ctrl+K) en la barra de búsqueda
    root.style.setProperty("--searchbar-kbd-bg", "#ebeaea");

    // ****** Sidebar (barra lateral izquierda) ******
    root.style.setProperty("--sidebar-bg", "#dee3e4");
    root.style.setProperty("--sidebar-footer-border", "#dee3e4");

    root.style.setProperty("--list-panel-bg", "#ffffff");
    root.style.setProperty("--list-panel-border", "#e7e7e7");

    root.style.setProperty("--list-card-border", "#e7e7e7");
    root.style.setProperty("--list-tag-bg", "#DAE6FD");

    // Cabecera de los snippets
    root.style.setProperty("--snippet-header-border", "#dee3e4");

    // Fragmentos de los snippets
    root.style.setProperty("--fragment-tab-active-bg", "#ffffff");
    root.style.setProperty("--fragment-tab-inactive-bg", "#F9F9F9");
    root.style.setProperty("--fragments-bar-border", "#e7e7e7");
    root.style.setProperty("--fragments-divider-height", "45%");

    root.style.setProperty("--sidebar-tag-bg", "#e7e7e7");
    root.style.setProperty("--sidebar-tag-border", "#e7e7e7");
    root.style.setProperty("--sidebar-tag-hover-bg", "#e7e7e7");
    root.style.setProperty("--sidebar-tag-hover-border", "#e7e7e7");
  } else if (isSpacegray) {
    root.style.setProperty("--titlebar-bg", "#202936");
    root.style.setProperty("--titlebar-border", "#111a27");

    root.style.setProperty("--searchbar-bg", "#1a222d");
    root.style.setProperty("--searchbar-border", "#2c3644");
    root.style.setProperty("--searchbar-hover-bg", "#1e2733");
    root.style.setProperty("--searchbar-focus-bg", "#1e2733");
    root.style.setProperty("--searchbar-kbd-bg", "#242e3a");

    root.style.setProperty("--sidebar-bg", "#202936");
    root.style.setProperty("--sidebar-border", "#0e1724");
    root.style.setProperty("--sidebar-fg", "#c8cfd8");
    root.style.setProperty("--sidebar-fg-subtle", "#65737e");
    root.style.setProperty("--sidebar-hover-bg", "#1a222d");
    root.style.setProperty("--sidebar-footer-bg", "#1f2835");
    root.style.setProperty("--sidebar-footer-border", "#151d28");

    root.style.setProperty("--folder-active-bg", "#005ad2");
    root.style.setProperty("--folder-active-fg", "#ffffff");
    root.style.setProperty("--folder-active-icon", "#ffffff");
    root.style.setProperty("--list-active-bg", "#005ad2");

    root.style.setProperty("--list-panel-bg", "#242e3a");
    root.style.setProperty("--list-panel-border", "#111a27");
    root.style.setProperty("--list-header-bg", "#242e3a");
    root.style.setProperty("--list-header-border", "#1c2430");
    root.style.setProperty("--list-card-border", "#323b48");
    root.style.setProperty("--list-card-title", "#eff1f5");
    root.style.setProperty("--list-card-sub", "#8b94a1");
    root.style.setProperty("--list-tag-bg", "#3c434f");
    root.style.setProperty("--list-tag-border", "transparent");
    root.style.setProperty("--list-tag-fg", "#d8dee9");

    root.style.setProperty("--snippet-header-bg", "#242e3a");
    root.style.setProperty("--snippet-header-border", "#1d2632");
    root.style.setProperty("--snippet-header-title", "#eff1f5");
    root.style.setProperty("--snippet-header-fg", "#8b94a1");

    root.style.setProperty("--fragments-bar-bg", "#202936");
    root.style.setProperty("--fragments-bar-border", "#151d28");
    root.style.setProperty("--fragment-tab-active-bg", "#242e3a");
    root.style.setProperty("--fragment-tab-inactive-bg", "#1e2631");
    root.style.setProperty("--fragments-divider-height", "45%");

    root.style.setProperty("--editor-panel-bg", "#242e3a");
    root.style.setProperty("--statusbar-bg", "#242e3a");
    root.style.setProperty("--statusbar-border", "#242e3a");
    root.style.setProperty("--statusbar-fg", "#8b94a1");

    root.style.setProperty("--sidebar-tag-bg", "#2a3442");
    root.style.setProperty("--sidebar-tag-border", "#364253");
    root.style.setProperty("--sidebar-tag-fg", "#c8cfd8");
    root.style.setProperty("--sidebar-tag-hover-bg", "#323e4f");
  } else if (isCodeStashOneDark) {
    root.style.setProperty("--titlebar-bg", "#22282c");
    root.style.setProperty("--titlebar-border", "#181e23");

    root.style.setProperty("--searchbar-bg", "#1c2125");
    root.style.setProperty("--searchbar-border", "#32383e");
    root.style.setProperty("--searchbar-hover-bg", "#20252a");
    root.style.setProperty("--searchbar-focus-bg", "#20252a");
    root.style.setProperty("--searchbar-kbd-bg", "#282c34");

    root.style.setProperty("--sidebar-bg", "#22282c");
    root.style.setProperty("--sidebar-border", "#181e23");
    root.style.setProperty("--sidebar-fg", "#d7dae0");
    root.style.setProperty("--sidebar-fg-subtle", "#676d74");
    root.style.setProperty("--sidebar-hover-bg", "#1c2125");
    root.style.setProperty("--sidebar-footer-bg", "#22282c");
    root.style.setProperty("--sidebar-footer-border", "#181e23");

    root.style.setProperty("--folder-active-bg", "#5177cc");
    root.style.setProperty("--folder-active-fg", "#ffffff");
    root.style.setProperty("--folder-active-icon", "#ffffff");
    root.style.setProperty("--list-active-bg", "#5177cc");

    root.style.setProperty("--list-panel-bg", "#282c34");
    root.style.setProperty("--list-panel-border", "#181a1f");
    root.style.setProperty("--list-header-bg", "#282c34");
    root.style.setProperty("--list-header-border", "#1e2228");
    root.style.setProperty("--list-card-border", "#373c43");
    root.style.setProperty("--list-card-title", "#eff1f5");
    root.style.setProperty("--list-card-sub", "#9da1a9");
    root.style.setProperty("--list-tag-bg", "#41454b");
    root.style.setProperty("--list-tag-border", "transparent");
    root.style.setProperty("--list-tag-fg", "#d7dae0");

    root.style.setProperty("--snippet-header-bg", "#282c34");
    root.style.setProperty("--snippet-header-border", "#1e2228");
    root.style.setProperty("--snippet-header-title", "#eff1f5");
    root.style.setProperty("--snippet-header-fg", "#9da1a9");

    root.style.setProperty("--fragments-bar-bg", "#22282c");
    root.style.setProperty("--fragments-bar-border", "#181e23");
    root.style.setProperty("--fragment-tab-active-bg", "#282c34");
    root.style.setProperty("--fragment-tab-inactive-bg", "#1f2428");
    root.style.setProperty("--fragments-divider-height", "45%");

    root.style.setProperty("--editor-panel-bg", "#282c34");
    root.style.setProperty("--statusbar-bg", "#282c34");
    root.style.setProperty("--statusbar-border", "#282c34");
    root.style.setProperty("--statusbar-fg", "#9da1a9");

    root.style.setProperty("--sidebar-tag-bg", "#2c3138");
    root.style.setProperty("--sidebar-tag-border", "#393f47");
    root.style.setProperty("--sidebar-tag-fg", "#d7dae0");
    root.style.setProperty("--sidebar-tag-hover-bg", "#343a42");
  }
}

/**
 * Validates whether an unknown object contains a valid ThemeDefinition
 * or sanitizes it into one.
 */
export function validateCustomTheme(data: unknown): {
  valid: boolean;
  theme?: ThemeDefinition;
  error?: string;
} {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "El archivo no contiene un objeto JSON válido." };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.name || typeof obj.name !== "string" || obj.name.trim() === "") {
    return { valid: false, error: "El tema requiere un atributo 'name' (nombre del tema)." };
  }

  if (!obj.colors || typeof obj.colors !== "object") {
    return { valid: false, error: "El tema requiere un objeto 'colors' con la paleta de colores." };
  }

  const rawColors = obj.colors as Record<string, unknown>;
  const base = typeof rawColors.base === "string" ? rawColors.base : "#1f2430";
  const lift = typeof rawColors.lift === "string" ? rawColors.lift : "#242936";
  const sunk = typeof rawColors.sunk === "string" ? rawColors.sunk : "#181c26";
  const editorFg = typeof rawColors.editorFg === "string" ? rawColors.editorFg : "#cccac2";
  const fg = typeof rawColors.fg === "string" ? rawColors.fg : "#707a8c";
  const accent = typeof rawColors.accent === "string" ? rawColors.accent : "#ffcc66";

  const id =
    typeof obj.id === "string" && obj.id.trim() !== ""
      ? obj.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-")
      : "custom-" + Date.now();

  const colors: ThemeColors = {
    base,
    sunk,
    lift,
    panel: typeof rawColors.panel === "string" ? rawColors.panel : lift,
    popup: typeof rawColors.popup === "string" ? rawColors.popup : sunk,
    line: typeof rawColors.line === "string" ? rawColors.line : sunk,
    border: typeof rawColors.border === "string" ? rawColors.border : sunk,
    fg,
    fgSubtle: typeof rawColors.fgSubtle === "string" ? rawColors.fgSubtle : fg,
    editorFg,
    accent,
    accentHover: typeof rawColors.accentHover === "string" ? rawColors.accentHover : accent,
    accentOn: typeof rawColors.accentOn === "string" ? rawColors.accentOn : "#000000",
    error: typeof rawColors.error === "string" ? rawColors.error : "#ff6666",
    success: typeof rawColors.success === "string" ? rawColors.success : "#87d96c",
    warning: typeof rawColors.warning === "string" ? rawColors.warning : "#ffa659",
    info: typeof rawColors.info === "string" ? rawColors.info : "#73d0ff",

    sidebarBg: typeof rawColors.sidebarBg === "string" ? rawColors.sidebarBg : undefined,
    sidebarBorder: typeof rawColors.sidebarBorder === "string" ? rawColors.sidebarBorder : undefined,
    sidebarHoverBg: typeof rawColors.sidebarHoverBg === "string" ? rawColors.sidebarHoverBg : undefined,
    listBg: typeof rawColors.listBg === "string" ? rawColors.listBg : undefined,
    listBorder: typeof rawColors.listBorder === "string" ? rawColors.listBorder : undefined,
    editorPanelBg: typeof rawColors.editorPanelBg === "string" ? rawColors.editorPanelBg : undefined,
    titlebarBg: typeof rawColors.titlebarBg === "string" ? rawColors.titlebarBg : undefined,
    titlebarBorder: typeof rawColors.titlebarBorder === "string" ? rawColors.titlebarBorder : undefined,
    searchbarBg: typeof rawColors.searchbarBg === "string" ? rawColors.searchbarBg : undefined,
    searchbarBorder: typeof rawColors.searchbarBorder === "string" ? rawColors.searchbarBorder : undefined,
    fragmentsBg: typeof rawColors.fragmentsBg === "string" ? rawColors.fragmentsBg : undefined,
    fragmentsDividerHeight:
      typeof rawColors.fragmentsDividerHeight === "string" ? rawColors.fragmentsDividerHeight : undefined,
    statusbarBg: typeof rawColors.statusbarBg === "string" ? rawColors.statusbarBg : undefined,

    sidebarTagBg: typeof rawColors.sidebarTagBg === "string" ? rawColors.sidebarTagBg : undefined,
    sidebarTagBorder: typeof rawColors.sidebarTagBorder === "string" ? rawColors.sidebarTagBorder : undefined,
    sidebarTagFg: typeof rawColors.sidebarTagFg === "string" ? rawColors.sidebarTagFg : undefined,
    sidebarTagActiveBg: typeof rawColors.sidebarTagActiveBg === "string" ? rawColors.sidebarTagActiveBg : undefined,
    sidebarTagActiveBorder: typeof rawColors.sidebarTagActiveBorder === "string" ? rawColors.sidebarTagActiveBorder : undefined,
    sidebarTagActiveFg: typeof rawColors.sidebarTagActiveFg === "string" ? rawColors.sidebarTagActiveFg : undefined,
    listTagBg: typeof rawColors.listTagBg === "string" ? rawColors.listTagBg : undefined,
    listTagBorder: typeof rawColors.listTagBorder === "string" ? rawColors.listTagBorder : undefined,
    listTagFg: typeof rawColors.listTagFg === "string" ? rawColors.listTagFg : undefined,
    tagBadgeBg: typeof rawColors.tagBadgeBg === "string" ? rawColors.tagBadgeBg : undefined,
    tagBadgeBorder: typeof rawColors.tagBadgeBorder === "string" ? rawColors.tagBadgeBorder : undefined,
    tagBadgeFg: typeof rawColors.tagBadgeFg === "string" ? rawColors.tagBadgeFg : undefined,

    editorSelectionBg: typeof rawColors.editorSelectionBg === "string" ? rawColors.editorSelectionBg : undefined,
    editorSelectionFg: typeof rawColors.editorSelectionFg === "string" ? rawColors.editorSelectionFg : undefined,
    editorSelectionMatch: typeof rawColors.editorSelectionMatch === "string" ? rawColors.editorSelectionMatch : undefined,
    editorCursor: typeof rawColors.editorCursor === "string" ? rawColors.editorCursor : undefined,
    editorActiveLineBg: typeof rawColors.editorActiveLineBg === "string" ? rawColors.editorActiveLineBg : undefined,
    editorGutterBg: typeof rawColors.editorGutterBg === "string" ? rawColors.editorGutterBg : undefined,
    editorGutterFg: typeof rawColors.editorGutterFg === "string" ? rawColors.editorGutterFg : undefined,
    editorActiveGutterFg: typeof rawColors.editorActiveGutterFg === "string" ? rawColors.editorActiveGutterFg : undefined,
  };

  const theme: ThemeDefinition = {
    id,
    name: obj.name.trim(),
    description: typeof obj.description === "string" ? obj.description.trim() : undefined,
    isDark: typeof obj.isDark === "boolean" ? obj.isDark : true,
    colors,
  };

  return { valid: true, theme };
}

/**
 * Creates a template JSON string that users can download or copy to create their own custom themes.
 */
export function getThemeTemplateJson(): string {
  const template = {
    $schema: "https://codestash.app/schema/theme.json",
    id: "mi-tema-personalizado",
    name: "Mi Tema Personalizado",
    description: "Tema personalizado para CodeStash",
    isDark: true,
    colors: {
      base: "#1a1b26",
      sunk: "#16161e",
      lift: "#24283b",
      panel: "#1f2335",
      popup: "#1f2335",
      line: "#292e42",
      border: "#414868",
      fg: "#787c99",
      fgSubtle: "#565f89",
      editorFg: "#c0caf5",
      accent: "#7aa2f7",
      accentHover: "#89ddff",
      accentOn: "#15161e",
      error: "#f7768e",
      success: "#9ece6a",
      warning: "#e0af68",
      info: "#7dcfff",
    },
  };
  return JSON.stringify(template, null, 2);
}
