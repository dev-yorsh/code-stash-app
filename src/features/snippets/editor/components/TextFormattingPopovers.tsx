import React from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Check,
  Trash2,
  X,
} from "lucide-react";
import type { TranslationDictionary } from "../../../../shared/i18n";
import {
  HIGHLIGHT_SWATCHES,
  RichBlockStyle,
  RichListType,
  TextAlignmentValue,
} from "../extensions/richTextExtensions";
import {
  TableActionGroups,
  ToolbarEditorSnapshot,
} from "../utils/richTextCommands";
import { TextColorPalette } from "./TextColorPalette";

type RichTextLabels = TranslationDictionary["editor"]["richText"];

const MAX_TABLE_GRID = 5;

/**
 * Shared pill-button styling keeping active formatting states subtle and
 * readable across light and dark themes using translucent accent tokens.
 */
export function getToolbarPillButtonClass(isActive: boolean, isOpen = false): string {
  if (isActive) {
    return "bg-[var(--toolbar-active-bg)] text-[var(--toolbar-active-fg)] border border-[var(--toolbar-active-border)] hover:bg-[var(--toolbar-active-hover-bg)]";
  }
  if (isOpen) {
    return "bg-[var(--menu-hover-bg)] text-[var(--ayu-editor-fg)] border border-[var(--ayu-border)]";
  }
  return "border border-transparent text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)]";
}

export function getToolbarBadgeClass(active: boolean): string {
  return active
    ? "bg-[var(--toolbar-active-bg)] text-[var(--toolbar-active-fg)] border border-[var(--toolbar-active-border)]"
    : "bg-[var(--ayu-sunk)] text-[var(--ayu-fg)] border border-[var(--ayu-border)]";
}

interface BasePopoverProps {
  setPopoverElement: (el: HTMLElement | null) => void;
  preventBlur: (e: React.MouseEvent) => void;
  labels: RichTextLabels;
}

interface BlockStylePopoverProps extends BasePopoverProps {
  state: ToolbarEditorSnapshot;
  onApplyBlock: (style: RichBlockStyle) => void;
}

export const BlockStylePopover: React.FC<BlockStylePopoverProps> = ({
  setPopoverElement,
  preventBlur,
  labels,
  state,
  onApplyBlock,
}) => (
  <div
    ref={setPopoverElement}
    data-testid="block-style-popover"
    className="absolute left-0 top-[calc(100%+8px)] w-[232px] rounded-xl border border-[var(--ayu-border)] bg-[var(--ayu-popup)] shadow-2xl p-2 z-50 animate-toolbar-popover select-none"
  >
    <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
      {labels.blocksCategory}
    </div>
    <div className="space-y-0.5">
      <StyleBadgeRow
        active={state.isH1}
        label={labels.title}
        labelClassName="text-[15.5px] font-bold tracking-tight"
        onMouseDown={preventBlur}
        onClick={() => onApplyBlock("title")}
      />
      <StyleBadgeRow
        active={state.isH2}
        label={labels.heading}
        labelClassName="text-[14px] font-bold"
        onMouseDown={preventBlur}
        onClick={() => onApplyBlock("heading")}
      />
      <StyleBadgeRow
        active={state.isH3}
        label={labels.subtitle}
        labelClassName="text-[13px] font-semibold"
        onMouseDown={preventBlur}
        onClick={() => onApplyBlock("subtitle")}
      />
      <StyleBadgeRow
        active={state.isBody}
        label={labels.body}
        labelClassName="text-[13px] font-normal"
        onMouseDown={preventBlur}
        onClick={() => onApplyBlock("body")}
      />
    </div>

    <div className="my-1.5 border-t border-[var(--ayu-border)]" />
    <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
      {labels.specialBlocksCategory}
    </div>
    <div className="space-y-0.5">
      <StyleBadgeRow
        active={state.isCode}
        badge="</>"
        label={labels.monospace}
        labelClassName="font-mono text-[12px]"
        onMouseDown={preventBlur}
        onClick={() => onApplyBlock("mono")}
      />
      <StyleBadgeRow
        active={state.isBlockquote}
        badge="❝"
        label={labels.blockquote}
        labelClassName="text-[13px]"
        onMouseDown={preventBlur}
        onClick={() => onApplyBlock("blockquote")}
      />
    </div>
  </div>
);

interface ListsMenuPopoverProps extends BasePopoverProps {
  state: ToolbarEditorSnapshot;
  onApplyList: (listType: RichListType) => void;
}

export const ListsMenuPopover: React.FC<ListsMenuPopoverProps> = ({
  setPopoverElement,
  preventBlur,
  labels,
  state,
  onApplyList,
}) => (
  <div
    ref={setPopoverElement}
    data-testid="lists-menu-popover"
    className="absolute right-12 top-[calc(100%+8px)] w-[228px] rounded-xl border border-[var(--ayu-border)] bg-[var(--ayu-popup)] shadow-2xl p-2 z-50 animate-toolbar-popover select-none"
  >
    <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
      {labels.listsCategory}
    </div>
    <div className="space-y-0.5">
      <StyleBadgeRow
        active={state.isBulletList}
        badge="•"
        label={labels.bulletList}
        labelClassName="text-[13px]"
        onMouseDown={preventBlur}
        onClick={() => onApplyList("bullet")}
      />
      <StyleBadgeRow
        active={state.isDashList}
        badge="–"
        label={labels.dashList}
        labelClassName="text-[13px]"
        onMouseDown={preventBlur}
        onClick={() => onApplyList("dash")}
      />
      <StyleBadgeRow
        active={state.isOrderedList}
        badge="1."
        label={labels.orderedList}
        labelClassName="text-[13px]"
        onMouseDown={preventBlur}
        onClick={() => onApplyList("ordered")}
      />
      <div className="my-1 border-t border-[var(--ayu-border)]/70" />
      <StyleBadgeRow
        active={state.isTaskList}
        badge="☑"
        label={labels.checklistTooltip}
        labelClassName="text-[13px] font-medium"
        onMouseDown={preventBlur}
        onClick={() => onApplyList("task")}
      />
    </div>
  </div>
);

interface HighlightPalettePopoverProps extends BasePopoverProps {
  isHighlightActive: boolean;
  activeColor: string;
  onPickColor: (color: string) => void;
  onClearHighlight: () => void;
}

export const HighlightPalettePopover: React.FC<HighlightPalettePopoverProps> = ({
  setPopoverElement,
  preventBlur,
  labels,
  isHighlightActive,
  activeColor,
  onPickColor,
  onClearHighlight,
}) => (
  <div
    ref={setPopoverElement}
    data-testid="highlight-palette-popover"
    className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] rounded-xl border border-[var(--ayu-border)] bg-[var(--ayu-popup)] shadow-2xl px-2.5 py-2 z-50 animate-toolbar-popover flex items-center gap-2 select-none"
  >
    {HIGHLIGHT_SWATCHES.map((swatch) => {
      const isSelectedSwatch = isHighlightActive && activeColor === swatch.color;
      return (
        <button
          key={swatch.id}
          type="button"
          title={swatch.label}
          aria-label={swatch.label}
          aria-pressed={isSelectedSwatch}
          onMouseDown={preventBlur}
          onClick={() => onPickColor(swatch.color)}
          className={`w-5 h-5 rounded-full transition-transform hover:scale-110 cursor-pointer ${
            isSelectedSwatch
              ? "ring-2 ring-[var(--ayu-editor-fg)] ring-offset-2 ring-offset-[var(--ayu-popup)]"
              : "ring-1 ring-black/25"
          }`}
          style={{ backgroundColor: swatch.color }}
        />
      );
    })}
    <span className="h-4 w-px bg-[var(--ayu-border)]" aria-hidden="true" />
    <button
      type="button"
      data-testid="highlight-clear-btn"
      title={labels.highlightClear}
      aria-label={labels.highlightClear}
      onMouseDown={preventBlur}
      onClick={onClearHighlight}
      className="p-1 rounded-lg text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-panel)] cursor-pointer transition-colors"
    >
      <X size={13} />
    </button>
  </div>
);

interface TextColorPopoverProps {
  setPopoverElement: (el: HTMLElement | null) => void;
  preventBlur: (e: React.MouseEvent) => void;
  activeColor: string | null;
  fallbackPickerColor: string;
  onSelectColor: (color: string) => void;
  onResetDefault: () => void;
}

export const TextColorPopover: React.FC<TextColorPopoverProps> = ({
  setPopoverElement,
  preventBlur,
  activeColor,
  fallbackPickerColor,
  onSelectColor,
  onResetDefault,
}) => (
  <div
    ref={setPopoverElement}
    data-testid="text-color-popover"
    className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] rounded-xl border border-[var(--ayu-border)] bg-[var(--ayu-popup)] shadow-2xl px-2.5 py-2 z-50 animate-toolbar-popover select-none"
  >
    <TextColorPalette
      activeColor={activeColor}
      fallbackPickerColor={fallbackPickerColor}
      onSelectColor={(color) => onSelectColor(color)}
      onResetDefault={onResetDefault}
      onMouseDown={preventBlur}
    />
  </div>
);

interface AlignmentPopoverProps extends BasePopoverProps {
  activeAlign: TextAlignmentValue;
  onApplyAlignment: (alignment: TextAlignmentValue) => void;
}

export const AlignmentPopover: React.FC<AlignmentPopoverProps> = ({
  setPopoverElement,
  preventBlur,
  labels,
  activeAlign,
  onApplyAlignment,
}) => {
  const options = [
    { value: "left" as const, testId: "align-left-btn", label: labels.alignLeft, Icon: AlignLeft },
    { value: "center" as const, testId: "align-center-btn", label: labels.alignCenter, Icon: AlignCenter },
    { value: "right" as const, testId: "align-right-btn", label: labels.alignRight, Icon: AlignRight },
    { value: "justify" as const, testId: "align-justify-btn", label: labels.alignJustify, Icon: AlignJustify },
  ];

  return (
    <div
      ref={setPopoverElement}
      data-testid="align-menu-popover"
      className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] rounded-xl border border-[var(--ayu-border)] bg-[var(--ayu-popup)] shadow-2xl p-1.5 z-50 animate-toolbar-popover flex items-center gap-1 select-none"
    >
      {options.map(({ value, testId, label, Icon }) => {
        const isActive = activeAlign === value;
        return (
          <button
            key={value}
            type="button"
            data-testid={testId}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            onMouseDown={preventBlur}
            onClick={() => onApplyAlignment(value)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${getToolbarPillButtonClass(
              isActive
            )}`}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
};

interface TableFormatPopoverProps extends BasePopoverProps {
  isInTable: boolean;
  hoveredGrid: { rows: number; cols: number };
  onHoverGrid: (grid: { rows: number; cols: number }) => void;
  onInsertTable: (rows: number, cols: number) => void;
  tableActionGroups: TableActionGroups;
}

export const TableFormatPopover: React.FC<TableFormatPopoverProps> = ({
  setPopoverElement,
  preventBlur,
  labels,
  isInTable,
  hoveredGrid,
  onHoverGrid,
  onInsertTable,
  tableActionGroups,
}) => (
  <div
    ref={setPopoverElement}
    data-testid="table-format-popover"
    className="absolute right-6 top-[calc(100%+8px)] w-[232px] rounded-xl border border-[var(--ayu-border)] bg-[var(--ayu-popup)] shadow-2xl p-2.5 z-50 animate-toolbar-popover select-none"
  >
    {!isInTable ? (
      <div>
        <div className="flex items-center justify-between text-[11.5px] font-medium text-[var(--ayu-editor-fg)] mb-2 px-0.5">
          <span>{labels.insertTable}</span>
          <span className="text-[var(--ayu-accent)] font-mono">
            {hoveredGrid.rows} × {hoveredGrid.cols}
          </span>
        </div>
        <div
          className="grid grid-cols-5 gap-1 p-1.5 rounded-lg bg-[var(--ayu-sunk)] border border-[var(--ayu-border)]"
          onMouseLeave={() => onHoverGrid({ rows: 3, cols: 3 })}
        >
          {Array.from({ length: MAX_TABLE_GRID * MAX_TABLE_GRID }).map((_, index) => {
            const r = Math.floor(index / MAX_TABLE_GRID) + 1;
            const c = (index % MAX_TABLE_GRID) + 1;
            const isHighlighted = r <= hoveredGrid.rows && c <= hoveredGrid.cols;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                aria-label={labels.tableSizeLabel(r, c)}
                onMouseDown={preventBlur}
                onMouseEnter={() => onHoverGrid({ rows: r, cols: c })}
                onClick={() => onInsertTable(r, c)}
                className={`h-6 rounded-[4px] border transition-colors cursor-pointer ${
                  isHighlighted
                    ? "bg-[var(--toolbar-active-bg)] border-[var(--toolbar-active-border)]"
                    : "bg-[var(--ayu-panel)] border-[var(--ayu-border)] hover:border-[var(--ayu-fg)]"
                }`}
              />
            );
          })}
        </div>
      </div>
    ) : (
      <div className="space-y-1 text-[12px]">
        <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
          {labels.tableRowsSection}
        </div>
        {tableActionGroups.rows.map((action) => (
          <TableActionButton
            key={action.id}
            label={action.label}
            onMouseDown={preventBlur}
            onClick={action.run}
          />
        ))}

        <div className="border-t border-[var(--ayu-border)] pt-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
          {labels.tableColsSection}
        </div>
        {tableActionGroups.columns.map((action) => (
          <TableActionButton
            key={action.id}
            label={action.label}
            onMouseDown={preventBlur}
            onClick={action.run}
          />
        ))}

        <div className="border-t border-[var(--ayu-border)] pt-1.5 space-y-0.5">
          {tableActionGroups.options.map((action) =>
            action.danger ? (
              <button
                key={action.id}
                type="button"
                onMouseDown={preventBlur}
                onClick={action.run}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[var(--ayu-error)] hover:bg-[var(--ayu-error)]/10 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                <span>{action.label}</span>
              </button>
            ) : (
              <TableActionButton
                key={action.id}
                label={action.label}
                onMouseDown={preventBlur}
                onClick={action.run}
              />
            )
          )}
        </div>
      </div>
    )}
  </div>
);

interface StyleBadgeRowProps {
  active: boolean;
  badge?: string;
  label: string;
  labelClassName?: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
}

const StyleBadgeRow: React.FC<StyleBadgeRowProps> = ({
  active,
  badge,
  label,
  labelClassName = "",
  onMouseDown,
  onClick,
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={active}
    onMouseDown={onMouseDown}
    onClick={onClick}
    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
      active
        ? "bg-[var(--menu-active-bg)] text-[var(--ayu-editor-fg)] font-medium"
        : "text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)]"
    }`}
  >
    <span className="flex items-center gap-2.5 min-w-0">
      {badge && (
        <span
          aria-hidden="true"
          className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10.5px] font-mono font-semibold shrink-0 ${getToolbarBadgeClass(
            active
          )}`}
        >
          {badge}
        </span>
      )}
      <span className={`truncate ${labelClassName}`}>{label}</span>
    </span>
    <span className="w-4 shrink-0 flex items-center justify-center text-[var(--toolbar-active-fg)]">
      {active && <Check size={13} strokeWidth={2.5} />}
    </span>
  </button>
);

interface TableActionButtonProps {
  label: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
}

const TableActionButton: React.FC<TableActionButtonProps> = ({
  label,
  onMouseDown,
  onClick,
}) => (
  <button
    type="button"
    onMouseDown={onMouseDown}
    onClick={onClick}
    className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)] transition-colors cursor-pointer"
  >
    {label}
  </button>
);

/** Bold "A" in front of an 8-tooth outlined gear for "Mostrar menú de formato". */
export const FormattingMenuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    {/* Outlined 8-tooth gear positioned behind the "A" with explicit clearance */}
    <path
      strokeWidth="1.55"
      d="M8.95 6.94L8.58 6.57L10.17 4.98L11.53 6.35L13.28 5.62L13.27 3.69L15.53 3.69L15.52 5.62L17.27 6.35L18.63 4.98L20.22 6.57L18.85 7.93L19.58 9.68L21.51 9.67L21.51 11.93L19.58 11.92L18.85 13.67L20.22 15.03L18.63 16.62L17.27 15.25L15.52 15.98L15.53 17.91L13.95 17.91"
    />
    <path strokeWidth="1.55" d="M11.65 10.06A2.85 2.85 0 1 1 12.57 12.98" />

    {/* Foreground bold rounded "A" */}
    <path d="M3.4 20L7.1 9.5H8.1L11.8 20" strokeWidth="2.75" />
    <path d="M4.9 16.2H10.3" strokeWidth="2.25" />
  </svg>
);
