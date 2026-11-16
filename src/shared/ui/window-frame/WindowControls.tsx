import React from "react";
import { Minus, Square, X } from "lucide-react";
import { useTranslation } from "@/shared/i18n";

export interface WindowControlsProps {
  isMaximized: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  className?: string;
}

export const WindowControls: React.FC<WindowControlsProps> = ({
  isMaximized,
  onMinimize,
  onToggleMaximize,
  onClose,
  className = "",
}) => {
  const { t } = useTranslation();

  return (
    <div
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      className={`flex items-center space-x-1 ${className}`}
    >
      <button
        type="button"
        onClick={onMinimize}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[color-mix(in_srgb,var(--ayu-editor-fg)_15%,transparent)] transition-colors cursor-pointer"
        title={t.titlebar.minimize}
        aria-label={t.titlebar.minimizeAria}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onToggleMaximize}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[color-mix(in_srgb,var(--ayu-editor-fg)_15%,transparent)] transition-colors cursor-pointer"
        title={isMaximized ? t.titlebar.restore : t.titlebar.maximize}
        aria-label={t.titlebar.maximizeAria}
      >
        <Square className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--ayu-fg)] hover:text-white hover:bg-[#e81123] transition-colors cursor-pointer"
        title={t.titlebar.close}
        aria-label={t.titlebar.closeAria}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
