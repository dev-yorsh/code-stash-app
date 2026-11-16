/**
 * Design Tokens for CodeStash
 * Official Ayu Theme: Mirage Palette
 * Extracted from: https://github.com/ayu-theme/ayu-colors
 */

export const AYU_MIRAGE = {
  palette: {
    gray: {
      l1: "#6e7c8f",
      l2: "#afb7c1",
      l3: "#c0c6cf",
      l4: "#d2d6dc",
      l5: "#e3e6ea",
    },
    red: {
      l1: "#f28779",
      l2: "#f49f92",
      l3: "#f7b5ab",
      l4: "#facac2",
      l5: "#fdded9",
    },
    pink: {
      l1: "#ee8751",
      l2: "#f29e74",
      l3: "#f5b595",
      l4: "#f9cab3",
      l5: "#fddfd1",
    },
    orange: {
      l1: "#ed8a24",
      l2: "#ffa659",
      l3: "#ffba83",
      l4: "#ffcda6",
      l5: "#ffdfc7",
    },
    peach: {
      l1: "#baa280",
      l2: "#cab08b",
      l3: "#d9be98",
      l4: "#e8d1b0",
      l5: "#f3e4cf",
    },
    yellow: {
      l1: "#c99f47",
      l2: "#dcae4e",
      l3: "#eebd55",
      l4: "#ffcd66",
      l5: "#ffe3ac",
    },
    green: {
      l1: "#94b453",
      l2: "#a3c55c",
      l3: "#b1d665",
      l4: "#c0e76e",
      l5: "#d5ff80",
    },
    teal: {
      l1: "#74b6a0",
      l2: "#7fc6ae",
      l3: "#8ad6bc",
      l4: "#95e6cb",
      l5: "#b6f6e0",
    },
    indigo: {
      l1: "#50b6cb",
      l2: "#5ccfe6",
      l3: "#68ddf5",
      l4: "#85eaff",
      l5: "#b7f2ff",
    },
    blue: {
      l1: "#27b4ee",
      l2: "#49c3fa",
      l3: "#73d0ff",
      l4: "#a2deff",
      l5: "#caecff",
    },
    purple: {
      l1: "#c483fc",
      l2: "#cd98fd",
      l3: "#d6acfe",
      l4: "#dfbfff",
      l5: "#eedfff",
    },
  },
  surface: {
    sunk: "#181c26",
    base: "#1f2430",
    lift: "#242936",
    over: "#ffffff",
  },
  ui: {
    fg: "#707a8c",
    bg: "#1f2430",
    line: "#171b24",
    border: "#242b38",
    selection: {
      active: "rgba(99, 117, 153, 0.15)",
      normal: "rgba(105, 117, 140, 0.12)",
    },
    panel: {
      bg: "#282e3b",
      shadow: "rgba(0, 0, 0, 0.2)",
    },
    popup: {
      bg: "#1c212c",
      shadow: "rgba(0, 0, 0, 0.3)",
    },
  },
  editor: {
    fg: "#cccac2",
    bg: "#242936",
    line: "#1a1f29",
    selection: {
      active: "rgba(64, 159, 255, 0.25)",
      inactive: "rgba(64, 159, 255, 0.13)",
    },
    findMatch: {
      active: "#736950",
      inactive: "rgba(115, 105, 80, 0.4)",
    },
    lineNumber: {
      active: "#707a8c",
      normal: "rgba(112, 122, 140, 0.5)",
    },
    indentGuide: {
      active: "rgba(112, 122, 140, 0.44)",
      normal: "rgba(112, 122, 140, 0.23)",
    },
  },
  syntax: {
    tag: "#5ccfe6",
    func: "#ffcd66",
    entity: "#73d0ff",
    string: "#d5ff80",
    regexp: "#95e6cb",
    markup: "#f28779",
    keyword: "#ffa659",
    special: "#d9be98",
    comment: "#6e7c8f",
    constant: "#dfbfff",
    operator: "#f29e74",
  },
  common: {
    accent: {
      tint: "#ffcc66",
      on: "#735923",
      hover: "#e6b450",
    },
    error: "#ff6666",
  },
  vcs: {
    added: "#87d96c",
    modified: "#80bfff",
    removed: "#f27983",
  },
} as const;

export const THEME_TOKENS = {
  colors: {
    canvas: AYU_MIRAGE.surface.base,
    canvasDark: AYU_MIRAGE.surface.sunk,
    surface: AYU_MIRAGE.surface.lift,
    surfaceRaised: AYU_MIRAGE.ui.panel.bg,
    surfaceHover: "#282e3d",
    borderSubtle: AYU_MIRAGE.ui.line,
    borderFocus: AYU_MIRAGE.common.accent.tint,
    textPrimary: AYU_MIRAGE.editor.fg,
    textMuted: AYU_MIRAGE.ui.fg,
    textSubtle: "#556073",
    tagBg: AYU_MIRAGE.surface.sunk,
    accent: {
      primary: AYU_MIRAGE.common.accent.tint,
      gradient: "linear-gradient(135deg, #ffcc66 0%, #ffa659 100%)",
      hover: AYU_MIRAGE.common.accent.hover,
      onAccent: AYU_MIRAGE.common.accent.on,
      success: AYU_MIRAGE.vcs.added,
      warning: AYU_MIRAGE.syntax.keyword,
      danger: AYU_MIRAGE.common.error,
      info: AYU_MIRAGE.syntax.entity,
    },
  },
  typography: {
    fontSans: "var(--font-sans)",
    fontMono: "var(--font-mono)",
  },
  transitions: {
    fast: "120ms ease-out",
    normal: "200ms ease-out",
  },
} as const;

export const SUPPORTED_LANGUAGES = [
  { id: "typescript", name: "TypeScript", ext: ".ts" },
  { id: "javascript", name: "JavaScript", ext: ".js" },
  { id: "rust", name: "Rust", ext: ".rs" },
  { id: "python", name: "Python", ext: ".py" },
  { id: "java", name: "Java", ext: ".java" },
  { id: "cpp", name: "C++", ext: ".cpp" },
  { id: "sql", name: "SQL", ext: ".sql" },
  { id: "html", name: "HTML", ext: ".html" },
  { id: "css", name: "CSS", ext: ".css" },
  { id: "json", name: "JSON", ext: ".json" },
  { id: "markdown", name: "Markdown", ext: ".md" },
  { id: "shell", name: "Shell / Bash", ext: ".sh" },
  { id: "yaml", name: "YAML", ext: ".yaml" },
  { id: "plaintext", name: "Plain Text", ext: ".txt" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["id"];
