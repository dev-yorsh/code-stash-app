import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { Editor } from "@tiptap/core";
import {
  TAB_INDENT,
  applyRichBlockStyle,
  applyRichListType,
  createRichTextExtensions,
  hasRichTextFormatting,
  toggleStyledBulletList,
} from "../richTextExtensions";
import { isAllowedImageSource } from "../resizableImageExtension";

beforeAll(() => {
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

describe("richTextExtensions (Tiptap v3 Markdown Engine)", () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  const mountEditor = (initialMarkdown = "") => {
    editor = new Editor({
      extensions: createRichTextExtensions(),
      content: initialMarkdown,
      contentType: "markdown",
    });
    return editor;
  };

  it("distinguishes bulleted (* ) and dashed (- ) lists visually and in Markdown", () => {
    const ed = mountEditor("Primer elemento");
    ed.commands.setTextSelection(2);

    toggleStyledBulletList(ed, "bullet");
    expect(ed.isActive("bulletList")).toBe(true);
    expect(ed.getAttributes("bulletList").listStyle).toBe("bullet");
    expect(ed.getMarkdown().trim()).toBe("* Primer elemento");

    toggleStyledBulletList(ed, "dash");
    expect(ed.isActive("bulletList")).toBe(true);
    expect(ed.getAttributes("bulletList").listStyle).toBe("dash");
    expect(ed.getMarkdown().trim()).toBe("- Primer elemento");
  });

  it("parses bullet (* ) vs dash (- ) Markdown lists back to their distinct listStyle", () => {
    const ed = mountEditor("* Uno\n\n- Dos");
    const html = ed.getHTML();
    expect(html).toContain('data-list-style="bullet"');
    expect(html).toContain('data-list-style="dash"');
  });

  it("persists multicolor highlights via <mark data-color> and restores on reload", () => {
    const ed = mountEditor("Texto importante");
    ed.commands.selectAll();
    ed.commands.setHighlight({ color: "#e06c75" });

    const markdown = ed.getMarkdown();
    expect(markdown).toBe('<mark data-color="#e06c75">Texto importante</mark>');

    // Re-parse into fresh editor
    ed.destroy();
    const reloaded = mountEditor(markdown);
    reloaded.commands.setTextSelection(2);
    expect(reloaded.isActive("highlight")).toBe(true);
    expect(reloaded.getAttributes("highlight").color).toBe("#e06c75");
  });

  it("supports underline, inline monospace, blockquote, task checklists, and GFM tables", () => {
    const ed = mountEditor("Texto base");
    ed.commands.setTextSelection({ from: 1, to: 11 });
    ed.commands.toggleUnderline();
    ed.commands.toggleHeading({ level: 1 });
    expect(ed.getMarkdown().trim()).toBe("# <u>Texto base</u>");

    ed.commands.setContent("- [x] Completado\n- [ ] Pendiente", { contentType: "markdown" });
    expect(ed.getHTML()).toContain('data-type="taskList"');
    expect(ed.getMarkdown()).toContain("- [x] Completado");
    expect(ed.getMarkdown()).toContain("- [ ] Pendiente");

    ed.commands.clearContent();
    ed.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    const tableMd = ed.getMarkdown();
    expect(tableMd).toContain("|");
    expect(tableMd).toContain("---");

    ed.commands.addRowAfter();
    expect(ed.isActive("table")).toBe(true);
  });

  it("detects when rich formatting is present vs plain unformatted text", () => {
    const ed = mountEditor("Solo texto plano normal");
    expect(hasRichTextFormatting(ed)).toBe(false);

    ed.commands.selectAll();
    ed.commands.toggleBold();
    expect(hasRichTextFormatting(ed)).toBe(true);

    ed.commands.unsetAllMarks();
    expect(hasRichTextFormatting(ed)).toBe(false);

    ed.commands.toggleBlockquote();
    expect(hasRichTextFormatting(ed)).toBe(true);
  });

  it("inserts and outdents horizontal Tab spacing without losing Markdown paragraph structure", () => {
    const ed = mountEditor("Linea indentada");
    ed.commands.setTextSelection(1);

    // Simulate Tab keyboard shortcut via Tiptap's shortcut runner
    const handledTab = ed.view.someProp("handleKeyDown", (fn) =>
      fn(
        ed.view,
        new KeyboardEvent("keydown", { key: "Tab", cancelable: true, bubbles: true })
      )
    );
    expect(handledTab).toBe(true);
    expect(ed.getText()).toBe(`${TAB_INDENT}Linea indentada`);

    // Must persist cleanly in Markdown and reload as paragraph (not code block)
    const md = ed.getMarkdown();
    ed.destroy();
    const reloaded = mountEditor(md);
    expect(reloaded.getText()).toBe(`${TAB_INDENT}Linea indentada`);

    // Shift-Tab removes leading tab indentation
    reloaded.commands.setTextSelection(5);
    const handledShiftTab = reloaded.view.someProp("handleKeyDown", (fn) =>
      fn(
        reloaded.view,
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          cancelable: true,
          bubbles: true,
        })
      )
    );
    expect(handledShiftTab).toBe(true);
    expect(reloaded.getText()).toBe("Linea indentada");
  });

  it("supports unified block style and list type helpers cleanly", () => {
    const ed = mountEditor("Elemento convertible");
    ed.commands.setTextSelection(2);

    applyRichBlockStyle(ed, "heading");
    expect(ed.isActive("heading", { level: 2 })).toBe(true);

    applyRichBlockStyle(ed, "body");
    expect(ed.isActive("heading")).toBe(false);

    applyListFormatCheck(ed);
  });

  it("persists text color via <span data-text-color> alongside bold and reloads cleanly", () => {
    const ed = mountEditor("Texto **importante**");
    ed.commands.selectAll();
    ed.commands.setTextColor("#3b82f6");

    const markdown = ed.getMarkdown();
    expect(markdown).toContain('data-text-color="#3b82f6"');
    expect(ed.getHTML()).toContain('data-text-color="#3b82f6"');

    ed.destroy();
    const reloaded = mountEditor(markdown);
    expect(hasRichTextFormatting(reloaded)).toBe(true);
    expect(reloaded.getHTML()).toContain('data-text-color="#3b82f6"');
    expect(reloaded.getHTML()).toMatch(/<strong>.*importante.*<\/strong>/);
  });

  it("persists paragraph, heading, and blockquote alignment across Markdown reload while keeping left pure", () => {
    const ed = mountEditor("Texto **centrado**\n\n## Titulo derecha\n\n> Cita justificada");

    // Center first paragraph
    ed.commands.setTextSelection(3);
    expect(ed.commands.setTextAlign("center")).toBe(true);

    // Right-align heading
    const headingPos = ed.getText({ blockSeparator: "\n" }).indexOf("Titulo");
    ed.commands.setTextSelection(headingPos + 6);
    expect(ed.commands.setTextAlign("right")).toBe(true);

    // Justify blockquote (position inside the blockquote's child paragraph)
    const quotePos = ed.state.doc.content.size - 5;
    ed.commands.setTextSelection(quotePos);
    expect(ed.commands.setTextAlign("justify")).toBe(true);

    const markdown = ed.getMarkdown();
    expect(markdown).toContain('data-align="center"');
    expect(markdown).toContain("<strong>centrado</strong>");
    expect(markdown).toContain('data-align="right"');
    expect(markdown).toContain('data-align="justify"');

    ed.destroy();
    const reloaded = mountEditor(markdown);
    expect(hasRichTextFormatting(reloaded)).toBe(true);
    expect(reloaded.getHTML()).toMatch(/data-align="center"[^>]*text-align:\s*center/);
    expect(reloaded.getHTML()).toContain("<strong>centrado</strong>");
    expect(reloaded.getHTML()).toMatch(/data-align="right"[^>]*text-align:\s*right/);
    expect(reloaded.getHTML()).toMatch(/data-align="justify"[^>]*text-align:\s*justify/);

    // Resetting alignment back to left produces pure clean Markdown
    reloaded.commands.setTextSelection(3);
    reloaded.commands.setTextAlign("left");
    expect(reloaded.getMarkdown().split("\n")[0]).toBe("Texto **centrado**");
  });

  it("applies Monoestilo as inline code on substring selection and unified single codeBlock on block/multi-line selection", () => {
    // 1. Substring selection inside a sentence -> inline code mark
    const inlineEd = mountEditor("Usa console aqui");
    inlineEd.commands.setTextSelection({ from: 5, to: 12 });
    applyRichBlockStyle(inlineEd, "mono");
    expect(inlineEd.isActive("code")).toBe(true);
    expect(inlineEd.isActive("codeBlock")).toBe(false);
    inlineEd.destroy();

    // 2. Empty paragraph -> unified codeBlock
    const emptyEd = mountEditor("");
    applyRichBlockStyle(emptyEd, "mono");
    expect(emptyEd.isActive("codeBlock")).toBe(true);
    expect(hasRichTextFormatting(emptyEd)).toBe(true);
    emptyEd.destroy();

    // 3. Multi-paragraph selection -> merged into ONE single codeBlock
    const multiEd = mountEditor("const a = 1;\n\nconst b = 2;");
    multiEd.commands.selectAll();
    applyRichBlockStyle(multiEd, "mono");
    expect(multiEd.isActive("codeBlock")).toBe(true);
    expect(multiEd.state.doc.firstChild?.type.name).toBe("codeBlock");
    expect(multiEd.state.doc.firstChild?.textContent).toBe("const a = 1;\nconst b = 2;");
    const codeBlockNodes: string[] = [];
    multiEd.state.doc.descendants((node) => {
      if (node.type.name === "codeBlock") codeBlockNodes.push(node.textContent);
    });
    expect(codeBlockNodes).toEqual(["const a = 1;\nconst b = 2;"]);
  });

  it('disables native spellcheck on inline code, codeBlock Monoestilo, and links via spellcheck="false"', () => {
    const ed = mountEditor("Revisa `useState` y [Docs](https://tauri.app)\n\n```\nconst ok = true;\n```");
    const html = ed.getHTML();

    expect(html).toContain('<code spellcheck="false">useState</code>');
    expect(html).toContain('<a');
    expect(html).toMatch(/<a[^>]*spellcheck="false"[^>]*>Docs<\/a>/);
    expect(html).toMatch(/<pre[^>]*spellcheck="false"[^>]*><code/);
    expect(ed.view.dom.querySelector("pre")?.getAttribute("spellcheck")).toBe("false");
  });

  it("parses and round-trips ResizableImage markdown and <img width data-align> nodes inside Plain Text", () => {
    const assetUri = `codestash-asset://${"a".repeat(64)}.webp`;
    const md = [
      "Encabezado de nota",
      "",
      `![Diagrama](${assetUri})`,
      "",
      `<img src="${assetUri}" alt="Ajustada" width="60%" data-align="center" />`,
    ].join("\n");

    const ed = mountEditor(md);
    expect(hasRichTextFormatting(ed)).toBe(true);

    const imageNodes: Array<Record<string, unknown>> = [];
    ed.state.doc.descendants((node) => {
      if (node.type.name === "image") {
        imageNodes.push({ ...node.attrs });
      }
    });

    expect(imageNodes).toHaveLength(2);
    expect(imageNodes[0]).toMatchObject({
      src: assetUri,
      alt: "Diagrama",
      width: null,
      align: "left",
    });
    expect(imageNodes[1]).toMatchObject({
      src: assetUri,
      alt: "Ajustada",
      width: "60%",
      align: "center",
    });

    const exportedMd = ed.getMarkdown();
    expect(exportedMd).toContain(`![Diagrama](${assetUri})`);
    expect(exportedMd).toContain(`width="60%"`);
    expect(exportedMd).toContain(`data-align="center"`);
  });

  it("rejects unsafe javascript: or non-image image URIs", () => {
    expect(isAllowedImageSource("javascript:alert(1)")).toBe(false);
    expect(isAllowedImageSource("data:text/html,<script>1</script>")).toBe(false);
    expect(isAllowedImageSource(`codestash-asset://${"f".repeat(64)}.webp`)).toBe(true);

    const ed = mountEditor("![xss](javascript:alert(1))");
    let imageCount = 0;
    ed.state.doc.descendants((node) => {
      if (node.type.name === "image") imageCount += 1;
    });
    expect(imageCount).toBe(0);
  });
});

function applyListFormatCheck(ed: Editor) {
  applyRichListType(ed, "ordered");
  expect(ed.isActive("orderedList")).toBe(true);

  applyRichListType(ed, "task");
  expect(ed.isActive("taskList")).toBe(true);

  applyRichListType(ed, "dash");
  expect(ed.isActive("bulletList")).toBe(true);
  expect(ed.getAttributes("bulletList").listStyle).toBe("dash");
}
