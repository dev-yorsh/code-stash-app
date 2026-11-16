import {
  AnyExtension,
  Editor,
  Extension,
  JSONContent,
  Mark,
  mergeAttributes,
  wrappingInputRule,
} from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Blockquote from "@tiptap/extension-blockquote";
import Heading from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import Paragraph from "@tiptap/extension-paragraph";
import { BulletList, ListItem, TaskList, TaskItem } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import {
  ResizableImage,
  splitParagraphTokensWithImages,
} from "./resizableImageExtension";

export type BulletListStyle = "bullet" | "dash";
export type RichListType = "bullet" | "dash" | "ordered" | "task";
export type RichBlockStyle = "title" | "heading" | "subtitle" | "body" | "blockquote" | "mono";
export type TextAlignmentValue = "left" | "center" | "right" | "justify";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (color: string) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
    textAlignment: {
      setTextAlign: (alignment: TextAlignmentValue) => ReturnType;
      unsetTextAlign: () => ReturnType;
    };
  }
}

/**
 * 4 non-breaking spaces preserve horizontal indentation across HTML rendering
 * and Markdown round-trips without triggering CommonMark 4-space code blocks.
 */
export const TAB_INDENT = "\u00A0\u00A0\u00A0\u00A0";

export const HIGHLIGHT_SWATCHES = [
  { id: "amber", color: "#e5c07b", label: "Amber" },
  { id: "coral", color: "#e06c75", label: "Coral" },
  { id: "sage", color: "#98c379", label: "Sage" },
  { id: "sky", color: "#61afef", label: "Sky" },
  { id: "lavender", color: "#c678dd", label: "Lavender" },
] as const;

export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_SWATCHES[0].color;

export const TEXT_COLOR_SWATCHES = [
  { id: "red", color: "#ef4444", label: "Red" },
  { id: "orange", color: "#f97316", label: "Orange" },
  { id: "yellow", color: "#eab308", label: "Yellow" },
  { id: "green", color: "#22c55e", label: "Green" },
  { id: "cyan", color: "#06b6d4", label: "Cyan" },
  { id: "blue", color: "#3b82f6", label: "Blue" },
  { id: "purple", color: "#a855f7", label: "Purple" },
  { id: "pink", color: "#ec4899", label: "Pink" },
] as const;

const ALIGNABLE_TYPES = new Set(["paragraph", "heading", "blockquote"]);
const VALID_ALIGNMENTS = new Set<TextAlignmentValue>(["left", "center", "right", "justify"]);

function normalizeAlignment(raw: unknown): TextAlignmentValue | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase() as TextAlignmentValue;
  return VALID_ALIGNMENTS.has(trimmed) ? trimmed : null;
}

function sanitizeCssValue(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/["<>]/g, "").trim() : "";
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapWithMarkHtml(inner: string, mark: { type?: string; attrs?: Record<string, unknown> }): string {
  switch (mark.type) {
    case "bold":
      return `<strong>${inner}</strong>`;
    case "italic":
      return `<em>${inner}</em>`;
    case "underline":
      return `<u>${inner}</u>`;
    case "strike":
      return `<s>${inner}</s>`;
    case "code":
      return `<code>${inner}</code>`;
    case "highlight": {
      const color = sanitizeCssValue(mark.attrs?.color);
      return color ? `<mark data-color="${color}">${inner}</mark>` : `<mark>${inner}</mark>`;
    }
    case "textColor": {
      const color = sanitizeCssValue(mark.attrs?.color);
      return color
        ? `<span data-text-color="${color}" style="color: ${color}">${inner}</span>`
        : inner;
    }
    case "link": {
      const href = sanitizeCssValue(mark.attrs?.href);
      return href ? `<a href="${href}">${inner}</a>` : inner;
    }
    default:
      return inner;
  }
}

function serializeNodesAsHtml(nodes?: JSONContent[]): string {
  if (!nodes || nodes.length === 0) return "";
  return nodes
    .map((child) => {
      if (child.type === "text") {
        let html = escapeHtmlText(child.text ?? "");
        const marks = Array.isArray(child.marks) ? child.marks : [];
        for (let i = marks.length - 1; i >= 0; i--) {
          html = wrapWithMarkHtml(html, marks[i] as { type?: string; attrs?: Record<string, unknown> });
        }
        return html;
      }
      if (child.type === "hardBreak") {
        return "<br>";
      }
      if (child.type === "paragraph") {
        const align = normalizeAlignment(child.attrs?.textAlign);
        const alignAttr =
          align && align !== "left" ? ` data-align="${align}" style="text-align: ${align}"` : "";
        return `<p${alignAttr}>${serializeNodesAsHtml(child.content)}</p>`;
      }
      if (child.type === "heading") {
        const level = Number(child.attrs?.level) || 1;
        const align = normalizeAlignment(child.attrs?.textAlign);
        const alignAttr =
          align && align !== "left" ? ` data-align="${align}" style="text-align: ${align}"` : "";
        return `<h${level}${alignAttr}>${serializeNodesAsHtml(child.content)}</h${level}>`;
      }
      if (child.type === "bulletList") {
        return `<ul>${serializeNodesAsHtml(child.content)}</ul>`;
      }
      if (child.type === "orderedList") {
        return `<ol>${serializeNodesAsHtml(child.content)}</ol>`;
      }
      if (child.type === "listItem") {
        return `<li>${serializeNodesAsHtml(child.content)}</li>`;
      }
      if (child.type === "codeBlock") {
        return `<pre><code>${serializeNodesAsHtml(child.content)}</code></pre>`;
      }
      return serializeNodesAsHtml(child.content);
    })
    .join("");
}

const BULLET_MARKER_INPUT_REGEX = /^\s*([*+])\s$/;
const DASH_MARKER_INPUT_REGEX = /^\s*(-)\s$/;

/**
 * Extends Tiptap BulletList with a `listStyle` attribute ("bullet" | "dash")
 * so bulleted (`* `) and dashed (`- `) lists render distinct markers and
 * round-trip cleanly in Markdown.
 */
export const StyledBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      listStyle: {
        default: "bullet" as BulletListStyle,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-list-style") === "dash" ? "dash" : "bullet",
        renderHTML: (attributes: { listStyle?: BulletListStyle }) => ({
          "data-list-style": attributes.listStyle === "dash" ? "dash" : "bullet",
        }),
      },
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: BULLET_MARKER_INPUT_REGEX,
        type: this.type,
        getAttributes: () => ({ listStyle: "bullet" }),
      }),
      wrappingInputRule({
        find: DASH_MARKER_INPUT_REGEX,
        type: this.type,
        getAttributes: () => ({ listStyle: "dash" }),
      }),
    ];
  },

  parseMarkdown(token, helpers) {
    if (token.type !== "list" || token.ordered) {
      return [];
    }

    const rawTrimmed = typeof token.raw === "string" ? token.raw.trimStart() : "";
    const listStyle: BulletListStyle = rawTrimmed.startsWith("-") ? "dash" : "bullet";

    return {
      type: "bulletList",
      attrs: { listStyle },
      content: token.items ? helpers.parseChildren(token.items) : [],
    };
  },
});

/**
 * Extends Tiptap ListItem so parent `listStyle: "bullet"` serializes as `* `
 * while `listStyle: "dash"` serializes as `- `.
 */
export const StyledListItem = ListItem.extend({
  renderMarkdown(node, helpers, ctx) {
    const baseOutput = ListItem.config.renderMarkdown
      ? ListItem.config.renderMarkdown.call(this, node, helpers, ctx)
      : "";

    if (
      ctx?.parentType === "bulletList" &&
      ctx?.meta?.parentAttrs?.listStyle !== "dash" &&
      baseOutput.startsWith("- ")
    ) {
      return `* ${baseOutput.slice(2)}`;
    }

    return baseOutput;
  },
});

/**
 * Multicolor Highlight mark persisting colored swatches as `<mark data-color="...">`
 * and uncolored highlights as standard `==...==` Markdown.
 */
export const ColoredHighlight = Highlight.extend({
  renderMarkdown(node, helpers) {
    const content = helpers.renderChildren(node);
    const color = node.attrs?.color;
    if (typeof color === "string" && color.trim().length > 0) {
      const safeColor = color.replace(/"/g, "");
      return `<mark data-color="${safeColor}">${content}</mark>`;
    }
    return `==${content}==`;
  },
}).configure({
  multicolor: true,
});

const SPAN_COLOR_OPEN_REGEX = /^<span\b([^>]*)>/i;

function extractColorFromSpanAttrs(attrText: string): string | null {
  const dataMatch = /data-text-color\s*=\s*"([^"]+)"/i.exec(attrText);
  if (dataMatch?.[1]) {
    return sanitizeCssValue(dataMatch[1]) || null;
  }
  const styleMatch = /style\s*=\s*"[^"]*color\s*:\s*([^;"']+)/i.exec(attrText);
  return styleMatch?.[1] ? sanitizeCssValue(styleMatch[1]) || null : null;
}

/**
 * Custom text-color mark persisting colors in Markdown via inline `<span data-text-color style="color: ...">`.
 */
export const TextColor = Mark.create({
  name: "textColor",
  priority: 50,

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-text-color") || element.style?.color || null,
        renderHTML: (attributes: { color?: string | null }) => {
          const safeColor = sanitizeCssValue(attributes.color);
          if (!safeColor) return {};
          return {
            "data-text-color": safeColor,
            style: `color: ${safeColor}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: "span[data-text-color]" },
      {
        tag: "span",
        getAttrs: (element) => {
          if (typeof element === "string") return false;
          return element.style?.color ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  renderMarkdown(node, helpers) {
    const content = helpers.renderChildren(node);
    const safeColor = sanitizeCssValue(node.attrs?.color);
    if (!safeColor) {
      return content;
    }
    return `<span data-text-color="${safeColor}" style="color: ${safeColor}">${content}</span>`;
  },

  parseMarkdown(token, helpers) {
    const rawColor = (token as { color?: unknown }).color;
    const color = sanitizeCssValue(rawColor);
    const children = helpers.parseInline(token.tokens || []);
    return color ? helpers.applyMark(this.name || "textColor", children, { color }) : children;
  },

  markdownTokenizer: {
    name: "textColor",
    level: "inline",
    start(src) {
      const idx = src.toLowerCase().indexOf("<span");
      return idx;
    },
    tokenize(src, _tokens, lexer) {
      const openMatch = SPAN_COLOR_OPEN_REGEX.exec(src);
      if (!openMatch) return;
      const color = extractColorFromSpanAttrs(openMatch[1] ?? "");
      if (!color) return;

      const openLen = openMatch[0].length;
      const closeIdx = src.toLowerCase().indexOf("</span>", openLen);
      if (closeIdx === -1) return;

      const text = src.slice(openLen, closeIdx);
      if (!text) return;

      return {
        type: "textColor",
        raw: src.slice(0, closeIdx + 7),
        text,
        color,
        tokens: lexer.inlineTokens(text),
      };
    },
  },

  addCommands() {
    return {
      setTextColor:
        (color: string) =>
        ({ commands }) => {
          const safeColor = sanitizeCssValue(color);
          if (!safeColor) {
            return commands.unsetMark(this.name);
          }
          return commands.setMark(this.name, { color: safeColor });
        },
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

/**
 * Global text alignment attribute ("left" | "center" | "right" | "justify")
 * applied uniformly across paragraphs, headings, and blockquotes.
 */
export const TextAlignment = Extension.create({
  name: "textAlignment",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockquote"],
        attributes: {
          textAlign: {
            default: "left" as TextAlignmentValue,
            parseHTML: (element: HTMLElement) =>
              normalizeAlignment(element.getAttribute("data-align")) ??
              normalizeAlignment(element.style?.textAlign) ??
              "left",
            renderHTML: (attributes: { textAlign?: TextAlignmentValue }) => {
              const align = normalizeAlignment(attributes.textAlign);
              if (!align || align === "left") {
                return {};
              }
              return {
                "data-align": align,
                style: `text-align: ${align}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment: TextAlignmentValue) =>
        ({ commands }) => {
          const valid = normalizeAlignment(alignment) ?? "left";
          let updated = false;
          for (const nodeType of ALIGNABLE_TYPES) {
            if (commands.updateAttributes(nodeType, { textAlign: valid })) {
              updated = true;
            }
          }
          return updated;
        },
      unsetTextAlign:
        () =>
        ({ commands }) => {
          let reset = false;
          for (const nodeType of ALIGNABLE_TYPES) {
            if (commands.resetAttributes(nodeType, "textAlign")) {
              reset = true;
            }
          }
          return reset;
        },
    };
  },
});

export const AlignedParagraph = Paragraph.extend({
  parseMarkdown(token, helpers) {
    const splitBlocks = splitParagraphTokensWithImages(token.tokens, helpers);
    if (splitBlocks) {
      return splitBlocks;
    }
    if (Paragraph.config.parseMarkdown) {
      return Paragraph.config.parseMarkdown.call(this, token, helpers);
    }
    return helpers.createNode(
      "paragraph",
      {},
      helpers.parseInline(token.tokens || [])
    );
  },

  renderMarkdown(node, helpers, ctx) {
    const align = normalizeAlignment(node.attrs?.textAlign);
    if (align && align !== "left") {
      return `<p data-align="${align}" style="text-align: ${align}">${serializeNodesAsHtml(node.content)}</p>`;
    }
    return Paragraph.config.renderMarkdown
      ? Paragraph.config.renderMarkdown.call(this, node, helpers, ctx)
      : helpers.renderChildren(node);
  },
});

export const AlignedHeading = Heading.extend({
  renderMarkdown(node, helpers, ctx) {
    const align = normalizeAlignment(node.attrs?.textAlign);
    if (align && align !== "left") {
      const level = Number(node.attrs?.level) || 1;
      return `<h${level} data-align="${align}" style="text-align: ${align}">${serializeNodesAsHtml(node.content)}</h${level}>`;
    }
    return Heading.config.renderMarkdown
      ? Heading.config.renderMarkdown.call(this, node, helpers, ctx)
      : `# ${helpers.renderChildren(node)}`;
  },
}).configure({
  levels: [1, 2, 3],
});

export const AlignedBlockquote = Blockquote.extend({
  renderMarkdown(node, helpers, ctx) {
    const align = normalizeAlignment(node.attrs?.textAlign);
    if (align && align !== "left") {
      return `<blockquote data-align="${align}" style="text-align: ${align}">${serializeNodesAsHtml(node.content)}</blockquote>`;
    }
    return Blockquote.config.renderMarkdown
      ? Blockquote.config.renderMarkdown.call(this, node, helpers, ctx)
      : `> ${helpers.renderChildren(node)}`;
  },
});

function insertHorizontalIndent(editor: Editor): boolean {
  return editor
    .chain()
    .command(({ tr, state }) => {
      tr.insertText(TAB_INDENT, state.selection.from, state.selection.to);
      return true;
    })
    .run();
}

function removeHorizontalIndent(editor: Editor): boolean {
  return editor
    .chain()
    .command(({ tr, state }) => {
      const { from, to, $from } = state.selection;
      if (from !== to) {
        return true;
      }

      const blockStart = $from.start();
      const textBefore = state.doc.textBetween(blockStart, from, "", "");
      const trailingMatch = textBefore.match(/[\u00A0 ]{1,4}$/);
      if (trailingMatch) {
        tr.delete(from - trailingMatch[0].length, from);
        return true;
      }

      const blockText = $from.parent.textContent;
      const leadingMatch = blockText.match(/^[\u00A0 ]{1,4}/);
      if (leadingMatch) {
        tr.delete(blockStart, blockStart + leadingMatch[0].length);
      }
      return true;
    })
    .run();
}

/**
 * Prevents Tab / Shift-Tab from moving focus out across lines or UI buttons:
 * - Tables keep cell navigation (`return false` delegates to `TableKit`).
 * - Lists / checklists indent or outdent sub-items, falling back to horizontal indent at top level.
 * - Paragraphs, headings, and blockquotes insert/remove horizontal 4-space tabs.
 */
export const RichTextTabKeymap = Extension.create({
  name: "richTextTabKeymap",
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.isActive("table")) {
          return false;
        }
        if (editor.isActive("codeBlock")) {
          editor
            .chain()
            .command(({ tr, state }) => {
              tr.insertText("    ", state.selection.from, state.selection.to);
              return true;
            })
            .run();
          return true;
        }
        if (editor.isActive("listItem")) {
          if (!editor.commands.sinkListItem("listItem")) {
            insertHorizontalIndent(editor);
          }
          return true;
        }
        if (editor.isActive("taskItem")) {
          if (!editor.commands.sinkListItem("taskItem")) {
            insertHorizontalIndent(editor);
          }
          return true;
        }

        insertHorizontalIndent(editor);
        return true;
      },

      "Shift-Tab": ({ editor }) => {
        if (editor.isActive("table")) {
          return false;
        }
        if (editor.isActive("listItem")) {
          editor.commands.liftListItem("listItem");
          return true;
        }
        if (editor.isActive("taskItem")) {
          editor.commands.liftListItem("taskItem");
          return true;
        }

        removeHorizontalIndent(editor);
        return true;
      },
    };
  },
});

/**
 * Builds the complete Tiptap v3 extension stack used by `RichTextEditorPanel`.
 */
export function createRichTextExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      paragraph: false,
      heading: false,
      blockquote: false,
      bulletList: false,
      listItem: false,
      code: {
        HTMLAttributes: {
          spellcheck: "false",
        },
      },
      codeBlock: {
        HTMLAttributes: {
          spellcheck: "false",
        },
      },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          spellcheck: "false",
        },
      },
    }),
    AlignedParagraph,
    AlignedHeading,
    AlignedBlockquote,
    StyledBulletList,
    StyledListItem,
    ColoredHighlight,
    TextColor,
    TextAlignment,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    TableKit.configure({
      table: {
        resizable: false,
      },
    }),
    ResizableImage,
    RichTextTabKeymap,
    Markdown.configure({
      markedOptions: {
        breaks: true,
        gfm: true,
      },
    }),
  ];
}

const RICH_BLOCK_NODES = new Set([
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "taskItem",
  "table",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "image",
]);

const RICH_MARKS = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "highlight",
  "textColor",
  "link",
]);

/**
 * Inspects whether a Tiptap document currently uses any rich-text nodes, marks, or custom alignments.
 * Used to keep rich-formatted plain-text notes from being misclassified as raw Markdown code.
 */
export function hasRichTextFormatting(editor: Editor): boolean {
  let detected = false;
  editor.state.doc.descendants((node) => {
    if (detected) {
      return false;
    }
    if (RICH_BLOCK_NODES.has(node.type.name)) {
      detected = true;
      return false;
    }
    const align = normalizeAlignment(node.attrs?.textAlign);
    if (align && align !== "left") {
      detected = true;
      return false;
    }
    if (node.marks.some((mark) => RICH_MARKS.has(mark.type.name))) {
      detected = true;
      return false;
    }
    return true;
  });
  return detected;
}

/**
 * Switches the cursor's current block/selection into a styled bullet list (`bullet` or `dash`),
 * converting seamlessly from paragraphs, headings, ordered lists, task lists, or the other bullet variant.
 */
export function toggleStyledBulletList(editor: Editor, style: BulletListStyle): void {
  const isInBulletList = editor.isActive("bulletList");
  const currentStyle = editor.getAttributes("bulletList")?.listStyle;

  if (isInBulletList && currentStyle === style) {
    editor.chain().toggleBulletList().focus().run();
    return;
  }

  if (isInBulletList) {
    editor.chain().updateAttributes("bulletList", { listStyle: style }).focus().run();
    return;
  }

  editor
    .chain()
    .toggleBulletList()
    .updateAttributes("bulletList", { listStyle: style })
    .focus()
    .run();
}

/**
 * Uniformly applies any list format (bullet, dash, ordered, checklist) from one place.
 */
export function applyRichListType(editor: Editor, listType: RichListType): void {
  if (listType === "bullet" || listType === "dash") {
    toggleStyledBulletList(editor, listType);
    return;
  }
  if (listType === "ordered") {
    editor.chain().toggleOrderedList().focus().run();
    return;
  }
  editor.chain().toggleTaskList().focus().run();
}

function selectionOnlyContainsCodeBlocks(state: Editor["state"]): boolean {
  let hasCodeBlock = false;
  let hasOtherBlock = false;
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
    if (node.type.name === "codeBlock") {
      hasCodeBlock = true;
      return false;
    }
    if (node.isTextblock) {
      hasOtherBlock = true;
    }
    return true;
  });
  return hasCodeBlock && !hasOtherBlock;
}

function toggleMonoStyle(editor: Editor): void {
  if (editor.isActive("codeBlock")) {
    editor.chain().toggleCodeBlock().focus().run();
    return;
  }
  if (selectionOnlyContainsCodeBlocks(editor.state)) {
    editor.chain().clearNodes().focus().run();
    return;
  }

  const { state } = editor;
  const { from, to, empty, $from, $to } = state.selection;
  const isSingleTextBlock = $from.sameParent($to) && $from.parent.isTextblock;
  const spansEntireBlock = isSingleTextBlock && from <= $from.start() && to >= $from.end();
  const isInlineSubstring = !empty && isSingleTextBlock && !spansEntireBlock;

  if (isInlineSubstring) {
    editor.chain().toggleCode().focus().run();
    return;
  }

  if (empty && editor.isActive("code")) {
    editor.chain().unsetCode().focus().run();
    return;
  }

  if (!isSingleTextBlock) {
    const range = $from.blockRange($to);
    const startPos = range ? range.start : 0;
    const endPos = range ? range.end : state.doc.content.size;
    const codeBlockType = state.schema.nodes.codeBlock;
    if (codeBlockType) {
      const combinedCode = state.doc.textBetween(startPos, endPos, "\n", "\n");
      const codeNode = codeBlockType.create(
        null,
        combinedCode ? state.schema.text(combinedCode) : undefined
      );
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.replaceWith(startPos, endPos, codeNode);
          const endOfCode = Math.min(startPos + 1 + combinedCode.length, tr.doc.content.size);
          tr.setSelection(TextSelection.create(tr.doc, endOfCode));
          return true;
        })
        .run();
      return;
    }
  }

  editor.chain().toggleCodeBlock().focus().run();
}

/**
 * Uniformly applies a block typography style or monospace block/inline toggle.
 */
export function applyRichBlockStyle(editor: Editor, style: RichBlockStyle): void {
  if (style === "title") {
    editor.chain().toggleHeading({ level: 1 }).focus().run();
    return;
  }
  if (style === "heading") {
    editor.chain().toggleHeading({ level: 2 }).focus().run();
    return;
  }
  if (style === "subtitle") {
    editor.chain().toggleHeading({ level: 3 }).focus().run();
    return;
  }
  if (style === "blockquote") {
    editor.chain().toggleBlockquote().focus().run();
    return;
  }
  if (style === "mono") {
    toggleMonoStyle(editor);
    return;
  }

  // "body": normalize current block back to a standard paragraph
  if (editor.isActive("code")) {
    editor.chain().unsetCode().run();
  }
  if (editor.isActive("table")) {
    editor.chain().setParagraph().focus().run();
  } else {
    editor.chain().clearNodes().setParagraph().focus().run();
  }
}
