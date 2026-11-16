import { Editor, getMarkRange } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { TranslationDictionary } from "../../../../shared/i18n";
import {
  applyRichBlockStyle,
  TextAlignmentValue,
} from "../extensions/richTextExtensions";

export interface ToolbarEditorSnapshot {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  isCode: boolean;
  isHighlight: boolean;
  highlightColor: string | null;
  textColor: string | null;
  textAlign: TextAlignmentValue;
  isH1: boolean;
  isH2: boolean;
  isH3: boolean;
  isBulletList: boolean;
  isDashList: boolean;
  isOrderedList: boolean;
  isTaskList: boolean;
  isBlockquote: boolean;
  isInTable: boolean;
  isLink: boolean;
  linkHref: string;
  linkText: string;
  isBody: boolean;
}

export interface ApplyRichLinkOptions {
  displayText?: string;
  appendAtEnd?: boolean;
}

export type PanelInsertKind = "table" | "blockquote" | "mono";

export interface TableActionDescriptor {
  id: string;
  label: string;
  danger?: boolean;
  closesMenu?: boolean;
  run: () => void;
}

export interface TableActionGroups {
  rows: TableActionDescriptor[];
  columns: TableActionDescriptor[];
  options: TableActionDescriptor[];
}

export function getLinkTargetRangeFromState(state: EditorState): {
  from: number;
  to: number;
} {
  const { selection, schema } = state;
  const linkMarkType = schema.marks.link;
  if (linkMarkType && selection.empty) {
    const range = getMarkRange(selection.$from, linkMarkType);
    if (range) {
      return range;
    }
  }
  return { from: selection.from, to: selection.to };
}

/**
 * Extracts a normalized formatting and structural state snapshot from Tiptap.
 */
export function selectRichEditorSnapshot(ed: Editor): ToolbarEditorSnapshot {
  const isBullet = ed.isActive("bulletList");
  const listStyle = isBullet ? ed.getAttributes("bulletList")?.listStyle : null;
  const isBulletList = isBullet && listStyle !== "dash";
  const isDashList = isBullet && listStyle === "dash";
  const isH1 = ed.isActive("heading", { level: 1 });
  const isH2 = ed.isActive("heading", { level: 2 });
  const isH3 = ed.isActive("heading", { level: 3 });
  const isOrderedList = ed.isActive("orderedList");
  const isTaskList = ed.isActive("taskList");
  const isBlockquote = ed.isActive("blockquote");
  const isCode = ed.isActive("code") || ed.isActive("codeBlock");
  const hlAttrs = ed.getAttributes("highlight");
  const colorAttrs = ed.getAttributes("textColor");
  const alignBlockType = ed.isActive("heading")
    ? "heading"
    : isBlockquote
      ? "blockquote"
      : "paragraph";
  const rawAlign = ed.getAttributes(alignBlockType)?.textAlign;
  const textAlign: TextAlignmentValue =
    rawAlign === "center" || rawAlign === "right" || rawAlign === "justify"
      ? rawAlign
      : "left";
  const linkAttrs = ed.getAttributes("link");
  const linkRange = getLinkTargetRangeFromState(ed.state);
  const linkText =
    linkRange.to > linkRange.from
      ? ed.state.doc.textBetween(linkRange.from, linkRange.to, " ", " ").trim()
      : "";

  return {
    isBold: ed.isActive("bold"),
    isItalic: ed.isActive("italic"),
    isUnderline: ed.isActive("underline"),
    isStrike: ed.isActive("strike"),
    isCode,
    isHighlight: ed.isActive("highlight"),
    highlightColor: typeof hlAttrs?.color === "string" ? hlAttrs.color : null,
    textColor: typeof colorAttrs?.color === "string" ? colorAttrs.color : null,
    textAlign,
    isH1,
    isH2,
    isH3,
    isBulletList,
    isDashList,
    isOrderedList,
    isTaskList,
    isBlockquote,
    isInTable: ed.isActive("table"),
    isLink: ed.isActive("link"),
    linkHref: typeof linkAttrs?.href === "string" ? linkAttrs.href : "",
    linkText,
    isBody: !isH1 && !isH2 && !isH3 && !isBlockquote,
  };
}

export function normalizeLinkHref(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  return /^(https?:\/\/|mailto:|#)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Inserts or updates a link mark along with its visible display text, preserving
 * surrounding inline formatting marks (bold, color, etc.) on the linked range.
 */
export function applyRichLink(
  editor: Editor,
  rawUrl: string,
  options?: ApplyRichLinkOptions
): boolean {
  const normalized = normalizeLinkHref(rawUrl);
  if (!normalized) {
    return removeRichLink(editor);
  }

  const appendAtEnd = options?.appendAtEnd ?? false;
  const requestedLabel = options?.displayText?.trim() ?? "";

  return editor
    .chain()
    .command(({ tr, state }) => {
      const linkMarkType = state.schema.marks.link;
      if (!linkMarkType) return false;

      const linkMark = linkMarkType.create({ href: normalized });

      if (appendAtEnd) {
        const visibleLabel = requestedLabel || normalized;
        const textNode = state.schema.text(visibleLabel, [linkMark]);
        const lastChild = state.doc.lastChild;
        if (lastChild?.type.name === "paragraph" && lastChild.content.size === 0) {
          const insertPos = Math.max(0, state.doc.content.size - 1);
          tr.insert(insertPos, textNode);
          tr.setSelection(TextSelection.create(tr.doc, insertPos + visibleLabel.length));
          return true;
        }

        const paragraphType = state.schema.nodes.paragraph;
        if (!paragraphType) return false;
        const endPos = state.doc.content.size;
        tr.insert(endPos, paragraphType.create(null, textNode));
        tr.setSelection(TextSelection.create(tr.doc, endPos + 1 + visibleLabel.length));
        return true;
      }

      const { from, to } = getLinkTargetRangeFromState(state);
      const existingText = to > from ? state.doc.textBetween(from, to, " ", " ") : "";
      const visibleLabel = requestedLabel || existingText || normalized;

      if (to > from && visibleLabel === existingText) {
        tr.addMark(from, to, linkMark);
        return true;
      }

      const samplePos = to > from ? Math.min(from + 1, to) : from;
      const baseMarks = (
        to > from
          ? state.doc.resolve(samplePos).marks()
          : (state.storedMarks ?? state.selection.$from.marks())
      ).filter((mark) => mark.type !== linkMarkType);

      const textNode = state.schema.text(visibleLabel, [...baseMarks, linkMark]);
      tr.replaceWith(from, to, textNode);
      tr.setSelection(
        TextSelection.create(
          tr.doc,
          Math.min(from + visibleLabel.length, tr.doc.content.size)
        )
      );
      return true;
    })
    .focus()
    .run();
}

export function removeRichLink(editor: Editor): boolean {
  return editor.chain().extendMarkRange("link").unsetLink().focus().run();
}

export function clearAllRichFormatting(editor: Editor, isInTable?: boolean): boolean {
  const inTable = isInTable ?? editor.isActive("table");
  const chain = editor.chain().unsetAllMarks();
  if (!inTable) {
    chain.clearNodes().unsetTextAlign();
  }
  return chain.focus().run();
}

function appendEmptyBlockAtDocEnd(
  editor: Editor,
  kind: "blockquote" | "mono"
): boolean {
  return editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      const endPos = state.doc.content.size;
      if (kind === "mono") {
        const codeBlockType = state.schema.nodes.codeBlock;
        if (!codeBlockType) return false;
        tr.insert(endPos, codeBlockType.create());
        tr.setSelection(TextSelection.create(tr.doc, Math.min(endPos + 1, tr.doc.content.size)));
        return true;
      }

      const blockquoteType = state.schema.nodes.blockquote;
      const paragraphType = state.schema.nodes.paragraph;
      if (!blockquoteType || !paragraphType) return false;
      tr.insert(endPos, blockquoteType.create(null, paragraphType.create()));
      tr.setSelection(TextSelection.create(tr.doc, Math.min(endPos + 2, tr.doc.content.size)));
      return true;
    })
    .run();
}

/**
 * Inserts a table, blockquote, or Monostyled code block cleanly without clobbering
 * existing content when triggered from an empty canvas area below text.
 */
export function insertPanelElement(
  editor: Editor,
  kind: PanelInsertKind,
  appendAtEnd = false,
  tableSize: { rows: number; cols: number } = { rows: 3, cols: 3 }
): boolean {
  if (kind === "table") {
    const chain = editor.chain().focus();
    if (appendAtEnd) {
      chain.setTextSelection(editor.state.doc.content.size);
    }
    return chain
      .insertTable({
        rows: tableSize.rows,
        cols: tableSize.cols,
        withHeaderRow: true,
      })
      .run();
  }

  const lastChildHasText = Boolean(editor.state.doc.lastChild?.textContent.trim().length);
  if (appendAtEnd && lastChildHasText) {
    return appendEmptyBlockAtDocEnd(editor, kind);
  }

  applyRichBlockStyle(editor, kind);
  return true;
}

/**
 * Builds shared table modification action descriptors used by both the toolbar
 * table popover and the right-click context menu.
 */
export function buildTableActionGroups(
  editor: Editor,
  richTextLabels: TranslationDictionary["editor"]["richText"]
): TableActionGroups {
  return {
    rows: [
      {
        id: "addRowBefore",
        label: richTextLabels.addRowBefore,
        run: () => editor.chain().addRowBefore().focus().run(),
      },
      {
        id: "addRowAfter",
        label: richTextLabels.addRowAfter,
        run: () => editor.chain().addRowAfter().focus().run(),
      },
      {
        id: "deleteRow",
        label: richTextLabels.deleteRow,
        run: () => editor.chain().deleteRow().focus().run(),
      },
    ],
    columns: [
      {
        id: "addColumnBefore",
        label: richTextLabels.addColumnBefore,
        run: () => editor.chain().addColumnBefore().focus().run(),
      },
      {
        id: "addColumnAfter",
        label: richTextLabels.addColumnAfter,
        run: () => editor.chain().addColumnAfter().focus().run(),
      },
      {
        id: "deleteColumn",
        label: richTextLabels.deleteColumn,
        run: () => editor.chain().deleteColumn().focus().run(),
      },
    ],
    options: [
      {
        id: "toggleHeaderRow",
        label: richTextLabels.toggleHeaderRow,
        run: () => editor.chain().toggleHeaderRow().focus().run(),
      },
      {
        id: "deleteTable",
        label: richTextLabels.deleteTable,
        danger: true,
        closesMenu: true,
        run: () => editor.chain().deleteTable().focus().run(),
      },
    ],
  };
}
