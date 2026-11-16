import { useHorizontalResize } from "../../../shared/hooks/useHorizontalResize";

export const DEFAULT_LIST_WIDTH = 288;
export const MIN_LIST_WIDTH = 210;
export const MAX_LIST_WIDTH = 550;

export function useSnippetListResize(initialWidth = DEFAULT_LIST_WIDTH) {
  const { width: listWidth, setWidth: setListWidth, startResizing } =
    useHorizontalResize({
      initialWidth,
      minWidth: MIN_LIST_WIDTH,
      maxWidth: MAX_LIST_WIDTH,
    });

  return { listWidth, setListWidth, startResizing };
}
