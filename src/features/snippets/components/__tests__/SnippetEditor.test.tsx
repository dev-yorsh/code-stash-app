import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { openExternalUrl } from "@/core/utils/openExternalUrl";
import { SettingsProvider } from "@/features/settings/context/SettingsContext";
import { EditorSettings } from "@/features/settings/components/sections/EditorSettings";
import { SnippetEditor } from "../SnippetEditor";
import { useFormattingBarSessionStore } from "../../editor";
import * as mermaidRenderer from "../../editor/utils/mermaidRenderer";
import { CreateSnippetInput, Snippet, Tag, UpdateSnippetInput } from "@/core/types";

vi.mock("@/core/utils/openExternalUrl", () => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof Range !== "undefined") {
    const zeroRect = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect;

    if (!Range.prototype.getClientRects) {
      Range.prototype.getClientRects = (() => ({
        length: 1,
        0: zeroRect,
        item: () => zeroRect,
        [Symbol.iterator]: function* () {
          yield zeroRect;
        },
      })) as unknown as () => DOMRectList;
    }
    if (!Range.prototype.getBoundingClientRect) {
      Range.prototype.getBoundingClientRect = () => zeroRect;
    }
  }
});

const createMockSnippet = (overrides: Partial<Snippet> = {}): Snippet => {
  const now = new Date().toISOString();
  const baseCode = overrides.code ?? "";
  const baseLang = overrides.language ?? "plaintext";

  return {
    id: overrides.id ?? "snip-1",
    title: overrides.title ?? "Nota de prueba",
    description: overrides.description ?? "",
    code: baseCode,
    language: baseLang,
    folder_id: overrides.folder_id ?? null,
    tags: overrides.tags ?? [],
    is_favorite: overrides.is_favorite ?? false,
    is_deleted: overrides.is_deleted ?? false,
    deleted_at: overrides.deleted_at ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
    fragments: overrides.fragments ?? [
      {
        id: "frag-1",
        label: "Fragmento 1",
        code: baseCode,
        language: baseLang,
      },
    ],
  };
};

type AutoSaveFn = (
  data: CreateSnippetInput | UpdateSnippetInput,
  existingId: string | null
) => Promise<Snippet>;

describe("SnippetEditor Dual-Mode (Plain Text Rich Engine & Dynamic Pill Bar)", () => {
  const tags: Tag[] = [];
  let onAutoSave: ReturnType<typeof vi.fn<AutoSaveFn>>;

  beforeEach(() => {
    useFormattingBarSessionStore.getState().resetSession();
    onAutoSave = vi.fn<AutoSaveFn>().mockImplementation(async (data) =>
      createMockSnippet({
        title: data.title ?? "Nota de prueba",
        code: data.code ?? "",
        language: data.language ?? "plaintext",
        fragments: data.fragments,
      })
    );
  });

  it("hides TextFormattingBar by default when Plain Text snippet is empty", () => {
    const emptySnippet = createMockSnippet({ code: "", language: "plaintext" });

    render(<SnippetEditor snippet={emptySnippet} tags={tags} onAutoSave={onAutoSave} />);

    expect(screen.getByTestId("rich-text-editor-panel")).toBeInTheDocument();
    const toolbar = screen.getByTestId("text-formatting-bar");
    expect(toolbar).toHaveAttribute("data-visible", "false");
    expect(toolbar).toHaveAttribute("aria-hidden", "true");
    expect(toolbar.className).toContain("grid-rows-[0fr]");
  });

  it("displays centered TextFormattingBar when Plain Text has text, right below FragmentTabs", () => {
    const multiFragSnippet = createMockSnippet({
      code: "Lista de ideas rápidas",
      language: "plaintext",
      fragments: [
        { id: "f-1", label: "Notas", code: "Lista de ideas rápidas", language: "plaintext" },
        { id: "f-2", label: "Script", code: "console.log(1);", language: "javascript" },
      ],
    });

    const { container } = render(
      <SnippetEditor snippet={multiFragSnippet} tags={tags} onAutoSave={onAutoSave} />
    );

    const toolbar = screen.getByTestId("text-formatting-bar");
    expect(toolbar).toHaveAttribute("data-visible", "true");
    expect(toolbar.className).toContain("grid-rows-[1fr]");

    // Verify centered wrapper inside toolbar
    const centeredRow = toolbar.firstElementChild;
    expect(centeredRow?.className).toContain("justify-center");

    // Verify DOM placement directly after the FragmentTabs container
    const fragBarWrapper = container.querySelector(".animate-fragment-bar");
    expect(fragBarWrapper).not.toBeNull();
    expect(fragBarWrapper?.nextElementSibling).toBe(toolbar);
  });

  it("hides TextFormattingBar and renders CodeEditorPanel for code languages", () => {
    const rustSnippet = createMockSnippet({
      code: 'fn main() {\n  println!("Hola");\n}',
      language: "rust",
    });

    render(<SnippetEditor snippet={rustSnippet} tags={tags} onAutoSave={onAutoSave} />);

    expect(screen.queryByTestId("rich-text-editor-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "false");
  });

  it("provides direct inline marks, categorized block style menu, unified lists menu, interactive checklist, and table controls", async () => {
    const plainSnippet = createMockSnippet({
      code: "Titulo principal",
      language: "plaintext",
    });

    render(<SnippetEditor snippet={plainSnippet} tags={tags} onAutoSave={onAutoSave} />);

    // Verify direct 1-click inline formatting controls on the capsule dock
    expect(screen.getByRole("button", { name: "Negrita" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cursiva" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subrayado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tachado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monoestilo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resaltar texto" })).toBeInTheDocument();

    // Open Block Hierarchy & Special Blocks menu
    fireEvent.click(screen.getByTestId("block-style-trigger"));
    const blockPopover = screen.getByTestId("block-style-popover");
    expect(blockPopover).toBeInTheDocument();
    expect(blockPopover.textContent).not.toMatch(/\bH[123]\b/);
    expect(screen.getByRole("button", { name: "Título" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Encabezado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subtítulo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cuerpo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cita en bloque" })).toBeInTheDocument();

    // Apply Título formatting and verify block trigger shows text without H1 icon while staying in plaintext
    fireEvent.click(screen.getByRole("button", { name: "Título" }));

    await waitFor(() => {
      expect(screen.getByTestId("rich-text-editor-panel")).toBeInTheDocument();
      expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "true");
      const triggerText = screen.getByTestId("block-style-trigger").textContent ?? "";
      expect(triggerText).toContain("Título");
      expect(triggerText).not.toContain("H1");
      expect(
        screen.getByTestId("rich-text-editor-panel").querySelector("h1")?.textContent
      ).toContain("Titulo principal");
    });

    // Open unified Lists dropdown grouping ALL list formats together
    fireEvent.click(screen.getByTestId("lists-menu-trigger"));
    expect(screen.getByTestId("lists-menu-popover")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lista con viñetas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lista con guiones" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lista enumerada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lista de verificación" })).toBeInTheDocument();

    // Convert to interactive Checklist and toggle checkbox checked state
    fireEvent.click(screen.getByRole("button", { name: "Lista de verificación" }));
    await waitFor(() => {
      expect(
        screen.getByTestId("rich-text-editor-panel").querySelector('ul[data-type="taskList"]')
      ).not.toBeNull();
    });

    const checkbox = screen
      .getByTestId("rich-text-editor-panel")
      .querySelector('ul[data-type="taskList"] input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    await waitFor(() => {
      const taskItem = screen
        .getByTestId("rich-text-editor-panel")
        .querySelector('ul[data-type="taskList"] li');
      expect(taskItem).toHaveAttribute("data-checked", "true");
      expect(checkbox.checked).toBe(true);
    });

    // Open table grid selector and insert a 2x3 table
    fireEvent.click(screen.getByTestId("format-table-trigger"));
    expect(screen.getByTestId("table-format-popover")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tabla 2 × 3" }));

    await waitFor(() => {
      const table = screen.getByTestId("rich-text-editor-panel").querySelector("table");
      expect(table).not.toBeNull();
      expect(table?.querySelectorAll("tr").length).toBe(2);
    });

    // Table popover stays open cleanly after insertion and immediately reveals Row/Column actions
    expect(screen.getByTestId("table-format-popover")).toBeInTheDocument();
    expect(screen.getByText("Filas")).toBeInTheDocument();
    expect(screen.getByText("Columnas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar tabla" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("table-format-popover")).not.toBeInTheDocument();
  });

  it("auto-switches to CodeEditorPanel and hides TextFormattingBar when code is pasted", async () => {
    const emptySnippet = createMockSnippet({ code: "", language: "plaintext" });

    render(<SnippetEditor snippet={emptySnippet} tags={tags} onAutoSave={onAutoSave} />);

    const proseMirrorEl = screen
      .getByTestId("rich-text-editor-panel")
      .querySelector(".ProseMirror")!;

    fireEvent.paste(proseMirrorEl, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain"
            ? 'fn main() {\n    println!("Hello, Rust!");\n}'
            : "",
      },
    });

    await waitFor(() => {
      expect(screen.queryByTestId("rich-text-editor-panel")).not.toBeInTheDocument();
      expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "false");
    });
  });

  it("applies highlight swatches, dashed list, normalized link, full-canvas select-text, and clears formatting", async () => {
    const plainSnippet = createMockSnippet({
      code: "Nota importante",
      language: "plaintext",
    });

    render(<SnippetEditor snippet={plainSnippet} tags={tags} onAutoSave={onAutoSave} />);

    // Editor wrapper must remain selectable (never select-none) down to empty bottom lines
    const richPanel = screen.getByTestId("rich-text-editor-panel");
    expect(richPanel.className).toContain("select-text");
    expect(richPanel.className).not.toContain("select-none");

    // Separate highlight color dot icon is hidden; clicking "Resaltar texto" opens the color palette
    expect(screen.queryByTestId("highlight-palette-toggle")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("format-highlight-btn"));
    expect(screen.getByTestId("highlight-palette-popover")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sky" })).toBeInTheDocument();

    // Open Lists menu and choose Lista con guiones
    fireEvent.click(screen.getByTestId("lists-menu-trigger"));
    fireEvent.click(screen.getByRole("button", { name: "Lista con guiones" }));
    await waitFor(() => {
      expect(
        screen
          .getByTestId("rich-text-editor-panel")
          .querySelector('ul[data-list-style="dash"]')
      ).not.toBeNull();
    });

    // Link trigger is hidden from the floating formatting toolbar (moved exclusively to context menu)
    expect(screen.queryByTestId("format-link-trigger")).not.toBeInTheDocument();

    // Right-click selected text to insert a link with custom Display Name and URL
    const proseEl = screen.getByTestId("rich-text-editor-panel").querySelector(".ProseMirror")!;
    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });
    fireEvent.contextMenu(proseEl, { clientX: 60, clientY: 60 });
    fireEvent.click(screen.getByTestId("context-submenu-link"));

    const labelInput = screen.getByTestId("context-link-label-input") as HTMLInputElement;
    const urlInput = screen.getByTestId("context-link-url-input") as HTMLInputElement;
    expect(labelInput.value).toBe("Nota importante");

    fireEvent.change(labelInput, { target: { value: "CodeStash Docs" } });
    fireEvent.change(urlInput, { target: { value: "codestash.app" } });
    fireEvent.submit(screen.getByTestId("context-link-form"));

    await waitFor(() => {
      const anchor = screen.getByTestId("rich-text-editor-panel").querySelector("a");
      expect(anchor).not.toBeNull();
      expect(anchor?.getAttribute("href")).toBe("https://codestash.app");
      expect(anchor?.textContent).toBe("CodeStash Docs");
    });

    // Clear formatting resets nodes cleanly back to plain paragraph
    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });
    fireEvent.click(screen.getByTestId("format-clear-btn"));
    await waitFor(() => {
      expect(
        screen.getByTestId("rich-text-editor-panel").querySelector("ul")
      ).toBeNull();
    });
  });

  it("removes ¶ icon on Cuerpo, provides responsive layout classes, color picker, and alignment options", async () => {
    const plainSnippet = createMockSnippet({
      code: "Texto configurable",
      language: "plaintext",
    });

    render(<SnippetEditor snippet={plainSnippet} tags={tags} onAutoSave={onAutoSave} />);

    // Responsive sizing classes without forced horizontal overflow
    const richPanel = screen.getByTestId("rich-text-editor-panel");
    expect(richPanel.className).toContain("min-w-0");
    expect(richPanel.className).toContain("w-full");

    // No ¶ icon on Cuerpo trigger pill or dropdown option
    const blockTrigger = screen.getByTestId("block-style-trigger");
    expect(blockTrigger.textContent).not.toContain("¶");
    fireEvent.click(blockTrigger);
    const cuerpoBtn = screen.getByRole("button", { name: "Cuerpo" });
    expect(cuerpoBtn.textContent).not.toContain("¶");
    fireEvent.click(cuerpoBtn);

    // Focus editor & trigger ProseMirror Mod+A selection before applying color mark
    const proseEl = richPanel.querySelector(".ProseMirror") as HTMLElement;
    fireEvent.focus(proseEl);
    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });

    // Text color swatch application & reset (popover stays open while previewing options)
    fireEvent.click(screen.getByTestId("text-color-trigger"));
    expect(screen.getByTestId("text-color-popover")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));

    await waitFor(() => {
      expect(richPanel.querySelector('span[data-text-color="#3b82f6"]')).not.toBeNull();
    });

    expect(screen.getByTestId("text-color-popover")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("text-color-reset-btn"));

    await waitFor(() => {
      expect(richPanel.querySelector('span[data-text-color="#3b82f6"]')).toBeNull();
    });

    // Alignment selection (center -> justify) stays open until outside click or Escape
    fireEvent.click(screen.getByTestId("align-menu-trigger"));
    expect(screen.getByTestId("align-menu-popover")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("align-center-btn"));

    await waitFor(() => {
      expect(richPanel.querySelector('p[data-align="center"]')).not.toBeNull();
    });

    expect(screen.getByTestId("align-menu-popover")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("align-justify-btn"));

    await waitFor(() => {
      expect(richPanel.querySelector('p[data-align="justify"]')).not.toBeNull();
    });
    expect(screen.getByTestId("align-menu-popover")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("align-menu-popover")).not.toBeInTheDocument();
  });

  it("pastes multi-line code into Monoestilo as a single unified <pre><code> block and opens clicked links externally", async () => {
    const mockOpenExternal = vi.mocked(openExternalUrl);
    mockOpenExternal.mockClear();

    const plainSnippet = createMockSnippet({
      code: "[Tauri](https://tauri.app)",
      language: "plaintext",
    });

    render(<SnippetEditor snippet={plainSnippet} tags={tags} onAutoSave={onAutoSave} />);

    const richPanel = screen.getByTestId("rich-text-editor-panel");

    // 1. Clicking an external link invokes openExternalUrl with its href
    const linkEl = richPanel.querySelector("a[href='https://tauri.app']")!;
    expect(linkEl).not.toBeNull();
    fireEvent.click(linkEl, { button: 0 });
    expect(mockOpenExternal).toHaveBeenCalledWith("https://tauri.app");

    // 2. Switching to Monoestilo and pasting token-wrapped IDE HTML code keeps ONE <pre><code> block
    fireEvent.click(screen.getByTestId("format-mono-btn"));
    await waitFor(() => {
      expect(richPanel.querySelector("pre code")).not.toBeNull();
    });

    const proseEl = richPanel.querySelector(".ProseMirror")!;
    fireEvent.paste(proseEl, {
      clipboardData: {
        getData: (type: string) => {
          if (type === "text/plain") {
            return "const a = 1;\nconst b = 2;";
          }
          if (type === "text/html") {
            return '<div class="hljs"><span>const</span> <span>a</span> <span>=</span> <span>1;</span></div><div><span>const</span> <span>b</span> <span>=</span> <span>2;</span></div>';
          }
          return "";
        },
      },
    });

    await waitFor(() => {
      const preBlocks = richPanel.querySelectorAll("pre");
      expect(preBlocks).toHaveLength(1);
      expect(preBlocks[0].textContent).toContain("const a = 1;");
      expect(preBlocks[0].textContent).toContain("const b = 2;");
    });
  });

  it("renders CodeEditorPanel with responsive min-w-0 w-full container classes", () => {
    const codeSnippet = createMockSnippet({
      code: "const veryLongVariableName = 'fits responsively';",
      language: "typescript",
    });

    const { container } = render(
      <SnippetEditor snippet={codeSnippet} tags={tags} onAutoSave={onAutoSave} />
    );

    const cmWrapper = container.querySelector(".cm-theme")?.parentElement;
    expect(cmWrapper?.className).toContain("min-w-0");
    expect(cmWrapper?.className).toContain("w-full");
  });

  it("enables spellcheck in Plain Text and header while keeping code blocks and CodeEditorPanel unchecked, and reacts to EditorSettings", async () => {
    const plainSnippet = createMockSnippet({
      code: "Texto normal `codigoInline`",
      language: "plaintext",
    });

    const mockSetSpellCheck = vi.fn().mockResolvedValue({ success: true });
    window.electronAPI = {
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn(),
      getAppearanceConfigPath: vi.fn().mockResolvedValue("appearance-config.json"),
      readAppearanceConfig: vi.fn().mockResolvedValue({ success: true, exists: false, path: "" }),
      writeAppearanceConfig: vi.fn().mockResolvedValue({ success: true, path: "" }),
      openAppearanceConfigFile: vi.fn(),
      chooseThemeFile: vi.fn(),
      openExternalUrl: vi.fn(),
      setSpellCheckConfig: mockSetSpellCheck,
    };

    const { rerender } = render(
      <SettingsProvider>
        <EditorSettings />
        <SnippetEditor snippet={plainSnippet} tags={tags} onAutoSave={onAutoSave} />
      </SettingsProvider>
    );

    const proseEl = screen.getByTestId("rich-text-editor-panel").querySelector(".ProseMirror")!;
    expect(proseEl).toHaveAttribute("spellcheck", "true");
    expect(proseEl.querySelector("code")).toHaveAttribute("spellcheck", "false");
    expect(screen.getByPlaceholderText(/Sin título/i)).toHaveAttribute("spellcheck", "true");

    // Disable spellcheck via EditorSettings checkbox and verify live DOM & IPC synchronization
    const spellCheckbox = screen.getByTestId("settings-spellcheck-checkbox") as HTMLInputElement;
    expect(spellCheckbox.checked).toBe(true);
    fireEvent.click(spellCheckbox);

    await waitFor(() => {
      expect(spellCheckbox.checked).toBe(false);
      expect(proseEl).toHaveAttribute("spellcheck", "false");
      expect(mockSetSpellCheck).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    // Re-enable before testing programming code panel
    fireEvent.click(spellCheckbox);

    const tsSnippet = createMockSnippet({
      id: "snip-code",
      code: "const x = 1;",
      language: "typescript",
    });
    rerender(
      <SettingsProvider>
        <EditorSettings />
        <SnippetEditor snippet={tsSnippet} tags={tags} onAutoSave={onAutoSave} />
      </SettingsProvider>
    );

    await waitFor(() => {
      const cmContent = document.querySelector(".cm-content");
      expect(cmContent).not.toBeNull();
      expect(cmContent?.getAttribute("spellcheck")).not.toBe("true");
    });

    delete window.electronAPI;
    localStorage.removeItem("codestash_settings");
  });

  it("displays theme-adaptive 'Sin color' icon default option in text color picker and adapts underline bar", async () => {
    const plainSnippet = createMockSnippet({
      code: "Color adaptable",
      language: "plaintext",
    });

    render(<SnippetEditor snippet={plainSnippet} tags={tags} onAutoSave={onAutoSave} />);

    // Default state: underline bar beneath A uses adaptive CSS variable, not fixed red
    const indicatorBar = screen.getByTestId("text-color-indicator-bar");
    expect(indicatorBar).toHaveStyle({ backgroundColor: "var(--ayu-editor-fg)" });

    const proseEl = screen.getByTestId("rich-text-editor-panel").querySelector(".ProseMirror")!;
    fireEvent.focus(proseEl);
    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });

    // Open text color palette: "Sin color" option is visible, marked active by default
    fireEvent.click(screen.getByTestId("text-color-trigger"));
    const noColorBtn = screen.getByTestId("text-color-reset-btn");
    expect(noColorBtn).toHaveAttribute("aria-pressed", "true");
    expect(noColorBtn).toHaveAttribute("title", "Sin color (Predeterminado)");

    // Apply custom black/blue, then reset via "Sin color" while popover stays open
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));
    await waitFor(() => {
      expect(screen.getByTestId("rich-text-editor-panel").querySelector('span[data-text-color="#3b82f6"]')).not.toBeNull();
    });

    expect(screen.getByTestId("text-color-popover")).toBeInTheDocument();
    expect(screen.getByTestId("text-color-reset-btn")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByTestId("text-color-reset-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("rich-text-editor-panel").querySelector('span[data-text-color]')).toBeNull();
      expect(screen.getByTestId("text-color-indicator-bar")).toHaveStyle({
        backgroundColor: "var(--ayu-editor-fg)",
      });
    });
  });

  it("opens contextual secondary-click menus for empty panel list, text selection formatting, and table modifications", async () => {
    const plainSnippet = createMockSnippet({
      code: "Linea inicial",
      language: "plaintext",
    });

    render(<SnippetEditor snippet={plainSnippet} tags={tags} onAutoSave={onAutoSave} />);

    const richPanel = screen.getByTestId("rich-text-editor-panel");
    const proseEl = richPanel.querySelector(".ProseMirror") as HTMLElement;

    // 1. Empty selection right-click opens Panel insertion list (Table, Blockquote, Monoestilo)
    fireEvent.contextMenu(proseEl, { clientX: 60, clientY: 60 });
    const ctxMenu = screen.getByTestId("rich-text-context-menu");
    expect(ctxMenu).toBeInTheDocument();
    expect(screen.getByTestId("context-panel-insert-section")).toBeInTheDocument();
    expect(screen.getByTestId("context-insert-table-btn")).toHaveTextContent("Insertar tabla");
    expect(screen.getByTestId("context-insert-blockquote-btn")).toHaveTextContent(
      "Agregar cita en bloque"
    );
    expect(screen.getByTestId("context-insert-codeblock-btn")).toHaveTextContent(
      "Agregar bloque de código (Monoestilo)"
    );

    // Clicking "Insertar tabla" inserts a real table into the note
    fireEvent.click(screen.getByTestId("context-insert-table-btn"));
    await waitFor(() => {
      expect(richPanel.querySelector("table")).not.toBeNull();
      expect(richPanel.querySelectorAll("table tr").length).toBe(3);
    });

    // Right-click inside table shows Table modification menu (Rows, Columns, Delete Table)
    const firstCell = richPanel.querySelector("table td, table th")!;
    fireEvent.click(firstCell);
    fireEvent.contextMenu(firstCell, { clientX: 80, clientY: 80 });
    expect(screen.getByTestId("context-table-section")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Agregar fila abajo" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Eliminar fila" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Agregar columna derecha" })).toBeInTheDocument();

    // Execute Delete Table cleanly from context menu
    fireEvent.click(screen.getByRole("menuitem", { name: "Eliminar tabla" }));
    await waitFor(() => {
      expect(richPanel.querySelector("table")).toBeNull();
    });

    // Panel right-click -> "Agregar bloque de código (Monoestilo)"
    fireEvent.contextMenu(proseEl, { clientX: 60, clientY: 60 });
    fireEvent.click(screen.getByTestId("context-insert-codeblock-btn"));
    await waitFor(() => {
      expect(richPanel.querySelector("pre code")).not.toBeNull();
    });

    // Toggle back out of the newly inserted codeBlock first so we format normal paragraphs
    fireEvent.click(screen.getByTestId("format-mono-btn"));
    await waitFor(() => {
      expect(richPanel.querySelector("pre")).toBeNull();
    });

    // 2. Selecting text and right-clicking shows Formatting options (inline bar + color "Sin color" + clear)
    fireEvent.focus(proseEl);
    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });
    fireEvent.contextMenu(proseEl, { clientX: 60, clientY: 60 });
    expect(screen.getByTestId("context-inline-format-strip")).toBeInTheDocument();
    expect(screen.getByTestId("context-submenu-blocks")).toBeInTheDocument();
    expect(screen.getByTestId("context-submenu-color")).toBeInTheDocument();
    expect(screen.getByTestId("context-submenu-align")).toBeInTheDocument();
    expect(screen.getByTestId("context-submenu-lists")).toBeInTheDocument();

    // Open Text Color submenu via context menu and verify Sin color option exists
    fireEvent.click(screen.getByTestId("context-submenu-color"));
    expect(screen.getByTestId("context-text-color-reset-btn")).toHaveTextContent("Sin color");

    // Apply Bold directly from context menu strip
    const boldInContextMenu = within(screen.getByTestId("context-inline-format-strip")).getByRole(
      "button",
      { name: "Negrita" }
    );
    fireEvent.click(boldInContextMenu);
    await waitFor(() => {
      expect(richPanel.querySelector("strong")).not.toBeNull();
    });
  });

  it("shows Ortografía category with ONLY Ignorar and Desactivar/Activar ortografía (suggestions disabled)", async () => {
    const mockIgnore = vi.fn().mockResolvedValue({ success: true });
    const mockAddDict = vi.fn().mockResolvedValue({ success: true });
    const mockSetSpell = vi.fn().mockResolvedValue({ success: true });

    window.electronAPI = {
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn(),
      getAppearanceConfigPath: vi.fn().mockResolvedValue("appearance-config.json"),
      readAppearanceConfig: vi.fn().mockResolvedValue({ success: true, exists: false, path: "" }),
      writeAppearanceConfig: vi.fn().mockResolvedValue({ success: true, path: "" }),
      openAppearanceConfigFile: vi.fn(),
      chooseThemeFile: vi.fn(),
      openExternalUrl: vi.fn(),
      setSpellCheckConfig: mockSetSpell,
      isWordMisspelled: (word: string) => word === "pruva" || word === "codigoo",
      getWordSuggestions: (word: string) =>
        word === "pruva" ? ["prueba"] : word === "codigoo" ? ["código"] : [],
      ignoreSpellCheckWord: mockIgnore,
      addWordToDictionary: mockAddDict,
    };

    const plainSnippet = createMockSnippet({
      code: "pruva",
      language: "plaintext",
    });

    render(
      <SettingsProvider>
        <EditorSettings />
        <SnippetEditor snippet={plainSnippet} tags={tags} onAutoSave={onAutoSave} />
      </SettingsProvider>
    );

    const richPanel = screen.getByTestId("rich-text-editor-panel");
    const proseEl = richPanel.querySelector(".ProseMirror") as HTMLElement;

    // 1. Selecting/clicking the highlighted misspelled word displays Ortografía quick popover without suggestions
    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });
    fireEvent.mouseUp(proseEl, { button: 0, clientX: 40, clientY: 40 });

    await waitFor(() => {
      expect(screen.getByTestId("spellcheck-quick-popover")).toBeInTheDocument();
    });
    const quickSpellingSection = screen.getByTestId("spelling-category-section");
    expect(quickSpellingSection).toHaveTextContent("Ortografía");
    expect(screen.queryByTestId("spell-suggestion-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spell-add-dict-btn")).not.toBeInTheDocument();
    expect(quickSpellingSection).not.toHaveTextContent("prueba");
    expect(quickSpellingSection).not.toHaveTextContent("Sin sugerencias");
    expect(screen.getByTestId("spell-ignore-btn")).toHaveTextContent("Ignorar");
    expect(screen.getByTestId("spell-toggle-btn")).toHaveTextContent("Desactivar ortografía");

    // Clicking "Ignorar" calls IPC ignoreWord and dismisses popover (word won't pop up again)
    fireEvent.click(screen.getByTestId("spell-ignore-btn"));
    await waitFor(() => {
      expect(mockIgnore).toHaveBeenCalledWith("pruva");
      expect(screen.queryByTestId("spellcheck-quick-popover")).not.toBeInTheDocument();
    });

    // Re-selecting ignored "pruva" must NOT pop up spellcheck again
    fireEvent.mouseUp(proseEl, { button: 0, clientX: 40, clientY: 40 });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("spellcheck-quick-popover")).not.toBeInTheDocument();

    // 2. Replace text with another misspelled word "codigoo" and verify right-click Ortografía hides suggestions
    fireEvent.change(proseEl, {});
    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });
    fireEvent.paste(proseEl, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "codigoo" : ""),
      },
    });
    await waitFor(() => {
      expect(proseEl.textContent).toContain("codigoo");
    });

    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });
    fireEvent.contextMenu(proseEl, { clientX: 40, clientY: 40 });
    const ctxMenu = screen.getByTestId("rich-text-context-menu");
    expect(ctxMenu).toHaveTextContent("Ortografía");
    expect(screen.queryByTestId("spell-suggestion-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spell-add-dict-btn")).not.toBeInTheDocument();
    expect(ctxMenu).not.toHaveTextContent("código");
    expect(screen.getByTestId("spell-ignore-btn")).toHaveTextContent("Ignorar");
    expect(screen.getByTestId("spell-toggle-btn")).toHaveTextContent("Desactivar ortografía");

    // 3. Click "Desactivar ortografía" inside right-click Ortografía category
    fireEvent.click(screen.getByTestId("spell-toggle-btn"));

    await waitFor(() => {
      expect(proseEl).toHaveAttribute("spellcheck", "false");
      expect(mockSetSpell).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
      const checkbox = screen.getByTestId("settings-spellcheck-checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    // Re-opening context menu shows "Activar ortografía" under Ortografía
    fireEvent.contextMenu(proseEl, { clientX: 40, clientY: 40 });
    expect(screen.getByTestId("spell-toggle-btn")).toHaveTextContent("Activar ortografía");

    delete window.electronAPI;
    localStorage.removeItem("codestash_settings");
  });

  it("copies Plain Text notes with formatting (Word/WhatsApp) or without formatting (Obsidian Markdown) from header and context menu", async () => {
    const mockWriteRich = vi.fn().mockResolvedValue({ success: true });
    window.electronAPI = {
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn(),
      getAppearanceConfigPath: vi.fn(),
      readAppearanceConfig: vi.fn(),
      writeAppearanceConfig: vi.fn(),
      openAppearanceConfigFile: vi.fn(),
      chooseThemeFile: vi.fn(),
      openExternalUrl: vi.fn(),
      writeRichClipboard: mockWriteRich,
    };

    const richPlainSnippet = createMockSnippet({
      code: '<h1 data-align="center" style="text-align: center"><strong>Nota</strong> <span data-text-color="#3b82f6" style="color: #3b82f6">Azul</span></h1>\n\n<p data-align="right" style="text-align: right"><mark data-color="#e5c07b">Importante</mark> <u>detalle</u></p>',
      language: "plaintext",
    });

    render(<SnippetEditor snippet={richPlainSnippet} tags={tags} onAutoSave={onAutoSave} />);

    // 1. Header copy button offers both modes for Plain Text
    fireEvent.click(screen.getByTestId("copy-options-trigger"));
    fireEvent.click(screen.getByTestId("copy-with-formatting-btn"));

    await waitFor(() => {
      expect(mockWriteRich).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("background-color: #e5c07b;"),
          text: "*Nota Azul*\n\nImportante detalle",
        })
      );
    });
    expect(mockWriteRich.mock.calls[0][0].html).toContain("color: #3b82f6;");
    expect(mockWriteRich.mock.calls[0][0].html).toContain("<u>detalle</u>");
    expect(mockWriteRich.mock.calls[0][0].html).toContain("text-align: center;");

    // 2. Header "Copiar sin formato (Markdown)" copies pure Obsidian Markdown without HTML
    fireEvent.click(screen.getByTestId("copy-options-trigger"));
    fireEvent.click(screen.getByTestId("copy-as-markdown-btn"));

    await waitFor(() => {
      expect(mockWriteRich).toHaveBeenCalledTimes(2);
    });
    const markdownCall = mockWriteRich.mock.calls[1][0];
    expect(markdownCall.html).toBeUndefined();
    expect(markdownCall.text).toBe("# **Nota** Azul\n\n==Importante== detalle");
    expect(markdownCall.text).not.toMatch(/<\/?(?:p|h1|span|mark|u)\b/i);

    // 3. Context menu when selecting text provides both copy modes for selection
    const richPanel = screen.getByTestId("rich-text-editor-panel");
    const proseEl = richPanel.querySelector(".ProseMirror") as HTMLElement;
    fireEvent.focus(proseEl);
    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });
    fireEvent.contextMenu(proseEl, { clientX: 50, clientY: 50 });

    fireEvent.click(screen.getByTestId("context-copy-markdown-btn"));
    await waitFor(() => {
      expect(mockWriteRich).toHaveBeenCalledTimes(3);
    });
    expect(mockWriteRich.mock.calls[2][0]).toEqual({
      text: "# **Nota** Azul\n\n==Importante== detalle",
    });

    // 4. Re-open context menu and click "Copiar con formato" on selection
    fireEvent.contextMenu(proseEl, { clientX: 50, clientY: 50 });
    fireEvent.click(screen.getByTestId("context-copy-formatted-btn"));
    await waitFor(() => {
      expect(mockWriteRich).toHaveBeenCalledTimes(4);
    });
    expect(mockWriteRich.mock.calls[3][0]).toEqual(
      expect.objectContaining({
        html: expect.stringContaining("background-color: #e5c07b;"),
        text: "*Nota Azul*\n\nImportante detalle",
      })
    );

    delete window.electronAPI;
  });

  it("hides separate highlight color icon, opens colors on Resaltar texto click, keeps submenus open until outside click/Esc, and uses subtle active colors", async () => {
    const plainSnippet = createMockSnippet({
      code: "Texto resaltado y alineado",
      language: "plaintext",
    });

    render(<SnippetEditor snippet={plainSnippet} tags={tags} onAutoSave={onAutoSave} />);

    const richPanel = screen.getByTestId("rich-text-editor-panel");
    const proseEl = richPanel.querySelector(".ProseMirror") as HTMLElement;
    fireEvent.focus(proseEl);
    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });

    // 1. Separate highlight color dot toggle is gone; clicking "Resaltar texto" opens color palette
    expect(screen.queryByTestId("highlight-palette-toggle")).not.toBeInTheDocument();
    const highlightTrigger = screen.getByTestId("format-highlight-btn");
    fireEvent.click(highlightTrigger);
    expect(screen.getByTestId("highlight-palette-popover")).toBeInTheDocument();

    // Selecting Coral and then Sky keeps highlight popover open so user can preview colors
    fireEvent.click(screen.getByRole("button", { name: "Coral" }));
    await waitFor(() => {
      expect(richPanel.querySelector('mark[data-color="#e06c75"]')).not.toBeNull();
    });
    expect(screen.getByTestId("highlight-palette-popover")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sky" }));
    await waitFor(() => {
      expect(richPanel.querySelector('mark[data-color="#61afef"]')).not.toBeNull();
    });
    expect(screen.getByTestId("highlight-palette-popover")).toBeInTheDocument();

    // Remove highlight inside the open popover without closing it prematurely
    fireEvent.click(screen.getByTestId("highlight-clear-btn"));
    await waitFor(() => {
      expect(richPanel.querySelector("mark")).toBeNull();
    });
    expect(screen.getByTestId("highlight-palette-popover")).toBeInTheDocument();

    // Only clicking outside closes it
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId("highlight-palette-popover")).not.toBeInTheDocument();

    // 2. Submenus (blocks, alignment, lists) stay open across clicks and close ONLY on outside click or Escape
    fireEvent.click(screen.getByTestId("align-menu-trigger"));
    expect(screen.getByTestId("align-menu-popover")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("align-left-btn"));
    fireEvent.click(screen.getByTestId("align-center-btn"));
    fireEvent.click(screen.getByTestId("align-right-btn"));
    expect(screen.getByTestId("align-menu-popover")).toBeInTheDocument();
    await waitFor(() => {
      expect(richPanel.querySelector('p[data-align="right"]')).not.toBeNull();
    });

    // Pressing Escape dismisses alignment submenu cleanly
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("align-menu-popover")).not.toBeInTheDocument();

    // Block styles also remain open while testing options
    fireEvent.click(screen.getByTestId("block-style-trigger"));
    fireEvent.click(screen.getByRole("button", { name: "Título" }));
    expect(screen.getByTestId("block-style-popover")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Subtítulo" }));
    expect(screen.getByTestId("block-style-popover")).toBeInTheDocument();
    fireEvent.pointerDown(richPanel);
    expect(screen.queryByTestId("block-style-popover")).not.toBeInTheDocument();

    // 3. Active formatting pill buttons use subtle translucent accent tokens instead of glaring solid accent fill
    const boldBtn = screen.getByRole("button", { name: "Negrita" });
    fireEvent.click(boldBtn);
    await waitFor(() => {
      expect(boldBtn).toHaveAttribute("aria-pressed", "true");
    });
    expect(boldBtn.className).toContain("bg-[var(--toolbar-active-bg)]");
    expect(boldBtn.className).toContain("text-[var(--toolbar-active-fg)]");
    expect(boldBtn.className).not.toContain("bg-[var(--ayu-accent)]");
  });

  it("toggles formatting menu via both buttons while keeping icon-only header button visible in plain text mode", async () => {
    const snippetA = createMockSnippet({
      id: "snip-a",
      title: "Nota A",
      code: "Contenido carpeta A",
      language: "plaintext",
      folder_id: "folder-1",
    });
    const snippetB = createMockSnippet({
      id: "snip-b",
      title: "Nota B",
      code: "Contenido carpeta B",
      language: "plaintext",
      folder_id: "folder-2",
    });

    const { rerender } = render(
      <SnippetEditor
        key={snippetA.id}
        snippet={snippetA}
        activeFolderId="folder-1"
        tags={tags}
        onAutoSave={onAutoSave}
      />
    );

    // Header toggle button is icon-only and remains visible while Plain Text has content
    const headerToggleBtn = screen.getByTestId("toggle-formatting-bar-btn");
    expect(headerToggleBtn.textContent?.trim()).toBe("");
    expect(headerToggleBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "true");

    // Hide formatting menu from inside the floating bar via chevron minimize button
    fireEvent.click(screen.getByTestId("hide-formatting-bar-btn"));
    expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "false");
    expect(screen.getByTestId("toggle-formatting-bar-btn")).toHaveAttribute("aria-pressed", "false");

    // Simulate switching to another folder and snippet (key forces remount like SnippetWorkspace)
    rerender(
      <SnippetEditor
        key={snippetB.id}
        snippet={snippetB}
        activeFolderId="folder-2"
        tags={tags}
        onAutoSave={onAutoSave}
      />
    );

    // Must remain hidden across snippet & folder switches while header toggle button stays visible
    expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "false");
    expect(screen.getByTestId("toggle-formatting-bar-btn")).toHaveAttribute("aria-pressed", "false");

    // Also accessible from right-click context menu when hidden with custom A+gear formatting icon
    const proseEl = screen.getByTestId("rich-text-editor-panel").querySelector(".ProseMirror")!;
    fireEvent.contextMenu(proseEl, { clientX: 50, clientY: 50 });
    const showFromMenuBtn = screen.getByTestId("context-show-formatting-bar-btn");
    expect(showFromMenuBtn).toBeInTheDocument();
    expect(showFromMenuBtn.querySelector("svg")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });

    // Restore formatting bar from header toggle button (remains visible and reflects open state)
    fireEvent.click(screen.getByTestId("toggle-formatting-bar-btn"));
    expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "true");
    expect(screen.getByTestId("toggle-formatting-bar-btn")).toHaveAttribute("aria-pressed", "true");

    // Header toggle button can also minimize the formatting bar directly
    fireEvent.click(screen.getByTestId("toggle-formatting-bar-btn"));
    expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "false");
    expect(screen.getByTestId("toggle-formatting-bar-btn")).toHaveAttribute("aria-pressed", "false");
  });

  it("inserts and edits links with Display Name and Link URL solely from right-click context menu", async () => {
    const plainSnippet = createMockSnippet({
      code: "Nota con enlace",
      language: "plaintext",
    });

    render(<SnippetEditor snippet={plainSnippet} tags={tags} onAutoSave={onAutoSave} />);

    // Confirm floating toolbar has no Link button
    expect(screen.queryByTestId("format-link-trigger")).not.toBeInTheDocument();

    const richPanel = screen.getByTestId("rich-text-editor-panel");
    const proseEl = richPanel.querySelector(".ProseMirror")!;

    // Right-click with no text selection -> Mode 3 also exposes Link insertion
    fireEvent.contextMenu(proseEl, { clientX: 60, clientY: 60 });
    fireEvent.click(screen.getByTestId("context-submenu-link"));

    fireEvent.change(screen.getByTestId("context-link-label-input"), {
      target: { value: "Portal Oficial" },
    });
    fireEvent.change(screen.getByTestId("context-link-url-input"), {
      target: { value: "https://example.org" },
    });
    fireEvent.submit(screen.getByTestId("context-link-form"));

    await waitFor(() => {
      const anchor = richPanel.querySelector("a");
      expect(anchor).not.toBeNull();
      expect(anchor?.textContent).toBe("Portal Oficial");
      expect(anchor?.getAttribute("href")).toBe("https://example.org");
    });

    // Select all and edit existing link display name + URL via right-click context menu
    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });
    fireEvent.contextMenu(proseEl, { clientX: 60, clientY: 60 });
    fireEvent.click(screen.getByTestId("context-submenu-link"));

    const editLabelInput = screen.getByTestId("context-link-label-input") as HTMLInputElement;
    const editUrlInput = screen.getByTestId("context-link-url-input") as HTMLInputElement;
    expect(editLabelInput.value).toContain("Portal Oficial");

    fireEvent.change(editLabelInput, { target: { value: "Docs Actualizadas" } });
    fireEvent.change(editUrlInput, { target: { value: "docs.example.org" } });
    fireEvent.submit(screen.getByTestId("context-link-form"));

    await waitFor(() => {
      const anchor = richPanel.querySelector("a");
      expect(anchor).not.toBeNull();
      expect(anchor?.textContent).toBe("Docs Actualizadas");
      expect(anchor?.getAttribute("href")).toBe("https://docs.example.org");
    });
  });

  it("reveals formatting tools automatically when inserting plain text in a new snippet or creating a new fragment while hidden", async () => {
    const existingA = createMockSnippet({
      id: "existing-a",
      title: "Existente A",
      code: "Nota existente A",
      language: "plaintext",
      folder_id: "folder-1",
    });
    const existingEmptyB = createMockSnippet({
      id: "existing-empty-b",
      title: "Vacío anterior",
      code: "",
      language: "plaintext",
      folder_id: "folder-2",
    });

    const { rerender } = render(
      <SnippetEditor
        key={existingA.id}
        snippet={existingA}
        activeFolderId="folder-1"
        tags={tags}
        onAutoSave={onAutoSave}
      />
    );

    // 1. User hides formatting bar; state persists across navigation
    fireEvent.click(screen.getByTestId("hide-formatting-bar-btn"));
    expect(useFormattingBarSessionStore.getState().isFormattingBarHidden).toBe(true);

    // Older empty snippet NOT created as new in this session keeps hidden state when navigated to
    rerender(
      <SnippetEditor
        key={existingEmptyB.id}
        snippet={existingEmptyB}
        activeFolderId="folder-2"
        tags={tags}
        onAutoSave={onAutoSave}
      />
    );
    const emptyProseEl = screen
      .getByTestId("rich-text-editor-panel")
      .querySelector(".ProseMirror")!;
    fireEvent.paste(emptyProseEl, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? "Texto en nota antigua sin crear nueva" : "",
      },
    });
    await waitFor(() => {
      expect(screen.getByTestId("toggle-formatting-bar-btn")).toBeInTheDocument();
    });
    expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "false");

    // 2. Creating a NEW snippet and inserting plain text reveals formatting bar automatically
    const brandNewSnippet = createMockSnippet({
      id: "new-snip-1",
      title: "Untitled Snippet",
      code: "",
      language: "plaintext",
    });
    useFormattingBarSessionStore.getState().markNewSnippetPendingReveal(brandNewSnippet.id);

    rerender(
      <SnippetEditor
        key={brandNewSnippet.id}
        snippet={brandNewSnippet}
        tags={tags}
        onAutoSave={onAutoSave}
      />
    );
    expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "false");

    const newProseEl = screen
      .getByTestId("rich-text-editor-panel")
      .querySelector(".ProseMirror")!;
    fireEvent.paste(newProseEl, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? "Texto plano recién creado" : "",
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "true");
      expect(screen.getByTestId("toggle-formatting-bar-btn")).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });

    // 3. Hide formatting bar again, then add a new fragment inside the snippet -> reveals again
    fireEvent.click(screen.getByTestId("hide-formatting-bar-btn"));
    expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "false");

    fireEvent.click(screen.getByRole("button", { name: "Añadir pestaña de fragmento" }));

    await waitFor(() => {
      expect(useFormattingBarSessionStore.getState().isFormattingBarHidden).toBe(false);
    });

    const fragProseEl = screen
      .getByTestId("rich-text-editor-panel")
      .querySelector(".ProseMirror")!;
    fireEvent.paste(fragProseEl, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "Contenido nuevo fragmento" : ""),
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("text-formatting-bar")).toHaveAttribute("data-visible", "true");
      expect(screen.getByTestId("toggle-formatting-bar-btn")).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });
  });

  it("enables image resize toolbar and drag handles ONLY when the user clicks the image, not on hover", async () => {
    const imgSnippet = createMockSnippet({
      id: "snip-img-click-only",
      title: "Nota con imagen",
      language: "plaintext",
      code: "Texto previo\n\n![captura](https://example.com/demo.png)",
    });

    render(<SnippetEditor snippet={imgSnippet} tags={tags} onAutoSave={onAutoSave} />);

    const imageContainer = await screen.findByTestId("resizable-image-container");
    expect(imageContainer.className).not.toContain("group/img");
    expect(imageContainer.className).not.toContain("hover:ring-");

    // Hovering over the image must not render or enable resize controls
    fireEvent.mouseEnter(imageContainer);
    fireEvent.mouseOver(imageContainer);
    expect(screen.queryByTestId("resizable-image-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("image-resize-handle-left")).not.toBeInTheDocument();
    expect(screen.queryByTestId("image-resize-handle-right")).not.toBeInTheDocument();
    expect(screen.queryByTestId("image-resize-handle-corner")).not.toBeInTheDocument();

    // Clicking the image selects it and enables resize toolbar and drag handles
    fireEvent.click(imageContainer);
    await waitFor(() => {
      expect(screen.getByTestId("resizable-image-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("image-resize-handle-left")).toBeInTheDocument();
      expect(screen.getByTestId("image-resize-handle-right")).toBeInTheDocument();
      expect(screen.getByTestId("image-resize-handle-corner")).toBeInTheDocument();
    });

    // Preset resize button works while clicked/selected
    fireEvent.click(within(screen.getByTestId("resizable-image-toolbar")).getByText("50%"));
    await waitFor(() => {
      expect(screen.getByTestId("resizable-image-container").style.width).toBe("50%");
    });

    // Clicking outside the editor/image hides resize controls again
    const titleInput = screen.getByDisplayValue("Nota con imagen");
    fireEvent.pointerDown(titleInput);
    await waitFor(() => {
      expect(screen.queryByTestId("resizable-image-toolbar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("image-resize-handle-left")).not.toBeInTheDocument();
      expect(screen.queryByTestId("image-resize-handle-right")).not.toBeInTheDocument();
      expect(screen.queryByTestId("image-resize-handle-corner")).not.toBeInTheDocument();
    });
  });

  it("enables Copy image and Duplicate options when an image is selected, and duplicates/copies cleanly", async () => {
    const mockWriteImageClipboard = vi.fn().mockResolvedValue({ success: true });
    window.electronAPI = {
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn(),
      getAppearanceConfigPath: vi.fn().mockResolvedValue("appearance-config.json"),
      readAppearanceConfig: vi.fn().mockResolvedValue({ success: true, exists: false, path: "" }),
      writeAppearanceConfig: vi.fn().mockResolvedValue({ success: true, path: "" }),
      openAppearanceConfigFile: vi.fn(),
      chooseThemeFile: vi.fn(),
      openExternalUrl: vi.fn(),
      writeImageClipboard: mockWriteImageClipboard,
    };

    // 1x1 transparent PNG data URL
    const tinyPngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    const imgSnippet = createMockSnippet({
      id: "snip-img-copy-dup",
      title: "Nota copiar duplicar imagen",
      language: "plaintext",
      code: `![pixel](${tinyPngDataUrl})`,
    });

    render(<SnippetEditor snippet={imgSnippet} tags={tags} onAutoSave={onAutoSave} />);

    const imageContainer = await screen.findByTestId("resizable-image-container");
    expect(screen.queryByTestId("image-copy-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("image-duplicate-btn")).not.toBeInTheDocument();

    // Select image by clicking it
    fireEvent.click(imageContainer);
    const copyBtn = await screen.findByTestId("image-copy-btn");
    const dupBtn = screen.getByTestId("image-duplicate-btn");
    expect(copyBtn).toBeEnabled();
    expect(dupBtn).toBeEnabled();

    // Copy image writes PNG binary via IPC clipboard handler
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(mockWriteImageClipboard).toHaveBeenCalledTimes(1);
      const arg = mockWriteImageClipboard.mock.calls[0]?.[0];
      expect(arg?.bytes).toBeInstanceOf(Uint8Array);
      expect(arg?.bytes?.length).toBeGreaterThan(0);
    });

    // Secondary-clicking while selected also offers Copy image and Duplicate image
    const richPanel = screen.getByTestId("rich-text-editor-panel");
    fireEvent.contextMenu(richPanel, { clientX: 50, clientY: 50 });
    expect(screen.getByTestId("context-copy-image-btn")).toHaveTextContent("Copiar imagen");
    expect(screen.getByTestId("context-duplicate-image-btn")).toHaveTextContent("Duplicar imagen");

    // Duplicate from toolbar adds a second identical image node
    fireEvent.click(screen.getByTestId("image-duplicate-btn"));
    await waitFor(() => {
      expect(screen.getAllByTestId("resizable-image-container")).toHaveLength(2);
    });

    delete window.electronAPI;
  });

  it("auto-hides right-click submenus such as Insertar o editar enlace when the mouse leaves", async () => {
    const plainSnippet = createMockSnippet({
      id: "snip-submenu-hover",
      title: "Prueba submenu hover",
      language: "plaintext",
      code: "Texto para enlace",
    });

    render(<SnippetEditor snippet={plainSnippet} tags={tags} onAutoSave={onAutoSave} />);

    const richPanel = screen.getByTestId("rich-text-editor-panel");
    const proseEl = richPanel.querySelector(".ProseMirror") as HTMLElement;

    // Select text and right-click
    fireEvent.keyDown(proseEl, { key: "a", ctrlKey: true });
    fireEvent.contextMenu(proseEl, { clientX: 60, clientY: 60 });

    const linkBtn = screen.getByTestId("context-submenu-link");
    expect(screen.queryByTestId("context-link-submenu")).not.toBeInTheDocument();

    // Hovering "Insertar o editar enlace" opens its submenu automatically
    fireEvent.mouseEnter(linkBtn);
    expect(screen.getByTestId("context-link-submenu")).toBeInTheDocument();

    // Moving mouse away hides the submenu automatically
    fireEvent.mouseLeave(linkBtn.parentElement!);
    expect(screen.queryByTestId("context-link-submenu")).not.toBeInTheDocument();

    // Same auto-hide behavior holds for other submenus like Estilos de bloque
    const blocksBtn = screen.getByTestId("context-submenu-blocks");
    fireEvent.mouseEnter(blocksBtn);
    expect(blocksBtn).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseLeave(blocksBtn.parentElement!);
    expect(blocksBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("auto-detects pasted Markdown, reveals Preview button, and toggles between Markdown code and Mermaid preview", async () => {
    const renderMermaidSpy = vi
      .spyOn(mermaidRenderer, "renderMermaidDiagram")
      .mockResolvedValue({
        svg: '<svg data-testid="editor-mermaid-svg" viewBox="0 0 120 60"><rect width="120" height="60"/></svg>',
      });

    const emptySnippet = createMockSnippet({ code: "", language: "plaintext" });

    render(<SnippetEditor snippet={emptySnippet} tags={tags} onAutoSave={onAutoSave} />);

    // Preview button is hidden before Markdown content is pasted
    expect(screen.queryByTestId("toggle-markdown-preview-btn")).not.toBeInTheDocument();

    const proseMirrorEl = screen
      .getByTestId("rich-text-editor-panel")
      .querySelector(".ProseMirror")!;

    const pastedMarkdown = [
      "# Arquitectura CodeStash",
      "",
      "```mermaid",
      "flowchart LR",
      "  UI[Editor] --> Preview[Mermaid]",
      "```",
    ].join("\n");

    fireEvent.paste(proseMirrorEl, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? pastedMarkdown : ""),
      },
    });

    // Switches to Markdown CodeEditorPanel and reveals the Preview toggle button
    const previewBtn = await screen.findByTestId("toggle-markdown-preview-btn");
    expect(previewBtn).toHaveAttribute("aria-pressed", "false");
    expect(previewBtn).toHaveAttribute("title", "Previsualizar Markdown");
    expect(screen.queryByTestId("rich-text-editor-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("markdown-preview-panel")).not.toBeInTheDocument();
    expect(document.querySelector(".cm-editor")).not.toBeNull();
    expect(screen.getByTitle("Selector de lenguaje (Clic para cambiar)")).toHaveTextContent(
      "Markdown"
    );

    // Click Preview button -> shows formatted Markdown & Mermaid diagram
    fireEvent.click(previewBtn);
    await waitFor(() => {
      expect(screen.getByTestId("markdown-preview-panel")).toBeInTheDocument();
      expect(screen.getByTestId("editor-mermaid-svg")).toBeInTheDocument();
    });
    expect(previewBtn).toHaveAttribute("aria-pressed", "true");
    expect(previewBtn).toHaveAttribute("title", "Ver código Markdown");
    expect(document.querySelector(".cm-editor")).toBeNull();
    expect(screen.getByTestId("markdown-preview-panel").querySelector("h1")?.textContent).toBe(
      "Arquitectura CodeStash"
    );

    // Click the same button again -> switches cleanly back to Markdown code editor
    fireEvent.click(previewBtn);
    await waitFor(() => {
      expect(screen.queryByTestId("markdown-preview-panel")).not.toBeInTheDocument();
      expect(document.querySelector(".cm-editor")).not.toBeNull();
    });
    expect(previewBtn).toHaveAttribute("aria-pressed", "false");

    // Right-click inside Markdown editing panel shows "Previsualizar Markdown" without Ortografía or Inspect Element
    const codePanel = screen.getByTestId("code-editor-panel");
    fireEvent.contextMenu(codePanel, { clientX: 80, clientY: 90 });
    const codeCtxMenu = screen.getByTestId("code-editor-context-menu");
    expect(codeCtxMenu).toHaveTextContent("Previsualizar Markdown");
    expect(codeCtxMenu).not.toHaveTextContent(/ortograf/i);
    expect(codeCtxMenu).not.toHaveTextContent(/inspeccionar/i);

    // Clicking "Previsualizar Markdown" in context menu switches to preview mode
    fireEvent.click(screen.getByTestId("context-preview-markdown-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("markdown-preview-panel")).toBeInTheDocument();
    });

    // Right-click inside preview mode shows copy/select-all ONLY (no Previsualizar, Ortografía, or Inspect Element)
    fireEvent.contextMenu(screen.getByTestId("markdown-preview-panel"), {
      clientX: 80,
      clientY: 90,
    });
    const previewCtxMenu = screen.getByTestId("markdown-preview-context-menu");
    expect(previewCtxMenu).not.toHaveTextContent(/previsualizar/i);
    expect(previewCtxMenu).not.toHaveTextContent(/ortograf/i);
    expect(previewCtxMenu).not.toHaveTextContent(/inspeccionar/i);

    renderMermaidSpy.mockRestore();
  });

  it("hides Ortografía, Inspect Element, and Preview options in right-click menu for non-Markdown code languages", () => {
    const tsSnippet = createMockSnippet({
      id: "snip-ts-ctx",
      code: "const value: number = 42;",
      language: "typescript",
    });

    render(<SnippetEditor snippet={tsSnippet} tags={tags} onAutoSave={onAutoSave} />);

    const cmContent = document.querySelector(".cm-content");
    expect(cmContent).toHaveAttribute("spellcheck", "false");

    const codePanel = screen.getByTestId("code-editor-panel");
    fireEvent.contextMenu(codePanel, { clientX: 70, clientY: 70 });

    const codeCtxMenu = screen.getByTestId("code-editor-context-menu");
    expect(codeCtxMenu).toHaveTextContent("Pegar");
    expect(codeCtxMenu).toHaveTextContent("Seleccionar todo");
    expect(codeCtxMenu).not.toHaveTextContent(/previsualizar/i);
    expect(codeCtxMenu).not.toHaveTextContent(/ortograf/i);
    expect(codeCtxMenu).not.toHaveTextContent(/inspeccionar/i);
  });
});
