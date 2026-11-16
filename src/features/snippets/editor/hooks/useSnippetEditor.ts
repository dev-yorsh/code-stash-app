import { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/core";
import {
  Snippet,
  CreateSnippetInput,
  UpdateSnippetInput,
  SnippetFragment,
} from "@/core/types";
import { detectLanguage } from "@/core/utils/detectLanguage";
import {
  generateNextFragmentLabel,
  getSnippetFragments,
  findMatchingFragment,
} from "@/core/utils/fragmentUtils";
import { copyPlainTextContent, RichTextCopyMode } from "../utils/richTextClipboard";

export interface UseSnippetEditorParams {
  snippet?: Snippet | null;
  activeFolderId?: string | null;
  searchQuery?: string;
  onAutoSave: (
    data: CreateSnippetInput | UpdateSnippetInput,
    existingId: string | null
  ) => Promise<Snippet>;
}

export interface CodeChangeMeta {
  isRichTextContext?: boolean;
  hasRichFormatting?: boolean;
  plainText?: string;
}

export const computeSignature = (
  effTitle: string,
  effDesc: string,
  folderId: string | null,
  tagIds: string[],
  frags: SnippetFragment[]
): string => {
  return `${effTitle}|${effDesc}|${folderId || ""}|${tagIds.join(",")}|${JSON.stringify(frags)}`;
};

export function useSnippetEditor({
  snippet,
  activeFolderId,
  searchQuery,
  onAutoSave,
}: UseSnippetEditorParams) {
  // Primary state
  const [currentId, setCurrentId] = useState<string | null>(snippet?.id || null);
  const [title, setTitle] = useState(snippet?.title || "Untitled Snippet");
  const [description, setDescription] = useState(snippet?.description || "");

  // Fragments state
  const [fragments, setFragments] = useState<SnippetFragment[]>(() =>
    getSnippetFragments(snippet)
  );
  const [activeFragmentId, setActiveFragmentId] = useState<string>(() => {
    const frags = getSnippetFragments(snippet);
    const initialFrag = findMatchingFragment(frags, searchQuery);
    return initialFrag?.id || "f-default";
  });
  const [code, setCode] = useState<string>(() => {
    const frags = getSnippetFragments(snippet);
    const initialFrag = findMatchingFragment(frags, searchQuery);
    return initialFrag ? initialFrag.code : snippet?.code || "";
  });
  const [language, setLanguage] = useState<string>(() => {
    const frags = getSnippetFragments(snippet);
    const initialFrag = findMatchingFragment(frags, searchQuery);
    const initialCode = initialFrag ? initialFrag.code : snippet?.code || "";
    const initialLang = initialFrag ? initialFrag.language : snippet?.language;
    return initialLang || detectLanguage(initialCode);
  });
  const [isManualLanguage, setIsManualLanguage] = useState<boolean>(() => {
    const frags = getSnippetFragments(snippet);
    const initialFrag = findMatchingFragment(frags, searchQuery);
    const initialLang = initialFrag ? initialFrag.language : snippet?.language;
    return Boolean(initialLang && initialLang !== "plaintext");
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    snippet?.tags?.map((t) => t.id) || []
  );
  const [newlyAddedFragmentId, setNewlyAddedFragmentId] = useState<string | null>(null);

  // Action states
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // References
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef<string>("");
  const pendingPastedLangRef = useRef<string | null>(null);
  const userExplicitlyLockedLangRef = useRef<boolean>(false);

  const isManualLanguageRef = useRef(isManualLanguage);
  const isSummaryRef = useRef(Boolean(snippet?.is_summary));
  useEffect(() => {
    isManualLanguageRef.current = isManualLanguage;
  }, [isManualLanguage]);
  useEffect(() => {
    isSummaryRef.current = Boolean(snippet?.is_summary);
  }, [snippet?.is_summary]);

  // Sync state when a different snippet is loaded
  useEffect(() => {
    userExplicitlyLockedLangRef.current = false;
    pendingPastedLangRef.current = null;
    if (snippet?.is_summary) {
      setCurrentId(snippet.id);
      return;
    }
    if (snippet) {
      setCurrentId(snippet.id);
      const initialTitle = snippet.title || "Untitled Snippet";
      setTitle(initialTitle);
      setDescription(snippet.description || "");

      const loadedFragments = getSnippetFragments(snippet);
      setFragments(loadedFragments);
      const activeFrag = findMatchingFragment(loadedFragments, searchQuery);
      setActiveFragmentId(activeFrag.id);
      setCode(activeFrag.code);
      setLanguage(activeFrag.language || "plaintext");
      const hasExplicitLang = Boolean(activeFrag.language && activeFrag.language !== "plaintext");
      setIsManualLanguage(hasExplicitLang);
      isManualLanguageRef.current = hasExplicitLang;

      const tagIds = snippet.tags?.map((t) => t.id) || [];
      setSelectedTagIds(tagIds);

      lastSavedSignatureRef.current = computeSignature(
        initialTitle,
        snippet.description || "",
        snippet.folder_id || null,
        tagIds,
        loadedFragments
      );
    } else {
      setCurrentId(null);
      setTitle("Untitled Snippet");
      setDescription("");
      const defaultFrag: SnippetFragment = {
        id: "f-" + Date.now(),
        label: "Fragment",
        code: "",
        language: "plaintext",
      };
      setFragments([defaultFrag]);
      setActiveFragmentId(defaultFrag.id);
      setCode("");
      setLanguage("plaintext");
      setIsManualLanguage(false);
      isManualLanguageRef.current = false;
      setSelectedTagIds([]);
      lastSavedSignatureRef.current = "";
    }
  }, [snippet?.id, snippet?.is_summary]);

  // Keep ref of latest state to prevent stale closures in async handlers
  const stateRef = useRef({
    currentId,
    title,
    description,
    code,
    language,
    selectedTagIds,
    activeFolderId,
    fragments,
    activeFragmentId,
  });

  useEffect(() => {
    stateRef.current = {
      currentId,
      title,
      description,
      code,
      language,
      selectedTagIds,
      activeFolderId,
      fragments,
      activeFragmentId,
    };
  }, [
    currentId,
    title,
    description,
    code,
    language,
    selectedTagIds,
    activeFolderId,
    fragments,
    activeFragmentId,
  ]);

  // Silent auto-save execution with signature deduping
  const executeSilentSave = useCallback(async () => {
    if (isSummaryRef.current) return;
    const s = stateRef.current;
    const effectiveTitle = s.title.trim() || "Untitled Snippet";

    const currentCode = s.code;
    const currentLang = s.language || "plaintext";
    const syncedFragments = s.fragments.map((f) =>
      f.id === s.activeFragmentId
        ? { ...f, code: currentCode, language: currentLang }
        : f
    );
    s.fragments = syncedFragments;

    const signature = computeSignature(
      effectiveTitle,
      s.description.trim(),
      s.activeFolderId || null,
      s.selectedTagIds,
      syncedFragments
    );
    if (signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      lastSavedSignatureRef.current = signature;
      const activeFrag =
        syncedFragments.find((f) => f.id === s.activeFragmentId) || syncedFragments[0];

      const payload: CreateSnippetInput | UpdateSnippetInput = {
        title: effectiveTitle,
        description: s.description.trim() || undefined,
        code: activeFrag ? activeFrag.code : s.code,
        language: activeFrag ? activeFrag.language : s.language,
        folder_id: s.activeFolderId || null,
        tag_ids: s.selectedTagIds,
        fragments: syncedFragments,
      };

      const saved = await onAutoSave(payload, s.currentId);
      if (!s.currentId && saved.id) {
        setCurrentId(saved.id);
        stateRef.current.currentId = saved.id;
      }
    } catch (err) {
      console.error("Silent save error:", err);
    }
  }, [onAutoSave]);

  // Trigger silent debounced auto-save (400ms)
  const triggerDebouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      executeSilentSave();
    }, 400);
  }, [executeSilentSave]);

  // Tab switching
  const handleSelectFragment = useCallback((nextId: string) => {
    if (nextId === stateRef.current.activeFragmentId) return;

    const currentCode = stateRef.current.code;
    const currentLang = stateRef.current.language || "plaintext";
    const currentFragId = stateRef.current.activeFragmentId;

    const committedFragments = stateRef.current.fragments.map((f) =>
      f.id === currentFragId
        ? { ...f, code: currentCode, language: currentLang }
        : f
    );

    const target = committedFragments.find((f) => f.id === nextId);
    if (!target) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const targetLang = target.language || "plaintext";
    const hasExplicitTargetLang = Boolean(target.language && target.language !== "plaintext");

    stateRef.current.fragments = committedFragments;
    stateRef.current.activeFragmentId = nextId;
    stateRef.current.code = target.code;
    stateRef.current.language = targetLang;

    setFragments(committedFragments);
    setActiveFragmentId(nextId);
    setCode(target.code);
    setLanguage(targetLang);
    setIsManualLanguage(hasExplicitTargetLang);
    isManualLanguageRef.current = hasExplicitTargetLang;

    executeSilentSave();
  }, [executeSilentSave]);

  // Tab adding
  const handleAddFragment = useCallback(() => {
    const currentCode = stateRef.current.code;
    const currentLang = stateRef.current.language || "plaintext";
    const currentFragId = stateRef.current.activeFragmentId;

    const committedFragments = stateRef.current.fragments.map((f) =>
      f.id === currentFragId
        ? { ...f, code: currentCode, language: currentLang }
        : f
    );

    const nextLabel = generateNextFragmentLabel(committedFragments);
    const newFrag: SnippetFragment = {
      id: "f-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      label: nextLabel,
      code: "",
      language: "plaintext",
    };

    const nextFragments = [...committedFragments, newFrag];

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    stateRef.current.fragments = nextFragments;
    stateRef.current.activeFragmentId = newFrag.id;
    stateRef.current.code = "";
    stateRef.current.language = "plaintext";

    setFragments(nextFragments);
    setActiveFragmentId(newFrag.id);
    setNewlyAddedFragmentId(newFrag.id);
    setCode("");
    setLanguage("plaintext");
    setIsManualLanguage(false);
    isManualLanguageRef.current = false;

    executeSilentSave();
  }, [executeSilentSave]);

  // Reset newlyAddedFragmentId after entrance animation completes
  useEffect(() => {
    if (newlyAddedFragmentId) {
      const timer = setTimeout(() => {
        setNewlyAddedFragmentId(null);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [newlyAddedFragmentId]);

  // Tab renaming
  const handleRenameFragment = useCallback((id: string, newLabel: string) => {
    setFragments((prev) => {
      const nextFragments = prev.map((f) =>
        f.id === id ? { ...f, label: newLabel } : f
      );
      stateRef.current.fragments = nextFragments;
      return nextFragments;
    });
    triggerDebouncedSave();
  }, [triggerDebouncedSave]);

  // Tab deleting
  const handleDeleteFragment = useCallback((id: string) => {
    if (stateRef.current.fragments.length <= 1) return;
    const nextFragments = stateRef.current.fragments.filter((f) => f.id !== id);
    let nextActiveId = stateRef.current.activeFragmentId;

    if (stateRef.current.activeFragmentId === id) {
      const deletedIdx = stateRef.current.fragments.findIndex((f) => f.id === id);
      const fallbackIdx = deletedIdx > 0 ? deletedIdx - 1 : 0;
      const fallbackFrag = nextFragments[fallbackIdx] || nextFragments[0];
      nextActiveId = fallbackFrag.id;
      const fbLang = fallbackFrag.language || "plaintext";
      const hasFbLang = Boolean(fallbackFrag.language && fallbackFrag.language !== "plaintext");

      setActiveFragmentId(fallbackFrag.id);
      setCode(fallbackFrag.code);
      setLanguage(fbLang);
      setIsManualLanguage(hasFbLang);
      isManualLanguageRef.current = hasFbLang;

      stateRef.current.code = fallbackFrag.code;
      stateRef.current.language = fbLang;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    setFragments(nextFragments);
    stateRef.current.fragments = nextFragments;
    stateRef.current.activeFragmentId = nextActiveId;
    executeSilentSave();
  }, [executeSilentSave]);

  // Tab reordering (Drag & Drop)
  const handleReorderFragments = useCallback((reorderedFragments: SnippetFragment[]) => {
    const currentCode = stateRef.current.code;
    const currentLang = stateRef.current.language || "plaintext";
    const synced = reorderedFragments.map((f) =>
      f.id === stateRef.current.activeFragmentId
        ? { ...f, code: currentCode, language: currentLang }
        : f
    );

    setFragments(synced);
    stateRef.current.fragments = synced;
    executeSilentSave();
  }, [executeSilentSave]);

  // Synchronize active fragment when a search query is entered/changed
  useEffect(() => {
    if (!searchQuery || !searchQuery.trim()) return;
    const currentFrags = stateRef.current.fragments;
    if (currentFrags.length <= 1) return;

    const targetFrag = findMatchingFragment(currentFrags, searchQuery);
    if (targetFrag && targetFrag.id !== stateRef.current.activeFragmentId) {
      handleSelectFragment(targetFrag.id);
    }
  }, [searchQuery, handleSelectFragment]);

  // Flush any pending auto-save and cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        void executeSilentSave();
      }
    };
  }, [executeSilentSave]);

  // Code change: typing or paste
  const handleCodeChange = useCallback((newCode: string, meta?: CodeChangeMeta) => {
    setCode(newCode);
    stateRef.current.code = newCode;

    let nextLanguage = stateRef.current.language;

    // If editor was cleared and language wasn't explicitly locked by user in this session, reset to auto/plaintext
    if (!newCode.trim() && !userExplicitlyLockedLangRef.current) {
      nextLanguage = "plaintext";
      pendingPastedLangRef.current = null;
      setLanguage("plaintext");
      stateRef.current.language = "plaintext";
      setIsManualLanguage(false);
      isManualLanguageRef.current = false;
    } else if (pendingPastedLangRef.current && !userExplicitlyLockedLangRef.current) {
      nextLanguage = pendingPastedLangRef.current;
      pendingPastedLangRef.current = null;
      setLanguage(nextLanguage);
      stateRef.current.language = nextLanguage;
      setIsManualLanguage(false);
      isManualLanguageRef.current = false;
    } else if (!userExplicitlyLockedLangRef.current && (!isManualLanguageRef.current || nextLanguage === "plaintext")) {
      const skipRichTextAutoDetect = Boolean(meta?.isRichTextContext && meta?.hasRichFormatting);
      if (!skipRichTextAutoDetect) {
        const textToAnalyze = meta?.isRichTextContext ? (meta.plainText ?? newCode) : newCode;
        if (textToAnalyze.trim().length > 2) {
          const sample =
            textToAnalyze.length > 3000 ? textToAnalyze.slice(0, 3000) : textToAnalyze;
          const detected = detectLanguage(sample);
          // Rich-text notes persist as Markdown under "plaintext" so they never hijack to raw Markdown code mode
          const ignoreDetectedMarkdown = Boolean(meta?.isRichTextContext && detected === "markdown");
          if (detected && !ignoreDetectedMarkdown) {
            nextLanguage = detected;
            setLanguage(detected);
            stateRef.current.language = detected;
            setIsManualLanguage(false);
            isManualLanguageRef.current = false;
          }
        }
      }
    }

    setFragments((prev) => {
      const updated = prev.map((f) =>
        f.id === stateRef.current.activeFragmentId
          ? {
              ...f,
              code: newCode,
              language: nextLanguage || f.language || "plaintext",
            }
          : f
      );
      stateRef.current.fragments = updated;
      return updated;
    });

    triggerDebouncedSave();
  }, [triggerDebouncedSave]);

  const handleLanguagePasted = useCallback((detectedLang: string) => {
    if (!userExplicitlyLockedLangRef.current) {
      pendingPastedLangRef.current = detectedLang;
      setLanguage(detectedLang);
      stateRef.current.language = detectedLang;
      setIsManualLanguage(false);
      isManualLanguageRef.current = false;
      setFragments((prev) => {
        const next = prev.map((f) =>
          f.id === stateRef.current.activeFragmentId
            ? { ...f, language: detectedLang }
            : f
        );
        stateRef.current.fragments = next;
        return next;
      });
      triggerDebouncedSave();
    }
  }, [triggerDebouncedSave]);

  const handleTitleChange = useCallback((val: string) => {
    setTitle(val);
    triggerDebouncedSave();
  }, [triggerDebouncedSave]);

  const handleTitleBlur = useCallback(() => {
    if (!stateRef.current.title.trim()) {
      setTitle("Untitled Snippet");
      stateRef.current.title = "Untitled Snippet";
      executeSilentSave();
    }
  }, [executeSilentSave]);

  const handleDescriptionChange = useCallback((val: string) => {
    setDescription(val);
    triggerDebouncedSave();
  }, [triggerDebouncedSave]);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId];
      stateRef.current.selectedTagIds = next;
      return next;
    });
    triggerDebouncedSave();
  }, [triggerDebouncedSave]);

  const selectLanguageExplicitly = useCallback((langId: string) => {
    userExplicitlyLockedLangRef.current = true;
    pendingPastedLangRef.current = null;
    setLanguage(langId);
    setIsManualLanguage(true);
    isManualLanguageRef.current = true;
    stateRef.current.language = langId;

    setFragments((prev) => {
      const nextFragments = prev.map((f) =>
        f.id === stateRef.current.activeFragmentId
          ? { ...f, language: langId }
          : f
      );
      stateRef.current.fragments = nextFragments;
      return nextFragments;
    });

    triggerDebouncedSave();
  }, [triggerDebouncedSave]);

  const resetToAutoDetect = useCallback(() => {
    userExplicitlyLockedLangRef.current = false;
    pendingPastedLangRef.current = null;
    setIsManualLanguage(false);
    isManualLanguageRef.current = false;
    const detected = detectLanguage(stateRef.current.code);
    const effLang = detected || "plaintext";
    setLanguage(effLang);
    stateRef.current.language = effLang;

    setFragments((prev) => {
      const nextFragments = prev.map((f) =>
        f.id === stateRef.current.activeFragmentId
          ? { ...f, language: effLang }
          : f
      );
      stateRef.current.fragments = nextFragments;
      return nextFragments;
    });

    triggerDebouncedSave();
  }, [triggerDebouncedSave]);

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCopiedFeedback = useCallback(() => {
    setCopied(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => {
      copyTimeoutRef.current = null;
      setCopied(false);
    }, 1600);
  }, []);

  const handleCopy = useCallback(() => {
    const rawCode = stateRef.current.code;
    if (!rawCode) return;

    if (stateRef.current.language === "plaintext") {
      void copyPlainTextContent({ code: rawCode }, "markdown");
      triggerCopiedFeedback();
      return;
    }

    navigator.clipboard.writeText(rawCode);
    triggerCopiedFeedback();
  }, [triggerCopiedFeedback]);

  const handleCopyPlainText = useCallback(
    async (mode: RichTextCopyMode, editor?: Editor | null) => {
      if (!stateRef.current.code && !editor) return;
      await copyPlainTextContent({ editor, code: stateRef.current.code }, mode);
      triggerCopiedFeedback();
    },
    [triggerCopiedFeedback]
  );

  return {
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
    executeSilentSave,
  };
}
