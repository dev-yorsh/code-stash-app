import { useCallback, useEffect, useRef, useState } from "react";

interface UseHorizontalResizeOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
}

/**
 * Coalesces horizontal mouse-drag resize updates to one animation frame per
 * paint cycle, suppresses descendant pointer-event churn while dragging, and
 * tears down listeners safely on mouseup, blur, or unmount.
 */
export function useHorizontalResize({
  initialWidth,
  minWidth,
  maxWidth,
}: UseHorizontalResizeOptions) {
  const [width, setWidth] = useState(initialWidth);
  const latestWidthRef = useRef(initialWidth);
  latestWidthRef.current = width;

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      cleanupRef.current?.();

      const startX = e.clientX;
      const startW = latestWidthRef.current;
      let rafId: number | null = null;
      let pendingWidth: number | null = null;

      document.body.classList.add("codestash-resizing");
      document.body.style.cursor = "col-resize";

      const flushPendingWidth = () => {
        rafId = null;
        if (pendingWidth !== null) {
          setWidth(pendingWidth);
          pendingWidth = null;
        }
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        const clamped = Math.max(
          minWidth,
          Math.min(maxWidth, startW + (moveEvent.clientX - startX))
        );
        pendingWidth = clamped;
        if (rafId === null) {
          rafId = window.requestAnimationFrame(flushPendingWidth);
        }
      };

      const stopResizing = () => {
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (pendingWidth !== null) {
          setWidth(pendingWidth);
          pendingWidth = null;
        }
        document.body.classList.remove("codestash-resizing");
        document.body.style.cursor = "default";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", stopResizing);
        window.removeEventListener("blur", stopResizing);
        cleanupRef.current = null;
      };

      cleanupRef.current = stopResizing;
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", stopResizing);
      window.addEventListener("blur", stopResizing);
    },
    [minWidth, maxWidth]
  );

  return { width, setWidth, startResizing };
}
