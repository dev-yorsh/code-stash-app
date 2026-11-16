import { describe, it, expect, afterEach, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { createRichTextExtensions, TAB_INDENT } from "../../extensions/richTextExtensions";
import {
  buildRichTextClipboardPayload,
  copyPlainTextContent,
  serializeJsonDocToCleanMarkdown,
  serializeJsonDocToWhatsAppText,
  serializeJsonDocToWordHtml,
  writeClipboardPayload,
} from "../richTextClipboard";
import { FallbackAssetRepository } from "@/shared/api/assets/fallback-asset.repository";
import { assetUrlManager } from "@/shared/api/assets/assetUrlManager";

describe("richTextClipboard (Formatted Word/WhatsApp & Pure Obsidian Markdown)", () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
    vi.restoreAllMocks();
  });

  const mountEditor = (initialMarkdown = "") => {
    editor = new Editor({
      extensions: createRichTextExtensions(),
      content: initialMarkdown,
      contentType: "markdown",
    });
    return editor;
  };

  it("serializes rich formatted notes into pure Obsidian-ready Markdown with ZERO mixed HTML", () => {
    const hybridStoredMarkdown = [
      '<h1 data-align="center" style="text-align: center"><strong>Reunión</strong> <span data-text-color="#3b82f6" style="color: #3b82f6">Q4</span></h1>',
      "",
      '<p data-align="right" style="text-align: right">Texto <u>subrayado</u>, <mark data-color="#e06c75">resaltado</mark>, <strong>negrita</strong>, <em>cursiva</em>, <s>tachado</s> y <a href="https://obsidian.md">Obsidian</a>.</p>',
      "",
      '<blockquote data-align="justify" style="text-align: justify"><p>Cita importante</p></blockquote>',
      "",
      "* Viñeta uno",
      "",
      "- Guion uno",
      "",
      "1. Numerada uno",
      "",
      "- [x] Tarea hecha",
      "- [ ] Tarea pendiente",
      "",
      "| Nombre | Estado |",
      "| --- | --- |",
      "| <span data-text-color=\"#22c55e\">OK</span> | Listo |",
      "",
      "```html",
      '<span data-text-color="#ef4444">Literal dentro de codigo</span>',
      "```",
    ].join("\n");

    const payload = buildRichTextClipboardPayload({ code: hybridStoredMarkdown }, "markdown");

    expect(payload.html).toBeUndefined();
    expect(payload.text).toContain("# **Reunión** Q4");
    expect(payload.text).toContain(
      "Texto subrayado, ==resaltado==, **negrita**, *cursiva*, ~~tachado~~ y [Obsidian](https://obsidian.md)."
    );
    expect(payload.text).toContain("> Cita importante");
    expect(payload.text).toContain("* Viñeta uno");
    expect(payload.text).toContain("- Guion uno");
    expect(payload.text).toContain("1. Numerada uno");
    expect(payload.text).toContain("- [x] Tarea hecha");
    expect(payload.text).toContain("- [ ] Tarea pendiente");
    expect(payload.text).toContain("| Nombre | Estado |");
    expect(payload.text).toContain("| OK | Listo |");
    // Literal HTML inside fenced code block must remain untouched
    expect(payload.text).toContain('<span data-text-color="#ef4444">Literal dentro de codigo</span>');
    // No leaked HTML wrappers outside the code block
    const outsideCode = payload.text.split("```")[0];
    expect(outsideCode).not.toMatch(/<(?:p|h1|blockquote|span|mark|u)\b/i);
  });

  it("coalesces fragmented bold runs when dropping HTML-only color marks and prevents NBSP code-block trap", () => {
    const ed = mountEditor(`${TAB_INDENT}**Hola mundo**`);
    // Color only "Hola " red while keeping "Hola mundo" bold
    ed.commands.setTextSelection({ from: 5, to: 10 });
    ed.commands.setTextColor("#ef4444");

    const md = serializeJsonDocToCleanMarkdown(ed.getJSON());
    expect(md).toBe("  **Hola mundo**");
    expect(md).not.toContain("<span");
    expect(md).not.toMatch(/^ {4}/);
  });

  it("produces Word-compatible inline-styled HTML and WhatsApp-friendly plain text on formatted copy", () => {
    const hybridStoredMarkdown = [
      '<h2 data-align="center" style="text-align: center">Resumen</h2>',
      "",
      '<p data-align="right" style="text-align: right">Texto <u>subrayado</u>, <span data-text-color="#3b82f6" style="color: #3b82f6">azul</span>, <mark data-color="#e5c07b">dorado</mark>, <strong>fuerte</strong>, <em>suave</em>, <s>viejo</s> y <a href="https://codestash.app">CodeStash</a>.</p>',
      "",
      "- [x] Revisado",
      "- [ ] Enviar",
      "",
      "| Col A | Col B |",
      "| --- | --- |",
      "| Uno | Dos |",
    ].join("\n");

    const ed = mountEditor(hybridStoredMarkdown);
    const json = ed.getJSON();
    const html = serializeJsonDocToWordHtml(json);
    const whatsAppText = serializeJsonDocToWhatsAppText(json);

    // HTML checks for Word / Docs / LibreOffice
    expect(html).toContain("text-align: center;");
    expect(html).toContain("text-align: right;");
    expect(html).toContain("<u>subrayado</u>");
    expect(html).toContain("color: #3b82f6;");
    expect(html).toContain("background-color: #e5c07b;");
    expect(html).toContain("<strong>fuerte</strong>");
    expect(html).toContain("<em>suave</em>");
    expect(html).toContain("<s>viejo</s>");
    expect(html).toContain("border-collapse: collapse;");
    expect(html).toContain("☑");
    expect(html).toContain("☐");

    // Plain-text checks for WhatsApp (zero HTML tags, native WhatsApp * _ ~ syntax)
    expect(whatsAppText).not.toMatch(/<\/?(?:p|h2|span|mark|u|table|strong|em)>/i);
    expect(whatsAppText).toContain("*Resumen*");
    expect(whatsAppText).toContain("*fuerte*");
    expect(whatsAppText).toContain("_suave_");
    expect(whatsAppText).toContain("~viejo~");
    expect(whatsAppText).toContain("CodeStash (https://codestash.app)");
    expect(whatsAppText).toContain("☑ Revisado");
    expect(whatsAppText).toContain("☐ Enviar");
    expect(whatsAppText).toContain("Col A | Col B");
  });

  it("extracts partial inline selection without promoting parent heading level", () => {
    const ed = mountEditor("# Título con **clave**");
    // Select only "clave"
    const docText = ed.state.doc.textBetween(0, ed.state.doc.content.size, "\n", "\n");
    const idx = docText.indexOf("clave");
    ed.commands.setTextSelection({ from: idx + 1, to: idx + 1 + "clave".length });

    const mdPayload = buildRichTextClipboardPayload(
      { editor: ed, selectionOnly: true },
      "markdown"
    );
    expect(mdPayload.text).toBe("**clave**");
    expect(mdPayload.text).not.toContain("# ");

    const fmtPayload = buildRichTextClipboardPayload(
      { editor: ed, selectionOnly: true },
      "formatted"
    );
    expect(fmtPayload.html).toContain("<strong>clave</strong>");
    expect(fmtPayload.html).not.toContain("<h1");
    expect(fmtPayload.text).toBe("*clave*");
  });

  it("writes via Electron native clipboard bridge when available and falls back safely", async () => {
    const writeRichMock = vi.fn().mockResolvedValue({ success: true });
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
      writeRichClipboard: writeRichMock,
    };

    const okElectron = await writeClipboardPayload({
      html: "<strong>Hola</strong>",
      text: "*Hola*",
    });
    expect(okElectron).toBe(true);
    expect(writeRichMock).toHaveBeenCalledWith({
      html: "<strong>Hola</strong>",
      text: "*Hola*",
    });

    delete window.electronAPI;
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const okFallback = await writeClipboardPayload({ text: "## Markdown puro" });
    expect(okFallback).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith("## Markdown puro");
  });

  it("preserves full block formatting (heading, aligned paragraph, bullet list, checklist, blockquote, codeBlock) when copying selected blocks", () => {
    const note = [
      '<h1 data-align="center" style="text-align: center">Titulo Bloque</h1>',
      "",
      '<p data-align="right" style="text-align: right">Parrafo alineado</p>',
      "",
      "* **Uno**",
      "* Dos",
      "",
      "- [x] Completada",
      "- [ ] Pendiente",
      "",
      "> Cita en bloque",
      "",
      "```",
      "const a = 1;",
      "const b = 2;",
      "```",
      "",
      "Final",
    ].join("\n");

    const ed = mountEditor(note);

    const findRange = (startText: string, endText: string) => {
      let from = -1;
      let to = -1;
      ed.state.doc.descendants((node, pos) => {
        if (node.isText && node.text?.includes(startText) && from === -1) {
          from = pos + node.text.indexOf(startText);
        }
        if (node.isText && node.text?.includes(endText)) {
          to = pos + node.text.indexOf(endText) + endText.length;
        }
      });
      return { from, to };
    };

    // 1. Selecting an entire Heading block keeps <h1> and center align
    ed.commands.setTextSelection(findRange("Titulo Bloque", "Titulo Bloque"));
    let payload = buildRichTextClipboardPayload({ editor: ed, selectionOnly: true }, "formatted");
    expect(payload.html).toContain("<h1");
    expect(payload.html).toContain("text-align: center;");
    expect(payload.text).toBe("*Titulo Bloque*");

    // 2. Selecting two bullet items keeps <ul>, <li>, and <strong> formatting inside list
    ed.commands.setTextSelection(findRange("Uno", "Dos"));
    payload = buildRichTextClipboardPayload({ editor: ed, selectionOnly: true }, "formatted");
    expect(payload.html).toContain("<ul");
    expect(payload.html).toContain("<strong>Uno</strong>");
    expect(payload.text).toContain("• *Uno*");
    expect(payload.text).toContain("• Dos");

    // 3. Selecting checklist items keeps checkboxes (☑ / ☐) and <s>
    ed.commands.setTextSelection(findRange("Completada", "Pendiente"));
    payload = buildRichTextClipboardPayload({ editor: ed, selectionOnly: true }, "formatted");
    expect(payload.html).toContain("☑ <s>Completada</s>");
    expect(payload.html).toContain("☐ Pendiente");
    expect(payload.text).toBe("☑ Completada\n☐ Pendiente");

    // 4. Selecting full blockquote keeps <blockquote> and > quote marker
    ed.commands.setTextSelection(findRange("Cita en bloque", "Cita en bloque"));
    payload = buildRichTextClipboardPayload({ editor: ed, selectionOnly: true }, "formatted");
    expect(payload.html).toContain("<blockquote");
    expect(payload.text).toBe("> Cita en bloque");

    // 5. Selecting multi-line code inside codeBlock keeps <pre><code>
    ed.commands.setTextSelection(findRange("const a = 1;", "const b = 2;"));
    payload = buildRichTextClipboardPayload({ editor: ed, selectionOnly: true }, "formatted");
    expect(payload.html).toContain("<pre");
    expect(payload.html).toContain("<code>");
    expect(payload.text).toContain("```\nconst a = 1;\nconst b = 2;\n```");

    // 6. Selecting full aligned paragraph preserves alignment
    ed.commands.setTextSelection(findRange("Parrafo alineado", "Parrafo alineado"));
    payload = buildRichTextClipboardPayload({ editor: ed, selectionOnly: true }, "formatted");
    expect(payload.html).toContain("text-align: right;");
  });

  it("serializes Plain Text images cleanly across Markdown, Word HTML (inline data URL), and WhatsApp", async () => {
    const assetId = "e".repeat(64);
    const assetUri = `codestash-asset://${assetId}.webp`;
    const sampleBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

    const tempRepo = new FallbackAssetRepository();
    await tempRepo.save({
      id: assetId,
      ext: "webp",
      mimeType: "image/webp",
      bytes: sampleBytes,
    });
    const prevRepo = assetUrlManager.getAssetRepository();
    assetUrlManager.setAssetRepository(tempRepo);

    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeMock },
      configurable: true,
    });

    try {
      const mdSource = `Nota con foto\n\n<img src="${assetUri}" alt="Arquitectura" width="50%" data-align="center" />`;

      // 1. Clean Markdown mode strips HTML sizing and writes pure Obsidian ![alt](uri)
      const mdPayload = buildRichTextClipboardPayload({ code: mdSource }, "markdown");
      expect(mdPayload.html).toBeUndefined();
      expect(mdPayload.text).toContain("Nota con foto");
      expect(mdPayload.text).toContain(`![Arquitectura](${assetUri})`);

      // 2. Formatted async copy pre-resolves codestash-asset:// to inline data: URL in Word HTML & [Imagen: ...] in WhatsApp
      const formattedPayload = await copyPlainTextContent({ code: mdSource }, "formatted");
      expect(formattedPayload.html).toContain('src="data:image/webp;base64,UklGRg=="');
      expect(formattedPayload.html).toContain('text-align: center;');
      expect(formattedPayload.text).toContain("[Imagen: Arquitectura]");
    } finally {
      assetUrlManager.setAssetRepository(prevRepo);
    }
  });
});
