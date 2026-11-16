import type { AppearanceConfigFile } from "@/features/settings/types";

export interface ElectronAPI {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<boolean>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  /**
   * Synchronizes the native BrowserWindow canvas color with the active UI theme
   * so horizontal resize / maximize frames never expose a mismatched dark gutter.
   */
  setWindowBackgroundColor?: (color: string) => Promise<{ success: boolean; error?: string }>;
  getAppearanceConfigPath: () => Promise<string>;
  readAppearanceConfig: () => Promise<{
    success: boolean;
    exists: boolean;
    data?: AppearanceConfigFile;
    path: string;
    error?: string;
  }>;
  writeAppearanceConfig: (config: AppearanceConfigFile) => Promise<{
    success: boolean;
    path: string;
    error?: string;
  }>;
  openAppearanceConfigFile: () => Promise<{ success: boolean; error?: string }>;
  chooseThemeFile: () => Promise<{
    canceled: boolean;
    filePath?: string;
    content?: string;
    error?: string;
  }>;
  openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
  setSpellCheckConfig?: (config: {
    enabled: boolean;
    language: "es" | "en";
  }) => Promise<{ success: boolean; error?: string }>;
  isWordMisspelled?: (word: string) => boolean;
  getWordSuggestions?: (word: string) => string[];
  ignoreSpellCheckWord?: (word: string) => Promise<{ success: boolean; error?: string }>;
  addWordToDictionary?: (word: string) => Promise<{ success: boolean; error?: string }>;
  onSpellCheckConfigChanged?: (
    callback: (config: { enabled: boolean }) => void
  ) => () => void;
  executeEditCommand?: (
    command: "cut" | "copy" | "paste" | "selectAll"
  ) => Promise<{ success: boolean; error?: string }>;
  writeRichClipboard?: (payload: {
    text: string;
    html?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  writeImageClipboard?: (payload: {
    bytes?: Uint8Array;
    dataUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  getBackupInfo?: () => Promise<{
    success: boolean;
    exists: boolean;
    path: string;
    updatedAt?: string;
    sizeBytes?: number;
    error?: string;
  }>;
  readAutoBackup?: () => Promise<{
    success: boolean;
    exists: boolean;
    path: string;
    content?: string;
    updatedAt?: string;
    sizeBytes?: number;
    error?: string;
  }>;
  writeAutoBackup?: (content: string) => Promise<{
    success: boolean;
    path: string;
    updatedAt?: string;
    sizeBytes?: number;
    error?: string;
  }>;
  openBackupLocation?: () => Promise<{ success: boolean; error?: string }>;
  exportBackupFile?: (payload: { content: string; defaultFileName: string }) => Promise<{
    canceled: boolean;
    success?: boolean;
    filePath?: string;
    error?: string;
  }>;
  chooseBackupImportFile?: () => Promise<{
    canceled: boolean;
    filePath?: string;
    fileName?: string;
    content?: string;
    error?: string;
  }>;
  exportBinaryBackupFile?: (payload: {
    bytes: Uint8Array;
    defaultFileName: string;
  }) => Promise<{
    canceled: boolean;
    success?: boolean;
    filePath?: string;
    error?: string;
  }>;
  chooseBinaryBackupImportFile?: () => Promise<{
    canceled: boolean;
    filePath?: string;
    fileName?: string;
    bytes?: Uint8Array;
    textContent?: string;
    error?: string;
  }>;
  saveAsset?: (payload: {
    id: string;
    ext: string;
    mimeType: string;
    bytes: Uint8Array;
    width?: number;
    height?: number;
  }) => Promise<{
    success: boolean;
    meta?: {
      id: string;
      ext: string;
      mimeType: string;
      sizeBytes: number;
      width?: number;
      height?: number;
      createdAt: string;
    };
    error?: string;
  }>;
  readAsset?: (id: string) => Promise<{
    success: boolean;
    exists: boolean;
    meta?: {
      id: string;
      ext: string;
      mimeType: string;
      sizeBytes: number;
      width?: number;
      height?: number;
      createdAt: string;
    };
    bytes?: Uint8Array;
    error?: string;
  }>;
  listAssets?: () => Promise<{
    success: boolean;
    assets: Array<{
      id: string;
      ext: string;
      mimeType: string;
      sizeBytes: number;
      width?: number;
      height?: number;
      createdAt: string;
    }>;
    error?: string;
  }>;
  pruneOrphanAssets?: (referencedIds: string[]) => Promise<{
    success: boolean;
    removedCount: number;
    error?: string;
  }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
