import React, { useState, useRef } from "react";
import { Tag } from "@/core/types";
import { TabPlusIcon } from "@/features/snippets/components/FragmentTabs";
import { TagGlyph } from "@/features/tags";
import { useTranslation } from "@/shared/i18n";
import {
  FileText,
  FileCode2,
  Eye,
  Tag as TagIcon,
  Star,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Popover } from "@/shared/ui";
import type { RichTextCopyMode } from "../utils/richTextClipboard";
import { FormattingMenuIcon } from "./TextFormattingPopovers";

export interface SnippetHeaderProps {
  title: string;
  description: string;
  tags: Tag[];
  selectedTagIds: string[];
  isFavorite?: boolean;
  isCopied: boolean;
  canDelete: boolean;
  hasCode: boolean;
  isPlainText?: boolean;
  showFavoriteButton?: boolean;
  showDeleteButton?: boolean;
  showFormattingBarToggle?: boolean;
  isFormattingBarOpen?: boolean;
  showMarkdownPreviewToggle?: boolean;
  isMarkdownPreviewOpen?: boolean;
  spellcheck?: boolean;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onTitleSubmit?: () => void;
  onDescriptionChange: (desc: string) => void;
  onToggleTag: (tagId: string) => void;
  onAddFragment: () => void;
  onToggleFavorite?: () => void;
  onCopy: () => void;
  onCopyRichText?: (mode: RichTextCopyMode) => void;
  onToggleFormattingBar?: () => void;
  onToggleMarkdownPreview?: () => void;
  onRequestDelete?: () => void;
}

export const SnippetHeader: React.FC<SnippetHeaderProps> = ({
  title,
  description,
  tags,
  selectedTagIds,
  isFavorite = false,
  isCopied,
  canDelete: _canDelete,
  hasCode,
  isPlainText = false,
  showFavoriteButton = false,
  showDeleteButton = false,
  showFormattingBarToggle = false,
  isFormattingBarOpen = false,
  showMarkdownPreviewToggle = false,
  isMarkdownPreviewOpen = false,
  spellcheck = true,
  onTitleChange,
  onTitleBlur,
  onTitleSubmit,
  onDescriptionChange,
  onToggleTag,
  onAddFragment,
  onToggleFavorite,
  onCopy,
  onCopyRichText,
  onToggleFormattingBar,
  onToggleMarkdownPreview,
  onRequestDelete,
}) => {
  const { t } = useTranslation();
  const [isDescOpen, setIsDescOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onTitleBlur();
      if (onTitleSubmit) {
        onTitleSubmit();
      } else {
        titleInputRef.current?.blur();
      }
    }
  };

  const getHeaderToggleClassName = (isActive: boolean) =>
    `w-7 h-7 flex items-center justify-center rounded border transition-colors cursor-pointer ${
      isActive
        ? "bg-[var(--toolbar-active-bg)] text-[var(--toolbar-active-fg)] border-[var(--toolbar-active-border)] hover:bg-[var(--toolbar-active-hover-bg)]"
        : "text-[var(--ayu-fg-subtle)] border-transparent hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)]"
    }`;

  return (
    <div className="h-10 px-4 border-b border-[var(--snippet-header-border)] flex items-center justify-between bg-[var(--snippet-header-bg)] shrink-0">
      {/* Title Input */}
      <div className="flex items-center space-x-2.5 overflow-hidden flex-1 mr-3">
        <input
          ref={titleInputRef}
          type="text"
          spellCheck={spellcheck}
          placeholder={t.editor.untitledPlaceholder}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
          onKeyDown={handleTitleKeyDown}
          className="w-full bg-transparent border-0 outline-none text-[15px] font-semibold text-[var(--snippet-header-title)] placeholder-[var(--snippet-header-fg)] focus:text-[var(--snippet-header-title)] transition-colors select-text tracking-tight"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-1 shrink-0">
        {showMarkdownPreviewToggle && onToggleMarkdownPreview && (
          <button
            type="button"
            data-testid="toggle-markdown-preview-btn"
            aria-pressed={isMarkdownPreviewOpen}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggleMarkdownPreview}
            title={
              isMarkdownPreviewOpen
                ? t.editor.markdown.codeTooltip
                : t.editor.markdown.previewTooltip
            }
            aria-label={
              isMarkdownPreviewOpen
                ? t.editor.markdown.codeTooltip
                : t.editor.markdown.previewTooltip
            }
            className={getHeaderToggleClassName(isMarkdownPreviewOpen)}
          >
            <Eye className="w-4 h-4 shrink-0" />
          </button>
        )}
        {showFormattingBarToggle && onToggleFormattingBar && (
          <button
            type="button"
            data-testid="toggle-formatting-bar-btn"
            aria-pressed={isFormattingBarOpen}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggleFormattingBar}
            title={
              isFormattingBarOpen
                ? t.editor.richText.hideFormattingBarTooltip
                : t.editor.richText.showFormattingBarTooltip
            }
            aria-label={
              isFormattingBarOpen
                ? t.editor.richText.hideFormattingBarTooltip
                : t.editor.richText.showFormattingBarTooltip
            }
            className={getHeaderToggleClassName(isFormattingBarOpen)}
          >
            <FormattingMenuIcon className="w-4 h-4 shrink-0" />
          </button>
        )}
        {/* Notes / Description Popover */}
        <Popover
          isOpen={isDescOpen}
          onClose={() => setIsDescOpen(false)}
          placement="bottom-end"
          className="w-80 bg-[var(--ayu-popup)] border border-[var(--ayu-border)] flex flex-col space-y-2"
          trigger={
            <button
              type="button"
              onClick={() => {
                setIsDescOpen((prev) => !prev);
                setIsTagsOpen(false);
              }}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer relative ${
                isDescOpen || description.trim()
                  ? "text-[var(--ayu-editor-fg)] bg-[var(--ayu-lift)]"
                  : "text-[var(--ayu-fg-subtle)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)]"
              }`}
              title={t.editor.notesTooltip}
              aria-label={t.editor.notesTooltip}
            >
              <FileText className="w-3.5 h-3.5" />
              {description.trim() && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--ayu-accent)]" />
              )}
            </button>
          }
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--ayu-fg-subtle)] tracking-wider uppercase">
            <span>{t.editor.notesHeader}</span>
            <button
              type="button"
              onClick={() => setIsDescOpen(false)}
              className="text-[var(--ayu-fg-subtle)] hover:text-[var(--ayu-editor-fg)] p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            spellCheck={spellcheck}
            placeholder={t.editor.notesPlaceholder}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={4}
            className="w-full bg-[var(--ayu-sunk)] border border-[var(--ayu-line)] focus:border-[var(--ayu-border)] rounded-md p-2.5 text-xs text-[var(--ayu-editor-fg)] placeholder-[var(--ayu-fg-subtle)] outline-none resize-none leading-relaxed select-text"
            autoFocus
          />
        </Popover>

        {/* Add Fragment Tab Button */}
        <button
          type="button"
          onClick={onAddFragment}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--ayu-fg-subtle)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] transition-colors cursor-pointer"
          title={t.editor.addFragmentTooltip}
          aria-label={t.editor.addFragmentTooltip}
        >
          <TabPlusIcon className="w-3.5 h-3.5" />
        </button>

        {/* Tags Popover */}
        <Popover
          isOpen={isTagsOpen}
          onClose={() => setIsTagsOpen(false)}
          placement="bottom-end"
          className="w-64 bg-[var(--editor-tag-popover-bg)] border border-[var(--editor-tag-popover-border)] flex flex-col space-y-2"
          trigger={
            <button
              type="button"
              onClick={() => {
                setIsTagsOpen((prev) => !prev);
                setIsDescOpen(false);
              }}
              className={`h-7 px-1.5 flex items-center justify-center space-x-1 rounded transition-colors cursor-pointer ${
                isTagsOpen || selectedTagIds.length > 0
                  ? "text-[var(--ayu-editor-fg)] bg-[var(--ayu-lift)]"
                  : "text-[var(--ayu-fg-subtle)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)]"
              }`}
              title={t.editor.tagsTooltip}
              aria-label={t.editor.tagsTooltip}
            >
              <TagIcon className="w-3.5 h-3.5" />
              {selectedTagIds.length > 0 && (
                <span className="text-[10px] font-mono font-medium px-1 rounded bg-[var(--ayu-panel)] text-[var(--ayu-editor-fg)]">
                  {selectedTagIds.length}
                </span>
              )}
            </button>
          }
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--ayu-fg-subtle)] tracking-wider uppercase">
            <span>{t.editor.tagsHeader}</span>
            <span className="text-[10px] font-mono text-[var(--ayu-fg-subtle)]">
              {t.editor.tagsSelectedCount(selectedTagIds.length)}
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5 py-1">
            {tags.length === 0 ? (
              <p className="text-[11px] text-[var(--ayu-fg-subtle)] italic py-1">
                {t.editor.noTagsCreatedYet}
              </p>
            ) : (
              tags.map((tagItem) => {
                const isSelected = selectedTagIds.includes(tagItem.id);
                return (
                  <button
                    type="button"
                    key={tagItem.id}
                    onClick={() => onToggleTag(tagItem.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer text-left ${
                      isSelected
                        ? "bg-[var(--editor-tag-item-active-bg)] text-[var(--editor-tag-item-active-fg)] font-medium"
                        : "text-[var(--ayu-fg)] hover:bg-[var(--editor-tag-item-hover-bg)] hover:text-[var(--ayu-editor-fg)]"
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <TagGlyph
                        color={tagItem.color || "var(--ayu-fg)"}
                        className="w-[1em] h-[1em]"
                      />
                      <span className="truncate">{tagItem.name}</span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[var(--ayu-accent)] shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Popover>

        {/* Favorite Button */}
        {showFavoriteButton && onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--ayu-fg-subtle)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] transition-colors cursor-pointer"
            title={isFavorite ? t.editor.unmarkFavoriteTooltip : t.editor.markFavoriteTooltip}
            aria-label={t.editor.toggleFavoriteAria}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isFavorite ? "fill-[var(--ayu-fg)] text-[var(--ayu-fg)]" : ""
              }`}
            />
          </button>
        )}

        {/* Copy Button (Rich/Markdown selector for Plain Text notes, 1-click for Code) */}
        {isPlainText && onCopyRichText ? (
          <Popover
            isOpen={isCopyMenuOpen}
            onClose={() => setIsCopyMenuOpen(false)}
            className="w-64 p-1.5"
            trigger={
              <button
                type="button"
                data-testid="copy-options-trigger"
                onClick={() => setIsCopyMenuOpen((prev) => !prev)}
                disabled={!hasCode}
                className={`h-7 px-1.5 flex items-center justify-center gap-0.5 rounded transition-colors cursor-pointer ${
                  isCopied
                    ? "text-[var(--ayu-success)] bg-[var(--ayu-success)]/15"
                    : "text-[var(--ayu-fg-subtle)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] disabled:opacity-40"
                }`}
                title={isCopied ? t.editor.copiedTooltip : t.editor.copyNoteTooltip}
                aria-label={t.editor.copyNoteAria}
                aria-expanded={isCopyMenuOpen}
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <ChevronDown className="w-2.5 h-2.5 opacity-75" />
              </button>
            }
          >
            <div data-testid="copy-format-popover" className="flex flex-col gap-0.5">
              <button
                type="button"
                data-testid="copy-with-formatting-btn"
                onClick={() => {
                  onCopyRichText("formatted");
                  setIsCopyMenuOpen(false);
                }}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md text-left hover:bg-[var(--editor-tag-item-hover-bg)] transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 mt-0.5 text-[var(--ayu-accent)] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[var(--ayu-editor-fg)]">
                    {t.editor.copyWithFormatting}
                  </div>
                  <div className="text-[11px] text-[var(--ayu-fg-subtle)] truncate">
                    {t.editor.copyWithFormattingHint}
                  </div>
                </div>
              </button>

              <button
                type="button"
                data-testid="copy-as-markdown-btn"
                onClick={() => {
                  onCopyRichText("markdown");
                  setIsCopyMenuOpen(false);
                }}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md text-left hover:bg-[var(--editor-tag-item-hover-bg)] transition-colors cursor-pointer"
              >
                <FileCode2 className="w-3.5 h-3.5 mt-0.5 text-[var(--ayu-fg)] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[var(--ayu-editor-fg)]">
                    {t.editor.copyWithoutFormatting}
                  </div>
                  <div className="text-[11px] text-[var(--ayu-fg-subtle)] truncate">
                    {t.editor.copyWithoutFormattingHint}
                  </div>
                </div>
              </button>
            </div>
          </Popover>
        ) : (
          <button
            type="button"
            onClick={onCopy}
            disabled={!hasCode}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
              isCopied
                ? "text-[var(--ayu-success)] bg-[var(--ayu-success)]/15"
                : "text-[var(--ayu-fg-subtle)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-lift)] disabled:opacity-40"
            }`}
            title={isCopied ? t.editor.copiedTooltip : t.editor.copyCodeTooltip}
            aria-label={t.editor.copyCodeAria}
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Delete Button */}
        {showDeleteButton && onRequestDelete && (
          <button
            type="button"
            onClick={onRequestDelete}
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--ayu-fg-subtle)] hover:text-[var(--ayu-error)] hover:bg-[var(--ayu-error)]/15 transition-colors cursor-pointer"
            title={t.editor.deleteSnippetTooltip}
            aria-label={t.editor.deleteSnippetTooltip}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
