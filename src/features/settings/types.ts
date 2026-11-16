import { LucideIcon } from "lucide-react";

export interface ThemeColors {
  base: string;       // Background principal de la app
  sunk: string;       // Fondos hundidos (inputs, buscador, status bar, badges)
  lift: string;       // Fondos elevados (editor, tarjetas)
  panel: string;      // Modales y paneles flotantes
  popup: string;      // Menús contextuales y popovers
  line: string;       // Divisores principales y bordes estructurales
  border: string;     // Bordes secundarios sutiles
  fg: string;         // Texto secundario y etiquetas
  fgSubtle: string;   // Texto atenuado y leyendas
  editorFg: string;   // Texto principal y código
  accent: string;     // Acento primario (dorado Ayu, etc.)
  accentHover: string;
  accentOn: string;    // Texto legible sobre el acento
  error: string;
  success: string;
  warning: string;
  info: string;

  // Component-specific overrides (opcionales para personalización granular)
  sidebarBg?: string;      // Fondo del panel de carpetas
  sidebarBorder?: string;  // Borde derecho del panel de carpetas
  sidebarHoverBg?: string; // Fondo hover discreto de elementos en el sidebar
  listBg?: string;         // Fondo del panel de lista de snippets
  listBorder?: string;     // Borde del panel de lista de snippets
  editorPanelBg?: string;  // Fondo del panel de código y edición
  titlebarBg?: string;     // Fondo de la barra superior
  titlebarBorder?: string; // Borde inferior de la barra superior
  searchbarBg?: string;    // Fondo de la barra de búsqueda
  searchbarBorder?: string;// Borde de la barra de búsqueda
  fragmentsBg?: string;    // Fondo de la barra de pestañas de fragmentos
  fragmentsDividerHeight?: string; // Altura/porcentaje del divisor de fragmentos (ej: "50%", "16px")
  statusbarBg?: string;    // Fondo de la barra de estado inferior

  // Etiquetas / Tags overrides
  sidebarTagBg?: string;          // Fondo de etiquetas en el sidebar
  sidebarTagBorder?: string;      // Borde de etiquetas en el sidebar
  sidebarTagFg?: string;          // Texto de etiquetas en el sidebar
  sidebarTagActiveBg?: string;    // Fondo de etiqueta activa en el sidebar
  sidebarTagActiveBorder?: string;// Borde de etiqueta activa en el sidebar
  sidebarTagActiveFg?: string;    // Texto de etiqueta activa en el sidebar
  listTagBg?: string;             // Fondo de etiquetas en tarjetas de snippets
  listTagBorder?: string;         // Borde de etiquetas en tarjetas de snippets
  listTagFg?: string;             // Texto de etiquetas en tarjetas de snippets
  tagBadgeBg?: string;            // Fondo de etiquetas tipo badge
  tagBadgeBorder?: string;        // Borde de etiquetas tipo badge
  tagBadgeFg?: string;            // Texto de etiquetas tipo badge

  // Selección de código y editor CodeMirror overrides
  editorSelectionBg?: string;     // Color de selección de código en el editor
  editorSelectionFg?: string;     // Color de texto seleccionado en el editor
  editorSelectionMatch?: string;  // Color de ocurrencias coincidentes seleccionadas
  editorCursor?: string;          // Color del cursor/caret en el editor
  editorActiveLineBg?: string;    // Fondo de la línea activa en el editor
  editorGutterBg?: string;        // Fondo del gutter (números de línea)
  editorGutterFg?: string;        // Color de números de línea
  editorActiveGutterFg?: string;  // Color del número de línea activo
}

export interface ThemeDefinition {
  id: string;
  name: string;
  description?: string;
  isDark?: boolean;
  category?: string;
  colors: ThemeColors;
}

export type AppLanguage = "es" | "en";

export interface AppearanceConfigFile {
  theme: string;
  fontSize: number;
  fontFamily: string;
  language?: AppLanguage;
  customThemes?: ThemeDefinition[];
}

export interface AppSettings {
  language: AppLanguage;
  theme: string; // Theme ID
  fontSize: number; // in pixels, e.g. 14
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  spellcheck: boolean;
  customThemes: ThemeDefinition[];
}

export type SettingsSectionId = "appearance" | "editor" | "general" | "about";

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
}
