import { Palette, Code2, Sliders, Info } from "lucide-react";
import { AppSettings, SettingsSection } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  language: "es",
  theme: "codestash-onedark",
  fontSize: 13,
  fontFamily: "Fira Code",
  tabSize: 2,
  wordWrap: true,
  lineNumbers: true,
  spellcheck: true,
  customThemes: [],
};

export const SETTINGS_STORAGE_KEY = "codestash_settings";
export const APPEARANCE_CONFIG_FILE_NAME = "appearance-config.json";

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "general",
    label: "General",
    description: "Idioma y respaldo de datos.",
    icon: Sliders,
  },
  {
    id: "appearance",
    label: "Apariencia",
    description: "Personaliza el tema, colores y tamaño de fuente.",
    icon: Palette,
  },
  {
    id: "editor",
    label: "Editor de texto",
    description: "Opciones de indentación, ajuste de línea y ortografía.",
    icon: Code2,
  },
  {
    id: "about",
    label: "Acerca de",
    description: "Versión, licencia y créditos de la aplicación.",
    icon: Info,
  },
];

export const THEME_OPTIONS: { id: AppSettings["theme"]; label: string; description: string }[] = [
  {
    id: "codestash-onedark",
    label: "CodeStash - OneDark (Predeterminado)",
    description: "Tema oscuro estilo OneDark / SnippetsLab con sidebar carbón, selección azul acero y sintaxis vibrante.",
  },
  {
    id: "codestash-spacegray",
    label: "CodeStash - Spacegray",
    description: "Tema oscuro elegante estilo Spacegray / Base16 Ocean con contrastes azul pizarra y tipografía nítida.",
  },
  {
    id: "codestash-light-modern",
    label: "CodeStash - Light Modern",
    description: "Tema claro moderno estilo macOS / SnippetsLab con acentos azul sistema y tipografía limpia.",
  },
  {
    id: "one-dark",
    label: "One Dark",
    description: "Tema icónico One Dark Pro con tonos oscuros y sintaxis balanceada.",
  },
];

export const FONT_SIZE_OPTIONS = [11, 12, 13, 14, 15, 16, 18, 20];
