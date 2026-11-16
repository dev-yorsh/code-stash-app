import { Editor, JSONContent } from "@tiptap/core";
import { createRichTextExtensions, DEFAULT_HIGHLIGHT_COLOR } from "../extensions/richTextExtensions";
import { assetUrlManager } from "@/shared/api/assets/assetUrlManager";
import { CODESTASH_ASSET_SCHEME } from "@/shared/api/assets/assetReferences";

export type RichTextCopyMode = "formatted" | "markdown";

export interface RichClipboardPayload {
  html?: string;
  text: string;
}

export interface CopyPlainTextSource {
  editor?: Editor | null;
  code?: string;
  selectionOnly?: boolean;
  docOverride?: JSONContent | null;
}

const VALID_ALIGNS = new Set(["left", "center", "right", "justify"]);
const MARKDOWN_RELEVANT_MARKS = new Set(["bold", "italic", "strike", "code", "highlight", "link"]);
const WHATSAPP_RELEVANT_MARKS = new Set(["bold", "italic", "strike", "code", "link"]);

function normalizeAlignment(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return VALID_ALIGNS.has(normalized) ? normalized : null;
}

function sanitizeStyleValue(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/["<>]/g, "").trim() : "";
}

function sanitizeHref(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed || /^\s*javascript:/i.test(trimmed)) return "";
  return trimmed;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeMarkdownTableCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function normalizeNbsp(text: string, capRootIndent = false): string {
  const withSpaces = text.replace(/\u00A0/g, " ");
  if (!capRootIndent) return withSpaces;
  // Prevent 4+ leading NBSPs from converting prose paragraphs into indented Markdown code blocks.
  return withSpaces.replace(/^ {4,}/, "  ");
}

function wrapInlinePreservingEdges(text: string, open: string, close: string): string {
  if (!text.trim()) return text;
  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  const core = text.slice(leading.length, text.length - trailing.length);
  return `${leading}${open}${core}${close}${trailing}`;
}

function formatInlineCodeToken(text: string): string {
  const maxRun = Math.max(
    0,
    ...(text.match(/`+/g) ?? []).map((run) => run.length)
  );
  const fence = "`".repeat(maxRun + 1);
  const needsPadding = text.startsWith("`") || text.endsWith("`");
  return needsPadding ? `${fence} ${text} ${fence}` : `${fence}${text}${fence}`;
}

function normalizeTextMarksKey(
  marks: JSONContent["marks"],
  allowedNames: ReadonlySet<string>
): string {
  if (!Array.isArray(marks) || marks.length === 0) return "";
  const filtered = marks
    .filter((mark) => mark?.type && allowedNames.has(mark.type))
    .map((mark) => ({
      type: mark.type,
      href: mark.type === "link" ? sanitizeHref(mark.attrs?.href) : undefined,
    }))
    .sort((a, b) => (a.type ?? "").localeCompare(b.type ?? ""));
  return JSON.stringify(filtered);
}

/**
 * Merges adjacent text nodes whose effective output marks match so dropping
 * HTML-only marks (like color or underline) never fragments `**bold**` spans.
 */
function coalesceInlineNodes(
  nodes: JSONContent[] | undefined,
  allowedMarks: ReadonlySet<string>
): JSONContent[] {
  if (!nodes || nodes.length === 0) return [];
  const result: JSONContent[] = [];

  for (const node of nodes) {
    if (node.type !== "text") {
      result.push(node);
      continue;
    }

    const filteredMarks = (node.marks ?? []).filter(
      (mark) => mark?.type && allowedMarks.has(mark.type)
    );
    const key = normalizeTextMarksKey(filteredMarks, allowedMarks);
    const prev = result[result.length - 1];
    const prevKey =
      prev?.type === "text" ? normalizeTextMarksKey(prev.marks, allowedMarks) : null;

    if (prev && prev.type === "text" && prevKey === key) {
      prev.text = `${prev.text ?? ""}${node.text ?? ""}`;
    } else {
      result.push({
        ...node,
        marks: filteredMarks,
      });
    }
  }

  return result;
}

function hasMark(node: JSONContent, type: string): Record<string, unknown> | null {
  const found = node.marks?.find((mark) => mark.type === type);
  return found ? (found.attrs ?? {}) : null;
}

function extractNodePlainText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (!node.content) return "";
  return node.content.map(extractNodePlainText).join("");
}

function extractListItemParts(
  itemNode: JSONContent
): { primaryBlocks: JSONContent[]; nestedLists: JSONContent[] } {
  const primaryBlocks: JSONContent[] = [];
  const nestedLists: JSONContent[] = [];
  const nestedTypes = new Set(["bulletList", "orderedList", "taskList"]);

  for (const child of itemNode.content ?? []) {
    if (child.type && nestedTypes.has(child.type)) {
      nestedLists.push(child);
    } else {
      primaryBlocks.push(child);
    }
  }
  return { primaryBlocks, nestedLists };
}

/* -------------------------------------------------------------------------- */
/*  1. PURE MARKDOWN SERIALIZER (Obsidian / CommonMark / GFM — ZERO HTML)     */
/* -------------------------------------------------------------------------- */

function applyMarkdownMarks(rawText: string, node: JSONContent): string {
  const codeMark = hasMark(node, "code");
  let output = codeMark
    ? formatInlineCodeToken(rawText)
    : normalizeNbsp(rawText, false);

  if (!codeMark) {
    if (hasMark(node, "highlight")) {
      output = wrapInlinePreservingEdges(output, "==", "==");
    }
    if (hasMark(node, "strike")) {
      output = wrapInlinePreservingEdges(output, "~~", "~~");
    }
    if (hasMark(node, "italic")) {
      output = wrapInlinePreservingEdges(output, "*", "*");
    }
    if (hasMark(node, "bold")) {
      output = wrapInlinePreservingEdges(output, "**", "**");
    }
  }

  const linkAttrs = hasMark(node, "link");
  const href = sanitizeHref(linkAttrs?.href);
  if (href) {
    output = `[${output}](${href})`;
  }
  return output;
}

function serializeInlineToMarkdown(nodes?: JSONContent[], isRootParagraph = false): string {
  const merged = coalesceInlineNodes(nodes, MARKDOWN_RELEVANT_MARKS);
  const raw = merged
    .map((node) => {
      if (node.type === "hardBreak") return "  \n";
      if (node.type !== "text") return extractNodePlainText(node);
      return applyMarkdownMarks(node.text ?? "", node);
    })
    .join("");

  return isRootParagraph ? normalizeNbsp(raw, true) : normalizeNbsp(raw, false);
}

function serializeListToMarkdown(listNode: JSONContent, depth: number): string {
  const items = listNode.content ?? [];
  const indent = "  ".repeat(depth);
  const isOrdered = listNode.type === "orderedList";
  const isTask = listNode.type === "taskList";
  const bulletMarker = listNode.attrs?.listStyle === "dash" ? "-" : "*";
  const startIndex = Number(listNode.attrs?.start) || 1;
  const lines: string[] = [];

  items.forEach((item, index) => {
    const { primaryBlocks, nestedLists } = extractListItemParts(item);
    const primaryText = primaryBlocks
      .map((block) => serializeBlockToMarkdown(block, depth + 1))
      .filter(Boolean)
      .join(" ")
      .trim();

    let marker: string;
    if (isTask) {
      marker = item.attrs?.checked ? "- [x]" : "- [ ]";
    } else if (isOrdered) {
      marker = `${startIndex + index}.`;
    } else {
      marker = bulletMarker;
    }

    lines.push(`${indent}${marker} ${primaryText}`.trimEnd());
    for (const nested of nestedLists) {
      lines.push(serializeListToMarkdown(nested, depth + 1));
    }
  });

  return lines.join("\n");
}

function serializeTableToMarkdown(tableNode: JSONContent): string {
  const rows = tableNode.content ?? [];
  if (rows.length === 0) return "";

  const matrix = rows.map((row) =>
    (row.content ?? []).map((cell) => {
      const cellText = (cell.content ?? [])
        .map((block) => serializeBlockToMarkdown(block, 0))
        .filter(Boolean)
        .join(" ");
      return escapeMarkdownTableCell(cellText);
    })
  );

  const colCount = Math.max(1, ...matrix.map((row) => row.length));
  const formatRow = (cells: string[]): string => {
    const padded = Array.from({ length: colCount }, (_, idx) => cells[idx] ?? "");
    return `| ${padded.join(" | ")} |`;
  };

  const lines: string[] = [
    formatRow(matrix[0] ?? []),
    `| ${Array.from({ length: colCount }, () => "---").join(" | ")} |`,
  ];
  for (let i = 1; i < matrix.length; i++) {
    lines.push(formatRow(matrix[i] ?? []));
  }
  return lines.join("\n");
}

function serializeCodeBlockToMarkdown(node: JSONContent): string {
  const code = extractNodePlainText(node);
  const maxTicks = Math.max(2, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(maxTicks + 1);
  const lang = typeof node.attrs?.language === "string" ? node.attrs.language.trim() : "";
  return `${fence}${lang}\n${code}\n${fence}`;
}

function serializeBlockToMarkdown(node: JSONContent, listDepth = 0): string {
  switch (node.type) {
    case "paragraph":
      return serializeInlineToMarkdown(node.content, listDepth === 0);
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
      const inner = serializeInlineToMarkdown(node.content, false).trim();
      return `${"#".repeat(level)} ${inner}`;
    }
    case "blockquote": {
      const inner = (node.content ?? [])
        .map((child) => serializeBlockToMarkdown(child, listDepth))
        .filter(Boolean)
        .join("\n\n");
      return inner
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    }
    case "bulletList":
    case "orderedList":
    case "taskList":
      return serializeListToMarkdown(node, listDepth);
    case "table":
      return serializeTableToMarkdown(node);
    case "codeBlock":
      return serializeCodeBlockToMarkdown(node);
    case "horizontalRule":
      return "---";
    case "image": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      if (!src) return "";
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      const title = typeof node.attrs?.title === "string" ? node.attrs.title : "";
      const safeAlt = alt.replace(/([[\]])/g, "\\$1");
      if (title) {
        const safeTitle = title.replace(/"/g, '\\"');
        return `![${safeAlt}](${src} "${safeTitle}")`;
      }
      return `![${safeAlt}](${src})`;
    }
    case "text":
    case "hardBreak":
      return serializeInlineToMarkdown([node], false);
    default:
      return (node.content ?? [])
        .map((child) => serializeBlockToMarkdown(child, listDepth))
        .filter(Boolean)
        .join("\n\n");
  }
}

export function serializeJsonDocToCleanMarkdown(doc: JSONContent): string {
  const blocks = doc.content ?? [];
  return blocks
    .map((block) => serializeBlockToMarkdown(block, 0))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/* -------------------------------------------------------------------------- */
/*  2A. WORD / DOCS HTML SERIALIZER (Inline Styles — Portable Across Office)  */
/* -------------------------------------------------------------------------- */

function serializeInlineToWordHtml(nodes?: JSONContent[]): string {
  if (!nodes || nodes.length === 0) return "";
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "<br>";
      if (node.type !== "text") return escapeHtml(extractNodePlainText(node));

      let html = escapeHtml(node.text ?? "").replace(/\u00A0/g, "&nbsp;");
      if (hasMark(node, "code")) {
        html = `<code style="font-family: Consolas, 'Courier New', monospace; background-color: #f3f4f6; padding: 1px 4px; border-radius: 4px; font-size: 0.9em;">${html}</code>`;
      }
      if (hasMark(node, "bold")) html = `<strong>${html}</strong>`;
      if (hasMark(node, "italic")) html = `<em>${html}</em>`;
      if (hasMark(node, "underline")) html = `<u>${html}</u>`;
      if (hasMark(node, "strike")) html = `<s>${html}</s>`;

      const colorAttrs = hasMark(node, "textColor");
      const textColor = sanitizeStyleValue(colorAttrs?.color);
      if (textColor) {
        html = `<span style="color: ${textColor};">${html}</span>`;
      }

      const highlightAttrs = hasMark(node, "highlight");
      if (highlightAttrs) {
        const bgColor = sanitizeStyleValue(highlightAttrs.color) || DEFAULT_HIGHLIGHT_COLOR;
        const inkStyle = textColor ? "" : " color: #181c24;";
        html = `<span style="background-color: ${bgColor};${inkStyle} padding: 1px 3px; border-radius: 3px;">${html}</span>`;
      }

      const linkAttrs = hasMark(node, "link");
      const href = sanitizeHref(linkAttrs?.href);
      if (href) {
        html = `<a href="${escapeHtml(href)}" style="color: #2563eb; text-decoration: underline;">${html}</a>`;
      }

      return html;
    })
    .join("");
}

function buildTextAlignCss(node: JSONContent): string {
  const align = normalizeAlignment(node.attrs?.textAlign);
  return align && align !== "left" ? ` text-align: ${align};` : "";
}

function serializeListToWordHtml(listNode: JSONContent): string {
  const items = listNode.content ?? [];
  const isOrdered = listNode.type === "orderedList";
  const isTask = listNode.type === "taskList";

  const renderedItems = items
    .map((item) => {
      const { primaryBlocks, nestedLists } = extractListItemParts(item);
      const inlineBody = primaryBlocks
        .map((block) => serializeInlineToWordHtml(block.content))
        .filter(Boolean)
        .join("<br>");
      const nestedHtml = nestedLists.map(serializeListToWordHtml).join("");

      if (isTask) {
        const checked = Boolean(item.attrs?.checked);
        const checkboxGlyph = checked ? "☑" : "☐";
        const textHtml = checked ? `<s>${inlineBody}</s>` : inlineBody;
        return `<li style="list-style: none; margin: 3px 0;">${checkboxGlyph} ${textHtml}${nestedHtml}</li>`;
      }
      return `<li style="margin: 3px 0;">${inlineBody || "&nbsp;"}${nestedHtml}</li>`;
    })
    .join("");

  if (isTask) {
    return `<ul style="list-style: none; padding-left: 6px; margin: 6px 0;">${renderedItems}</ul>`;
  }
  if (isOrdered) {
    const startAttr = Number(listNode.attrs?.start) > 1 ? ` start="${Number(listNode.attrs?.start)}"` : "";
    return `<ol${startAttr} style="margin: 6px 0; padding-left: 24px;">${renderedItems}</ol>`;
  }
  return `<ul style="margin: 6px 0; padding-left: 24px;">${renderedItems}</ul>`;
}

function serializeTableToWordHtml(tableNode: JSONContent): string {
  const rows = (tableNode.content ?? [])
    .map((row) => {
      const cells = (row.content ?? [])
        .map((cell) => {
          const isHeader = cell.type === "tableHeader";
          const tag = isHeader ? "th" : "td";
          const inner = (cell.content ?? [])
            .map((block) =>
              block.type === "paragraph"
                ? `<p style="margin: 0;${buildTextAlignCss(block)}">${serializeInlineToWordHtml(block.content) || "&nbsp;"}</p>`
                : serializeBlockToWordHtml(block)
            )
            .join("");
          const bg = isHeader ? " background-color: #f3f4f6; font-weight: 600;" : "";
          return `<${tag} style="border: 1px solid #cbd5e1; padding: 6px 10px; vertical-align: top; text-align: left;${bg}">${inner}</${tag}>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table style="border-collapse: collapse; width: 100%; margin: 8px 0;"><tbody>${rows}</tbody></table>`;
}

function serializeBlockToWordHtml(
  node: JSONContent,
  resolvedAssetUrls?: Map<string, string>
): string {
  const alignCss = buildTextAlignCss(node);

  switch (node.type) {
    case "paragraph": {
      const inner = serializeInlineToWordHtml(node.content) || "&nbsp;";
      return `<p style="margin: 0 0 8px;${alignCss}">${inner}</p>`;
    }
    case "heading": {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1));
      const sizes: Record<number, string> = { 1: "22px", 2: "18px", 3: "15px" };
      const inner = serializeInlineToWordHtml(node.content) || "&nbsp;";
      return `<h${level} style="font-size: ${sizes[level]}; font-weight: 700; margin: 10px 0 6px;${alignCss}">${inner}</h${level}>`;
    }
    case "blockquote": {
      const inner = (node.content ?? [])
        .map((child) => serializeBlockToWordHtml(child, resolvedAssetUrls))
        .join("");
      return `<blockquote style="border-left: 3px solid #9ca3af; padding: 4px 0 4px 12px; margin: 8px 0; color: #374151;${alignCss}">${inner}</blockquote>`;
    }
    case "bulletList":
    case "orderedList":
    case "taskList":
      return serializeListToWordHtml(node);
    case "table":
      return serializeTableToWordHtml(node);
    case "codeBlock": {
      const escapedCode = escapeHtml(extractNodePlainText(node));
      return `<pre style="font-family: Consolas, 'Courier New', monospace; background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; margin: 8px 0; white-space: pre-wrap;"><code>${escapedCode}</code></pre>`;
    }
    case "horizontalRule":
      return `<hr style="border: none; border-top: 1px solid #d1d5db; margin: 10px 0;">`;
    case "image": {
      const rawSrc = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      const resolvedSrc = resolvedAssetUrls?.get(rawSrc) ?? rawSrc;
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      const width = typeof node.attrs?.width === "string" ? node.attrs.width : "";
      const align =
        node.attrs?.align === "center" || node.attrs?.align === "right"
          ? node.attrs.align
          : "left";
      if (!resolvedSrc || resolvedSrc.startsWith(CODESTASH_ASSET_SCHEME)) {
        return alt ? `<p style="margin: 8px 0; color: #6b7280;">[Imagen: ${escapeHtml(alt)}]</p>` : "";
      }
      const widthStyle = width ? ` width: ${escapeHtml(width)};` : "";
      return `<div style="text-align: ${align}; margin: 8px 0;"><img src="${escapeHtml(resolvedSrc)}" alt="${escapeHtml(alt)}" style="max-width: 100%; height: auto;${widthStyle} border-radius: 6px;" /></div>`;
    }
    case "text":
    case "hardBreak":
      return serializeInlineToWordHtml([node]);
    default:
      return (node.content ?? [])
        .map((child) => serializeBlockToWordHtml(child, resolvedAssetUrls))
        .join("");
  }
}

export function serializeJsonDocToWordHtml(
  doc: JSONContent,
  resolvedAssetUrls?: Map<string, string>
): string {
  const blocksHtml = (doc.content ?? [])
    .map((block) => serializeBlockToWordHtml(block, resolvedAssetUrls))
    .join("");
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6;">${blocksHtml}</div>`;
}

/* -------------------------------------------------------------------------- */
/*  2B. WHATSAPP / MESSAGING PLAIN-TEXT FORMATTER (Clean & Readable)          */
/* -------------------------------------------------------------------------- */

function applyWhatsAppMarks(rawText: string, node: JSONContent): string {
  const codeMark = hasMark(node, "code");
  let output = codeMark ? `\`${rawText}\`` : normalizeNbsp(rawText, false);

  if (!codeMark) {
    if (hasMark(node, "strike")) {
      output = wrapInlinePreservingEdges(output, "~", "~");
    }
    if (hasMark(node, "italic")) {
      output = wrapInlinePreservingEdges(output, "_", "_");
    }
    if (hasMark(node, "bold")) {
      output = wrapInlinePreservingEdges(output, "*", "*");
    }
  }

  const linkAttrs = hasMark(node, "link");
  const href = sanitizeHref(linkAttrs?.href);
  if (href) {
    const normalizedLabel = rawText.trim().replace(/^https?:\/\//i, "");
    const normalizedHref = href.replace(/^https?:\/\//i, "");
    output =
      normalizedLabel === normalizedHref || rawText.trim() === href
        ? href
        : `${output} (${href})`;
  }
  return output;
}

function serializeInlineToWhatsAppText(nodes?: JSONContent[]): string {
  const merged = coalesceInlineNodes(nodes, WHATSAPP_RELEVANT_MARKS);
  return merged
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      if (node.type !== "text") return extractNodePlainText(node);
      return applyWhatsAppMarks(node.text ?? "", node);
    })
    .join("");
}

function serializeListToWhatsAppText(listNode: JSONContent, depth: number): string {
  const items = listNode.content ?? [];
  const indent = "  ".repeat(depth);
  const isOrdered = listNode.type === "orderedList";
  const isTask = listNode.type === "taskList";
  const bulletGlyph = listNode.attrs?.listStyle === "dash" ? "-" : "•";
  const startIndex = Number(listNode.attrs?.start) || 1;
  const lines: string[] = [];

  items.forEach((item, index) => {
    const { primaryBlocks, nestedLists } = extractListItemParts(item);
    const body = primaryBlocks
      .map((block) => serializeBlockToWhatsAppText(block, depth + 1))
      .filter(Boolean)
      .join(" ")
      .trim();

    let marker: string;
    if (isTask) {
      marker = item.attrs?.checked ? "☑" : "☐";
    } else if (isOrdered) {
      marker = `${startIndex + index}.`;
    } else {
      marker = bulletGlyph;
    }

    lines.push(`${indent}${marker} ${body}`.trimEnd());
    for (const nested of nestedLists) {
      lines.push(serializeListToWhatsAppText(nested, depth + 1));
    }
  });

  return lines.join("\n");
}

function serializeTableToWhatsAppText(tableNode: JSONContent): string {
  const rows = tableNode.content ?? [];
  return rows
    .map((row) =>
      (row.content ?? [])
        .map((cell) =>
          (cell.content ?? [])
            .map((block) => serializeBlockToWhatsAppText(block, 0))
            .filter(Boolean)
            .join(" ")
            .trim()
        )
        .join(" | ")
    )
    .join("\n");
}

function ensureBoldTextNodes(nodes?: JSONContent[]): JSONContent[] {
  if (!nodes) return [];
  return nodes.map((node) => {
    if (node.type !== "text") return node;
    const existing = node.marks ?? [];
    if (existing.some((m) => m.type === "bold" || m.type === "code")) {
      return node;
    }
    return {
      ...node,
      marks: [...existing, { type: "bold" }],
    };
  });
}

function serializeBlockToWhatsAppText(node: JSONContent, listDepth = 0): string {
  switch (node.type) {
    case "paragraph":
      return serializeInlineToWhatsAppText(node.content);
    case "heading": {
      // Promote heading runs to bold at the AST level so mixed bold/plain spans coalesce into one `*title*`.
      return serializeInlineToWhatsAppText(ensureBoldTextNodes(node.content)).trim();
    }
    case "blockquote": {
      const inner = (node.content ?? [])
        .map((child) => serializeBlockToWhatsAppText(child, listDepth))
        .filter(Boolean)
        .join("\n");
      return inner
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    }
    case "bulletList":
    case "orderedList":
    case "taskList":
      return serializeListToWhatsAppText(node, listDepth);
    case "table":
      return serializeTableToWhatsAppText(node);
    case "codeBlock":
      return `\`\`\`\n${extractNodePlainText(node)}\n\`\`\``;
    case "horizontalRule":
      return "———";
    case "image": {
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt.trim() : "";
      return alt && alt !== "imagen" ? `[Imagen: ${alt}]` : "[Imagen]";
    }
    case "text":
    case "hardBreak":
      return serializeInlineToWhatsAppText([node]);
    default:
      return (node.content ?? [])
        .map((child) => serializeBlockToWhatsAppText(child, listDepth))
        .filter(Boolean)
        .join("\n\n");
  }
}

export function serializeJsonDocToWhatsAppText(doc: JSONContent): string {
  return (doc.content ?? [])
    .map((block) => serializeBlockToWhatsAppText(block, 0))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/* -------------------------------------------------------------------------- */
/*  3. SELECTION EXTRACTION, FALLBACK PARSER & CLIPBOARD TRANSPORT            */
/* -------------------------------------------------------------------------- */

function isInsideSameTableCell($from: Editor["state"]["selection"]["$from"], to: number): boolean {
  const sharedDepth = $from.sharedDepth(to);
  for (let d = sharedDepth; d >= 1; d--) {
    const name = $from.node(d).type.name;
    if (name === "tableCell" || name === "tableHeader") {
      return true;
    }
  }
  return false;
}

function unwrapSingleTableCell(nodes: JSONContent[]): JSONContent[] {
  const tableNode = nodes.length === 1 ? nodes[0] : undefined;
  const rowNode =
    tableNode?.type === "table" && tableNode.content?.length === 1
      ? tableNode.content[0]
      : undefined;
  const cellNode =
    rowNode?.type === "tableRow" && rowNode.content?.length === 1
      ? rowNode.content[0]
      : undefined;

  if (
    cellNode &&
    (cellNode.type === "tableCell" || cellNode.type === "tableHeader") &&
    Array.isArray(cellNode.content)
  ) {
    return cellNode.content;
  }

  return nodes;
}

export function extractSelectionAsJsonDoc(editor: Editor): JSONContent {
  const { state } = editor;
  const { selection, doc } = state;
  const { from, to, empty, $from, $to } = selection;
  if (empty) {
    return editor.getJSON();
  }

  // Table CellSelection constructs its own slice (rows or full table).
  if ("$anchorCell" in selection) {
    const cellNodes = (selection.content().content.toJSON() as JSONContent[] | null) ?? [];
    if (cellNodes.length > 0 && cellNodes[0]?.type === "tableRow") {
      return { type: "doc", content: [{ type: "table", content: cellNodes }] };
    }
    return { type: "doc", content: cellNodes };
  }

  if (from <= 1 && to >= doc.content.size - 1) {
    return editor.getJSON();
  }

  const isNodeSelection = "node" in selection;
  const isSingleTextBlock = !isNodeSelection && $from.sameParent($to) && $from.parent.isTextblock;
  const coversWholeTextBlock = isSingleTextBlock && from <= $from.start() && to >= $to.end();
  const isMultiLineCode =
    isSingleTextBlock &&
    $from.parent.type.name === "codeBlock" &&
    (coversWholeTextBlock || doc.textBetween(from, to, "\n", "\n").includes("\n"));

  // Strict inline substring inside a single textblock should stay plain inline text
  // rather than wrapping with heading/list syntax, except for multi-line code blocks.
  if (isSingleTextBlock && !coversWholeTextBlock && !isMultiLineCode) {
    const inlineNodes = (doc.slice(from, to, false).content.toJSON() as JSONContent[] | null) ?? [];
    if (inlineNodes.length === 0) {
      return { type: "doc", content: [] };
    }
    const allInline = inlineNodes.every((n) => n.type === "text" || n.type === "hardBreak");
    return {
      type: "doc",
      content: allInline ? [{ type: "paragraph", content: inlineNodes }] : inlineNodes,
    };
  }

  // selection.content() uses doc.slice(from, to, true), preserving top-level block ancestors.
  const sliceNodes = (selection.content().content.toJSON() as JSONContent[] | null) ?? [];
  if (sliceNodes.length === 0) {
    return { type: "doc", content: [] };
  }

  const content =
    !isNodeSelection && isInsideSameTableCell($from, to)
      ? unwrapSingleTableCell(sliceNodes)
      : sliceNodes;

  return { type: "doc", content };
}

export function parseStoredMarkdownToJsonDoc(rawCode: string): JSONContent {
  if (!rawCode) {
    return { type: "doc", content: [] };
  }

  const headlessEditor = new Editor({
    extensions: createRichTextExtensions(),
    content: rawCode,
    contentType: "markdown",
  });
  try {
    return headlessEditor.getJSON();
  } finally {
    headlessEditor.destroy();
  }
}

function resolveSourceDoc(source: CopyPlainTextSource): JSONContent {
  return source.docOverride
    ? source.docOverride
    : source.editor
      ? source.selectionOnly
        ? extractSelectionAsJsonDoc(source.editor)
        : source.editor.getJSON()
      : parseStoredMarkdownToJsonDoc(source.code ?? "");
}

function collectAssetUrisFromJsonDoc(node: JSONContent | undefined, result = new Set<string>()): Set<string> {
  if (!node) return result;
  if (node.type === "image" && typeof node.attrs?.src === "string") {
    if (node.attrs.src.startsWith(CODESTASH_ASSET_SCHEME)) {
      result.add(node.attrs.src);
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectAssetUrisFromJsonDoc(child, result);
    }
  }
  return result;
}

export function buildRichTextClipboardPayload(
  source: CopyPlainTextSource,
  mode: RichTextCopyMode,
  resolvedAssetUrls?: Map<string, string>
): RichClipboardPayload {
  const doc = resolveSourceDoc(source);

  if (mode === "markdown") {
    return {
      text: serializeJsonDocToCleanMarkdown(doc),
    };
  }

  return {
    html: serializeJsonDocToWordHtml(doc, resolvedAssetUrls),
    text: serializeJsonDocToWhatsAppText(doc),
  };
}

export async function writeClipboardPayload(payload: RichClipboardPayload): Promise<boolean> {
  if (window.electronAPI?.writeRichClipboard) {
    const res = await window.electronAPI.writeRichClipboard(payload);
    if (res?.success) {
      return true;
    }
  }

  if (
    payload.html &&
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined"
  ) {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([payload.html], { type: "text/html" }),
        "text/plain": new Blob([payload.text], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      // Fallback to writeText when ClipboardItem write is denied by browser context.
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
    await navigator.clipboard.writeText(payload.text);
    return true;
  }

  return false;
}

export async function copyPlainTextContent(
  source: CopyPlainTextSource,
  mode: RichTextCopyMode
): Promise<RichClipboardPayload> {
  const doc = resolveSourceDoc(source);
  let resolvedAssetUrls: Map<string, string> | undefined;

  if (mode === "formatted") {
    const uris = collectAssetUrisFromJsonDoc(doc);
    if (uris.size > 0) {
      resolvedAssetUrls = await assetUrlManager.resolveAllUrisToDataUrlMap(uris);
    }
  }

  const payload = buildRichTextClipboardPayload(
    { ...source, docOverride: doc },
    mode,
    resolvedAssetUrls
  );
  await writeClipboardPayload(payload);
  return payload;
}
