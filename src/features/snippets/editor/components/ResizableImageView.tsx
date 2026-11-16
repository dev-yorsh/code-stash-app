import React, { useCallback, useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Copy,
  CopyPlus,
  ImageOff,
  Trash2,
} from "lucide-react";
import { useTranslation } from "@/shared/i18n";
import { assetUrlManager } from "@/shared/api/assets/assetUrlManager";
import { CODESTASH_ASSET_SCHEME } from "@/shared/api/assets/assetReferences";
import { copyImageToClipboard, duplicateImageNodeAt } from "../utils/richTextImageInsert";

type ImageAlign = "left" | "center" | "right";

const WIDTH_PRESETS: Array<{ label: string; value: string | null }> = [
  { label: "25%", value: "25%" },
  { label: "50%", value: "50%" },
  { label: "75%", value: "75%" },
  { label: "100%", value: "100%" },
];

export const ResizableImageView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
  getPos,
}) => {
  const { t } = useTranslation();
  const rt = t.editor.richText;

  const src = String(node.attrs.src ?? "");
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const title = typeof node.attrs.title === "string" ? node.attrs.title : undefined;
  const widthAttr = typeof node.attrs.width === "string" ? node.attrs.width : null;
  const alignAttr: ImageAlign =
    node.attrs.align === "center" || node.attrs.align === "right"
      ? node.attrs.align
      : "left";

  const isAssetUri = src.startsWith(CODESTASH_ASSET_SCHEME);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => {
    if (!isAssetUri) return src || null;
    return assetUrlManager.getCachedBlobUrl(src);
  });
  const [isLoading, setIsLoading] = useState<boolean>(
    () => isAssetUri && !assetUrlManager.getCachedBlobUrl(src)
  );
  const [hasError, setHasError] = useState<boolean>(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const [liveWidthPx, setLiveWidthPx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUserActivated, setIsUserActivated] = useState<boolean>(false);
  const [imageCopied, setImageCopied] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHasError(false);

    if (!src) {
      setResolvedSrc(null);
      setIsLoading(false);
      setHasError(true);
      return () => {
        cancelled = true;
      };
    }

    if (!isAssetUri) {
      setResolvedSrc(src);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const cached = assetUrlManager.getCachedBlobUrl(src);
    if (cached) {
      setResolvedSrc(cached);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    void assetUrlManager.resolveAssetUrl(src).then((url) => {
      if (cancelled) return;
      if (url) {
        setResolvedSrc(url);
        setHasError(false);
      } else {
        setResolvedSrc(null);
        setHasError(true);
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [src, isAssetUri]);

  const isImageActive = (selected && isUserActivated) || isDragging;

  useEffect(() => {
    if (!selected && !isDragging) {
      setIsUserActivated(false);
    }
  }, [selected, isDragging]);

  const selectThisImageNode = () => {
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (typeof pos === "number" && editor.isEditable) {
      setIsUserActivated(true);
      if (!editor.isFocused) {
        editor.view?.focus?.();
      }
      editor.commands.setNodeSelection(pos);
    }
  };

  const clearThisImageSelection = useCallback(
    (shouldFocus = false) => {
      setIsUserActivated(false);
      if (typeof getPos !== "function") return;
      const pos = getPos();
      if (typeof pos === "number") {
        try {
          const nextPos = Math.min(pos + node.nodeSize, editor.state.doc.content.size);
          const sel = TextSelection.near(editor.state.doc.resolve(nextPos));
          editor.view.dispatch(editor.state.tr.setSelection(sel));
          if (shouldFocus) {
            editor.view?.focus?.();
          }
        } catch {
          // Ignore stale node positions during concurrent updates
        }
      }
    },
    [editor, getPos, node.nodeSize]
  );

  useEffect(() => {
    if (!isImageActive || isDragging) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return;
      }
      if (
        target instanceof Node &&
        target !== wrapperRef.current &&
        editor.view?.dom?.contains(target)
      ) {
        return;
      }
      clearThisImageSelection(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        clearThisImageSelection(true);
      }
    };

    window.addEventListener("pointerdown", handleOutsidePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handleOutsidePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isImageActive, isDragging, editor, clearThisImageSelection]);

  const handleResizePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    direction: "left" | "right"
  ) => {
    if (!editor.isEditable || !isImageActive) return;
    e.preventDefault();
    e.stopPropagation();

    const containerEl = containerRef.current;
    const wrapperEl = wrapperRef.current;
    if (!containerEl || !wrapperEl) return;

    const startX = e.clientX;
    const startRect = containerEl.getBoundingClientRect();
    const wrapperRect = wrapperEl.getBoundingClientRect();
    const maxWidth = Math.max(120, wrapperRect.width || startRect.width || 600);
    const startWidth = Math.max(80, startRect.width);
    const multiplier = alignAttr === "center" ? 2 : 1;

    setIsDragging(true);
    setLiveWidthPx(startWidth);

    let latestWidth = startWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const signedDelta = direction === "left" ? -dx : dx;
      const nextWidth = Math.max(
        80,
        Math.min(maxWidth, Math.round(startWidth + signedDelta * multiplier))
      );
      latestWidth = nextWidth;
      setLiveWidthPx(nextWidth);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      const percent = Math.max(
        15,
        Math.min(100, Math.round((latestWidth / maxWidth) * 100))
      );
      setIsDragging(false);
      setLiveWidthPx(null);
      updateAttributes({ width: `${percent}%` });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  const justifyClass =
    alignAttr === "center"
      ? "justify-center"
      : alignAttr === "right"
        ? "justify-end"
        : "justify-start";

  const activeWidthStyle: React.CSSProperties =
    liveWidthPx !== null
      ? { width: `${liveWidthPx}px`, maxWidth: "100%" }
      : widthAttr
        ? { width: widthAttr, maxWidth: "100%" }
        : { maxWidth: "100%" };

  const currentPercentLabel =
    liveWidthPx !== null && wrapperRef.current?.clientWidth
      ? `${Math.max(
          15,
          Math.min(100, Math.round((liveWidthPx / wrapperRef.current.clientWidth) * 100))
        )}%`
      : widthAttr || rt.imageOriginalSize;

  return (
    <NodeViewWrapper
      as="div"
      ref={wrapperRef}
      data-selected={isImageActive ? "true" : "false"}
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === wrapperRef.current && e.button === 0) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === wrapperRef.current) {
          e.stopPropagation();
          clearThisImageSelection(true);
        }
      }}
      className={`codestash-image-node my-2.5 flex w-full ${justifyClass}`}
      data-testid="resizable-image-node"
      data-align={alignAttr}
    >
      <div
        ref={containerRef}
        data-testid="resizable-image-container"
        style={activeWidthStyle}
        onClick={(e) => {
          e.stopPropagation();
          selectThisImageNode();
        }}
        className={`relative inline-block max-w-full rounded-lg transition-[box-shadow] ${
          isImageActive
            ? "ring-2 ring-[var(--ayu-accent)] shadow-md"
            : editor.isEditable
              ? "cursor-pointer"
              : ""
        }`}
      >
        {/* Floating action bar enabled only after clicking the image */}
        {editor.isEditable && isImageActive && (
          <div
            contentEditable={false}
            data-testid="resizable-image-toolbar"
            className="codestash-image-toolbar absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 rounded-lg border border-[var(--ayu-border)] bg-[var(--ayu-popup)]/95 backdrop-blur-sm px-1.5 py-1 shadow-xl"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            {WIDTH_PRESETS.map((preset) => {
              const isActive = widthAttr === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => updateAttributes({ width: preset.value })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    isActive
                      ? "bg-[var(--ayu-accent)]/20 text-[var(--ayu-accent)] font-semibold"
                      : "text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)]"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => updateAttributes({ width: null })}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                widthAttr === null
                  ? "bg-[var(--ayu-accent)]/20 text-[var(--ayu-accent)] font-semibold"
                  : "text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)]"
              }`}
            >
              {rt.imageOriginalSize}
            </button>

            <div className="w-px h-3.5 bg-[var(--ayu-line)] mx-1" />

            <button
              type="button"
              onClick={() => updateAttributes({ align: "left" })}
              title={rt.imageAlignLeft}
              aria-label={rt.imageAlignLeft}
              className={`p-1 rounded transition-colors cursor-pointer ${
                alignAttr === "left"
                  ? "bg-[var(--ayu-accent)]/20 text-[var(--ayu-accent)]"
                  : "text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)]"
              }`}
            >
              <AlignLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: "center" })}
              title={rt.imageAlignCenter}
              aria-label={rt.imageAlignCenter}
              className={`p-1 rounded transition-colors cursor-pointer ${
                alignAttr === "center"
                  ? "bg-[var(--ayu-accent)]/20 text-[var(--ayu-accent)]"
                  : "text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)]"
              }`}
            >
              <AlignCenter className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: "right" })}
              title={rt.imageAlignRight}
              aria-label={rt.imageAlignRight}
              className={`p-1 rounded transition-colors cursor-pointer ${
                alignAttr === "right"
                  ? "bg-[var(--ayu-accent)]/20 text-[var(--ayu-accent)]"
                  : "text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)]"
              }`}
            >
              <AlignRight className="w-3 h-3" />
            </button>

            <div className="w-px h-3.5 bg-[var(--ayu-line)] mx-1" />

            <button
              type="button"
              data-testid="image-copy-btn"
              disabled={isLoading || hasError || !resolvedSrc}
              onClick={() => {
                void copyImageToClipboard(src, resolvedSrc).then((ok) => {
                  if (!ok) return;
                  setImageCopied(true);
                  if (copyFeedbackTimerRef.current !== null) {
                    window.clearTimeout(copyFeedbackTimerRef.current);
                  }
                  copyFeedbackTimerRef.current = window.setTimeout(() => {
                    setImageCopied(false);
                    copyFeedbackTimerRef.current = null;
                  }, 1500);
                });
              }}
              title={imageCopied ? rt.imageCopiedTooltip : rt.imageCopyTooltip}
              aria-label={imageCopied ? rt.imageCopiedTooltip : rt.imageCopyTooltip}
              className={`p-1 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                imageCopied
                  ? "bg-[var(--ayu-accent)]/20 text-[var(--ayu-accent)]"
                  : "text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)]"
              }`}
            >
              {imageCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
            <button
              type="button"
              data-testid="image-duplicate-btn"
              onClick={() => {
                if (typeof getPos !== "function") return;
                const pos = getPos();
                if (typeof pos === "number") {
                  duplicateImageNodeAt(editor, pos);
                }
              }}
              title={rt.imageDuplicateTooltip}
              aria-label={rt.imageDuplicateTooltip}
              className="p-1 rounded text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] transition-colors cursor-pointer"
            >
              <CopyPlus className="w-3 h-3" />
            </button>

            <div className="w-px h-3.5 bg-[var(--ayu-line)] mx-1" />

            <button
              type="button"
              onClick={() => deleteNode()}
              title={rt.imageDeleteTooltip}
              aria-label={rt.imageDeleteTooltip}
              className="p-1 rounded text-[var(--ayu-fg)] hover:text-[var(--ayu-error)] hover:bg-[var(--ayu-error)]/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Image Content */}
        {isLoading ? (
          <div className="flex items-center justify-center min-w-[160px] min-h-[100px] rounded-lg border border-dashed border-[var(--ayu-border)] bg-[var(--ayu-sunk)]/70 px-4 py-6 text-xs text-[var(--ayu-fg-subtle)] animate-pulse">
            {rt.imageLoading}
          </div>
        ) : hasError || !resolvedSrc ? (
          <div className="flex flex-col items-center justify-center gap-1.5 min-w-[180px] rounded-lg border border-dashed border-[var(--ayu-error)]/40 bg-[var(--ayu-sunk)] px-4 py-5 text-xs text-[var(--ayu-fg-subtle)]">
            <ImageOff className="w-5 h-5 text-[var(--ayu-error)]/80" />
            <span>{rt.imageMissing}</span>
            {alt && <span className="text-[10px] font-mono opacity-70">{alt}</span>}
          </div>
        ) : (
          <img
            src={resolvedSrc}
            alt={alt}
            title={title}
            draggable={false}
            onError={() => setHasError(true)}
            className={`block rounded-lg h-auto object-contain select-none ${
              widthAttr || liveWidthPx !== null ? "w-full" : "max-w-full w-auto"
            }`}
          />
        )}

        {/* Live drag dimension badge */}
        {isDragging && (
          <div className="absolute bottom-2 right-2 z-20 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono text-white pointer-events-none">
            {currentPercentLabel}
          </div>
        )}

        {/* Drag Resize Handles enabled ONLY after clicking the image */}
        {editor.isEditable && isImageActive && !hasError && (
          <>
            {(
              [
                {
                  id: "left",
                  direction: "left" as const,
                  testId: "image-resize-handle-left",
                  className:
                    "left-1.5 top-1/2 -translate-y-1/2 h-10 w-1.5 rounded-full bg-[var(--ayu-accent)]/85 border border-white/80 cursor-ew-resize",
                },
                {
                  id: "right",
                  direction: "right" as const,
                  testId: "image-resize-handle-right",
                  className:
                    "right-1.5 top-1/2 -translate-y-1/2 h-10 w-1.5 rounded-full bg-[var(--ayu-accent)]/85 border border-white/80 cursor-ew-resize",
                },
                {
                  id: "corner",
                  direction: "right" as const,
                  testId: "image-resize-handle-corner",
                  className:
                    "right-1 bottom-1 h-3 w-3 rounded-sm bg-[var(--ayu-accent)] border border-white/90 cursor-nwse-resize",
                },
              ] as const
            ).map((handle) => (
              <button
                key={handle.id}
                type="button"
                contentEditable={false}
                data-testid={handle.testId}
                aria-label={rt.imageDragToResizeTooltip}
                title={rt.imageDragToResizeTooltip}
                onPointerDown={(e) => handleResizePointerDown(e, handle.direction)}
                onClick={(e) => e.stopPropagation()}
                className={`absolute ${handle.className} shadow`}
              />
            ))}
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
};
