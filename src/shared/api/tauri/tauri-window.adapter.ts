import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppWindowPort } from "../contracts/app-window.port";

export class TauriWindowAdapter implements AppWindowPort {
  async minimize(): Promise<void> {
    await getCurrentWindow().minimize();
  }

  async toggleMaximize(): Promise<void> {
    await getCurrentWindow().toggleMaximize();
  }

  async isMaximized(): Promise<boolean> {
    return await getCurrentWindow().isMaximized();
  }

  async close(): Promise<void> {
    await getCurrentWindow().close();
  }
}
