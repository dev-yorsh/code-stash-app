import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorStatusBar } from "../EditorStatusBar";

describe("EditorStatusBar (Presentational Slice)", () => {
  it("renders lines count, char count, and current language", () => {
    render(
      <EditorStatusBar
        language="typescript"
        isManualLanguage={true}
        lineCount={42}
        charCount={1337}
        onSelectLanguage={vi.fn()}
        onResetAutoDetect={vi.fn()}
      />
    );

    expect(screen.getByText("42 líneas")).toBeInTheDocument();
    expect(screen.getByText("1337 caracteres")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("shows (auto) indicator when isManualLanguage is false", () => {
    render(
      <EditorStatusBar
        language="rust"
        isManualLanguage={false}
        lineCount={10}
        charCount={100}
        onSelectLanguage={vi.fn()}
        onResetAutoDetect={vi.fn()}
      />
    );

    expect(screen.getByText("(auto)")).toBeInTheDocument();
  });

  it("opens language selector popover and allows selecting a language", () => {
    const handleSelect = vi.fn();
    render(
      <EditorStatusBar
        language="javascript"
        isManualLanguage={true}
        lineCount={5}
        charCount={50}
        onSelectLanguage={handleSelect}
        onResetAutoDetect={vi.fn()}
      />
    );

    // Click language trigger button
    const trigger = screen.getByTitle("Selector de lenguaje (Clic para cambiar)");
    fireEvent.click(trigger);

    // Popover opens with search input and Auto-detect at the start of the list
    expect(screen.getByPlaceholderText("Buscar lenguaje...")).toBeInTheDocument();
    expect(screen.getByText("Autodetectar")).toBeInTheDocument();
    expect(screen.queryByText("Select Language")).toBeNull();

    // Click Python option
    const pythonBtn = screen.getByText("Python");
    fireEvent.click(pythonBtn);

    expect(handleSelect).toHaveBeenCalledWith("python");
  });

  it("allows resetting to auto-detect", () => {
    const handleReset = vi.fn();
    render(
      <EditorStatusBar
        language="python"
        isManualLanguage={true}
        lineCount={5}
        charCount={50}
        onSelectLanguage={vi.fn()}
        onResetAutoDetect={handleReset}
      />
    );

    // Open menu
    const trigger = screen.getByTitle("Selector de lenguaje (Clic para cambiar)");
    fireEvent.click(trigger);

    // Click Auto-detect button
    const autoDetectBtn = screen.getByText("Autodetectar");
    fireEvent.click(autoDetectBtn);

    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});
