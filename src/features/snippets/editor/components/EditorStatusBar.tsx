import React, { useState, useRef, useEffect, useMemo } from "react";
import { SUPPORTED_LANGUAGES } from "@/core/theme/tokens";
import { useTranslation } from "@/shared/i18n";

export interface EditorStatusBarProps {
  language: string;
  isManualLanguage: boolean;
  lineCount: number;
  charCount: number;
  onSelectLanguage: (langId: string) => void;
  onResetAutoDetect: () => void;
}

export const EditorStatusBar: React.FC<EditorStatusBarProps> = ({
  language,
  isManualLanguage,
  lineCount,
  charCount,
  onSelectLanguage,
  onResetAutoDetect,
}) => {
  const { t } = useTranslation();
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close language menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filteredLanguages = useMemo(() => {
    if (!langSearch.trim()) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
        l.id.toLowerCase().includes(langSearch.toLowerCase())
    );
  }, [langSearch]);

  const showAutoDetectOption = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    return (
      !q ||
      "auto-detect".includes(q) ||
      "autodetectar".includes(q) ||
      "automatico".includes(q)
    );
  }, [langSearch]);

  const activeLangObj = SUPPORTED_LANGUAGES.find((l) => l.id === language);
  const currentLangLabel = activeLangObj ? activeLangObj.name : language;

  return (
    <div className="relative h-7 pl-0 pr-3 bg-[var(--statusbar-bg)] border-t border-[var(--statusbar-border)] flex items-center justify-between z-30 shrink-0 text-[var(--statusbar-fg)] select-none font-sans">
      {/* Left side: Language Selector (flush with left edge) */}
      <div ref={langMenuRef} className="relative h-full flex items-center">
        {/* Popover opened above the button: only input + list */}
        {isLangMenuOpen && (
          <div
            className="absolute bottom-full mb-1 left-1 w-52 bg-[var(--menu-bg)] border border-[var(--ayu-border)] rounded-lg shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Search Input */}
            <input
              type="text"
              placeholder={t.editor.searchLanguagePlaceholder}
              value={langSearch}
              onChange={(e) => setLangSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[var(--ayu-sunk)] border border-[var(--ayu-line)] focus:border-[var(--ayu-accent)] px-2.5 py-1 text-[12px] font-sans text-[var(--ayu-editor-fg)] placeholder-[var(--ayu-fg-subtle)] outline-none mb-1.5 rounded transition-colors"
              autoFocus
            />

            {/* Languages List (Auto-detect at the start of the list, right below the input) */}
            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {showAutoDetectOption && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetAutoDetect();
                    setIsLangMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[13px] font-sans transition-colors cursor-pointer text-left ${
                    !isManualLanguage
                      ? "bg-[var(--folder-active-bg)] text-[var(--folder-active-fg)] font-medium shadow-xs"
                      : "text-[var(--ayu-fg)] hover:bg-[var(--menu-hover-bg)] hover:text-[var(--ayu-editor-fg)]"
                  }`}
                >
                  <span className="truncate">{t.editor.autoDetect}</span>
                </button>
              )}

              {filteredLanguages.map((l) => {
                const isCurrentLang = language.toLowerCase() === l.id.toLowerCase();
                const isExplicitSelected = isManualLanguage && isCurrentLang;
                const isAutoDetectedCurrent = !isManualLanguage && isCurrentLang;

                return (
                  <button
                    type="button"
                    key={l.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectLanguage(l.id);
                      setIsLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[13px] font-sans transition-colors cursor-pointer ${
                      isExplicitSelected
                        ? "bg-[var(--folder-active-bg)] text-[var(--folder-active-fg)] font-medium shadow-xs"
                        : isAutoDetectedCurrent
                          ? "bg-[var(--folder-active-bg)]/20 text-[var(--ayu-editor-fg)] font-medium"
                          : "text-[var(--ayu-fg)] hover:bg-[var(--menu-hover-bg)] hover:text-[var(--ayu-editor-fg)]"
                    }`}
                  >
                    <span>{l.name}</span>
                    <span
                      className={`text-[11px] ${
                        isExplicitSelected
                          ? "text-white/85"
                          : isAutoDetectedCurrent
                            ? "text-[var(--ayu-editor-fg)]/80"
                            : "text-[var(--ayu-fg-subtle)]"
                      }`}
                    >
                      {l.ext}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Minimalist Language Trigger Button (flush left, full footer height, folder typography, no icons) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsLangMenuOpen((prev) => !prev);
          }}
          className="h-full px-3 flex items-center gap-1.5 text-[13px] font-sans text-[var(--statusbar-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)] transition-colors cursor-pointer"
          title={t.editor.languageSelectorTooltip}
        >
          <span>{currentLangLabel}</span>
          {!isManualLanguage && <span className="text-[10px] opacity-60">(auto)</span>}
        </button>
      </div>

      {/* Right side: Line and Char Count Metrics */}
      <div className="text-[11px] font-mono text-[var(--statusbar-fg)] flex items-center space-x-3 select-none">
        <span>{t.editor.linesCount(lineCount)}</span>
        <span>{t.editor.charsCount(charCount)}</span>
      </div>
    </div>
  );
};
