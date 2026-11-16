import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { CheckSquare, ClipboardPaste, Copy, Eye, Scissors } from "lucide-react";
import { createCodeMirrorTheme } from "@/core/theme/ayuMirageCodeMirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { sql } from "@codemirror/lang-sql";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { scrollbarAutoHideExtension } from "@/core/theme/codeMirrorScrollExtension";
import type { Extension } from "@codemirror/state";
import { detectLanguage } from "@/core/utils/detectLanguage";
import { ThemeDefinition } from "@/features/settings";
import { useTranslation } from "@/shared/i18n";
import {
  EditorFloatingMenu,
  EditorFloatingMenuDivider,
  EditorFloatingMenuItem,
} from "./EditorFloatingMenu";

export interface CodeEditorPanelHandle {
  focus: () => void;
}

export interface CodeEditorPanelProps {
  code: string;
  language: string;
  isManualLanguage: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
  activeTheme: ThemeDefinition;
  isSlideAnimationActive?: boolean;
  onChange: (newCode: string) => void;
  onLanguageDetectedOnPaste?: (detectedLang: string) => void;
  onPreviewMarkdown?: () => void;
}

interface CodeContextMenuState {
  anchor: { x: number; y: number };
  hasSelection: boolean;
}

function detectLanguageAfterPaste(
  view: EditorView,
  pastedText: string,
  isManualLanguage: boolean,
  onDetected?: (detectedLang: string) => void
): void {
  if (pastedText.trim().length <= 2 || !onDetected) return;

  const state = view.state;
  const sel = state.selection.main;
  const docLength = state.doc.length;
  const isReplacingNearlyAll =
    docLength === 0 ||
    state.doc.toString().trim().length === 0 ||
    sel.to - sel.from >= docLength * 0.7;

  const fullAfterPaste =
    state.doc.sliceString(0, sel.from) + pastedText + state.doc.sliceString(sel.to);

  const detectedFromPaste = detectLanguage(pastedText);
  const detected =
    detectedFromPaste !== "plaintext" ? detectedFromPaste : detectLanguage(fullAfterPaste);

  if (detected && (!isManualLanguage || isReplacingNearlyAll)) {
    onDetected(detected);
  }
}

const languageExtensionCache = new Map<string, Extension>();

function getCachedLanguageExtension(lang: string): Extension | null {
  const key = lang.toLowerCase();
  if (languageExtensionCache.has(key)) return languageExtensionCache.get(key)!;
  let ext: Extension | null = null;
  switch (key) {
    case "javascript":
    case "jsx":
      ext = javascript({ jsx: true });
      break;
    case "typescript":
    case "tsx":
      ext = javascript({ jsx: true, typescript: true });
      break;
    case "python":
      ext = python();
      break;
    case "rust":
      ext = rust();
      break;
    case "java":
      ext = java();
      break;
    case "cpp":
    case "c++":
    case "c":
      ext = cpp();
      break;
    case "sql":
      ext = sql();
      break;
    case "html":
      ext = html();
      break;
    case "css":
      ext = css();
      break;
    case "json":
      ext = json();
      break;
    case "markdown":
    case "md":
      ext = markdown();
      break;
    case "yaml":
    case "yml":
      ext = yaml();
      break;
    default:
      return null;
  }
  if (ext) languageExtensionCache.set(key, ext);
  return ext;
}

export const CodeEditorPanel = forwardRef<CodeEditorPanelHandle, CodeEditorPanelProps>(({
  code,
  language,
  isManualLanguage,
  wordWrap,
  lineNumbers,
  activeTheme,
  isSlideAnimationActive = false,
  onChange,
  onLanguageDetectedOnPaste,
  onPreviewMarkdown,
}, ref) => {
  const { t } = useTranslation();
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<CodeContextMenuState | null>(null);

  const focusEditor = useCallback(() => {
    const view = editorViewRef.current || cmRef.current?.view;
    if (view) {
      view.focus();
    }
    const contentDom =
      view?.contentDOM ||
      containerRef.current?.querySelector<HTMLElement>(".cm-content");
    if (contentDom && document.activeElement !== contentDom) {
      contentDom.focus();
    }
  }, []);

  useImperativeHandle(ref, () => ({
    focus: focusEditor,
  }), [focusEditor]);

  const cmTheme = useMemo(() => createCodeMirrorTheme(activeTheme), [activeTheme]);

  const extensions = useMemo(() => {
    const exts: Extension[] = [];

    // Scrollbar auto-hide extension: reveals only while actively scrolling
    exts.push(scrollbarAutoHideExtension);

    // Explicitly disable Chromium spellcheck inside code & Markdown source panels
    exts.push(
      EditorView.contentAttributes.of({
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",
      })
    );

    // Auto-detect language when code is pasted
    exts.push(
      EditorView.domEventHandlers({
        paste(event, view) {
          const pastedText = event.clipboardData?.getData("text/plain") || "";
          detectLanguageAfterPaste(
            view,
            pastedText,
            isManualLanguage,
            onLanguageDetectedOnPaste
          );
        },
      })
    );

    if (wordWrap) {
      exts.push(EditorView.lineWrapping);
    }

    const langExt = getCachedLanguageExtension(language);
    if (langExt) {
      exts.push(langExt);
    }

    return exts;
  }, [language, wordWrap, isManualLanguage, onLanguageDetectedOnPaste]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const view = editorViewRef.current || cmRef.current?.view;
    const cmHasSel = view ? !view.state.selection.main.empty : false;
    const domHasSel = Boolean(window.getSelection()?.toString().length);

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      hasSelection: cmHasSel || domHasSel,
    });
  }, []);

  const handleClipboardAction = useCallback(
    async (action: "cut" | "copy" | "paste" | "selectAll") => {
      const view = editorViewRef.current || cmRef.current?.view;
      setContextMenu(null);

      if (action === "selectAll") {
        if (view) {
          view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
          focusEditor();
        }
        return;
      }

      if (action === "copy" || action === "cut") {
        const sel = view?.state.selection.main;
        const selectedText =
          view && sel && !sel.empty
            ? view.state.sliceDoc(sel.from, sel.to)
            : window.getSelection()?.toString() || "";

        if (selectedText) {
          if (window.electronAPI?.writeRichClipboard) {
            await window.electronAPI.writeRichClipboard({ text: selectedText }).catch(() => {});
          } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(selectedText).catch(() => {});
          }
        }

        if (action === "cut" && view && sel && !sel.empty) {
          view.dispatch({
            changes: { from: sel.from, to: sel.to, insert: "" },
            selection: { anchor: sel.from },
          });
        }
        focusEditor();
        return;
      }

      if (action === "paste") {
        focusEditor();
        if (navigator.clipboard?.readText && view) {
          try {
            const clipText = await navigator.clipboard.readText();
            if (clipText) {
              const sel = view.state.selection.main;
              detectLanguageAfterPaste(
                view,
                clipText,
                isManualLanguage,
                onLanguageDetectedOnPaste
              );
              view.dispatch({
                changes: { from: sel.from, to: sel.to, insert: clipText },
                selection: { anchor: sel.from + clipText.length },
              });
              return;
            }
          } catch {
            // Fall through to Electron native paste command
          }
        }
        if (window.electronAPI?.executeEditCommand) {
          await window.electronAPI.executeEditCommand("paste").catch(() => {});
        }
      }
    },
    [focusEditor, isManualLanguage, onLanguageDetectedOnPaste]
  );

  const normalizedLang = language.trim().toLowerCase();
  const canPreviewMarkdown = Boolean(
    onPreviewMarkdown &&
      (normalizedLang === "markdown" || normalizedLang === "md") &&
      code.trim().length > 0
  );

  return (
    <div
      ref={containerRef}
      data-testid="code-editor-panel"
      onContextMenu={handleContextMenu}
      className={`flex-1 min-h-0 min-w-0 w-full relative overflow-hidden bg-[var(--editor-panel-bg)] select-text ${
        isSlideAnimationActive ? "animate-editor-slide-left" : ""
      }`}
    >
      <CodeMirror
        ref={cmRef}
        onCreateEditor={(view) => {
          editorViewRef.current = view;
        }}
        value={code}
        height="100%"
        width="100%"
        className="h-full w-full min-w-0"
        onChange={onChange}
        extensions={extensions}
        theme={cmTheme}
        basicSetup={{
          lineNumbers,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          history: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />

      {contextMenu && (
        <EditorFloatingMenu
          testId="code-editor-context-menu"
          anchor={contextMenu.anchor}
          onClose={() => setContextMenu(null)}
          onEscape={focusEditor}
        >
          {canPreviewMarkdown && onPreviewMarkdown && (
            <>
              <EditorFloatingMenuItem
                testId="context-preview-markdown-btn"
                icon={<Eye size={13} />}
                label={t.editor.markdown.previewTooltip}
                onClick={() => {
                  setContextMenu(null);
                  onPreviewMarkdown();
                }}
              />
              <EditorFloatingMenuDivider />
            </>
          )}
          {contextMenu.hasSelection && (
            <>
              <EditorFloatingMenuItem
                testId="code-context-cut-btn"
                icon={<Scissors size={13} />}
                label={t.editor.richText.contextCut}
                onClick={() => void handleClipboardAction("cut")}
              />
              <EditorFloatingMenuItem
                testId="code-context-copy-btn"
                icon={<Copy size={13} />}
                label={t.editor.richText.contextCopy}
                onClick={() => void handleClipboardAction("copy")}
              />
            </>
          )}
          <EditorFloatingMenuItem
            testId="code-context-paste-btn"
            icon={<ClipboardPaste size={13} />}
            label={t.editor.richText.contextPaste}
            onClick={() => void handleClipboardAction("paste")}
          />
          <EditorFloatingMenuItem
            testId="code-context-select-all-btn"
            icon={<CheckSquare size={13} />}
            label={t.editor.richText.contextSelectAll}
            onClick={() => void handleClipboardAction("selectAll")}
          />
        </EditorFloatingMenu>
      )}
    </div>
  );
});

CodeEditorPanel.displayName = "CodeEditorPanel";
