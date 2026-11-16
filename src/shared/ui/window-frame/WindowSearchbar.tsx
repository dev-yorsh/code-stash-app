import React, { useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "@/shared/i18n";

export interface WindowSearchbarProps {
  value: string;
  onChange: (value: string) => void;
  onClick?: () => void;
  placeholder?: string;
  shortcutBadge?: string;
  className?: string;
}

export const WindowSearchbar: React.FC<WindowSearchbarProps> = ({
  value,
  onChange,
  onClick,
  placeholder,
  shortcutBadge = "Ctrl K",
  className = "",
}) => {
  const { t } = useTranslation();
  const effectivePlaceholder = placeholder ?? t.titlebar.searchPlaceholder;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Ctrl+K / Cmd+K anywhere, or Ctrl+F / Cmd+F outside CodeMirror editor
      if (isCmdOrCtrl && !e.shiftKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const isInsideCodeEditor = Boolean(target?.closest(".cm-content"));
        if (key === "k" || (key === "f" && !isInsideCodeEditor)) {
          e.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  return (
    <div
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      className={`flex-1 max-w-[340px] md:max-w-[420px] mx-4 ${className}`}
    >
      <div
        onClick={() => {
          onClick?.();
          inputRef.current?.focus();
        }}
        className="h-7 flex items-center space-x-2 bg-[var(--searchbar-bg)] hover:bg-[var(--searchbar-hover-bg)] focus-within:bg-[var(--searchbar-focus-bg)] border border-[var(--searchbar-border)] focus-within:border-[var(--searchbar-focus-border)] rounded-md px-3 text-xs text-[var(--searchbar-fg)] transition-all cursor-pointer"
      >
        <Search className="w-3.5 h-3.5 text-[var(--searchbar-fg)] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder={effectivePlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              if (value) {
                onChange("");
              } else {
                inputRef.current?.blur();
              }
            } else if (e.key === "ArrowDown" || e.key === "Enter") {
              e.preventDefault();
              inputRef.current?.blur();
            }
          }}
          className="bg-transparent border-none outline-none flex-1 text-xs text-[var(--searchbar-text)] placeholder-[var(--searchbar-fg)] cursor-text leading-none"
        />
        {shortcutBadge && (
          <kbd className="hidden sm:inline-block text-[10px] bg-[var(--searchbar-kbd-bg)] text-[var(--searchbar-kbd-fg)] px-1.5 py-0.5 rounded font-mono border border-[var(--searchbar-kbd-border)] shrink-0">
            {shortcutBadge}
          </kbd>
        )}
      </div>
    </div>
  );
};
