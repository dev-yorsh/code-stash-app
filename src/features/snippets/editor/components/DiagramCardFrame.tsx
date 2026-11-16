import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  Eye,
  Loader2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslation } from "@/shared/i18n";
import { useTransientCopy } from "../hooks/useTransientCopy";

export interface DiagramCardFrameProps {
  label: string;
  sourceCode: string;
  svgMarkup: string | null;
  errorMessage: string | null;
  isLoading?: boolean;
  svgContainerRef?: React.Ref<HTMLDivElement>;
  testId?: string;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

/**
 * Shared frame for rendered diagrams (Mermaid, inline SVG) offering zoom,
 * source inspection, error fallback, and one-click source/SVG copy.
 */
export const DiagramCardFrame: React.FC<DiagramCardFrameProps> = ({
  label,
  sourceCode,
  svgMarkup,
  errorMessage,
  isLoading = false,
  svgContainerRef,
  testId,
}) => {
  const { t } = useTranslation();
  const [showSource, setShowSource] = useState(false);
  const [zoom, setZoom] = useState(1);
  const { copiedKey, copyText } = useTransientCopy();

  const htmlPayload = useMemo(
    () => (svgMarkup ? { __html: svgMarkup } : undefined),
    [svgMarkup]
  );

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(MIN_ZOOM, Number((prev - ZOOM_STEP).toFixed(2))));
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(MAX_ZOOM, Number((prev + ZOOM_STEP).toFixed(2))));
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  return (
    <div
      data-testid={testId}
      className="my-4 rounded-xl border border-[var(--ayu-border)] bg-[var(--ayu-sunk)]/75 overflow-hidden shadow-xs"
    >
      {/* Card Header */}
      <div className="h-8 px-3 border-b border-[var(--ayu-line)] bg-[var(--ayu-panel)]/65 flex items-center justify-between gap-2 text-[11px] select-none">
        <span className="font-mono font-medium text-[var(--ayu-accent)] truncate">
          {label}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {!showSource && !errorMessage && svgMarkup && (
            <div className="flex items-center border-r border-[var(--ayu-line)] pr-1.5 mr-0.5 gap-0.5">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
                title={t.editor.markdown.diagramZoomOut}
                aria-label={t.editor.markdown.diagramZoomOut}
                className="w-6 h-6 flex items-center justify-center rounded text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] disabled:opacity-35 transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                title={t.editor.markdown.diagramZoomReset}
                className="px-1.5 h-6 rounded font-mono text-[10px] text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] transition-colors cursor-pointer"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
                title={t.editor.markdown.diagramZoomIn}
                aria-label={t.editor.markdown.diagramZoomIn}
                className="w-6 h-6 flex items-center justify-center rounded text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] disabled:opacity-35 transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {svgMarkup && !errorMessage && (
            <button
              type="button"
              onClick={() => void copyText(svgMarkup, "svg")}
              title={t.editor.markdown.copySvg}
              className="px-1.5 h-6 inline-flex items-center gap-1 rounded text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] transition-colors cursor-pointer"
            >
              {copiedKey === "svg" ? (
                <Check className="w-3 h-3 text-[var(--ayu-success)]" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>SVG</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSource((prev) => !prev)}
            title={
              showSource
                ? t.editor.markdown.diagramVisualToggle
                : t.editor.markdown.diagramSourceToggle
            }
            className="px-1.5 h-6 inline-flex items-center gap-1 rounded text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] transition-colors cursor-pointer"
          >
            {showSource ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
            <span>
              {showSource
                ? t.editor.markdown.diagramVisualToggle
                : t.editor.markdown.diagramSourceToggle}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void copyText(sourceCode, "source")}
            title={t.editor.markdown.copyCodeBlock}
            className="px-1.5 h-6 inline-flex items-center gap-1 rounded text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] transition-colors cursor-pointer"
          >
            {copiedKey === "source" ? (
              <Check className="w-3 h-3 text-[var(--ayu-success)]" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Card Body */}
      {showSource ? (
        <pre className="p-3.5 text-xs font-mono text-[var(--ayu-editor-fg)] overflow-x-auto leading-relaxed m-0 bg-transparent border-0">
          <code>{sourceCode}</code>
        </pre>
      ) : errorMessage ? (
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-start gap-2 rounded-lg border border-[var(--ayu-error)]/40 bg-[var(--ayu-error)]/10 px-3 py-2 text-xs text-[var(--ayu-error)]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-medium">{t.editor.markdown.diagramRenderError}</div>
              <div className="font-mono text-[11px] opacity-85 break-words mt-0.5">
                {errorMessage}
              </div>
            </div>
          </div>
          <pre className="p-3 rounded-lg bg-[var(--ayu-base)] border border-[var(--ayu-line)] text-xs font-mono text-[var(--ayu-editor-fg)] overflow-x-auto leading-relaxed m-0">
            <code>{sourceCode}</code>
          </pre>
        </div>
      ) : isLoading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--ayu-fg-subtle)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t.editor.markdown.diagramRendering}</span>
        </div>
      ) : (
        <div className="p-4 overflow-x-auto">
          <div
            ref={svgContainerRef}
            data-zoom={String(zoom)}
            style={zoom !== 1 ? { zoom } : undefined}
            className="codestash-diagram-svg w-full mx-auto"
            dangerouslySetInnerHTML={htmlPayload}
          />
        </div>
      )}
    </div>
  );
};
