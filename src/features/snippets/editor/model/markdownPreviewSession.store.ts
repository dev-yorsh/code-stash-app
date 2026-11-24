import { create } from "zustand";

export const MARKDOWN_PREVIEW_STORAGE_KEY = "codestash_markdown_preview_enabled";

function readStoredMarkdownPreview(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(MARKDOWN_PREVIEW_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredMarkdownPreview(enabled: boolean): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(MARKDOWN_PREVIEW_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage quota or restricted-context errors
  }
}

function clearStoredMarkdownPreview(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(MARKDOWN_PREVIEW_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export interface MarkdownPreviewSessionState {
  /**
   * Persistent preference for Markdown preview mode.
   * Remembered across fragment switches, snippet/folder changes, and app restarts.
   */
  isMarkdownPreviewEnabled: boolean;
  setMarkdownPreviewEnabled: (enabled: boolean) => void;
  toggleMarkdownPreview: () => boolean;
  syncFromStorage: () => void;
  resetSession: () => void;
}

export const useMarkdownPreviewSessionStore = create<MarkdownPreviewSessionState>((set, get) => ({
  isMarkdownPreviewEnabled: readStoredMarkdownPreview(),
  setMarkdownPreviewEnabled: (enabled) => {
    writeStoredMarkdownPreview(enabled);
    set({ isMarkdownPreviewEnabled: enabled });
  },
  toggleMarkdownPreview: () => {
    const next = !get().isMarkdownPreviewEnabled;
    writeStoredMarkdownPreview(next);
    set({ isMarkdownPreviewEnabled: next });
    return next;
  },
  syncFromStorage: () => {
    set({ isMarkdownPreviewEnabled: readStoredMarkdownPreview() });
  },
  resetSession: () => {
    clearStoredMarkdownPreview();
    set({ isMarkdownPreviewEnabled: false });
  },
}));
