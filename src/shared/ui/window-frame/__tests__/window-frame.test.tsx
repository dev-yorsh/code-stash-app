import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Titlebar, WindowControls, WindowSearchbar } from "../index";

describe("Window Frame UI Primitives", () => {
  describe("WindowControls", () => {
    it("renders minimize, maximize, and close buttons", () => {
      const onMin = vi.fn();
      const onMax = vi.fn();
      const onClose = vi.fn();

      render(
        <WindowControls
          isMaximized={false}
          onMinimize={onMin}
          onToggleMaximize={onMax}
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Minimizar ventana" }));
      expect(onMin).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "Maximizar ventana" }));
      expect(onMax).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "Cerrar ventana" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("displays restore title when isMaximized is true", () => {
      render(
        <WindowControls
          isMaximized={true}
          onMinimize={() => {}}
          onToggleMaximize={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByTitle("Restaurar")).toBeInTheDocument();
    });
  });

  describe("WindowSearchbar", () => {
    it("renders search input with shortcut badge and calls onChange", () => {
      const handleChange = vi.fn();
      render(
        <WindowSearchbar
          value=""
          onChange={handleChange}
          placeholder="Filter snippets..."
          shortcutBadge="Ctrl K"
        />
      );

      const input = screen.getByPlaceholderText("Filter snippets...");
      fireEvent.change(input, { target: { value: "react" } });
      expect(handleChange).toHaveBeenCalledWith("react");
      expect(screen.getByText("Ctrl K")).toBeInTheDocument();
    });
  });

  describe("Titlebar", () => {
    it("renders slots correctly", () => {
      render(
        <Titlebar
          brandSlot={<div data-testid="brand-slot">CodeStash</div>}
          centerSlot={<div data-testid="search-slot">Search</div>}
          controlsSlot={<div data-testid="controls-slot">Controls</div>}
        />
      );

      expect(screen.getByTestId("brand-slot")).toBeInTheDocument();
      expect(screen.getByTestId("search-slot")).toBeInTheDocument();
      expect(screen.getByTestId("controls-slot")).toBeInTheDocument();
    });
  });
});
