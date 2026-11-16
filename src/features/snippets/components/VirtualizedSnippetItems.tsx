import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Snippet } from "@/core/types";

export const VIRTUALIZATION_THRESHOLD = 40;
const ESTIMATED_ROW_HEIGHT = 86;
const OVERSCAN_COUNT = 6;

export interface VirtualizedSnippetItemsHandle {
  scrollToSnippet: (snippetId: string) => void;
}

export interface VirtualizedSnippetItemsProps {
  snippets: Snippet[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  renderItem: (snippet: Snippet) => React.ReactNode;
}

interface MeasuredRowProps {
  snippetId: string;
  onMeasure: (snippetId: string, height: number) => void;
  children: React.ReactNode;
}

const MeasuredRow: React.FC<MeasuredRowProps> = ({ snippetId, onMeasure, children }) => {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const report = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) {
        onMeasure(snippetId, Math.round(h));
      }
    };

    report();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(report);
      observer.observe(el);
      return () => observer.disconnect();
    }
    return undefined;
  }, [snippetId, onMeasure]);

  return (
    <div ref={rowRef} data-snippet-row-id={snippetId}>
      {children}
    </div>
  );
};

export function findStartIndexForOffset(offsets: Float64Array, targetY: number): number {
  let lo = 0;
  let hi = Math.max(0, offsets.length - 1);
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (offsets[mid] <= targetY) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return Math.max(0, lo - 1);
}

export const VirtualizedSnippetItems = forwardRef<
  VirtualizedSnippetItemsHandle,
  VirtualizedSnippetItemsProps
>(({ snippets, scrollContainerRef, renderItem }, ref) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [measureVersion, setMeasureVersion] = useState(0);
  const measuredHeightsRef = useRef<Map<string, number>>(new Map());

  const handleMeasure = useCallback((snippetId: string, height: number) => {
    const prev = measuredHeightsRef.current.get(snippetId);
    if (prev !== height) {
      measuredHeightsRef.current.set(snippetId, height);
      setMeasureVersion((v) => v + 1);
    }
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateMetrics = () => {
      setViewportHeight(el.clientHeight);
      setScrollTop(el.scrollTop);
    };

    updateMetrics();

    const onScroll = () => {
      setScrollTop(el.scrollTop);
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateMetrics);
      resizeObserver.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", onScroll);
      resizeObserver?.disconnect();
    };
  }, [scrollContainerRef]);

  const shouldVirtualize =
    snippets.length > VIRTUALIZATION_THRESHOLD && viewportHeight > 0;

  const { offsets, totalHeight, indexById } = useMemo(() => {
    const len = snippets.length;
    const pos = new Float64Array(len);
    const idMap = new Map<string, number>();
    let y = 0;

    for (let i = 0; i < len; i += 1) {
      const id = snippets[i].id;
      pos[i] = y;
      idMap.set(id, i);
      y += measuredHeightsRef.current.get(id) ?? ESTIMATED_ROW_HEIGHT;
    }

    return {
      offsets: pos,
      totalHeight: y,
      indexById: idMap,
    };
    // measureVersion intentionally recalculates cumulative offsets when rows resize
  }, [snippets, measureVersion]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToSnippet: (snippetId: string) => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const domRow = container.querySelector(
          `[data-snippet-id="${snippetId}"]`
        ) as HTMLElement | null;
        if (domRow && typeof domRow.scrollIntoView === "function") {
          domRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return;
        }

        const idx = indexById.get(snippetId);
        if (idx === undefined) return;
        const itemTop = offsets[idx] ?? idx * ESTIMATED_ROW_HEIGHT;
        const itemHeight =
          measuredHeightsRef.current.get(snippetId) ?? ESTIMATED_ROW_HEIGHT;
        const viewTop = container.scrollTop;
        const viewBottom = viewTop + container.clientHeight;

        if (itemTop < viewTop) {
          container.scrollTop = itemTop;
        } else if (itemTop + itemHeight > viewBottom) {
          container.scrollTop = Math.max(0, itemTop + itemHeight - container.clientHeight);
        }
      },
    }),
    [scrollContainerRef, indexById, offsets]
  );

  if (!shouldVirtualize) {
    return (
      <>
        {snippets.map((snippet) => (
          <React.Fragment key={snippet.id}>{renderItem(snippet)}</React.Fragment>
        ))}
      </>
    );
  }

  const rawStart = findStartIndexForOffset(offsets, scrollTop);
  const rawEnd = findStartIndexForOffset(offsets, scrollTop + viewportHeight);
  const startIndex = Math.max(0, rawStart - OVERSCAN_COUNT);
  const endIndex = Math.min(snippets.length - 1, rawEnd + OVERSCAN_COUNT);
  const topOffset = offsets[startIndex] ?? 0;
  const visibleSlice = snippets.slice(startIndex, endIndex + 1);

  return (
    <div
      style={{ height: `${totalHeight}px`, position: "relative" }}
      data-testid="virtualized-snippet-container"
    >
      <div
        style={{
          transform: `translateY(${topOffset}px)`,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
        }}
      >
        {visibleSlice.map((snippet) => (
          <MeasuredRow
            key={snippet.id}
            snippetId={snippet.id}
            onMeasure={handleMeasure}
          >
            {renderItem(snippet)}
          </MeasuredRow>
        ))}
      </div>
    </div>
  );
});
VirtualizedSnippetItems.displayName = "VirtualizedSnippetItems";
