import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Editor, useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Check,
  CheckSquare,
  ChevronRight,
  ClipboardPaste,
  Code2,
  Copy,
  CopyPlus,
  FileCode2,
  Highlighter,
  Link2,
  List,
  Palette,
  Quote,
  RemoveFormatting,
  Scissors,
  Table2,
  Trash2,
  Type,
  X,
  ImagePlus,
} from "lucide-react";
import { assetUrlManager } from "@/shared/api/assets/assetUrlManager";
import {
  copyImageToClipboard,
  duplicateImageNodeAt,
  openImageFilePickerForEditor,
} from "../utils/richTextImageInsert";
import { useTranslation } from "../../../../shared/i18n";
import {
  applyRichBlockStyle,
  applyRichListType,
  DEFAULT_HIGHLIGHT_COLOR,
  HIGHLIGHT_SWATCHES,
  RichBlockStyle,
  RichListType,
  TEXT_COLOR_SWATCHES,
  TextAlignmentValue,
} from "../extensions/richTextExtensions";
import {
  applyRichLink,
  buildTableActionGroups,
  clearAllRichFormatting,
  insertPanelElement,
  PanelInsertKind,
  removeRichLink,
  selectRichEditorSnapshot,
  TableActionGroups,
} from "../utils/richTextCommands";
import { clampFloatingCoords, SpellcheckTarget } from "../utils/spellcheckHelpers";
import { SpellingMenuSection } from "./SpellingMenuSection";
import { TextColorPalette } from "./TextColorPalette";
import {
  FormattingMenuIcon,
  getToolbarPillButtonClass,
} from "./TextFormattingPopovers";

export type ClipboardCommand =
  | "cut"
  | "copy"
  | "copyFormatted"
  | "copyMarkdown"
  | "paste"
  | "selectAll";

type ContextSubmenuId =
  | "blocks"
  | "textColor"
  | "highlight"
  | "align"
  | "lists"
  | "link"
  | "table"
  | null;

export interface RichTextContextMenuProps {
  editor: Editor;
  anchor: { x: number; y: number };
  hasTextSelection: boolean;
  isInTable: boolean;
  clickedBelowContent: boolean;
  selectedImage?: { pos: number; src: string } | null;
  spellTarget: SpellcheckTarget | null;
  spellcheckEnabled: boolean;
  showFormattingBarRestore?: boolean;
  onShowFormattingBar?: () => void;
  onIgnoreWord: (word: string) => void;
  onToggleSpellcheck: (nextEnabled: boolean) => void;
  onClipboardCommand: (command: ClipboardCommand) => void;
  onClose: () => void;
}

function preventFocusLoss(e: React.MouseEvent) {
  e.preventDefault();
}

/**
 * Contextual Plain-Text right-click menu adapting seamlessly between:
 * 1. Selected text enrichment tools
 * 2. Table row/column/header/delete modifications
 * 3. Empty-panel insertion list (Table, Blockquote, Monostyled Code Block)
 * Plus unified "Ortografía" (Spelling) and Clipboard sections.
 */
export const RichTextContextMenu: React.FC<RichTextContextMenuProps> = ({
  editor,
  anchor,
  hasTextSelection,
  isInTable,
  clickedBelowContent,
  selectedImage = null,
  spellTarget,
  spellcheckEnabled,
  showFormattingBarRestore = false,
  onShowFormattingBar,
  onIgnoreWord,
  onToggleSpellcheck,
  onClipboardCommand,
  onClose,
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<ContextSubmenuId>(null);
  const [openLeft, setOpenLeft] = useState(false);
  const [linkDisplayNameInput, setLinkDisplayNameInput] = useState("");
  const [linkUrlInput, setLinkUrlInput] = useState("");
  const [selectedCustomColor, setSelectedCustomColor] = useState<string>(
    TEXT_COLOR_SWATCHES[0].color
  );

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => selectRichEditorSnapshot(ed),
  });

  const [position, setPosition] = useState<{ left: number; top: number }>(() =>
    clampFloatingCoords(anchor.x, anchor.y, 248, 360)
  );

  useLayoutEffect(() => {
    const el = menuRef.current;
    const width = el?.offsetWidth || 248;
    const height = el?.offsetHeight || 360;
    const nextPos = clampFloatingCoords(anchor.x, anchor.y, width, height);
    setPosition(nextPos);
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
    setOpenLeft(nextPos.left + width + 280 > viewportWidth);
  }, [anchor.x, anchor.y, hasTextSelection, isInTable, spellTarget?.word, spellcheckEnabled]);

  useEffect(() => {
    if (clickedBelowContent) {
      setLinkDisplayNameInput("");
      setLinkUrlInput("");
      return;
    }
    setLinkDisplayNameInput(state.linkText || "");
    setLinkUrlInput(state.linkHref || "");
  }, [anchor.x, anchor.y, clickedBelowContent, state.linkHref, state.linkText]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        editor.commands.focus();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, editor]);

  const rt = t.editor.richText;
  const tableGroups = buildTableActionGroups(editor, rt);
  const submenuSideClass = openLeft ? "right-full pr-1.5" : "left-full pl-1.5";

  const handleInsertPanel = (kind: PanelInsertKind) => {
    insertPanelElement(editor, kind, clickedBelowContent);
    onClose();
  };

  const handleApplyBlock = (style: RichBlockStyle) => {
    applyRichBlockStyle(editor, style);
    onClose();
  };

  const handleApplyList = (listType: RichListType) => {
    applyRichListType(editor, listType);
    onClose();
  };

  const handleApplyAlign = (align: TextAlignmentValue) => {
    editor.chain().setTextAlign(align).focus().run();
    onClose();
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyRichLink(editor, linkUrlInput, {
      displayText: linkDisplayNameInput,
      appendAtEnd: clickedBelowContent,
    });
    onClose();
  };

  const canRemoveActiveLink = state.isLink && !clickedBelowContent;

  const linkSubmenuRow = (
    <SubmenuTriggerRow
      testId="context-submenu-link"
      icon={<Link2 size={13} />}
      label={rt.linkTooltip}
      open={activeSubmenu === "link"}
      onActivate={() => setActiveSubmenu("link")}
      onDeactivate={() => setActiveSubmenu((p) => (p === "link" ? null : p))}
      onToggle={() => setActiveSubmenu((p) => (p === "link" ? null : "link"))}
    >
      {activeSubmenu === "link" && (
        <SubmenuPanel
          testId="context-link-submenu"
          sideClass={submenuSideClass}
          widthClass="w-[272px] p-2.5"
        >
          <form
            onSubmit={handleLinkSubmit}
            data-testid="context-link-form"
            className="space-y-2"
          >
            <label className="block space-y-1">
              <span className="block text-[10.5px] font-medium text-[var(--ayu-fg-subtle)]">
                {rt.linkDisplayNameLabel}
              </span>
              <input
                type="text"
                data-testid="context-link-label-input"
                value={linkDisplayNameInput}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => setLinkDisplayNameInput(e.target.value)}
                placeholder={rt.linkDisplayNamePlaceholder}
                className="w-full px-2 py-1.5 text-[12px] rounded-lg bg-[var(--ayu-sunk)] border border-[var(--ayu-border)] text-[var(--ayu-editor-fg)] placeholder-[var(--ayu-fg-subtle)] focus:outline-none focus:border-[var(--ayu-accent)] select-text"
              />
            </label>

            <label className="block space-y-1">
              <span className="block text-[10.5px] font-medium text-[var(--ayu-fg-subtle)]">
                {rt.linkUrlLabel}
              </span>
              <input
                type="text"
                inputMode="url"
                data-testid="context-link-url-input"
                value={linkUrlInput}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => setLinkUrlInput(e.target.value)}
                placeholder={rt.linkPlaceholder}
                className="w-full px-2 py-1.5 text-[12px] rounded-lg bg-[var(--ayu-sunk)] border border-[var(--ayu-border)] text-[var(--ayu-editor-fg)] placeholder-[var(--ayu-fg-subtle)] focus:outline-none focus:border-[var(--ayu-accent)] select-text"
              />
            </label>

            <div className="flex items-center justify-end gap-1.5 pt-0.5">
              {canRemoveActiveLink && (
                <button
                  type="button"
                  data-testid="context-link-remove-btn"
                  title={rt.removeLink}
                  aria-label={rt.removeLink}
                  onMouseDown={preventFocusLoss}
                  onClick={() => {
                    removeRichLink(editor);
                    onClose();
                  }}
                  className="p-1.5 rounded-lg text-[var(--ayu-error)] hover:bg-[var(--ayu-error)]/10 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
              <button
                type="submit"
                data-testid="context-link-apply-btn"
                className="px-2.5 py-1 rounded-lg text-[11.5px] font-medium bg-[var(--toolbar-active-bg)] text-[var(--toolbar-active-fg)] border border-[var(--toolbar-active-border)] hover:bg-[var(--toolbar-active-hover-bg)] transition-colors cursor-pointer"
              >
                {rt.applyLink}
              </button>
            </div>
          </form>
        </SubmenuPanel>
      )}
    </SubmenuTriggerRow>
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      data-testid="rich-text-context-menu"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      onMouseDown={preventFocusLoss}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="fixed z-50 w-[252px] rounded-xl border border-[var(--ayu-border)] bg-[var(--menu-bg)] shadow-2xl p-1.5 text-[12px] select-none animate-toolbar-popover"
    >
      {/* MODE 1: Selected Text Enrichment Controls */}
      {hasTextSelection && (
        <div className="space-y-0.5">
          <div className="px-2.5 pt-0.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
            {rt.contextTextFormat}
          </div>

          <div
            data-testid="context-inline-format-strip"
            className="flex items-center justify-between gap-0.5 px-1 pb-1"
          >
            <QuickToggleButton
              label="B"
              title={rt.bold}
              active={state.isBold}
              className="font-bold text-[13px]"
              onClick={() => {
                editor.chain().toggleBold().focus().run();
                onClose();
              }}
            />
            <QuickToggleButton
              label="I"
              title={rt.italic}
              active={state.isItalic}
              className="italic font-serif text-[13.5px]"
              onClick={() => {
                editor.chain().toggleItalic().focus().run();
                onClose();
              }}
            />
            <QuickToggleButton
              label="U"
              title={rt.underline}
              active={state.isUnderline}
              className="underline text-[12.5px]"
              onClick={() => {
                editor.chain().toggleUnderline().focus().run();
                onClose();
              }}
            />
            <QuickToggleButton
              label="S"
              title={rt.strikethrough}
              active={state.isStrike}
              className="line-through text-[12.5px]"
              onClick={() => {
                editor.chain().toggleStrike().focus().run();
                onClose();
              }}
            />
            <QuickToggleIconButton
              title={rt.monospace}
              active={state.isCode}
              onClick={() => {
                applyRichBlockStyle(editor, "mono");
                onClose();
              }}
            >
              <Code2 size={13.5} />
            </QuickToggleIconButton>
            <QuickToggleIconButton
              title={rt.highlight}
              active={state.isHighlight}
              onClick={() => {
                editor
                  .chain()
                  .toggleHighlight({ color: state.highlightColor || DEFAULT_HIGHLIGHT_COLOR })
                  .focus()
                  .run();
                onClose();
              }}
            >
              <Highlighter size={13.5} />
            </QuickToggleIconButton>
          </div>

          {/* Submenu: Block Style */}
          <SubmenuTriggerRow
            testId="context-submenu-blocks"
            icon={<Type size={13} />}
            label={rt.contextBlockStyle}
            open={activeSubmenu === "blocks"}
            onActivate={() => setActiveSubmenu("blocks")}
            onDeactivate={() => setActiveSubmenu((p) => (p === "blocks" ? null : p))}
            onToggle={() => setActiveSubmenu((p) => (p === "blocks" ? null : "blocks"))}
          >
            {activeSubmenu === "blocks" && (
              <SubmenuPanel sideClass={submenuSideClass} widthClass="w-[205px]">
                {(
                  [
                    { id: "title", label: rt.title, active: state.isH1 },
                    { id: "heading", label: rt.heading, active: state.isH2 },
                    { id: "subtitle", label: rt.subtitle, active: state.isH3 },
                    { id: "body", label: rt.body, active: state.isBody },
                    { id: "blockquote", label: rt.blockquote, active: state.isBlockquote },
                    { id: "mono", label: rt.monospace, active: state.isCode },
                  ] as const
                ).map((item) => (
                  <ContextMenuRow
                    key={item.id}
                    label={item.label}
                    active={item.active}
                    onClick={() => handleApplyBlock(item.id)}
                  />
                ))}
              </SubmenuPanel>
            )}
          </SubmenuTriggerRow>

          {/* Submenu: Text Color (with Sin color default icon) */}
          <SubmenuTriggerRow
            testId="context-submenu-color"
            icon={<Palette size={13} />}
            label={rt.contextTextColor}
            open={activeSubmenu === "textColor"}
            onActivate={() => setActiveSubmenu("textColor")}
            onDeactivate={() => setActiveSubmenu((p) => (p === "textColor" ? null : p))}
            onToggle={() => setActiveSubmenu((p) => (p === "textColor" ? null : "textColor"))}
          >
            {activeSubmenu === "textColor" && (
              <SubmenuPanel
                testId="context-text-color-submenu"
                sideClass={submenuSideClass}
                widthClass="w-[260px] p-2"
              >
                <TextColorPalette
                  activeColor={state.textColor}
                  fallbackPickerColor={state.textColor || selectedCustomColor}
                  resetButtonTestId="context-text-color-reset-btn"
                  customInputTestId="context-text-color-custom-input"
                  showNoColorLabel
                  onMouseDown={preventFocusLoss}
                  onSelectColor={(color, shouldClose) => {
                    setSelectedCustomColor(color);
                    editor.chain().setTextColor(color).focus().run();
                    if (shouldClose !== false) onClose();
                  }}
                  onResetDefault={() => {
                    editor.chain().unsetTextColor().focus().run();
                    onClose();
                  }}
                />
              </SubmenuPanel>
            )}
          </SubmenuTriggerRow>

          {/* Submenu: Highlight */}
          <SubmenuTriggerRow
            testId="context-submenu-highlight"
            icon={<Highlighter size={13} />}
            label={rt.contextHighlightColor}
            open={activeSubmenu === "highlight"}
            onActivate={() => setActiveSubmenu("highlight")}
            onDeactivate={() => setActiveSubmenu((p) => (p === "highlight" ? null : p))}
            onToggle={() => setActiveSubmenu((p) => (p === "highlight" ? null : "highlight"))}
          >
            {activeSubmenu === "highlight" && (
              <SubmenuPanel sideClass={submenuSideClass} widthClass="w-auto p-2">
                <div className="flex items-center gap-1.5">
                  {HIGHLIGHT_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.id}
                      type="button"
                      title={swatch.label}
                      aria-label={swatch.label}
                      onMouseDown={preventFocusLoss}
                      onClick={() => {
                        editor.chain().setHighlight({ color: swatch.color }).focus().run();
                        onClose();
                      }}
                      className={`w-5 h-5 rounded-full transition-transform hover:scale-110 cursor-pointer ${
                        state.highlightColor === swatch.color
                          ? "ring-2 ring-[var(--ayu-editor-fg)]"
                          : "ring-1 ring-black/25"
                      }`}
                      style={{ backgroundColor: swatch.color }}
                    />
                  ))}
                  <span className="h-4 w-px bg-[var(--ayu-border)]" aria-hidden="true" />
                  <button
                    type="button"
                    title={rt.highlightClear}
                    aria-label={rt.highlightClear}
                    onMouseDown={preventFocusLoss}
                    onClick={() => {
                      editor.chain().unsetHighlight().focus().run();
                      onClose();
                    }}
                    className="p-1 rounded-lg text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)] cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
              </SubmenuPanel>
            )}
          </SubmenuTriggerRow>

          {/* Submenu: Alignment */}
          <SubmenuTriggerRow
            testId="context-submenu-align"
            icon={<AlignLeft size={13} />}
            label={rt.contextAlignment}
            open={activeSubmenu === "align"}
            onActivate={() => setActiveSubmenu("align")}
            onDeactivate={() => setActiveSubmenu((p) => (p === "align" ? null : p))}
            onToggle={() => setActiveSubmenu((p) => (p === "align" ? null : "align"))}
          >
            {activeSubmenu === "align" && (
              <SubmenuPanel sideClass={submenuSideClass} widthClass="w-[196px]">
                {(
                  [
                    { id: "left", label: rt.alignLeft, Icon: AlignLeft },
                    { id: "center", label: rt.alignCenter, Icon: AlignCenter },
                    { id: "right", label: rt.alignRight, Icon: AlignRight },
                    { id: "justify", label: rt.alignJustify, Icon: AlignJustify },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <ContextMenuRow
                    key={id}
                    icon={<Icon size={13} />}
                    label={label}
                    active={state.textAlign === id}
                    onClick={() => handleApplyAlign(id)}
                  />
                ))}
              </SubmenuPanel>
            )}
          </SubmenuTriggerRow>

          {/* Submenu: Lists */}
          <SubmenuTriggerRow
            testId="context-submenu-lists"
            icon={<List size={13} />}
            label={rt.contextLists}
            open={activeSubmenu === "lists"}
            onActivate={() => setActiveSubmenu("lists")}
            onDeactivate={() => setActiveSubmenu((p) => (p === "lists" ? null : p))}
            onToggle={() => setActiveSubmenu((p) => (p === "lists" ? null : "lists"))}
          >
            {activeSubmenu === "lists" && (
              <SubmenuPanel sideClass={submenuSideClass} widthClass="w-[210px]">
                <ContextMenuRow
                  label={rt.bulletList}
                  active={state.isBulletList}
                  onClick={() => handleApplyList("bullet")}
                />
                <ContextMenuRow
                  label={rt.dashList}
                  active={state.isDashList}
                  onClick={() => handleApplyList("dash")}
                />
                <ContextMenuRow
                  label={rt.orderedList}
                  active={state.isOrderedList}
                  onClick={() => handleApplyList("ordered")}
                />
                <ContextMenuRow
                  label={rt.checklistTooltip}
                  active={state.isTaskList}
                  onClick={() => handleApplyList("task")}
                />
              </SubmenuPanel>
            )}
          </SubmenuTriggerRow>

          {/* Submenu: Link */}
          {linkSubmenuRow}

          <ContextMenuRow
            testId="context-clear-formatting-btn"
            icon={<RemoveFormatting size={13} />}
            label={rt.clearFormatting}
            onClick={() => {
              clearAllRichFormatting(editor, state.isInTable);
              onClose();
            }}
          />
        </div>
      )}

      {/* MODE 2: Table Controls (Inline list when right-clicking a table directly, or submenu when text is also selected) */}
      {isInTable && (
        <>
          {hasTextSelection ? (
            <SubmenuTriggerRow
              testId="context-submenu-table"
              icon={<Table2 size={13} />}
              label={rt.contextTableSection}
              open={activeSubmenu === "table"}
              onActivate={() => setActiveSubmenu("table")}
              onDeactivate={() => setActiveSubmenu((p) => (p === "table" ? null : p))}
              onToggle={() => setActiveSubmenu((p) => (p === "table" ? null : "table"))}
            >
              {activeSubmenu === "table" && (
                <SubmenuPanel
                  testId="context-table-submenu"
                  sideClass={submenuSideClass}
                  widthClass="w-[224px] p-1.5"
                >
                  <TableMenuList
                    groups={tableGroups}
                    rowsHeader={rt.tableRowsSection}
                    colsHeader={rt.tableColsSection}
                    onActionDone={onClose}
                  />
                </SubmenuPanel>
              )}
            </SubmenuTriggerRow>
          ) : (
            <div data-testid="context-table-section" className="space-y-0.5">
              <div className="px-2.5 pt-0.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
                {rt.contextTableSection}
              </div>
              <TableMenuList
                groups={tableGroups}
                rowsHeader={rt.tableRowsSection}
                colsHeader={rt.tableColsSection}
                onActionDone={onClose}
              />
              <div className="my-1 border-t border-[var(--ayu-border)]" />
              {linkSubmenuRow}
            </div>
          )}
        </>
      )}

      {/* MODE 3: Panel List Menu when nothing is selected & not inside a table */}
      {!hasTextSelection && !isInTable && (
        <div data-testid="context-panel-insert-section" className="space-y-0.5">
          <div className="px-2.5 pt-0.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
            {rt.contextPanelSection}
          </div>
          <ContextMenuRow
            testId="context-insert-table-btn"
            icon={<Table2 size={13.5} className="text-[var(--ayu-accent)]" />}
            label={rt.contextInsertTable}
            onClick={() => handleInsertPanel("table")}
          />
          <ContextMenuRow
            testId="context-insert-blockquote-btn"
            icon={<Quote size={13.5} className="text-[var(--ayu-accent)]" />}
            label={rt.contextAddBlockquote}
            onClick={() => handleInsertPanel("blockquote")}
          />
          <ContextMenuRow
            testId="context-insert-codeblock-btn"
            icon={<Code2 size={13.5} className="text-[var(--ayu-accent)]" />}
            label={rt.contextAddCodeBlock}
            onClick={() => handleInsertPanel("mono")}
          />
          <ContextMenuRow
            testId="context-insert-image-btn"
            icon={<ImagePlus size={13.5} className="text-[var(--ayu-accent)]" />}
            label={rt.contextInsertImage}
            onClick={() => {
              onClose();
              openImageFilePickerForEditor(editor);
            }}
          />
          {linkSubmenuRow}
        </div>
      )}

      <div className="my-1.5 border-t border-[var(--ayu-border)]" />

      {/* UNIFIED SPELLING CATEGORY ("Ortografía") */}
      <SpellingMenuSection
        misspelledWord={spellTarget?.word ?? null}
        spellcheckEnabled={spellcheckEnabled}
        onMouseDown={preventFocusLoss}
        onIgnoreWord={(word) => {
          onIgnoreWord(word);
          onClose();
        }}
        onToggleSpellcheck={(next) => {
          onToggleSpellcheck(next);
          onClose();
        }}
      />

      <div className="my-1.5 border-t border-[var(--ayu-border)]" />

      {showFormattingBarRestore && onShowFormattingBar && (
        <>
          <ContextMenuRow
            icon={<FormattingMenuIcon className="w-3.5 h-3.5" />}
            label={rt.contextShowFormattingBar}
            testId="context-show-formatting-bar-btn"
            onClick={() => {
              onShowFormattingBar();
              onClose();
            }}
          />
          <div className="my-1.5 border-t border-[var(--ayu-border)]" />
        </>
      )}

      {/* CLIPBOARD SECTION */}
      <div className="space-y-0.5">
        {selectedImage && (
          <>
            <ContextMenuRow
              icon={<Copy size={13} />}
              label={rt.imageCopyTooltip}
              testId="context-copy-image-btn"
              onClick={() => {
                void copyImageToClipboard(
                  selectedImage.src,
                  assetUrlManager.getCachedBlobUrl(selectedImage.src) ?? selectedImage.src
                );
                onClose();
              }}
            />
            <ContextMenuRow
              icon={<CopyPlus size={13} />}
              label={rt.imageDuplicateTooltip}
              testId="context-duplicate-image-btn"
              onClick={() => {
                duplicateImageNodeAt(editor, selectedImage.pos);
                onClose();
              }}
            />
          </>
        )}
        {hasTextSelection && (
          <>
            <ContextMenuRow
              icon={<Scissors size={13} />}
              label={rt.contextCut}
              onClick={() => {
                onClipboardCommand("cut");
                onClose();
              }}
            />
            <ContextMenuRow
              icon={<Copy size={13} />}
              label={rt.contextCopyFormatted}
              testId="context-copy-formatted-btn"
              onClick={() => {
                onClipboardCommand("copyFormatted");
                onClose();
              }}
            />
            <ContextMenuRow
              icon={<FileCode2 size={13} />}
              label={rt.contextCopyMarkdown}
              testId="context-copy-markdown-btn"
              onClick={() => {
                onClipboardCommand("copyMarkdown");
                onClose();
              }}
            />
          </>
        )}
        <ContextMenuRow
          icon={<ClipboardPaste size={13} />}
          label={rt.contextPaste}
          onClick={() => {
            onClipboardCommand("paste");
            onClose();
          }}
        />
        <ContextMenuRow
          icon={<CheckSquare size={13} />}
          label={rt.contextSelectAll}
          onClick={() => {
            onClipboardCommand("selectAll");
            onClose();
          }}
        />
      </div>
    </div>
  );
};

interface QuickToggleButtonProps {
  label: string;
  title: string;
  active: boolean;
  className?: string;
  onClick: () => void;
}

const QuickToggleButton: React.FC<QuickToggleButtonProps> = ({
  label,
  title,
  active,
  className = "",
  onClick,
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    onMouseDown={preventFocusLoss}
    onClick={onClick}
    className={`w-8 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${className} ${getToolbarPillButtonClass(
      active
    )}`}
  >
    {label}
  </button>
);

interface QuickToggleIconButtonProps {
  title: string;
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}

const QuickToggleIconButton: React.FC<QuickToggleIconButtonProps> = ({
  title,
  active,
  children,
  onClick,
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    onMouseDown={preventFocusLoss}
    onClick={onClick}
    className={`w-8 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${getToolbarPillButtonClass(
      active
    )}`}
  >
    {children}
  </button>
);

interface ContextMenuRowProps {
  testId?: string;
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}

const ContextMenuRow: React.FC<ContextMenuRowProps> = ({
  testId,
  icon,
  label,
  active = false,
  danger = false,
  onClick,
}) => (
  <button
    type="button"
    role="menuitem"
    data-testid={testId}
    onMouseDown={preventFocusLoss}
    onClick={onClick}
    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
      danger
        ? "text-[var(--ayu-error)] hover:bg-[var(--ayu-error)]/15"
        : active
          ? "bg-[var(--menu-active-bg)] text-[var(--ayu-editor-fg)] font-medium"
          : "text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)]"
    }`}
  >
    <span className="flex items-center gap-2 min-w-0">
      {icon && <span className="shrink-0 text-[var(--ayu-fg)]">{icon}</span>}
      <span className="truncate">{label}</span>
    </span>
    {active && <Check size={12.5} className="shrink-0 text-[var(--ayu-accent)]" />}
  </button>
);

interface SubmenuTriggerRowProps {
  testId: string;
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onToggle: () => void;
  children?: React.ReactNode;
}

const SubmenuTriggerRow: React.FC<SubmenuTriggerRowProps> = ({
  testId,
  icon,
  label,
  open,
  onActivate,
  onDeactivate,
  onToggle,
  children,
}) => (
  <div
    className="relative"
    onMouseEnter={onActivate}
    onMouseLeave={onDeactivate}
  >
    <button
      type="button"
      data-testid={testId}
      aria-expanded={open}
      onMouseDown={preventFocusLoss}
      onClick={onToggle}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
        open
          ? "bg-[var(--menu-hover-bg)] text-[var(--ayu-editor-fg)]"
          : "text-[var(--ayu-editor-fg)] hover:bg-[var(--menu-hover-bg)]"
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 text-[var(--ayu-fg)]">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <ChevronRight size={13} className="shrink-0 opacity-70" />
    </button>
    {children}
  </div>
);

interface SubmenuPanelProps {
  testId?: string;
  sideClass: string;
  widthClass?: string;
  children: React.ReactNode;
}

const SubmenuPanel: React.FC<SubmenuPanelProps> = ({
  testId,
  sideClass,
  widthClass = "w-[205px]",
  children,
}) => (
  <div className={`absolute top-0 ${sideClass} z-50`}>
    <div
      data-testid={testId}
      className={`${widthClass} rounded-xl border border-[var(--ayu-border)] bg-[var(--menu-bg)] shadow-2xl p-1.5 space-y-0.5 animate-toolbar-popover`}
    >
      {children}
    </div>
  </div>
);

interface TableMenuListProps {
  groups: TableActionGroups;
  rowsHeader: string;
  colsHeader: string;
  onActionDone: () => void;
}

const TableMenuList: React.FC<TableMenuListProps> = ({
  groups,
  rowsHeader,
  colsHeader,
  onActionDone,
}) => (
  <div className="space-y-0.5">
    <div className="px-2.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
      {rowsHeader}
    </div>
    {groups.rows.map((action) => (
      <ContextMenuRow
        key={action.id}
        label={action.label}
        onClick={() => {
          action.run();
          onActionDone();
        }}
      />
    ))}
    <div className="my-1 border-t border-[var(--ayu-border)]/70" />
    <div className="px-2.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
      {colsHeader}
    </div>
    {groups.columns.map((action) => (
      <ContextMenuRow
        key={action.id}
        label={action.label}
        onClick={() => {
          action.run();
          onActionDone();
        }}
      />
    ))}
    <div className="my-1 border-t border-[var(--ayu-border)]/70" />
    {groups.options.map((action) => (
      <ContextMenuRow
        key={action.id}
        icon={action.danger ? <Trash2 size={13} /> : undefined}
        label={action.label}
        danger={action.danger}
        onClick={() => {
          action.run();
          onActionDone();
        }}
      />
    ))}
  </div>
);
