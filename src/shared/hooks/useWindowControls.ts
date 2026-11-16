import { useState, useEffect, useCallback } from "react";
import { AppWindowPort } from "@/shared/api/contracts/app-window.port";
import { appWindow as defaultAppWindow } from "@/shared/api";

export interface UseWindowControlsReturn {
  isMaximized: boolean;
  handleMinimize: () => Promise<void>;
  handleToggleMaximize: () => Promise<void>;
  handleClose: () => Promise<void>;
}

/**
 * Hook to manage desktop window actions cleanly decoupled from presentation UI.
 * Consumes AppWindowPort interface.
 */
export function useWindowControls(
  port: AppWindowPort = defaultAppWindow
): UseWindowControlsReturn {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkState = async () => {
      try {
        const state = await port.isMaximized();
        if (isMounted) setIsMaximized(state);
      } catch (e) {
        console.error("Failed to query window maximized state:", e);
      }
    };
    checkState();
    return () => {
      isMounted = false;
    };
  }, [port]);

  const handleMinimize = useCallback(async () => {
    try {
      await port.minimize();
    } catch (e) {
      console.error("Failed to minimize window:", e);
    }
  }, [port]);

  const handleToggleMaximize = useCallback(async () => {
    try {
      await port.toggleMaximize();
      const state = await port.isMaximized();
      setIsMaximized(state);
    } catch (e) {
      console.error("Failed to toggle maximize window:", e);
    }
  }, [port]);

  const handleClose = useCallback(async () => {
    try {
      await port.close();
    } catch (e) {
      console.error("Failed to close window:", e);
    }
  }, [port]);

  return {
    isMaximized,
    handleMinimize,
    handleToggleMaximize,
    handleClose,
  };
}
