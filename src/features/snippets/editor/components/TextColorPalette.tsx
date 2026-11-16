import React from "react";
import { DropletOff, Palette } from "lucide-react";
import { useTranslation } from "../../../../shared/i18n";
import { TEXT_COLOR_SWATCHES } from "../extensions/richTextExtensions";

export interface TextColorPaletteProps {
  activeColor: string | null;
  fallbackPickerColor: string;
  onSelectColor: (color: string, closeMenu?: boolean) => void;
  onResetDefault: () => void;
  resetButtonTestId?: string;
  customInputTestId?: string;
  showNoColorLabel?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}

/**
 * Reusable text color picker strip featuring the theme-adaptive "Sin color" (Default)
 * icon option first, preset swatches, and a custom hex color picker.
 */
export const TextColorPalette: React.FC<TextColorPaletteProps> = ({
  activeColor,
  fallbackPickerColor,
  onSelectColor,
  onResetDefault,
  resetButtonTestId = "text-color-reset-btn",
  customInputTestId = "text-color-custom-input",
  showNoColorLabel = false,
  onMouseDown,
}) => {
  const { t } = useTranslation();
  const isDefaultActive = !activeColor;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        data-testid={resetButtonTestId}
        title={t.editor.richText.textColorDefault}
        aria-label={t.editor.richText.textColorDefault}
        aria-pressed={isDefaultActive}
        onMouseDown={onMouseDown}
        onClick={onResetDefault}
        className={`inline-flex items-center justify-center gap-1 px-1.5 h-6 rounded-lg transition-colors cursor-pointer ${
          isDefaultActive
            ? "bg-[var(--toolbar-active-bg)] text-[var(--toolbar-active-fg)] border border-[var(--toolbar-active-border)]"
            : "border border-transparent text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-panel)]"
        }`}
      >
        <DropletOff size={13.5} />
        {showNoColorLabel && (
          <span className="text-[11px] font-medium whitespace-nowrap">
            {t.editor.richText.noColorLabel}
          </span>
        )}
      </button>

      <span className="h-4 w-px bg-[var(--ayu-border)] shrink-0" aria-hidden="true" />

      {TEXT_COLOR_SWATCHES.map((swatch) => (
        <button
          key={swatch.id}
          type="button"
          title={swatch.label}
          aria-label={swatch.label}
          onMouseDown={onMouseDown}
          onClick={() => onSelectColor(swatch.color, true)}
          className={`w-5 h-5 rounded-full transition-transform hover:scale-110 cursor-pointer shrink-0 ${
            activeColor === swatch.color
              ? "ring-2 ring-[var(--ayu-editor-fg)] ring-offset-2 ring-offset-[var(--ayu-popup)]"
              : "ring-1 ring-black/25"
          }`}
          style={{ backgroundColor: swatch.color }}
        />
      ))}

      <span className="h-4 w-px bg-[var(--ayu-border)] shrink-0" aria-hidden="true" />

      <label
        title={t.editor.richText.customColorTooltip}
        aria-label={t.editor.richText.customColorTooltip}
        onMouseDown={onMouseDown}
        className="relative p-1 rounded-lg text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-panel)] cursor-pointer transition-colors inline-flex items-center justify-center"
      >
        <Palette size={13} />
        <input
          type="color"
          data-testid={customInputTestId}
          value={fallbackPickerColor}
          onChange={(e) => onSelectColor(e.target.value, false)}
          className="sr-only"
        />
      </label>
    </div>
  );
};
