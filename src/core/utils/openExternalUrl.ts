import { open } from "@tauri-apps/plugin-shell";

/**
 * Opens an external URL or mailto link using the platform's default application/browser.
 * Supports Electron, Tauri v2, and standard web browser environments.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;

  const isElectron = typeof window !== "undefined" && "electronAPI" in window && !!window.electronAPI?.openExternalUrl;
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  try {
    if (isElectron && window.electronAPI?.openExternalUrl) {
      const res = await window.electronAPI.openExternalUrl(url);
      if (res?.success) return;
    }

    if (isTauri) {
      await open(url);
      return;
    }

    // Web browser fallback
    if (url.startsWith("mailto:")) {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (err) {
    console.error("[openExternalUrl] Error opening link:", url, err);
    // Ultimate fallback for browser/webview
    if (url.startsWith("mailto:")) {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
}
