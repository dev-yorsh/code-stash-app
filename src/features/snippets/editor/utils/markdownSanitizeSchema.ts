import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Element, ElementContent, Parents, Root } from "hast";
import { isAllowedImageSource } from "../extensions/resizableImageExtension";

const SAFE_BR_TAG_RE = /^<br\s*\/?>$/i;

function transformSafeLineBreaks(parent: Parents): void {
  if (!Array.isArray(parent.children)) return;
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i] as ElementContent & { value?: unknown };
    if ((child.type as string) === "raw" && typeof child.value === "string") {
      if (SAFE_BR_TAG_RE.test(child.value.trim())) {
        parent.children[i] = {
          type: "element",
          tagName: "br",
          properties: {},
          children: [],
        };
      } else {
        // Strip arbitrary raw HTML segments instead of passing raw HTML strings through
        parent.children.splice(i, 1);
        i--;
      }
      continue;
    }
    if ("children" in child && Array.isArray(child.children)) {
      transformSafeLineBreaks(child as Parents);
    }
  }
}

/**
 * Converts safe `<br>` inline line breaks inside Markdown (such as inside GFM
 * table cells) into `<br>` elements while stripping all arbitrary raw HTML.
 */
export function rehypeSafeLineBreaks() {
  return (tree: Root) => {
    transformSafeLineBreaks(tree);
  };
}

type SanitizeSchema = NonNullable<Parameters<typeof rehypeSanitize>[0]>;

/**
 * Strict GitHub-style HTML sanitization schema extended minimally for
 * fenced language/math classes and CodeStash offline asset image URIs.
 * Runs BEFORE rehype-katex and rehype-highlight in the rehype pipeline.
 */
export const markdownSanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? [])],
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./, "math-inline", "math-display"]],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ["className", "math", "math-display"],
      "align",
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", "math", "math-inline"],
    ],
    p: [...(defaultSchema.attributes?.p ?? []), "align"],
    h1: ["align"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "align"],
    h3: ["align"],
    h4: ["align"],
    h5: ["align"],
    h6: ["align"],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ["http", "https", "data", "blob", "codestash-asset"],
  },
};

const SAFE_LINK_PROTOCOL_RE = /^(?:https?:|mailto:|#)/i;

/**
 * Validates Markdown link/image URLs while permitting local CodeStash assets
 * and embedded data-URL images used in offline snippets.
 */
export function safeMarkdownUrlTransform(url: string, key: string): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return "";

  if (key === "src") {
    return isAllowedImageSource(trimmed) ? trimmed : "";
  }

  if (key === "href") {
    return SAFE_LINK_PROTOCOL_RE.test(trimmed) ? trimmed : "";
  }

  return SAFE_LINK_PROTOCOL_RE.test(trimmed) ? trimmed : "";
}

/** Recursively extracts raw plain text from a HAST element subtree. */
export function extractHastText(node: Element | ElementContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") {
    return node.value;
  }
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((child) => extractHastText(child)).join("");
  }
  return "";
}

/** Finds the <code> element inside a <pre> HAST element and returns its language ID + raw code. */
export function extractFencedCodeMeta(preNode: Element | undefined): {
  language: string;
  rawCode: string;
} {
  if (!preNode || !Array.isArray(preNode.children)) {
    return { language: "", rawCode: "" };
  }

  const codeChild = preNode.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "code"
  );

  if (!codeChild) {
    return {
      language: "",
      rawCode: extractHastText(preNode).replace(/\n$/, ""),
    };
  }

  const rawClassName: unknown = codeChild.properties?.className;
  const classList = Array.isArray(rawClassName)
    ? rawClassName
    : typeof rawClassName === "string"
      ? rawClassName.split(/\s+/)
      : [];

  let language = "";
  for (const cls of classList) {
    if (typeof cls === "string" && cls.startsWith("language-")) {
      language = cls.slice("language-".length).trim().toLowerCase();
      break;
    }
  }

  return {
    language,
    rawCode: extractHastText(codeChild).replace(/\n$/, ""),
  };
}
