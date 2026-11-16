import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Snippet,
  Tag,
  Folder,
  CreateSnippetInput,
  UpdateSnippetInput,
} from "@/core/types";
import { FragmentTabs } from "./FragmentTabs";
import { useSettings } from "@/features/settings";
import {
  useSnippetEditor,
  SnippetHeader,
  CodeEditorPanel,
  CodeEditorPanelHandle,
  MarkdownPreviewPanel,
  RichTextEditorPanel,
  TextFormattingBar,
  EditorStatusBar,
  SnippetDeleteConfirmModal,
  useFormattingBarSessionStore,
} from "../editor";

export interface SnippetEditorProps {
  snippet?: Snippet | null;
  folder?: Folder | null;
  tags: Tag[];
  activeFolderId?: string | null;
  searchQuery?: string;
  onAutoSave: (
    data: CreateSnippetInput | UpdateSnippetInput,
    existingId: string | null
  ) => Promise<Snippet>;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}

export const SnippetEditor: React.FC<SnippetEditorProps> = ({
  snippet,
  folder: _folder,
  tags,
  activeFolderId,
  searchQuery,
  onAutoSave,
  onDelete,
  onToggleFavorite,
}) => {
  const { activeTheme, settings, updateSetting } = useSettings();
  const codeEditorRef = useRef<CodeEditorPanelHandle>(null);
  const [richEditor, setRichEditor] = useState<Editor | null>(null);
  const hasEditorFocusRef = useRef(false);

  const {
    currentId,
    title,
    description,
    code,
    language,
    isManualLanguage,
    selectedTagIds,
    fragments,
    activeFragmentId,
    newlyAddedFragmentId,
    copied,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleTitleChange,
    handleTitleBlur,
    handleDescriptionChange,
    handleCodeChange,
    handleLanguagePasted,
    handleSelectFragment,
    handleAddFragment,
    handleRenameFragment,
    handleDeleteFragment,
    handleReorderFragments,
    toggleTag,
    selectLanguageExplicitly,
    resetToAutoDetect,
    handleCopy,
    handleCopyPlainText,
  } = useSnippetEditor({
    snippet,
    activeFolderId,
    searchQuery,
    onAutoSave,
  });

  const lineCount = useMemo(() => code.split("\n").length, [code]);
  const charCount = code.length;
  const isPlainText = language === "plaintext";
  const normalizedLang = language.trim().toLowerCase();
  const isMarkdown = normalizedLang === "markdown" || normalizedLang === "md";
  const hasPlainTextContent = isPlainText && code.trim().length > 0;
  const hasMarkdownContent = isMarkdown && code.trim().length > 0;
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
  const isMarkdownPreviewActive = hasMarkdownContent && isMarkdownPreview;
  const isFormattingBarHidden = useFormattingBarSessionStore(
    (s) => s.isFormattingBarHidden
  );
  const hideFormattingBar = useFormattingBarSessionStore((s) => s.hideFormattingBar);
  const showFormattingBar = useFormattingBarSessionStore((s) => s.showFormattingBar);
  const toggleFormattingBar = useFormattingBarSessionStore((s) => s.toggleFormattingBar);
  const consumePendingRevealSnippet = useFormattingBarSessionStore(
    (s) => s.consumePendingRevealSnippet
  );
  const isFormattingBarVisible = hasPlainTextContent && !isFormattingBarHidden;
  const showFormattingBarRestore = hasPlainTextContent && isFormattingBarHidden;
  const prevIsPlainTextRef = useRef(isPlainText);
  const draftPendingRevealRef = useRef<boolean>(!snippet);
  const handledNewFragmentIdRef = useRef<string | null>(null);

  useEffect(() => {
    hasEditorFocusRef.current = false;
    draftPendingRevealRef.current = !snippet;
    setIsMarkdownPreview(false);
  }, [snippet?.id]);

  useEffect(() => {
    setIsMarkdownPreview(false);
  }, [activeFragmentId]);

  useEffect(() => {
    if (!hasMarkdownContent && isMarkdownPreview) {
      setIsMarkdownPreview(false);
    }
  }, [hasMarkdownContent, isMarkdownPreview]);

  const handleToggleMarkdownPreview = () => {
    setIsMarkdownPreview((prev) => {
      const next = !prev;
      if (!next) {
        requestAnimationFrame(() => {
          codeEditorRef.current?.focus();
        });
      }
      return next;
    });
  };

  // Reveal formatting tools once when inserting plain text into a newly created snippet or draft
  useEffect(() => {
    if (!hasPlainTextContent) return;

    if (snippet?.id) {
      consumePendingRevealSnippet(snippet.id);
      return;
    }

    if (draftPendingRevealRef.current) {
      draftPendingRevealRef.current = false;
      showFormattingBar();
    }
  }, [hasPlainTextContent, snippet?.id, consumePendingRevealSnippet, showFormattingBar]);

  // Reveal formatting tools again whenever the user adds a new fragment inside a snippet
  useEffect(() => {
    if (!newlyAddedFragmentId || handledNewFragmentIdRef.current === newlyAddedFragmentId) {
      return;
    }
    handledNewFragmentIdRef.current = newlyAddedFragmentId;
    showFormattingBar();
  }, [newlyAddedFragmentId, showFormattingBar]);

  useEffect(() => {
    if (prevIsPlainTextRef.current === isPlainText) return;
    prevIsPlainTextRef.current = isPlainText;

    if (!isPlainText) {
      setRichEditor(null);
    }

    if (hasEditorFocusRef.current) {
      const rafId = requestAnimationFrame(() => {
        codeEditorRef.current?.focus();
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isPlainText]);

  return (
    <div className="flex flex-col flex-1 min-w-0 w-full h-full bg-[var(--editor-panel-bg)] overflow-hidden">
      {/* Top Header: Title and Quick Actions */}
      <SnippetHeader
        title={title}
        description={description}
        tags={tags}
        selectedTagIds={selectedTagIds}
        isFavorite={snippet?.is_favorite}
        isCopied={copied}
        canDelete={Boolean(currentId && onDelete)}
        hasCode={Boolean(code)}
        isPlainText={isPlainText}
        showFavoriteButton={Boolean(currentId && onToggleFavorite)}
        showDeleteButton={Boolean(currentId && onDelete)}
        showFormattingBarToggle={hasPlainTextContent}
        isFormattingBarOpen={isFormattingBarVisible}
        showMarkdownPreviewToggle={hasMarkdownContent}
        isMarkdownPreviewOpen={isMarkdownPreviewActive}
        spellcheck={settings.spellcheck}
        onTitleChange={handleTitleChange}
        onTitleBlur={handleTitleBlur}
        onTitleSubmit={() => codeEditorRef.current?.focus()}
        onDescriptionChange={handleDescriptionChange}
        onToggleTag={toggleTag}
        onAddFragment={handleAddFragment}
        onToggleFavorite={
          currentId && onToggleFavorite ? () => onToggleFavorite(currentId) : undefined
        }
        onCopy={handleCopy}
        onCopyRichText={(mode) => {
          void handleCopyPlainText(mode, richEditor);
        }}
        onToggleFormattingBar={toggleFormattingBar}
        onToggleMarkdownPreview={handleToggleMarkdownPreview}
        onRequestDelete={() => setShowDeleteConfirm(true)}
      />

      {/* Fragments Tab Bar (only shown when snippet has multiple fragments) */}
      {fragments.length > 1 && (
        <div className="animate-fragment-bar shrink-0">
          <FragmentTabs
            fragments={fragments}
            activeFragmentId={activeFragmentId}
            onSelectFragment={handleSelectFragment}
            onAddFragment={handleAddFragment}
            onRenameFragment={handleRenameFragment}
            onDeleteFragment={handleDeleteFragment}
            onReorderFragments={handleReorderFragments}
            newlyAddedId={newlyAddedFragmentId}
          />
        </div>
      )}

      {/* Centered Dynamic Rich-Text Formatting Pill (Plain Text with text only) */}
      <TextFormattingBar
        editor={richEditor}
        visible={isFormattingBarVisible}
        onHideToolbar={hideFormattingBar}
      />

      {/* Main Multi-Mode Editor / Markdown Preview Panel */}
      <div
        className="flex-1 min-h-0 min-w-0 flex flex-col relative overflow-hidden"
        onFocusCapture={() => {
          hasEditorFocusRef.current = true;
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            hasEditorFocusRef.current = false;
          }
        }}
      >
        {isPlainText ? (
          <RichTextEditorPanel
            ref={codeEditorRef}
            fragmentId={activeFragmentId}
            code={code}
            isManualLanguage={isManualLanguage}
            wordWrap={settings.wordWrap}
            spellcheck={settings.spellcheck}
            isSlideAnimationActive={newlyAddedFragmentId === activeFragmentId}
            showFormattingBarRestore={showFormattingBarRestore}
            onShowFormattingBar={showFormattingBar}
            onChange={handleCodeChange}
            onLanguageDetectedOnPaste={handleLanguagePasted}
            onEditorReady={setRichEditor}
            onToggleSpellcheck={(enabled) => updateSetting("spellcheck", enabled)}
          />
        ) : isMarkdownPreviewActive ? (
          <MarkdownPreviewPanel
            code={code}
            activeTheme={activeTheme}
            isSlideAnimationActive={newlyAddedFragmentId === activeFragmentId}
          />
        ) : (
          <CodeEditorPanel
            ref={codeEditorRef}
            code={code}
            language={language}
            isManualLanguage={isManualLanguage}
            wordWrap={settings.wordWrap}
            lineNumbers={settings.lineNumbers}
            activeTheme={activeTheme}
            isSlideAnimationActive={newlyAddedFragmentId === activeFragmentId}
            onChange={handleCodeChange}
            onLanguageDetectedOnPaste={handleLanguagePasted}
            onPreviewMarkdown={hasMarkdownContent ? handleToggleMarkdownPreview : undefined}
          />
        )}
      </div>

      {/* Bottom Status / Language Bar */}
      <EditorStatusBar
        language={language}
        isManualLanguage={isManualLanguage}
        lineCount={lineCount}
        charCount={charCount}
        onSelectLanguage={selectLanguageExplicitly}
        onResetAutoDetect={resetToAutoDetect}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && currentId && onDelete && (
        <SnippetDeleteConfirmModal
          isOpen={showDeleteConfirm}
          title={title}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            onDelete(currentId);
          }}
        />
      )}
    </div>
  );
};
