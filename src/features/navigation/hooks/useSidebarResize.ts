import { useHorizontalResize } from "../../../shared/hooks/useHorizontalResize";

export const DEFAULT_SIDEBAR_WIDTH = 224;
export const MIN_SIDEBAR_WIDTH = 175;
export const MAX_SIDEBAR_WIDTH = 420;

export function useSidebarResize(initialWidth = DEFAULT_SIDEBAR_WIDTH) {
  const { width: sidebarWidth, setWidth: setSidebarWidth, startResizing } =
    useHorizontalResize({
      initialWidth,
      minWidth: MIN_SIDEBAR_WIDTH,
      maxWidth: MAX_SIDEBAR_WIDTH,
    });

  return { sidebarWidth, setSidebarWidth, startResizing };
}
