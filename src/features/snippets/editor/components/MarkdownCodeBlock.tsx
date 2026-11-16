import React from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "@/shared/i18n";
import { useTransientCopy } from "../hooks/useTransientCopy";

export interface MarkdownCodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  language?: string;
  rawCode: string;
  children: React.ReactNode;
}

/**
 * Renders fenced non-diagram code blocks inside Markdown Preview with a subtle
 * language header badge and one-click copy action.
 */
export const MarkdownCodeBlock: React.FC<MarkdownCodeBlockProps> = ({
  language,
  rawCode,
  children,
  className = "",
  ...rest
}) => {
  const { t } = useTranslation();
  const { copiedKey, copyText } = useTransientCopy();
  const displayLang = language || "text";

  return (
    <div className="my-4 rounded-xl border border-[var(--ayu-border)] bg-[var(--ayu-sunk)] overflow-hidden">
      <div className="h-7 px-3 border-b border-[var(--ayu-line)] bg-[var(--ayu-panel)]/65 flex items-center justify-between text-[11px] select-none">
        <span className="font-mono text-[var(--ayu-fg-subtle)]">{displayLang}</span>
        <button
          type="button"
          onClick={() => void copyText(rawCode)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] transition-colors cursor-pointer"
          title={t.editor.markdown.copyCodeBlock}
        >
          {copiedKey ? (
            <>
              <Check className="w-3 h-3 text-[var(--ayu-success)]" />
              <span className="text-[var(--ayu-success)]">
                {t.editor.markdown.copiedBlock}
              </span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>{t.editor.markdown.copyCodeBlock}</span>
            </>
          )}
        </button>
      </div>
      <pre
        {...rest}
        className={`p-3.5 overflow-x-auto text-[13px] font-mono leading-relaxed m-0 bg-transparent border-0 ${className}`}
      >
        {children}
      </pre>
    </div>
  );
};
