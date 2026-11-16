import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import { createRichTextExtensions } from "../../extensions/richTextExtensions";
import {
  extractAllWordRanges,
  extractWordRangeAtOffset,
  findMisspelledTargetFromSelection,
  isPositionCheckableForSpelling,
  replaceTextRangePreservingMarks,
} from "../spellcheckHelpers";

describe("spellcheckHelpers", () => {
  it("extracts accented Spanish and English words cleanly around cursor offsets", () => {
    const sample = "Hola ágil-código, holla!";
    expect(extractWordRangeAtOffset(sample, 1)).toEqual({ word: "Hola", start: 0, end: 4 });
    expect(extractWordRangeAtOffset(sample, 4)).toEqual({ word: "Hola", start: 0, end: 4 });
    expect(extractWordRangeAtOffset(sample, 7)).toEqual({
      word: "ágil-código",
      start: 5,
      end: 16,
    });
    expect(extractWordRangeAtOffset(sample, 20)).toEqual({
      word: "holla",
      start: 18,
      end: 23,
    });

    expect(extractAllWordRanges("  holaa  ").map((w) => w.word)).toEqual(["holaa"]);
  });

  it("ignores Monoestilo code blocks, inline code, and links while checking normal prose", () => {
    const editor = new Editor({
      extensions: createRichTextExtensions(),
      content: "Texto `coddigo` [linkk](https://example.com)\n\n```\nconst pruva = 1;\n```",
      contentType: "markdown",
    });

    const isMisspelled = (w: string) => ["coddigo", "linkk", "pruva", "Textoo"].includes(w);

    // Position 2 is inside "Texto", paragraph 1 -> checkable
    expect(isPositionCheckableForSpelling(editor, 2)).toBe(true);

    // Find position inside inline `coddigo`
    let codePos = -1;
    let linkPos = -1;
    let codeBlockPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === "coddigo") codePos = pos + 2;
      if (node.isText && node.text === "linkk") linkPos = pos + 2;
      if (node.type.name === "codeBlock") codeBlockPos = pos + 2;
    });

    expect(isPositionCheckableForSpelling(editor, codePos)).toBe(false);
    expect(isPositionCheckableForSpelling(editor, linkPos)).toBe(false);
    expect(isPositionCheckableForSpelling(editor, codeBlockPos)).toBe(false);

    // Selecting inline code does not flag it as misspelled
    editor.commands.setTextSelection({ from: codePos - 1, to: codePos + 3 });
    expect(findMisspelledTargetFromSelection(editor, isMisspelled, new Set())).toBeNull();

    editor.destroy();
  });

  it("replaces a misspelled range while preserving active inline marks such as bold", () => {
    const editor = new Editor({
      extensions: createRichTextExtensions(),
      content: "**Textoo** normal",
      contentType: "markdown",
    });

    const target = { word: "Textoo", from: 1, to: 7 };
    expect(replaceTextRangePreservingMarks(editor, target.from, target.to, "Texto")).toBe(true);
    expect(editor.getHTML()).toContain("<strong>Texto</strong>");
    expect(editor.getText()).toContain("Texto normal");

    editor.destroy();
  });
});
