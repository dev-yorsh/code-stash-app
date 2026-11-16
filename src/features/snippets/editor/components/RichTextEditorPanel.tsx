import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import type { JSONContent } from "@tiptap/core";
import { detectLanguage } from "../../../../core/utils/detectLanguage";
import { openExternalUrl } from "../../../../core/utils/openExternalUrl";
import { useTranslation } from "../../../../shared/i18n";
import {
  createRichTextExtensions,
  hasRichTextFormatting,
} from "../extensions/richTextExtensions";
import {
  findMisspelledTargetFromSelection,
  findSpellcheckTargetForInteraction,
  findTablePosAtCoords,
  isCoordsBelowDocumentContent,
  isPointerNearDocRange,
  refreshDomSpellcheck,
  safePosAtCoords,
  SpellcheckTarget,
} from "../utils/spellcheckHelpers";
import { CodeEditorPanelHandle } from "./CodeEditorPanel";
import { ClipboardCommand, RichTextContextMenu } from "./RichTextContextMenu";
import { SpellcheckQuickPopover } from "./SpellcheckQuickPopover";
import {
  copyPlainTextContent,
  extractSelectionAsJsonDoc,
} from "../utils/richTextClipboard";

export interface RichTextChangeMeta {
  isRichTextContext: true;
  hasRichFormatting: boolean;
  plainText: string;
}

import {
  dataUrlToBlob,
  extractImageFilesFromDataTransfer,
} from "../utils/imageProcessing";
import {
  insertImageFilesIntoEditor,
} from "../utils/richTextImageInsert";

export interface RichTextEditorPanelProps {
  fragmentId: string;
  code: string;
  isManualLanguage: boolean;
  wordWrap: boolean;
  spellcheck?: boolean;
  isSlideAnimationActive: boolean;
  showFormattingBarRestore?: boolean;
  onShowFormattingBar?: () => void;
  onChange: (newCode: string, meta?: RichTextChangeMeta) => void;
  onLanguageDetectedOnPaste: (detectedLang: string) => void;
  onEditorReady?: (editor: Editor | null) => void;
  onToggleSpellcheck?: (enabled: boolean) => void;
}

interface ContextMenuState {
  anchor: { x: number; y: number };
  hasTextSelection: boolean;
  isInTable: boolean;
  clickedBelowContent: boolean;
  selectedImage: { pos: number; src: string } | null;
  spellTarget: SpellcheckTarget | null;
}

interface QuickSpellPopoverState {
  target: SpellcheckTarget;
  position: { x: number; y: number };
}

function isClipboardCodeHtml(html: string): boolean {
  if (!html) return false;
  return /<pre[\s>]|font-family:\s*[^;]*(?:monospace|consolas|courier|fira|jetbrains|menlo|monaco)|class="[^"]*(?:hljs|shiki|language-|monaco|view-line|token)[^"]*"/i.test(
    html
  );
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function insertPlainTextIntoCodeBlock(
  view: Editor["view"],
  text: string
): boolean {
  const { from, to } = view.state.selection;
  const normalized = normalizeLineEndings(text);
  view.dispatch(view.state.tr.insertText(normalized, from, to).scrollIntoView());
  return true;
}

function insertUnifiedCodeBlock(
  view: Editor["view"],
  text: string
): boolean {
  const codeBlockType = view.state.schema.nodes.codeBlock;
  if (!codeBlockType) {
    return false;
  }
  const normalized = normalizeLineEndings(text);
  const contentNode = normalized ? view.state.schema.text(normalized) : undefined;
  const codeBlockNode = codeBlockType.create(null, contentNode);
  view.dispatch(view.state.tr.replaceSelectionWith(codeBlockNode).scrollIntoView());
  return true;
}

/**
 * WYSIWYG Markdown-backed rich text editor (`Tiptap v3`) rendered when a fragment
 * is in Plain Text (`"plaintext"`) mode, storing Markdown cleanly in `fragment.code`.
 */
export const RichTextEditorPanel = memo(
  forwardRef<CodeEditorPanelHandle, RichTextEditorPanelProps>(
    (
      {
        fragmentId,
        code,
        isManualLanguage,
        wordWrap,
        spellcheck = true,
        isSlideAnimationActive,
        showFormattingBarRestore = false,
        onShowFormattingBar,
        onChange,
        onLanguageDetectedOnPaste,
        onEditorReady,
        onToggleSpellcheck,
      },
      ref
    ) => {
      const { t } = useTranslation();
      const scrollerRef = useRef<HTMLDivElement>(null);
      const [isScrolling, setIsScrolling] = useState(false);
      const [localSpellcheck, setLocalSpellcheck] = useState(spellcheck);
      const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
      const [quickSpellPopover, setQuickSpellPopover] =
        useState<QuickSpellPopoverState | null>(null);

      // Keep latest callbacks/props in refs because Tiptap's useEditor binds handlers on mount
      const fragmentIdRef = useRef(fragmentId);
      const isManualLanguageRef = useRef(isManualLanguage);
      const onChangeRef = useRef(onChange);
      const onLanguageDetectedOnPasteRef = useRef(onLanguageDetectedOnPaste);
      const spellcheckRef = useRef(localSpellcheck);
      const contextMenuOpenRef = useRef(false);
      const contextSelectionDocRef = useRef<JSONContent | null>(null);
      const ignoredWordsRef = useRef<Set<string>>(new Set());
      const pointerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
      const editorRef = useRef<Editor | null>(null);

      fragmentIdRef.current = fragmentId;
      isManualLanguageRef.current = isManualLanguage;
      onChangeRef.current = onChange;
      onLanguageDetectedOnPasteRef.current = onLanguageDetectedOnPaste;
      spellcheckRef.current = localSpellcheck;
      contextMenuOpenRef.current = contextMenuState !== null;

      useEffect(() => {
        setLocalSpellcheck(spellcheck);
        if (!spellcheck) {
          setQuickSpellPopover(null);
        }
      }, [spellcheck]);

      useEffect(() => {
        return () => {
          if (pointerTimerRef.current) {
            clearTimeout(pointerTimerRef.current);
          }
        };
      }, []);

      const lastSyncedRef = useRef<{ fragmentId: string; code: string }>({
        fragmentId,
        code,
      });

      const extensions = useMemo(() => createRichTextExtensions(), []);

      const editor = useEditor(
        {
          extensions,
          content: code,
          contentType: "markdown",
          editorProps: {
            attributes: {
              class: "codestash-tiptap-doc focus:outline-none",
              spellcheck: localSpellcheck ? "true" : "false",
            },
            handleDOMEvents: {
              keydown: (_view, event) => {
                if (!["Shift", "Control", "Alt", "Meta"].includes(event.key)) {
                  setQuickSpellPopover(null);
                }
                return false;
              },
              click: (_view, event) => {
                if (event.button !== 0 || !(event.target instanceof Element)) {
                  return false;
                }
                const anchor = event.target.closest("a");
                if (!anchor) {
                  return false;
                }
                const selection = window.getSelection();
                if (selection && !selection.isCollapsed && selection.toString().length > 0) {
                  return false;
                }
                const href = anchor.getAttribute("href");
                if (!href || href.startsWith("#")) {
                  return false;
                }
                event.preventDefault();
                void openExternalUrl(href);
                return false;
              },
            },
            handleDrop: (view, event, _slice, moved) => {
              if (moved) return false;
              const imageFiles = extractImageFilesFromDataTransfer(event.dataTransfer);
              if (imageFiles.length === 0) return false;

              event.preventDefault();
              event.stopPropagation();
              const coords = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              const activeEditor = editorRef.current;
              if (activeEditor) {
                void insertImageFilesIntoEditor(activeEditor, imageFiles, coords?.pos);
              }
              return true;
            },
            handlePaste: (view, event) => {
              const imageFiles = extractImageFilesFromDataTransfer(event.clipboardData);
              if (imageFiles.length > 0) {
                event.preventDefault();
                const activeEditor = editorRef.current;
                if (activeEditor) {
                  void insertImageFilesIntoEditor(activeEditor, imageFiles);
                }
                return true;
              }

              const pastedText = event.clipboardData?.getData("text/plain") ?? "";
              if (!pastedText.trim()) {
                const pastedHtml = event.clipboardData?.getData("text/html") ?? "";
                const dataImgMatch = /<img[^>]+src=["'](data:image\/[^"']+)["']/i.exec(pastedHtml);
                if (dataImgMatch) {
                  const blob = dataUrlToBlob(dataImgMatch[1]);
                  if (blob && editorRef.current) {
                    event.preventDefault();
                    void insertImageFilesIntoEditor(editorRef.current, [blob]);
                    return true;
                  }
                }
                return false;
              }

              const { $from, from, to } = view.state.selection;
              const isInsideCodeBlock = $from.parent.type.name === "codeBlock";
              const codeMarkType = view.state.schema.marks.code;
              const isInsideInlineCode = Boolean(
                codeMarkType &&
                  (view.state.storedMarks?.some((m) => m.type === codeMarkType) ||
                    $from.marks().some((m) => m.type === codeMarkType))
              );

              // Inside Monoestilo (codeBlock / inline code): keep raw multi-line code in ONE block
              if (isInsideCodeBlock) {
                event.preventDefault();
                return insertPlainTextIntoCodeBlock(view, pastedText);
              }
              if (isInsideInlineCode && normalizeLineEndings(pastedText).includes("\n")) {
                event.preventDefault();
                return insertUnifiedCodeBlock(view, pastedText);
              }

              const pastedHtml = event.clipboardData?.getData("text/html") ?? "";

              // Detect real programming languages and raw Markdown source pastes
              const detected = detectLanguage(pastedText);
              const docSize = view.state.doc.content.size;
              const isDocEmpty = view.state.doc.textContent.trim().length === 0;
              const isSelectingAll = from <= 1 && to >= docSize - 1;
              const isMultiLine = normalizeLineEndings(pastedText).includes("\n");
              const allowMarkdownSwitch =
                detected === "markdown" && (isDocEmpty || isSelectingAll || isMultiLine);
              const shouldAutoSwitchLanguage =
                Boolean(detected && detected !== "plaintext") &&
                (detected !== "markdown" || allowMarkdownSwitch) &&
                !(isManualLanguageRef.current && !isDocEmpty && !isSelectingAll);

              if (!shouldAutoSwitchLanguage || !detected) {
                if (
                  normalizeLineEndings(pastedText).includes("\n") &&
                  isClipboardCodeHtml(pastedHtml)
                ) {
                  event.preventDefault();
                  return insertUnifiedCodeBlock(view, pastedText);
                }
                return false;
              }

              event.preventDefault();

              let nextCode = pastedText;
              if (!isDocEmpty && !isSelectingAll) {
                const beforeText = view.state.doc.textBetween(0, from, "\n", "\n");
                const afterText = view.state.doc.textBetween(to, docSize, "\n", "\n");
                nextCode = `${beforeText}${pastedText}${afterText}`;
              }

              onLanguageDetectedOnPasteRef.current(detected);
              onChangeRef.current(nextCode);
              return true;
            },
          },
          onUpdate: ({ editor: ed }) => {
            setQuickSpellPopover(null);
            const markdown = ed.getMarkdown();
            const plainText = ed.getText({ blockSeparator: "\n" });
            const hasFormatting = hasRichTextFormatting(ed);

            lastSyncedRef.current = {
              fragmentId: fragmentIdRef.current,
              code: markdown,
            };

            onChangeRef.current(markdown, {
              isRichTextContext: true,
              hasRichFormatting: hasFormatting,
              plainText,
            });
          },
        },
        [extensions]
      );

      editorRef.current = editor;

      useImperativeHandle(
        ref,
        () => ({
          focus: () => {
            editor?.commands.focus();
          },
        }),
        [editor]
      );

      useEffect(() => {
        onEditorReady?.(editor);
        return () => {
          onEditorReady?.(null);
        };
      }, [editor, onEditorReady]);

      // Update DOM spellcheck dynamically when toggled without re-mounting
      useEffect(() => {
        if (editor?.view?.dom) {
          editor.view.dom.setAttribute("spellcheck", localSpellcheck ? "true" : "false");
        }
      }, [editor, localSpellcheck]);

      // Sync incoming code/fragment changes without resetting cursor after own edits
      useEffect(() => {
        if (!editor) return;
        if (
          lastSyncedRef.current.fragmentId === fragmentId &&
          lastSyncedRef.current.code === code
        ) {
          return;
        }

        lastSyncedRef.current = { fragmentId, code };
        editor.commands.setContent(code, { emitUpdate: false, contentType: "markdown" });
      }, [editor, fragmentId, code]);

      const showPlaceholder = useEditorState({
        editor,
        selector: ({ editor: ed }) => {
          if (!ed) return false;
          const firstChild = ed.state.doc.firstChild;
          return (
            ed.isEmpty &&
            ed.state.doc.childCount === 1 &&
            firstChild?.type.name === "paragraph"
          );
        },
      });

      // Auto-hide custom scrollbar when user stops scrolling (matches CodeMirror behavior)
      useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;

        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const handleScroll = () => {
          setIsScrolling(true);
          setQuickSpellPopover(null);
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => setIsScrolling(false), 800);
        };

        el.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
          el.removeEventListener("scroll", handleScroll);
          if (timeoutId) clearTimeout(timeoutId);
        };
      }, []);

      const handleIgnoreWord = useCallback(
        (word: string) => {
          const trimmed = word.trim();
          if (!trimmed) return;
          ignoredWordsRef.current.add(trimmed);
          ignoredWordsRef.current.add(trimmed.toLowerCase());
          setQuickSpellPopover(null);

          const triggerRefresh = () => {
            refreshDomSpellcheck(editor?.view?.dom, () => spellcheckRef.current);
          };

          if (window.electronAPI?.ignoreSpellCheckWord) {
            void window.electronAPI.ignoreSpellCheckWord(trimmed).finally(triggerRefresh);
          } else {
            triggerRefresh();
          }
        },
        [editor]
      );

      const handleToggleSpellcheckState = useCallback(
        (nextEnabled: boolean) => {
          setLocalSpellcheck(nextEnabled);
          spellcheckRef.current = nextEnabled;
          if (!nextEnabled) {
            setQuickSpellPopover(null);
          }
          onToggleSpellcheck?.(nextEnabled);
        },
        [onToggleSpellcheck]
      );

      const handleClipboardCommand = useCallback(
        (command: ClipboardCommand) => {
          if (!editor) return;

          if (command === "selectAll") {
            editor.commands.focus();
            editor.commands.selectAll();
            return;
          }

          if (command === "copyFormatted" || command === "copy") {
            const source = !editor.state.selection.empty
              ? { editor, selectionOnly: true }
              : contextSelectionDocRef.current
                ? { docOverride: contextSelectionDocRef.current }
                : null;
            if (source) {
              void copyPlainTextContent(source, "formatted");
            }
            editor.commands.focus();
            return;
          }

          if (command === "copyMarkdown") {
            const source = !editor.state.selection.empty
              ? { editor, selectionOnly: true }
              : contextSelectionDocRef.current
                ? { docOverride: contextSelectionDocRef.current }
                : null;
            if (source) {
              void copyPlainTextContent(source, "markdown");
            }
            editor.commands.focus();
            return;
          }

          if (command === "cut") {
            const hasLiveSel = !editor.state.selection.empty;
            const source = hasLiveSel
              ? { editor, selectionOnly: true }
              : contextSelectionDocRef.current
                ? { docOverride: contextSelectionDocRef.current }
                : null;
            if (!source) return;
            void copyPlainTextContent(source, "formatted").finally(() => {
              if (!editor.state.selection.empty) {
                editor.commands.deleteSelection();
              }
              editor.commands.focus();
            });
            return;
          }

          editor.commands.focus();

          if (window.electronAPI?.executeEditCommand) {
            void window.electronAPI.executeEditCommand(command);
            return;
          }

          if (command === "paste" && navigator.clipboard?.readText) {
            void navigator.clipboard.readText().then((clipText) => {
              if (clipText) {
                editor.chain().focus().insertContent(clipText).run();
              }
            });
          }
        },
        [editor]
      );

      const handleMouseUp = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
          if (e.button !== 0 || !editor || !spellcheckRef.current) return;
          if (!window.electronAPI?.isWordMisspelled) return;

          const clickCoords = { x: e.clientX, y: e.clientY };
          if (pointerTimerRef.current) {
            clearTimeout(pointerTimerRef.current);
          }

          pointerTimerRef.current = setTimeout(() => {
            if (contextMenuOpenRef.current || !spellcheckRef.current) return;
            const checker = window.electronAPI?.isWordMisspelled;
            if (!checker) return;

            const target = findMisspelledTargetFromSelection(
              editor,
              checker,
              ignoredWordsRef.current,
              true
            );

            if (!target) {
              setQuickSpellPopover(null);
              return;
            }

            if (
              editor.state.selection.empty &&
              !isPointerNearDocRange(editor.view, target.from, target.to, clickCoords)
            ) {
              setQuickSpellPopover(null);
              return;
            }

            const startRect = editor.view.coordsAtPos(target.from);
            const isZeroBox = startRect.bottom === 0 && startRect.left === 0;
            const anchorX = isZeroBox ? clickCoords.x : startRect.left;
            const anchorY = isZeroBox ? clickCoords.y + 20 : startRect.bottom + 6;

            setQuickSpellPopover({
              target,
              position: { x: anchorX, y: anchorY },
            });
          }, 0);
        },
        [editor]
      );

      const handleContextMenu = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
          if (!editor) return;
          e.preventDefault();
          e.stopPropagation();

          if (pointerTimerRef.current) {
            clearTimeout(pointerTimerRef.current);
          }
          setQuickSpellPopover(null);

          const coords = { x: e.clientX, y: e.clientY };
          const tablePos = findTablePosAtCoords(editor, coords);
          const alreadyInTable = editor.isActive("table");
          const isInTable = alreadyInTable || tablePos !== null;

          if (tablePos !== null && editor.state.selection.empty) {
            editor.commands.setTextSelection(tablePos);
          }

          const { selection, doc } = editor.state;
          const selectedImage =
            selection instanceof NodeSelection && selection.node.type.name === "image"
              ? {
                  pos: selection.from,
                  src: String(selection.node.attrs.src ?? ""),
                }
              : null;
          const hasTextSelection =
            !selection.empty &&
            (doc.textBetween(selection.from, selection.to, " ", " ").trim().length > 0 ||
              "$anchorCell" in selection);
          contextSelectionDocRef.current = hasTextSelection
            ? extractSelectionAsJsonDoc(editor)
            : null;
          const clickedBelowContent =
            !hasTextSelection &&
            !selectedImage &&
            !isInTable &&
            isCoordsBelowDocumentContent(editor.view, coords);

          if (selection.empty && !isInTable && !clickedBelowContent) {
            const posAtPointer = safePosAtCoords(editor.view, coords);
            if (posAtPointer) {
              editor.commands.setTextSelection(posAtPointer.pos);
            }
          }

          const checker = window.electronAPI?.isWordMisspelled;
          const spellTarget =
            spellcheckRef.current && checker
              ? findSpellcheckTargetForInteraction(
                  editor,
                  coords,
                  checker,
                  ignoredWordsRef.current
                )
              : null;

          setContextMenuState({
            anchor: coords,
            hasTextSelection,
            isInTable,
            clickedBelowContent,
            selectedImage,
            spellTarget,
          });
        },
        [editor]
      );

      return (
        <div
          data-testid="rich-text-editor-panel"
          data-word-wrap={wordWrap ? "true" : "false"}
          onContextMenu={handleContextMenu}
          onMouseUp={handleMouseUp}
          className={`codestash-tiptap flex-1 min-h-0 min-w-0 w-full flex flex-col relative overflow-hidden bg-[var(--editor-panel-bg)] select-text ${
            isSlideAnimationActive ? "animate-tab-slide-in" : ""
          }`}
        >
          <div
            ref={scrollerRef}
            className={`rich-editor-scroller min-w-0 w-full relative cursor-text ${
              isScrolling ? "cm-is-scrolling" : ""
            }`}
          >
            {showPlaceholder && (
              <div
                aria-hidden="true"
                className="pointer-events-none select-none absolute top-[18px] left-6 right-6 text-[var(--ayu-fg-subtle)]/70 text-[15px] leading-relaxed"
              >
                {t.editor.richText.placeholder}
              </div>
            )}
            <EditorContent editor={editor} className="codestash-tiptap-content w-full min-w-0 select-text" />
          </div>

          {editor && contextMenuState && (
            <RichTextContextMenu
              editor={editor}
              anchor={contextMenuState.anchor}
              hasTextSelection={contextMenuState.hasTextSelection}
              isInTable={contextMenuState.isInTable}
              clickedBelowContent={contextMenuState.clickedBelowContent}
              selectedImage={contextMenuState.selectedImage}
              spellTarget={contextMenuState.spellTarget}
              spellcheckEnabled={localSpellcheck}
              showFormattingBarRestore={showFormattingBarRestore}
              onShowFormattingBar={onShowFormattingBar}
              onIgnoreWord={handleIgnoreWord}
              onToggleSpellcheck={handleToggleSpellcheckState}
              onClipboardCommand={handleClipboardCommand}
              onClose={() => setContextMenuState(null)}
            />
          )}

          {editor && !contextMenuState && quickSpellPopover && (
            <SpellcheckQuickPopover
              target={quickSpellPopover.target}
              position={quickSpellPopover.position}
              spellcheckEnabled={localSpellcheck}
              onIgnoreWord={handleIgnoreWord}
              onToggleSpellcheck={handleToggleSpellcheckState}
              onClose={() => setQuickSpellPopover(null)}
            />
          )}
        </div>
      );
    }
  )
);

RichTextEditorPanel.displayName = "RichTextEditorPanel";
