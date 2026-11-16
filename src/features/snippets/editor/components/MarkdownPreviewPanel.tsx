import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeSanitize from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import {
  AlertCircle,
  AlertTriangle,
  CheckSquare,
  Copy,
  Info,
  Lightbulb,
  ShieldAlert,
} from "lucide-react";
import { ThemeDefinition } from "@/features/settings";
import { useTranslation } from "@/shared/i18n";
import { openExternalUrl } from "@/core/utils/openExternalUrl";
import { parseAssetUri } from "@/shared/api/assets/assetReferences";
import { assetUrlManager } from "@/shared/api/assets/assetUrlManager";
import {
  extractFencedCodeMeta,
  extractHastText,
  markdownSanitizeSchema,
  rehypeSafeLineBreaks,
  safeMarkdownUrlTransform,
} from "../utils/markdownSanitizeSchema";
import { MermaidDiagram } from "./MermaidDiagram";
import { SvgDiagramBlock } from "./SvgDiagramBlock";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";
import { EditorFloatingMenu, EditorFloatingMenuItem } from "./EditorFloatingMenu";

export interface MarkdownPreviewPanelProps {
  code: string;
  activeTheme: ThemeDefinition;
  isSlideAnimationActive?: boolean;
}

type AlertKind = "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";

const ALERT_STYLES: Record<
  AlertKind,
  { label: string; colorVar: string; Icon: React.FC<{ className?: string }> }
> = {
  NOTE: { label: "Note", colorVar: "var(--ayu-info)", Icon: Info },
  TIP: { label: "Tip", colorVar: "var(--ayu-success)", Icon: Lightbulb },
  IMPORTANT: {
    label: "Important",
    colorVar: "var(--ayu-accent)",
    Icon: AlertCircle,
  },
  WARNING: {
    label: "Warning",
    colorVar: "var(--ayu-warning)",
    Icon: AlertTriangle,
  },
  CAUTION: {
    label: "Caution",
    colorVar: "var(--ayu-error)",
    Icon: ShieldAlert,
  },
};

const ALERT_MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s+|$)/i;

function stripLeadingAlertMarker(node: React.ReactNode): {
  stripped: boolean;
  cleaned: React.ReactNode;
} {
  if (typeof node === "string") {
    const match = ALERT_MARKER_RE.exec(node);
    if (!match) return { stripped: false, cleaned: node };
    return { stripped: true, cleaned: node.slice(match[0].length) };
  }

  if (Array.isArray(node)) {
    let stripped = false;
    const next = node.map((item) => {
      if (stripped) return item;
      const res = stripLeadingAlertMarker(item);
      if (res.stripped) stripped = true;
      return res.cleaned;
    });
    return { stripped, cleaned: next };
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    const res = stripLeadingAlertMarker(node.props.children);
    if (!res.stripped) return { stripped: false, cleaned: node };
    return {
      stripped: true,
      cleaned: React.cloneElement(node, undefined, res.cleaned),
    };
  }

  return { stripped: false, cleaned: node };
}

const MarkdownImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({
  src = "",
  alt = "",
  className = "",
  ...rest
}) => {
  const isAssetUri = Boolean(parseAssetUri(src));
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    if (!isAssetUri) return src;
    return assetUrlManager.getCachedBlobUrl(src) ?? "";
  });

  useEffect(() => {
    if (!isAssetUri) {
      setResolvedSrc(src);
      return;
    }

    let cancelled = false;
    const cached = assetUrlManager.getCachedBlobUrl(src);
    if (cached) {
      setResolvedSrc(cached);
      return;
    }

    void assetUrlManager.resolveAssetUrl(src).then((url) => {
      if (!cancelled && url) {
        setResolvedSrc(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAssetUri, src]);

  if (!resolvedSrc) {
    return null;
  }

  return (
    <img
      {...rest}
      src={resolvedSrc}
      alt={alt}
      className={`max-w-full h-auto rounded-lg border border-[var(--ayu-line)] my-2 ${className}`}
    />
  );
};

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [
  rehypeSafeLineBreaks,
  [rehypeSanitize, markdownSanitizeSchema],
  rehypeKatex,
  [
    rehypeHighlight,
    {
      detect: false,
      plainText: ["mermaid", "mmd", "svg", "math", "text", "txt", "ascii"],
    },
  ],
] as const;

/**
 * Formats and previews Markdown snippets locally (GFM, tables, checklists, math,
 * syntax-highlighted code blocks, GitHub alerts, SVG, and all Mermaid diagrams).
 */
export const MarkdownPreviewPanel: React.FC<MarkdownPreviewPanelProps> = memo(
  ({ code, activeTheme, isSlideAnimationActive = false }) => {
    const { t } = useTranslation();
    const scrollerRef = useRef<HTMLDivElement>(null);
    const articleRef = useRef<HTMLElement>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
      anchor: { x: number; y: number };
      hasSelection: boolean;
    } | null>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const selected = window.getSelection()?.toString() || "";
      setContextMenu({
        anchor: { x: e.clientX, y: e.clientY },
        hasSelection: selected.trim().length > 0,
      });
    }, []);

    const handleCopySelection = useCallback(async () => {
      setContextMenu(null);
      const selected = window.getSelection()?.toString() || "";
      if (!selected) return;
      if (window.electronAPI?.writeRichClipboard) {
        await window.electronAPI.writeRichClipboard({ text: selected }).catch(() => {});
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selected).catch(() => {});
      }
    }, []);

    const handleSelectAllPreview = useCallback(() => {
      setContextMenu(null);
      const article = articleRef.current;
      const selection = window.getSelection();
      if (!article || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(article);
      selection.removeAllRanges();
      selection.addRange(range);
    }, []);

    useEffect(() => {
      const el = scrollerRef.current;
      if (!el) return;

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const handleScroll = () => {
        setIsScrolling(true);
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => setIsScrolling(false), 800);
      };

      el.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        el.removeEventListener("scroll", handleScroll);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }, []);

    const components = useMemo<Components>(
      () => ({
        pre({ node, children, ...rest }) {
          const { language, rawCode } = extractFencedCodeMeta(node);

          if (language === "mermaid" || language === "mmd") {
            return <MermaidDiagram chart={rawCode} activeTheme={activeTheme} />;
          }

          if (language === "svg") {
            return <SvgDiagramBlock svg={rawCode} />;
          }

          return (
            <MarkdownCodeBlock language={language} rawCode={rawCode} {...rest}>
              {children}
            </MarkdownCodeBlock>
          );
        },

        blockquote({ node, children, ...rest }) {
          const firstChild = node?.children?.find((c) => c.type === "element");
          const firstParagraphText = extractHastText(firstChild).trimStart();
          const match = ALERT_MARKER_RE.exec(firstParagraphText);

          if (match) {
            const kind = match[1].toUpperCase() as AlertKind;
            const cfg = ALERT_STYLES[kind];
            const Icon = cfg.Icon;
            const { cleaned } = stripLeadingAlertMarker(children);

            return (
              <div
                style={{
                  borderLeftColor: cfg.colorVar,
                  backgroundColor: `color-mix(in srgb, ${cfg.colorVar} 10%, transparent)`,
                }}
                className="my-4 rounded-r-lg border-l-[3px] px-4 py-3 text-[var(--ayu-editor-fg)]"
              >
                <div
                  style={{ color: cfg.colorVar }}
                  className="flex items-center gap-1.5 text-xs font-semibold tracking-wide mb-1"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{cfg.label}</span>
                </div>
                <div className="codestash-md-alert-body">{cleaned}</div>
              </div>
            );
          }

          return <blockquote {...rest}>{children}</blockquote>;
        },

        a({ node: _node, href, children, onClick, ...rest }) {
          return (
            <a
              {...rest}
              href={href}
              onClick={(e) => {
                onClick?.(e);
                if (!href) return;
                e.preventDefault();
                if (href.startsWith("#")) {
                  const targetId = href.slice(1);
                  const escapedId =
                    typeof CSS !== "undefined" && typeof CSS.escape === "function"
                      ? CSS.escape(targetId)
                      : targetId.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
                  const container = scrollerRef.current;
                  const targetEl =
                    container?.querySelector<HTMLElement>(`#${escapedId}`) ||
                    container?.querySelector<HTMLElement>(
                      `#user-content-${escapedId}`
                    );
                  targetEl?.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }
                void openExternalUrl(href);
              }}
            >
              {children}
            </a>
          );
        },

        img({ node: _node, ...props }) {
          return <MarkdownImage {...props} />;
        },

        table({ node: _node, children, ...rest }) {
          return (
            <div className="my-4 w-full overflow-x-auto rounded-lg border border-[var(--ayu-border)]">
              <table {...rest}>{children}</table>
            </div>
          );
        },

        input({ node: _node, type, checked, ...rest }) {
          if (type === "checkbox") {
            return (
              <input
                {...rest}
                type="checkbox"
                checked={Boolean(checked)}
                readOnly
                disabled
              />
            );
          }
          return <input type={type} checked={checked} {...rest} />;
        },
      }),
      [activeTheme]
    );

    return (
      <div
        data-testid="markdown-preview-panel"
        onContextMenu={handleContextMenu}
        className={`flex-1 min-h-0 min-w-0 w-full flex flex-col relative overflow-hidden bg-[var(--editor-panel-bg)] select-text ${
          isSlideAnimationActive ? "animate-editor-slide-left" : ""
        }`}
      >
        <div
          ref={scrollerRef}
          className={`rich-editor-scroller min-w-0 w-full ${
            isScrolling ? "cm-is-scrolling" : ""
          }`}
        >
          <article ref={articleRef} className="codestash-markdown-preview">
            <Markdown
              remarkPlugins={REMARK_PLUGINS as unknown as React.ComponentProps<typeof Markdown>["remarkPlugins"]}
              rehypePlugins={REHYPE_PLUGINS as unknown as React.ComponentProps<typeof Markdown>["rehypePlugins"]}
              urlTransform={safeMarkdownUrlTransform}
              components={components}
            >
              {code}
            </Markdown>
          </article>
        </div>

        {contextMenu && (
          <EditorFloatingMenu
            testId="markdown-preview-context-menu"
            anchor={contextMenu.anchor}
            onClose={() => setContextMenu(null)}
          >
            {contextMenu.hasSelection && (
              <EditorFloatingMenuItem
                testId="preview-context-copy-btn"
                icon={<Copy size={13} />}
                label={t.editor.richText.contextCopy}
                onClick={() => void handleCopySelection()}
              />
            )}
            <EditorFloatingMenuItem
              testId="preview-context-select-all-btn"
              icon={<CheckSquare size={13} />}
              label={t.editor.richText.contextSelectAll}
              onClick={handleSelectAllPreview}
            />
          </EditorFloatingMenu>
        )}
      </div>
    );
  }
);

MarkdownPreviewPanel.displayName = "MarkdownPreviewPanel";
