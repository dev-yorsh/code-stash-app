import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from "@tiptap/core";
import { ResizableImageView } from "../components/ResizableImageView";
import { CODESTASH_ASSET_SCHEME } from "@/shared/api/assets/assetReferences";

export type ResizableImageAlign = "left" | "center" | "right";

export function isAllowedImageSource(src: string | null | undefined): boolean {
  if (!src) return false;
  const trimmed = src.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith(CODESTASH_ASSET_SCHEME) ||
    lower.startsWith("data:image/") ||
    lower.startsWith("blob:") ||
    lower.startsWith("https://") ||
    lower.startsWith("http://")
  ) {
    return true;
  }
  return false;
}

function sanitizeImageAlign(value: unknown): ResizableImageAlign {
  if (value === "center" || value === "right") {
    return value;
  }
  return "left";
}

function sanitizeImageWidth(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{1,4}(%|px)?$/i.test(trimmed)) {
    return /^\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
  }
  return null;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeMarkdownAlt(value: string): string {
  return value.replace(/([[\]])/g, "\\$1");
}

function extractHtmlImgAttrs(rawHtml: string): {
  src: string;
  alt: string | null;
  title: string | null;
  width: string | null;
  align: ResizableImageAlign;
} | null {
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(rawHtml, "text/html");
      const img = doc.querySelector("img[src]");
      if (img) {
        const src = img.getAttribute("src") || "";
        if (!isAllowedImageSource(src)) return null;
        return {
          src,
          alt: img.getAttribute("alt"),
          title: img.getAttribute("title"),
          width: sanitizeImageWidth(
            img.getAttribute("width") ||
              (img instanceof HTMLElement ? img.style.width : null)
          ),
          align: sanitizeImageAlign(img.getAttribute("data-align") || img.getAttribute("align")),
        };
      }
    } catch {
      // Fall back to attribute parsing
    }
  }

  const getAttr = (name: string): string | null => {
    const match = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(rawHtml);
    return match ? (match[1] ?? match[2] ?? null) : null;
  };
  const src = getAttr("src");
  if (!src || !isAllowedImageSource(src)) return null;
  return {
    src,
    alt: getAttr("alt"),
    title: getAttr("title"),
    width: sanitizeImageWidth(getAttr("width")),
    align: sanitizeImageAlign(getAttr("data-align") ?? getAttr("align")),
  };
}

export function splitParagraphTokensWithImages(
  tokens: MarkdownToken[] | undefined,
  helpers: MarkdownParseHelpers
): JSONContent[] | null {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return null;
  }

  const containsImage = tokens.some(
    (t) =>
      t.type === "image" ||
      (t.type === "html" && /<img\b[^>]*src\s*=/i.test(t.raw || t.text || ""))
  );
  if (!containsImage) {
    return null;
  }

  const blocks: JSONContent[] = [];
  let inlineBuffer: MarkdownToken[] = [];

  const flushInline = () => {
    const meaningful = inlineBuffer.some((t) => {
      const txt = t.text ?? t.raw ?? "";
      return txt.trim().length > 0;
    });
    if (meaningful) {
      const parsedInline = helpers.parseInline(inlineBuffer);
      if (parsedInline.length > 0) {
        blocks.push(helpers.createNode("paragraph", {}, parsedInline));
      }
    }
    inlineBuffer = [];
  };

  for (const token of tokens) {
    if (token.type === "image") {
      const src = typeof token.href === "string" ? token.href : "";
      if (isAllowedImageSource(src)) {
        flushInline();
        blocks.push(
          helpers.createNode("image", {
            src,
            alt: token.text || null,
            title: token.title || null,
            width: null,
            align: "left",
          })
        );
        continue;
      }
    }

    if (token.type === "html") {
      const htmlRaw = token.text || token.raw || "";
      if (/<img\b/i.test(htmlRaw)) {
        const parsedAttrs = extractHtmlImgAttrs(htmlRaw);
        if (parsedAttrs) {
          flushInline();
          blocks.push(helpers.createNode("image", parsedAttrs));
          continue;
        }
      }
    }

    inlineBuffer.push(token);
  }

  flushInline();
  return blocks.length > 0 ? blocks : [helpers.createNode("paragraph", {}, [])];
}

export const ResizableImage = Node.create({
  name: "image",
  group: "block",
  inline: false,
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => {
          const src = element.getAttribute("src");
          return isAllowedImageSource(src) ? src : null;
        },
      },
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute("alt"),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("title"),
      },
      width: {
        default: null,
        parseHTML: (element) =>
          sanitizeImageWidth(
            element.getAttribute("width") || (element as HTMLElement).style?.width
          ),
        renderHTML: (attributes) => {
          const safe = sanitizeImageWidth(attributes.width);
          return safe ? { width: safe } : {};
        },
      },
      align: {
        default: "left",
        parseHTML: (element) =>
          sanitizeImageAlign(
            element.getAttribute("data-align") || element.getAttribute("align")
          ),
        renderHTML: (attributes) => {
          const align = sanitizeImageAlign(attributes.align);
          return align !== "left" ? { "data-align": align } : {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          const src = el.getAttribute("src");
          if (!isAllowedImageSource(src)) {
            return false;
          }
          return {
            src,
            alt: el.getAttribute("alt"),
            title: el.getAttribute("title"),
            width: sanitizeImageWidth(el.getAttribute("width") || el.style?.width),
            align: sanitizeImageAlign(
              el.getAttribute("data-align") || el.getAttribute("align")
            ),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },

  markdownTokenName: "image",

  parseMarkdown(token, helpers) {
    const src = typeof token.href === "string" ? token.href : "";
    if (!isAllowedImageSource(src)) {
      return [];
    }
    return helpers.createNode("image", {
      src,
      alt: token.text || null,
      title: token.title || null,
      width: null,
      align: "left",
    });
  },

  renderMarkdown(node) {
    const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
    if (!isAllowedImageSource(src)) {
      return "";
    }

    const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
    const title = typeof node.attrs?.title === "string" ? node.attrs.title : "";
    const width = sanitizeImageWidth(node.attrs?.width);
    const align = sanitizeImageAlign(node.attrs?.align);

    if (width || align !== "left" || title) {
      const parts = [`src="${escapeHtmlAttr(src)}"`];
      if (alt) parts.push(`alt="${escapeHtmlAttr(alt)}"`);
      if (title) parts.push(`title="${escapeHtmlAttr(title)}"`);
      if (width) parts.push(`width="${escapeHtmlAttr(width)}"`);
      if (align !== "left") parts.push(`data-align="${align}"`);
      return `<img ${parts.join(" ")} />`;
    }

    return `![${escapeMarkdownAlt(alt)}](${src})`;
  },
});
