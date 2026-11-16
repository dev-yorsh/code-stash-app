import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type React from "react";
import { useHorizontalResize } from "../useHorizontalResize";
import {
  useSidebarResize,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
} from "@/features/navigation/hooks/useSidebarResize";
import {
  useSnippetListResize,
  MIN_LIST_WIDTH,
  MAX_LIST_WIDTH,
  DEFAULT_LIST_WIDTH,
} from "@/features/snippets/hooks/useSnippetListResize";

describe("useHorizontalResize and panel resize hooks", () => {
  let rafQueue: FrameRequestCallback[];
  let rafSpy: ReturnType<typeof vi.spyOn>;
  let cancelRafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rafQueue = [];
    rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    rafSpy.mockRestore();
    cancelRafSpy.mockRestore();
    document.body.classList.remove("codestash-resizing");
    document.body.style.cursor = "default";
  });

  const flushRaf = () => {
    const callbacks = [...rafQueue];
    rafQueue = [];
    callbacks.forEach((cb) => cb(performance.now()));
  };

  it("coalesces rapid horizontal mousemove events into a single animation frame and clamps width", () => {
    const { result } = renderHook(() =>
      useHorizontalResize({ initialWidth: 250, minWidth: 180, maxWidth: 400 })
    );

    const startEvent = {
      preventDefault: vi.fn(),
      clientX: 250,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.startResizing(startEvent);
    });

    expect(startEvent.preventDefault).toHaveBeenCalled();
    expect(document.body.classList.contains("codestash-resizing")).toBe(true);
    expect(document.body.style.cursor).toBe("col-resize");

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 280 }));
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 330 }));
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 500 }));
    });

    // Scheduled once per frame regardless of bursts of raw mousemove events
    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(result.current.width).toBe(250);

    act(() => {
      flushRaf();
    });

    expect(result.current.width).toBe(400);

    // Lower clamp check + mouseup cleanup
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 50 }));
      window.dispatchEvent(new MouseEvent("mouseup"));
    });

    expect(result.current.width).toBe(180);
    expect(document.body.classList.contains("codestash-resizing")).toBe(false);
    expect(document.body.style.cursor).toBe("default");
  });

  it("cleans up active resize listeners and cursor state if component unmounts mid-drag", () => {
    const { result, unmount } = renderHook(() => useSidebarResize());
    expect(result.current.sidebarWidth).toBe(DEFAULT_SIDEBAR_WIDTH);

    act(() => {
      result.current.startResizing({
        preventDefault: vi.fn(),
        clientX: 200,
      } as unknown as React.MouseEvent);
    });

    expect(document.body.classList.contains("codestash-resizing")).toBe(true);
    unmount();
    expect(document.body.classList.contains("codestash-resizing")).toBe(false);
    expect(document.body.style.cursor).toBe("default");
  });

  it("preserves bounds on useSidebarResize and useSnippetListResize", () => {
    const sidebar = renderHook(() => useSidebarResize());
    expect(sidebar.result.current.sidebarWidth).toBe(DEFAULT_SIDEBAR_WIDTH);
    expect(MIN_SIDEBAR_WIDTH).toBeLessThan(DEFAULT_SIDEBAR_WIDTH);
    expect(MAX_SIDEBAR_WIDTH).toBeGreaterThan(DEFAULT_SIDEBAR_WIDTH);

    const list = renderHook(() => useSnippetListResize());
    expect(list.result.current.listWidth).toBe(DEFAULT_LIST_WIDTH);
    expect(MIN_LIST_WIDTH).toBeLessThan(DEFAULT_LIST_WIDTH);
    expect(MAX_LIST_WIDTH).toBeGreaterThan(DEFAULT_LIST_WIDTH);
  });
});
