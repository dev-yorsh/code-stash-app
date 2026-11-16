import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Editor, useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronUp,
  Code2,
  Highlighter,
  List,
  ListChecks,
  ListOrdered,
  ImagePlus,
  RemoveFormatting,
  Table2,
} from "lucide-react";
import { openImageFilePickerForEditor } from "../utils/richTextImageInsert";
import { useTranslation } from "../../../../shared/i18n";
import {
  applyRichBlockStyle,
  applyRichListType,
  DEFAULT_HIGHLIGHT_COLOR,
  RichBlockStyle,
  RichListType,
  TEXT_COLOR_SWATCHES,
  TextAlignmentValue,
} from "../extensions/richTextExtensions";
import {
  buildTableActionGroups,
  clearAllRichFormatting,
  selectRichEditorSnapshot,
  ToolbarEditorSnapshot,
} from "../utils/richTextCommands";
import {
  AlignmentPopover,
  BlockStylePopover,
  getToolbarBadgeClass,
  getToolbarPillButtonClass,
  HighlightPalettePopover,
  ListsMenuPopover,
  TableFormatPopover,
  TextColorPopover,
} from "./TextFormattingPopovers";

export interface TextFormattingBarProps {
  editor: Editor | null;
  visible: boolean;
  onHideToolbar?: () => void;
}

type OpenPopover =
  | "blocks"
  | "lists"
  | "highlight"
  | "textColor"
  | "align"
  | "table"
  | null;

function preventEditorBlur(e: React.MouseEvent) {
  e.preventDefault();
}

/**
 * Dynamically expanding Code-Stash floating capsule toolbar for Plain Text notes.
 * Collapses to 0px vertical height when empty, manually hidden, or in code mode.
 */
export const TextFormattingBar: React.FC<TextFormattingBarProps> = memo(
  ({ editor, visible, onHideToolbar }) => {
    if (!editor) {
      return (
        <div
          data-testid="text-formatting-bar"
          data-visible="false"
          className="grid grid-rows-[0fr] opacity-0 pointer-events-none shrink-0 select-none"
          aria-hidden="true"
        >
          <div className="min-h-0 overflow-hidden" />
        </div>
      );
    }

    return (
      <ActiveTextFormattingBar
        editor={editor}
        visible={visible}
        onHideToolbar={onHideToolbar}
      />
    );
  }
);

TextFormattingBar.displayName = "TextFormattingBar";

interface ActiveTextFormattingBarProps {
  editor: Editor;
  visible: boolean;
  onHideToolbar?: () => void;
}

const ActiveTextFormattingBar: React.FC<ActiveTextFormattingBarProps> = ({
  editor,
  visible,
  onHideToolbar,
}) => {
  const { t } = useTranslation();
  const activePopoverRef = useRef<HTMLElement | null>(null);

  const [openPopover, setOpenPopover] = useState<OpenPopover>(null);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<string>(
    DEFAULT_HIGHLIGHT_COLOR
  );
  const [selectedTextColor, setSelectedTextColor] = useState<string>(
    TEXT_COLOR_SWATCHES[0].color
  );
  const [hoveredGrid, setHoveredGrid] = useState<{ rows: number; cols: number }>({
    rows: 3,
    cols: 3,
  });

  const setPopoverElement = useCallback((el: HTMLElement | null) => {
    activePopoverRef.current = el;
  }, []);

  const state: ToolbarEditorSnapshot = useEditorState({
    editor,
    selector: ({ editor: ed }) => selectRichEditorSnapshot(ed),
  });

  useEffect(() => {
    if (!visible) {
      setOpenPopover(null);
    }
  }, [visible]);

  // Dismiss open submenus ONLY on click outside the submenu area or on native Escape key
  useEffect(() => {
    if (!openPopover) return;

    const isInsidePopoverOrTrigger = (target: EventTarget | null, skipOwnTriggerOnly: boolean) => {
      if (!(target instanceof Node)) return false;
      if (activePopoverRef.current?.contains(target)) {
        return true;
      }
      if (target instanceof Element) {
        const triggerEl = target.closest("[data-popover-trigger]");
        if (triggerEl) {
          return skipOwnTriggerOnly
            ? triggerEl.getAttribute("data-popover-trigger") === openPopover
            : true;
        }
      }
      return false;
    };

    const handleOutsidePress = (event: Event) => {
      if (!isInsidePopoverOrTrigger(event.target, true)) {
        setOpenPopover(null);
      }
    };

    const handleOutsideClick = (event: MouseEvent) => {
      // Ignore detached nodes when a submenu action re-renders its own contents (e.g. Table grid -> menu)
      if (!(event.target instanceof Node) || !document.contains(event.target)) {
        return;
      }
      if (!isInsidePopoverOrTrigger(event.target, false)) {
        setOpenPopover(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpenPopover(null);
        editor.commands.focus();
      }
    };

    window.addEventListener("pointerdown", handleOutsidePress, true);
    window.addEventListener("mousedown", handleOutsidePress, true);
    window.addEventListener("click", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", handleOutsidePress, true);
      window.removeEventListener("mousedown", handleOutsidePress, true);
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [openPopover, editor]);

  const activeHighlightIndicator = state.highlightColor || selectedHighlightColor;
  const activeTextColorBar = state.textColor || "var(--ayu-editor-fg)";
  const customColorFallback = state.textColor || selectedTextColor;
  const anyListActive =
    state.isBulletList || state.isDashList || state.isOrderedList || state.isTaskList;
  const tableActionGroups = buildTableActionGroups(editor, t.editor.richText);

  const activeBlockMeta: { badge?: string; label: string; elevated: boolean } = state.isH1
    ? { label: t.editor.richText.shortTitle, elevated: true }
    : state.isH2
      ? { label: t.editor.richText.shortHeading, elevated: true }
      : state.isH3
        ? { label: t.editor.richText.shortSubtitle, elevated: true }
        : state.isBlockquote
          ? { badge: "❝", label: t.editor.richText.shortQuote, elevated: true }
          : { label: t.editor.richText.shortBody, elevated: false };

  const togglePopover = (target: Exclude<OpenPopover, null>) => {
    setOpenPopover((prev) => (prev === target ? null : target));
  };

  // Submenu actions intentionally preserve openPopover so users can preview choices seamlessly
  const handleApplyBlock = (style: RichBlockStyle) => {
    applyRichBlockStyle(editor, style);
  };

  const handleApplyList = (listType: RichListType) => {
    applyRichListType(editor, listType);
  };

  const handlePickHighlightColor = (color: string) => {
    setSelectedHighlightColor(color);
    editor.chain().setHighlight({ color }).focus().run();
  };

  const handleClearHighlight = () => {
    editor.chain().unsetHighlight().focus().run();
  };

  const handlePickTextColor = (color: string) => {
    setSelectedTextColor(color);
    editor.chain().setTextColor(color).focus().run();
  };

  const handleResetTextColor = () => {
    editor.chain().unsetTextColor().focus().run();
  };

  const handleApplyAlignment = (alignment: TextAlignmentValue) => {
    editor.chain().setTextAlign(alignment).focus().run();
  };

  const handleInsertTable = (rows: number, cols: number) => {
    editor.chain().insertTable({ rows, cols, withHeaderRow: true }).focus().run();
  };

  const handleClearAllFormatting = () => {
    clearAllRichFormatting(editor, state.isInTable);
    setOpenPopover(null);
  };

  const renderActiveListIcon = () => {
    if (state.isTaskList) return <ListChecks size={14} />;
    if (state.isOrderedList) return <ListOrdered size={14} />;
    return <List size={14} />;
  };

  const renderActiveAlignIcon = () => {
    if (state.textAlign === "center") return <AlignCenter size={14} />;
    if (state.textAlign === "right") return <AlignRight size={14} />;
    if (state.textAlign === "justify") return <AlignJustify size={14} />;
    return <AlignLeft size={14} />;
  };

  return (
    <div
      data-testid="text-formatting-bar"
      data-visible={visible ? "true" : "false"}
      aria-hidden={!visible}
      className={`grid transition-[grid-template-rows,opacity,padding] duration-150 ease-out shrink-0 relative z-30 select-none ${
        visible
          ? "grid-rows-[1fr] opacity-100 pt-2 pb-1.5"
          : "grid-rows-[0fr] opacity-0 pointer-events-none py-0"
      }`}
    >
      <div
        className={`min-h-0 flex justify-center px-3 min-w-0 ${
          visible ? "overflow-visible" : "overflow-hidden"
        }`}
      >
        <div
          role="toolbar"
          aria-label={t.editor.richText.toolbarAriaLabel}
          className="relative inline-flex flex-wrap justify-center items-center max-w-full gap-0.5 px-2 py-1 rounded-2xl border border-[var(--ayu-border)] bg-[var(--menu-bg)] shadow-lg"
        >
          {/* Segment 1: Live Block Hierarchy Selector */}
          <button
            type="button"
            data-testid="block-style-trigger"
            data-popover-trigger="blocks"
            title={t.editor.richText.textStyleTooltip}
            aria-label={t.editor.richText.textStyleTooltip}
            aria-expanded={openPopover === "blocks"}
            onMouseDown={preventEditorBlur}
            onClick={() => togglePopover("blocks")}
            className={`h-7 px-2 rounded-xl text-[12px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              openPopover === "blocks" || activeBlockMeta.elevated
                ? "bg-[var(--menu-hover-bg)] text-[var(--ayu-editor-fg)] border border-[var(--ayu-border)]"
                : "text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)] border border-transparent"
            }`}
          >
            {activeBlockMeta.badge && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-4.5 px-1 rounded text-[10px] font-mono font-bold ${getToolbarBadgeClass(
                  activeBlockMeta.elevated
                )}`}
              >
                {activeBlockMeta.badge}
              </span>
            )}
            <span className="tracking-tight">{activeBlockMeta.label}</span>
            <ChevronDown size={12} className="opacity-70" />
          </button>

          <SegmentDivider />

          {/* Segment 2: 1-Click Inline Emphasis Cluster + Color Pickers */}
          <InlineFormatButton
            label="B"
            title={t.editor.richText.bold}
            active={state.isBold}
            onClick={() => editor.chain().toggleBold().focus().run()}
            className="font-bold text-[13.5px]"
          />
          <InlineFormatButton
            label="I"
            title={t.editor.richText.italic}
            active={state.isItalic}
            onClick={() => editor.chain().toggleItalic().focus().run()}
            className="italic font-serif text-[14px]"
          />
          <InlineFormatButton
            label="U"
            title={t.editor.richText.underline}
            active={state.isUnderline}
            onClick={() => editor.chain().toggleUnderline().focus().run()}
            className="underline text-[13px]"
          />
          <InlineFormatButton
            label="S"
            title={t.editor.richText.strikethrough}
            active={state.isStrike}
            onClick={() => editor.chain().toggleStrike().focus().run()}
            className="line-through text-[13px]"
          />
          <button
            type="button"
            data-testid="format-mono-btn"
            title={t.editor.richText.monospace}
            aria-label={t.editor.richText.monospace}
            aria-pressed={state.isCode}
            onMouseDown={preventEditorBlur}
            onClick={() => applyRichBlockStyle(editor, "mono")}
            className={`w-7 h-7 rounded-xl transition-colors flex items-center justify-center cursor-pointer ${getToolbarPillButtonClass(
              state.isCode
            )}`}
          >
            <Code2 size={14} />
          </button>

          {/* Highlight Trigger (opens color swatches popover on click; no separate color dot) */}
          <button
            type="button"
            data-testid="format-highlight-btn"
            data-popover-trigger="highlight"
            title={t.editor.richText.highlight}
            aria-label={t.editor.richText.highlight}
            aria-expanded={openPopover === "highlight"}
            aria-pressed={state.isHighlight}
            onMouseDown={preventEditorBlur}
            onClick={() => togglePopover("highlight")}
            className={`w-7 h-7 rounded-xl transition-colors flex items-center justify-center cursor-pointer ${getToolbarPillButtonClass(
              state.isHighlight,
              openPopover === "highlight"
            )}`}
          >
            <Highlighter size={14} />
          </button>

          {/* Text Color Picker Trigger */}
          <button
            type="button"
            data-testid="text-color-trigger"
            data-popover-trigger="textColor"
            title={t.editor.richText.textColorTooltip}
            aria-label={t.editor.richText.textColorTooltip}
            aria-expanded={openPopover === "textColor"}
            aria-pressed={Boolean(state.textColor)}
            onMouseDown={preventEditorBlur}
            onClick={() => togglePopover("textColor")}
            className={`w-7 h-7 rounded-xl transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${getToolbarPillButtonClass(
              Boolean(state.textColor),
              openPopover === "textColor"
            )}`}
          >
            <span className="text-[12.5px] font-bold leading-none">A</span>
            <span
              data-testid="text-color-indicator-bar"
              className="w-3.5 h-[2.5px] rounded-full"
              style={{ backgroundColor: activeTextColorBar }}
            />
          </button>

          <SegmentDivider />

          {/* Segment 3: Text Alignment, Unified Lists & Table */}
          <button
            type="button"
            data-testid="align-menu-trigger"
            data-popover-trigger="align"
            title={t.editor.richText.alignTooltip}
            aria-label={t.editor.richText.alignTooltip}
            aria-expanded={openPopover === "align"}
            onMouseDown={preventEditorBlur}
            onClick={() => togglePopover("align")}
            className={`h-7 px-2 rounded-xl transition-colors flex items-center gap-1 cursor-pointer ${getToolbarPillButtonClass(
              state.textAlign !== "left",
              openPopover === "align"
            )}`}
          >
            {renderActiveAlignIcon()}
            <ChevronDown size={11} className="opacity-75" />
          </button>

          <button
            type="button"
            data-testid="lists-menu-trigger"
            data-popover-trigger="lists"
            title={t.editor.richText.listsMenuTooltip}
            aria-label={t.editor.richText.listsMenuTooltip}
            aria-expanded={openPopover === "lists"}
            onMouseDown={preventEditorBlur}
            onClick={() => togglePopover("lists")}
            className={`h-7 px-2 rounded-xl transition-colors flex items-center gap-1 cursor-pointer ${getToolbarPillButtonClass(
              anyListActive,
              openPopover === "lists"
            )}`}
          >
            {renderActiveListIcon()}
            <ChevronDown size={11} className="opacity-75" />
          </button>

          <button
            type="button"
            data-testid="format-table-trigger"
            data-popover-trigger="table"
            title={t.editor.richText.tableTooltip}
            aria-label={t.editor.richText.tableTooltip}
            aria-expanded={openPopover === "table"}
            onMouseDown={preventEditorBlur}
            onClick={() => togglePopover("table")}
            className={`w-7 h-7 rounded-xl transition-colors flex items-center justify-center cursor-pointer ${getToolbarPillButtonClass(
              state.isInTable,
              openPopover === "table"
            )}`}
          >
            <Table2 size={14} />
          </button>

          <button
            type="button"
            data-testid="format-insert-image-btn"
            title={t.editor.richText.insertImageTooltip}
            aria-label={t.editor.richText.insertImageTooltip}
            onMouseDown={preventEditorBlur}
            onClick={() => openImageFilePickerForEditor(editor)}
            className={`w-7 h-7 rounded-xl transition-colors flex items-center justify-center cursor-pointer ${getToolbarPillButtonClass(
              false
            )}`}
          >
            <ImagePlus size={14} />
          </button>

          <SegmentDivider />

          {/* Segment 4: Clear Formatting & Minimize */}
          <button
            type="button"
            data-testid="format-clear-btn"
            title={t.editor.richText.clearFormatting}
            aria-label={t.editor.richText.clearFormatting}
            onMouseDown={preventEditorBlur}
            onClick={handleClearAllFormatting}
            className={`w-7 h-7 rounded-xl transition-colors flex items-center justify-center cursor-pointer ${getToolbarPillButtonClass(
              false
            )}`}
          >
            <RemoveFormatting size={14} />
          </button>

          {onHideToolbar && (
            <>
              <SegmentDivider />
              <button
                type="button"
                data-testid="hide-formatting-bar-btn"
                title={t.editor.richText.hideFormattingBarTooltip}
                aria-label={t.editor.richText.hideFormattingBarTooltip}
                onMouseDown={preventEditorBlur}
                onClick={() => {
                  setOpenPopover(null);
                  onHideToolbar();
                }}
                className={`w-7 h-7 rounded-xl transition-colors flex items-center justify-center cursor-pointer ${getToolbarPillButtonClass(
                  false
                )}`}
              >
                <ChevronUp size={15} strokeWidth={2.5} />
              </button>
            </>
          )}

          {/* Active Submenu Popover Panels */}
          {openPopover === "blocks" && (
            <BlockStylePopover
              setPopoverElement={setPopoverElement}
              preventBlur={preventEditorBlur}
              labels={t.editor.richText}
              state={state}
              onApplyBlock={handleApplyBlock}
            />
          )}

          {openPopover === "lists" && (
            <ListsMenuPopover
              setPopoverElement={setPopoverElement}
              preventBlur={preventEditorBlur}
              labels={t.editor.richText}
              state={state}
              onApplyList={handleApplyList}
            />
          )}

          {openPopover === "highlight" && (
            <HighlightPalettePopover
              setPopoverElement={setPopoverElement}
              preventBlur={preventEditorBlur}
              labels={t.editor.richText}
              isHighlightActive={state.isHighlight}
              activeColor={activeHighlightIndicator}
              onPickColor={handlePickHighlightColor}
              onClearHighlight={handleClearHighlight}
            />
          )}

          {openPopover === "textColor" && (
            <TextColorPopover
              setPopoverElement={setPopoverElement}
              preventBlur={preventEditorBlur}
              activeColor={state.textColor}
              fallbackPickerColor={customColorFallback}
              onSelectColor={handlePickTextColor}
              onResetDefault={handleResetTextColor}
            />
          )}

          {openPopover === "align" && (
            <AlignmentPopover
              setPopoverElement={setPopoverElement}
              preventBlur={preventEditorBlur}
              labels={t.editor.richText}
              activeAlign={state.textAlign}
              onApplyAlignment={handleApplyAlignment}
            />
          )}

          {openPopover === "table" && (
            <TableFormatPopover
              setPopoverElement={setPopoverElement}
              preventBlur={preventEditorBlur}
              labels={t.editor.richText}
              isInTable={state.isInTable}
              hoveredGrid={hoveredGrid}
              onHoverGrid={setHoveredGrid}
              onInsertTable={handleInsertTable}
              tableActionGroups={tableActionGroups}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const SegmentDivider: React.FC = () => (
  <span className="h-4 w-px bg-[var(--ayu-border)] mx-0.5 shrink-0" aria-hidden="true" />
);

interface InlineFormatButtonProps {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}

const InlineFormatButton: React.FC<InlineFormatButtonProps> = ({
  label,
  title,
  active,
  onClick,
  className = "",
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    onMouseDown={preventEditorBlur}
    onClick={onClick}
    className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${className} ${getToolbarPillButtonClass(
      active
    )}`}
  >
    {label}
  </button>
);
