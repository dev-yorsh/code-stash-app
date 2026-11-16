import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";

interface MenuItemMock {
  label?: string;
  role?: string;
  type?: string;
  enabled?: boolean;
  click?: () => void;
  submenu?: MenuItemMock[];
}

const require = createRequire(import.meta.url);
const {
  resolveSpellCheckLanguages,
  buildContextMenuTemplate,
  setupWindowSpellChecker,
} = require("../spellcheck.cjs") as {
  resolveSpellCheckLanguages: (available: string[], preferred?: string) => string[];
  buildContextMenuTemplate: (opts: {
    params: {
      isEditable?: boolean;
      misspelledWord?: string;
      dictionarySuggestions?: string[];
      selectionText?: string;
      spellcheckEnabled?: boolean;
      x?: number;
      y?: number;
      editFlags?: {
        canCut?: boolean;
        canCopy?: boolean;
        canPaste?: boolean;
        canSelectAll?: boolean;
      };
    };
    language?: "es" | "en";
    spellcheckEnabled?: boolean;
    onReplaceMisspelling?: (suggestion: string) => void;
    onIgnoreWord?: (word: string) => void;
    onAddToDictionary?: (word: string) => void;
    onToggleSpellCheck?: (nextEnabled: boolean) => void;
  }) => MenuItemMock[];
  setupWindowSpellChecker: (
    win: unknown,
    opts: { Menu: unknown; initialLanguage?: "es" | "en" }
  ) => {
    applySpellCheckConfig: (cfg: { enabled?: boolean; language?: "es" | "en" }) => {
      success: boolean;
      error?: string;
    };
    ignoreWord: (word: string) => Promise<{ success: boolean; error?: string }>;
    addWordToDictionary: (word: string) => { success: boolean; error?: string };
  };
};

describe("electron/spellcheck", () => {
  it("resolves bilingual Spanish and English codes filtered against availableSpellCheckerLanguages", () => {
    expect(resolveSpellCheckLanguages(["fr", "es-419", "en-US"], "es")).toEqual([
      "es-419",
      "en-US",
    ]);
    expect(resolveSpellCheckLanguages(["es", "en-US"], "en")).toEqual(["en-US", "es"]);
    expect(resolveSpellCheckLanguages(["pt-BR"], "es")).toEqual(["pt-BR"]);
    expect(resolveSpellCheckLanguages([], "es")).toEqual([]);
  });

  it("shows only Ignore and Disable/Enable spell check inside Ortografía / Spelling without word suggestions", () => {
    const onReplace = vi.fn();
    const onIgnore = vi.fn();
    const onAdd = vi.fn();
    const onToggle = vi.fn();

    const esMenu = buildContextMenuTemplate({
      params: {
        isEditable: true,
        misspelledWord: "holaa",
        dictionarySuggestions: ["hola", "ola"],
        spellcheckEnabled: true,
        editFlags: { canCut: true, canCopy: true, canPaste: true, canSelectAll: true },
      },
      language: "es",
      onReplaceMisspelling: onReplace,
      onIgnoreWord: onIgnore,
      onAddToDictionary: onAdd,
      onToggleSpellCheck: onToggle,
    });

    const ortografiaCategory = esMenu.find((item) => item.label === "Ortografía");
    expect(ortografiaCategory?.submenu).toBeDefined();

    const submenu = ortografiaCategory?.submenu ?? [];
    expect(submenu.some((item) => item.label === "hola")).toBe(false);
    expect(submenu.some((item) => item.label === "Agregar al diccionario")).toBe(false);

    submenu.find((item) => item.label === "Ignorar")?.click?.();
    expect(onIgnore).toHaveBeenCalledWith("holaa");

    submenu.find((item) => item.label === "Desactivar ortografía")?.click?.();
    expect(onToggle).toHaveBeenCalledWith(false);

    expect(esMenu.some((item) => item.label === "Cortar" && item.role === "cut")).toBe(true);
    expect(esMenu.some((item) => item.label === "Pegar" && item.role === "paste")).toBe(true);

    const enMenu = buildContextMenuTemplate({
      params: {
        isEditable: true,
        misspelledWord: "xyzqwerty",
        dictionarySuggestions: [],
        spellcheckEnabled: false,
      },
      language: "en",
      onToggleSpellCheck: onToggle,
    });

    const spellingCategory = enMenu.find((item) => item.label === "Spelling");
    const enSubmenu = spellingCategory?.submenu ?? [];
    expect(enSubmenu.some((item) => item.label === "No suggestions")).toBe(false);
    expect(enSubmenu.some((item) => item.label === "Add to dictionary")).toBe(false);
    expect(enSubmenu.some((item) => item.label === "Ignore")).toBe(true);
    expect(enSubmenu.some((item) => item.label === "Enable spell check")).toBe(true);
  });

  it("wires Electron session languages, session ignore cleanup, context-menu popup, and live IPC toggle cleanly", async () => {
    let contextMenuHandler: ((event: unknown, params: unknown) => void) | undefined;
    let closedHandler: (() => void) | undefined;
    const popupMock = vi.fn();
    const MenuMock = {
      buildFromTemplate: vi.fn((template) => ({ template, popup: popupMock })),
    };

    const sesMock = {
      availableSpellCheckerLanguages: ["es-419", "en-US"],
      setSpellCheckerEnabled: vi.fn(),
      setSpellCheckerLanguages: vi.fn(),
      listWordsInSpellCheckerDictionary: vi.fn().mockResolvedValue(["miPalabraFija"]),
      addWordToSpellCheckerDictionary: vi.fn(),
      removeWordFromSpellCheckerDictionary: vi.fn(),
      on: vi.fn(),
    };

    const winMock = {
      isDestroyed: () => false,
      on: vi.fn((eventName: string, handler: () => void) => {
        if (eventName === "closed") closedHandler = handler;
      }),
      webContents: {
        session: sesMock,
        replaceMisspelling: vi.fn(),
        inspectElement: vi.fn(),
        send: vi.fn(),
        on: vi.fn((eventName: string, handler: (event: unknown, params: unknown) => void) => {
          if (eventName === "context-menu") {
            contextMenuHandler = handler;
          }
        }),
      },
    };

    const { applySpellCheckConfig, ignoreWord, addWordToDictionary } = setupWindowSpellChecker(
      winMock,
      {
        Menu: MenuMock,
        initialLanguage: "es",
      }
    );

    expect(sesMock.setSpellCheckerEnabled).toHaveBeenCalledWith(true);
    expect(sesMock.setSpellCheckerLanguages).toHaveBeenCalledWith(["es-419", "en-US"]);

    // Right-clicking non-editable panel without text selection must NOT open Inspect Element or any menu
    contextMenuHandler?.({}, {
      isEditable: false,
      selectionText: "",
    });
    expect(MenuMock.buildFromTemplate).not.toHaveBeenCalled();
    expect(winMock.webContents.inspectElement).not.toHaveBeenCalled();

    contextMenuHandler?.({}, {
      isEditable: true,
      misspelledWord: "pruva",
      dictionarySuggestions: ["prueba"],
      spellcheckEnabled: true,
      editFlags: { canCopy: true, canPaste: true },
    });

    expect(MenuMock.buildFromTemplate).toHaveBeenCalled();
    expect(popupMock).toHaveBeenCalledWith({ window: winMock });

    const builtTemplate = MenuMock.buildFromTemplate.mock.calls[0][0] as MenuItemMock[];
    expect(
      builtTemplate.some((item) => /inspeccionar|inspect/i.test(item.label ?? ""))
    ).toBe(false);
    expect(winMock.webContents.inspectElement).not.toHaveBeenCalled();
    const ortografia = builtTemplate.find((item) => item.label === "Ortografía");
    expect(ortografia?.submenu?.some((item) => item.label === "prueba")).toBe(false);
    expect(ortografia?.submenu?.some((item) => item.label === "Agregar al diccionario")).toBe(false);

    ortografia?.submenu?.find((item) => item.label === "Ignorar")?.click?.();
    await vi.waitFor(() => {
      expect(sesMock.addWordToSpellCheckerDictionary).toHaveBeenCalledWith("pruva");
    });

    ortografia?.submenu?.find((item) => item.label === "Desactivar ortografía")?.click?.();
    expect(sesMock.setSpellCheckerEnabled).toHaveBeenLastCalledWith(false);
    expect(winMock.webContents.send).toHaveBeenCalledWith("spellcheck-config-changed", {
      enabled: false,
    });

    // Session ignore adds temporarily and cleans up on window close without deleting permanent words
    await ignoreWord("temporalWord");
    expect(sesMock.addWordToSpellCheckerDictionary).toHaveBeenCalledWith("temporalWord");
    addWordToDictionary("permWord");
    await ignoreWord("miPalabraFija");

    closedHandler?.();
    expect(sesMock.removeWordFromSpellCheckerDictionary).toHaveBeenCalledWith("temporalWord");
    expect(sesMock.removeWordFromSpellCheckerDictionary).not.toHaveBeenCalledWith("permWord");
    expect(sesMock.removeWordFromSpellCheckerDictionary).not.toHaveBeenCalledWith("miPalabraFija");

    const toggleResult = applySpellCheckConfig({ enabled: false, language: "en" });
    expect(toggleResult).toEqual({ success: true });
    expect(sesMock.setSpellCheckerEnabled).toHaveBeenLastCalledWith(false);
  });
});
