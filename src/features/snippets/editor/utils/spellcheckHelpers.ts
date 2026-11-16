import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

export interface SpellcheckTarget {
  word: string;
  from: number;
  to: number;
}

export type WordMisspelledChecker = (word: string) => boolean;

const WORD_CHAR_REGEX = /[\p{L}\p{M}\p{N}'’_-]/u;
const EDGE_PUNCT_REGEX = /^['’_-]+|['’_-]+$/g;
const NON_WORD_CHAR_ONLY_REGEX = /^[\p{N}'’_-]+$/u;
const EXCLUDED_SPELLCHECK_MARKS = new Set(["code", "link"]);

function normalizeCandidateToken(
  raw: string,
  rawStart: number
): { word: string; start: number; end: number } | null {
  const leadingMatch = raw.match(/^['’_-]+/);
  const trailingMatch = raw.match(/['’_-]+$/);
  const leadLen = leadingMatch ? leadingMatch[0].length : 0;
  const trailLen = trailingMatch ? trailingMatch[0].length : 0;
  const word = raw.replace(EDGE_PUNCT_REGEX, "");

  if (!word || NON_WORD_CHAR_ONLY_REGEX.test(word)) {
    return null;
  }

  return {
    word,
    start: rawStart + leadLen,
    end: rawStart + raw.length - trailLen,
  };
}

/**
 * Extracts a single word token surrounding `offset` inside a flat string.
 */
export function extractWordRangeAtOffset(
  text: string,
  offset: number
): { word: string; start: number; end: number } | null {
  if (!text) return null;

  let probe = Math.max(0, Math.min(offset, text.length));
  if (probe === text.length || !WORD_CHAR_REGEX.test(text[probe] ?? "")) {
    if (probe > 0 && WORD_CHAR_REGEX.test(text[probe - 1] ?? "")) {
      probe -= 1;
    } else {
      return null;
    }
  }

  let start = probe;
  while (start > 0 && WORD_CHAR_REGEX.test(text[start - 1] ?? "")) {
    start -= 1;
  }

  let end = probe + 1;
  while (end < text.length && WORD_CHAR_REGEX.test(text[end] ?? "")) {
    end += 1;
  }

  return normalizeCandidateToken(text.slice(start, end), start);
}

/**
 * Extracts all candidate word tokens and their relative string offsets from `text`.
 */
export function extractAllWordRanges(
  text: string
): Array<{ word: string; start: number; end: number }> {
  const tokens: Array<{ word: string; start: number; end: number }> = [];
  const regex = /[\p{L}\p{M}\p{N}'’_-]+/gu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const normalized = normalizeCandidateToken(match[0], match.index);
    if (normalized) {
      tokens.push(normalized);
    }
  }

  return tokens;
}

/**
 * Returns false inside Monoestilo code blocks, inline code marks, or URL links
 * so code syntax and links are never flagged by spellchecking.
 */
export function isPositionCheckableForSpelling(editor: Editor, pos: number): boolean {
  const { doc } = editor.state;
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(clamped);

  for (let d = $pos.depth; d >= 1; d -= 1) {
    if ($pos.node(d).type.name === "codeBlock") {
      return false;
    }
  }

  const checkMarks = (marks: readonly { type: { name: string } }[] | undefined) =>
    Boolean(marks?.some((m) => EXCLUDED_SPELLCHECK_MARKS.has(m.type.name)));

  if (checkMarks($pos.marks()) || checkMarks(editor.state.storedMarks ?? undefined)) {
    return false;
  }

  if ($pos.nodeBefore && checkMarks($pos.nodeBefore.marks)) {
    return false;
  }

  if ($pos.nodeAfter && checkMarks($pos.nodeAfter.marks)) {
    return false;
  }

  return true;
}

function findWordTargetInBlockAtPos(
  editor: Editor,
  pos: number,
  isWordMisspelled: WordMisspelledChecker,
  ignoredWords: ReadonlySet<string>
): SpellcheckTarget | null {
  const { doc } = editor.state;
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(clamped);

  if (!$pos.parent.isTextblock || !isPositionCheckableForSpelling(editor, clamped)) {
    return null;
  }

  const blockStart = $pos.start();
  let match: SpellcheckTarget | null = null;

  $pos.parent.forEach((child, offsetInBlock) => {
    if (match || !child.isText || !child.text) return;
    if (child.marks.some((m) => EXCLUDED_SPELLCHECK_MARKS.has(m.type.name))) {
      return;
    }

    const childFrom = blockStart + offsetInBlock;
    const childTo = childFrom + child.text.length;
    if (clamped < childFrom || clamped > childTo) return;

    const extracted = extractWordRangeAtOffset(child.text, clamped - childFrom);
    if (!extracted || isIgnoredWord(extracted.word, ignoredWords)) return;

    if (isWordMisspelled(extracted.word)) {
      match = {
        word: extracted.word,
        from: childFrom + extracted.start,
        to: childFrom + extracted.end,
      };
    }
  });

  return match;
}

function isIgnoredWord(word: string, ignoredWords: ReadonlySet<string>): boolean {
  return ignoredWords.has(word) || ignoredWords.has(word.toLowerCase());
}

/**
 * Checks whether viewport coordinates fall plausibly near a resolved ProseMirror position
 * (ignoring empty JSDOM zero rects cleanly).
 */
export function isPointerNearDocRange(
  view: Editor["view"],
  from: number,
  to: number,
  coords: { x: number; y: number }
): boolean {
  try {
    const startRect = view.coordsAtPos(from);
    const endRect = view.coordsAtPos(to);
    const isZeroBox =
      startRect.top === 0 &&
      startRect.bottom === 0 &&
      endRect.right === 0 &&
      endRect.left === 0;

    if (isZeroBox) {
      return true;
    }

    const minTop = Math.min(startRect.top, endRect.top) - 10;
    const maxBottom = Math.max(startRect.bottom, endRect.bottom) + 12;
    const minLeft = Math.min(startRect.left, endRect.left) - 12;
    const maxRight = Math.max(startRect.right, endRect.right) + 12;

    return (
      coords.y >= minTop &&
      coords.y <= maxBottom &&
      coords.x >= minLeft &&
      coords.x <= maxRight
    );
  } catch {
    return true;
  }
}

/**
 * Checks whether right-click coordinates landed strictly below the rendered document blocks.
 */
export function isCoordsBelowDocumentContent(
  view: Editor["view"],
  coords: { x: number; y: number }
): boolean {
  try {
    const domRect = view.dom.lastElementChild?.getBoundingClientRect();
    if (domRect && (domRect.bottom > 0 || domRect.height > 0)) {
      return coords.y > domRect.bottom + 12;
    }

    const endCoords = view.coordsAtPos(view.state.doc.content.size);
    if (endCoords.bottom === 0 && endCoords.top === 0) {
      return false;
    }
    return coords.y > endCoords.bottom + 14;
  } catch {
    return false;
  }
}

/**
 * Resolves a misspelled word inside the current text selection (single-word click/drag
 * or first misspelled word inside a selection).
 */
export function findMisspelledTargetFromSelection(
  editor: Editor,
  isWordMisspelled: WordMisspelledChecker,
  ignoredWords: ReadonlySet<string>,
  singleWordOnly = false
): SpellcheckTarget | null {
  const { selection, doc } = editor.state;

  if (selection.empty) {
    return findWordTargetInBlockAtPos(editor, selection.from, isWordMisspelled, ignoredWords);
  }

  const selectedText = doc.textBetween(selection.from, selection.to, " ", " ").trim();
  const tokensInSelection = extractAllWordRanges(selectedText);
  if (tokensInSelection.length === 0) {
    return null;
  }
  if (singleWordOnly && tokensInSelection.length > 1) {
    return null;
  }

  let match: SpellcheckTarget | null = null;
  doc.nodesBetween(selection.from, selection.to, (node, nodePos) => {
    if (match) return false;
    if (node.type.name === "codeBlock") return false;
    if (!node.isText || !node.text) return true;
    if (node.marks.some((m) => EXCLUDED_SPELLCHECK_MARKS.has(m.type.name))) {
      return false;
    }

    const nodeStart = Math.max(selection.from, nodePos);
    const nodeEnd = Math.min(selection.to, nodePos + node.text.length);
    const sliceOffset = nodeStart - nodePos;
    const sliced = node.text.slice(sliceOffset, nodeEnd - nodePos);

    for (const token of extractAllWordRanges(sliced)) {
      if (isIgnoredWord(token.word, ignoredWords)) continue;
      if (isWordMisspelled(token.word)) {
        match = {
          word: token.word,
          from: nodeStart + token.start,
          to: nodeStart + token.end,
        };
        return false;
      }
    }

    return true;
  });

  return match;
}

/**
 * Safely wraps `view.posAtCoords` so environments lacking `elementFromPoint` (e.g. JSDOM)
 * never throw uncaught TypeErrors inside `prosemirror-view`.
 */
export function safePosAtCoords(
  view: Editor["view"],
  coords: { x: number; y: number }
): { pos: number; inside: number } | null {
  try {
    if (typeof document !== "undefined" && typeof document.elementFromPoint !== "function") {
      return null;
    }
    return view.posAtCoords({ left: coords.x, top: coords.y });
  } catch {
    return null;
  }
}

/**
 * Finds the misspelled word at right-click viewport coordinates or within the active selection.
 */
export function findSpellcheckTargetForInteraction(
  editor: Editor,
  coords: { x: number; y: number } | null,
  isWordMisspelled: WordMisspelledChecker | undefined,
  ignoredWords: ReadonlySet<string>
): SpellcheckTarget | null {
  if (!isWordMisspelled) return null;

  if (coords) {
    const posAtPointer = safePosAtCoords(editor.view, coords);
    if (posAtPointer) {
      const pointerTarget = findWordTargetInBlockAtPos(
        editor,
        posAtPointer.pos,
        isWordMisspelled,
        ignoredWords
      );
      if (
        pointerTarget &&
        isPointerNearDocRange(editor.view, pointerTarget.from, pointerTarget.to, coords)
      ) {
        return pointerTarget;
      }
    } else if (!isCoordsBelowDocumentContent(editor.view, coords)) {
      const caretTarget = findWordTargetInBlockAtPos(
        editor,
        editor.state.selection.from,
        isWordMisspelled,
        ignoredWords
      );
      if (caretTarget) {
        return caretTarget;
      }
    }
  }

  if (!editor.state.selection.empty) {
    return findMisspelledTargetFromSelection(editor, isWordMisspelled, ignoredWords, false);
  }

  return null;
}

/**
 * Resolves a ProseMirror document position inside a table cell at pointer coords,
 * verifying the pointer lies inside that table DOM bounding box.
 */
export function findTablePosAtCoords(
  editor: Editor,
  coords: { x: number; y: number }
): number | null {
  const posAtPointer = safePosAtCoords(editor.view, coords);
  if (!posAtPointer) return null;

  const $pos = editor.state.doc.resolve(posAtPointer.pos);
  for (let d = $pos.depth; d >= 1; d -= 1) {
    const typeName = $pos.node(d).type.name;
    if (typeName === "tableCell" || typeName === "tableHeader" || typeName === "table") {
      if (typeof document !== "undefined" && typeof document.elementFromPoint === "function") {
        const elAtPoint = document.elementFromPoint(coords.x, coords.y);
        if (elAtPoint && !elAtPoint.closest("table")) {
          const domAtTable = editor.view.nodeDOM($pos.before(d));
          if (domAtTable instanceof HTMLElement) {
            const rect = domAtTable.getBoundingClientRect();
            if (rect.height > 0 && (coords.y > rect.bottom + 8 || coords.y < rect.top - 8)) {
              return null;
            }
          }
        }
      }
      return posAtPointer.pos;
    }
  }

  return null;
}

/**
 * Replaces a word range in ProseMirror while preserving inline marks and undo history.
 */
export function replaceTextRangePreservingMarks(
  editor: Editor,
  from: number,
  to: number,
  replacement: string
): boolean {
  const docSize = editor.state.doc.content.size;
  if (from < 0 || to < from || to > docSize) {
    return false;
  }

  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.insertText(replacement, from, to);
      const nextCaret = Math.min(from + replacement.length, tr.doc.content.size);
      tr.setSelection(TextSelection.create(tr.doc, nextCaret));
      return true;
    })
    .run();
}

/**
 * Forces Chromium/Blink to drop cached red underlines after Ignore or Add to Dictionary.
 */
export function refreshDomSpellcheck(
  dom: HTMLElement | null | undefined,
  isEnabled: () => boolean
): void {
  if (!dom || !isEnabled()) return;
  dom.setAttribute("spellcheck", "false");
  const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : setTimeout;
  schedule(() => {
    if (isEnabled()) {
      dom.setAttribute("spellcheck", "true");
    }
  });
}

/**
 * Computes viewport-safe floating coordinates for a context menu or spellcheck popover.
 */
export function clampFloatingCoords(
  rawX: number,
  rawY: number,
  boxWidth: number,
  boxHeight: number,
  margin = 10
): { left: number; top: number } {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

  const left = Math.max(margin, Math.min(rawX, Math.max(margin, viewportWidth - boxWidth - margin)));
  const top = Math.max(margin, Math.min(rawY, Math.max(margin, viewportHeight - boxHeight - margin)));

  return { left, top };
}
