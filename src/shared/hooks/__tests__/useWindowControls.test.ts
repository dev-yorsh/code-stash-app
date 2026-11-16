import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWindowControls } from "../useWindowControls";
import { AppWindowPort } from "@/shared/api/contracts/app-window.port";

describe("useWindowControls hook", () => {
  const createMockPort = (initialMaximized = false): AppWindowPort => {
    let maximized = initialMaximized;
    return {
      minimize: vi.fn().mockResolvedValue(undefined),
      toggleMaximize: vi.fn().mockImplementation(async () => {
        maximized = !maximized;
      }),
      isMaximized: vi.fn().mockImplementation(async () => maximized),
      close: vi.fn().mockResolvedValue(undefined),
    };
  };

  it("initializes with isMaximized state from port", async () => {
    const mockPort = createMockPort(true);
    const { result } = renderHook(() => useWindowControls(mockPort));

    // Wait for effect to query state
    await act(async () => {});

    expect(result.current.isMaximized).toBe(true);
    expect(mockPort.isMaximized).toHaveBeenCalled();
  });

  it("triggers minimize via port", async () => {
    const mockPort = createMockPort(false);
    const { result } = renderHook(() => useWindowControls(mockPort));

    await act(async () => {
      await result.current.handleMinimize();
    });

    expect(mockPort.minimize).toHaveBeenCalledTimes(1);
  });

  it("toggles maximize and updates state", async () => {
    const mockPort = createMockPort(false);
    const { result } = renderHook(() => useWindowControls(mockPort));

    await act(async () => {
      await result.current.handleToggleMaximize();
    });

    expect(mockPort.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(result.current.isMaximized).toBe(true);
  });

  it("triggers close via port", async () => {
    const mockPort = createMockPort(false);
    const { result } = renderHook(() => useWindowControls(mockPort));

    await act(async () => {
      await result.current.handleClose();
    });

    expect(mockPort.close).toHaveBeenCalledTimes(1);
  });
});
