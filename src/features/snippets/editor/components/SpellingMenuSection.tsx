import React from "react";
import { EyeOff, SpellCheck, SpellCheck2 } from "lucide-react";
import { useTranslation } from "../../../../shared/i18n";

export interface SpellingMenuSectionProps {
  misspelledWord: string | null;
  spellcheckEnabled: boolean;
  onIgnoreWord: (word: string) => void;
  onToggleSpellcheck: (nextEnabled: boolean) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

/**
 * Shared "Ortografía" / "Spelling" category block used by both the pointer quick-fix
 * popover and the full Plain Text right-click context menu.
 * Word suggestions are disabled; exposes only Ignore and Disable/Enable spell check.
 */
export const SpellingMenuSection: React.FC<SpellingMenuSectionProps> = ({
  misspelledWord,
  spellcheckEnabled,
  onIgnoreWord,
  onToggleSpellcheck,
  onMouseDown,
}) => {
  const { t } = useTranslation();

  return (
    <div data-testid="spelling-category-section" className="py-0.5">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
        <span className="inline-flex items-center gap-1.5">
          <SpellCheck size={11.5} className="text-[var(--ayu-accent)]" />
          <span>{t.editor.richText.contextSpellingCategory}</span>
        </span>
        {spellcheckEnabled && misspelledWord && (
          <span
            data-testid="spelling-target-word"
            className="max-w-[110px] truncate rounded px-1.5 py-0.5 text-[10px] font-mono lowercase tracking-normal bg-[var(--ayu-error)]/12 text-[var(--ayu-error)]"
          >
            {misspelledWord}
          </span>
        )}
      </div>

      {spellcheckEnabled && misspelledWord && (
        <div className="space-y-0.5 mt-0.5">
          <button
            type="button"
            data-testid="spell-ignore-btn"
            onMouseDown={onMouseDown}
            onClick={() => onIgnoreWord(misspelledWord)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[12px] text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)] transition-colors cursor-pointer"
          >
            <EyeOff size={13} className="text-[var(--ayu-fg)] shrink-0" />
            <span>{t.editor.richText.contextIgnoreWord}</span>
          </button>

          <div className="my-1 border-t border-[var(--ayu-border)]/70" />
        </div>
      )}

      {!spellcheckEnabled && (
        <div className="px-2.5 py-1 text-[11px] text-[var(--ayu-fg-subtle)]">
          {t.editor.richText.contextSpellcheckDisabledNote}
        </div>
      )}

      <button
        type="button"
        data-testid="spell-toggle-btn"
        onMouseDown={onMouseDown}
        onClick={() => onToggleSpellcheck(!spellcheckEnabled)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[12px] text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)] transition-colors cursor-pointer"
      >
        <SpellCheck2
          size={13}
          className={spellcheckEnabled ? "text-[var(--ayu-fg)] shrink-0" : "text-[var(--ayu-accent)] shrink-0"}
        />
        <span>
          {spellcheckEnabled
            ? t.editor.richText.contextDisableSpellcheck
            : t.editor.richText.contextEnableSpellcheck}
        </span>
      </button>
    </div>
  );
};
