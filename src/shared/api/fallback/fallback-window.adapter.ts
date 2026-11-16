import { AppWindowPort } from "../contracts/app-window.port";

export class FallbackWindowAdapter implements AppWindowPort {
  async minimize(): Promise<void> {
    if (typeof window !== "undefined" && window.electronAPI) {
      await window.electronAPI.minimize();
    }
  }

  async toggleMaximize(): Promise<void> {
    if (typeof window !== "undefined" && window.electronAPI) {
      await window.electronAPI.toggleMaximize();
    }
  }

  async isMaximized(): Promise<boolean> {
    if (typeof window !== "undefined" && window.electronAPI) {
      return await window.electronAPI.isMaximized();
    }
    return false;
  }

  async close(): Promise<void> {
    if (typeof window !== "undefined" && window.electronAPI) {
      await window.electronAPI.close();
    }
  }
}
