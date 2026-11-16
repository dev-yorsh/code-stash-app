const SPANISH_PRIORITY = ["es", "es-419", "es-ES", "es-MX", "es-AR"];
const ENGLISH_PRIORITY = ["en-US", "en-GB", "en"];

const CONTEXT_LABELS = {
  es: {
    spellingCategory: "Ortografía",
    noSuggestions: "Sin sugerencias",
    ignoreWord: "Ignorar",
    addToDictionary: "Agregar al diccionario",
    disableSpellcheck: "Desactivar ortografía",
    enableSpellcheck: "Activar ortografía",
    cut: "Cortar",
    copy: "Copiar",
    paste: "Pegar",
    selectAll: "Seleccionar todo",
  },
  en: {
    spellingCategory: "Spelling",
    noSuggestions: "No suggestions",
    ignoreWord: "Ignore",
    addToDictionary: "Add to dictionary",
    disableSpellcheck: "Disable spell check",
    enableSpellcheck: "Enable spell check",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    selectAll: "Select all",
  },
};

function pickFirstAvailable(availableLanguages, candidates, prefix) {
  const availableSet = new Set(availableLanguages);
  for (const candidate of candidates) {
    if (availableSet.has(candidate)) {
      return candidate;
    }
  }
  const lowerPrefix = prefix.toLowerCase();
  return availableLanguages.find((lang) => lang.toLowerCase().startsWith(lowerPrefix)) || null;
}

/**
 * Resolves valid Electron spellchecker language codes from `session.availableSpellCheckerLanguages`
 * so both Spanish and English work cleanly together without passing unsupported tags.
 */
function resolveSpellCheckLanguages(availableLanguages = [], preferredAppLanguage = "es") {
  if (!Array.isArray(availableLanguages) || availableLanguages.length === 0) {
    return [];
  }

  const spanishCode = pickFirstAvailable(availableLanguages, SPANISH_PRIORITY, "es");
  const englishCode = pickFirstAvailable(availableLanguages, ENGLISH_PRIORITY, "en");

  const ordered =
    preferredAppLanguage === "en" ? [englishCode, spanishCode] : [spanishCode, englishCode];
  const unique = ordered.filter((code, idx, arr) => Boolean(code) && arr.indexOf(code) === idx);

  return unique.length > 0 ? unique : [availableLanguages[0]];
}

function buildSpellingSubmenu({
  labels,
  misspelledWord,
  spellcheckEnabled,
  onIgnoreWord,
  onToggleSpellCheck,
}) {
  const submenu = [];

  if (misspelledWord) {
    submenu.push({
      label: labels.ignoreWord,
      click: () => onIgnoreWord?.(misspelledWord),
    });
  }

  if (typeof onToggleSpellCheck === "function") {
    if (submenu.length > 0) {
      submenu.push({ type: "separator" });
    }
    submenu.push({
      label: spellcheckEnabled ? labels.disableSpellcheck : labels.enableSpellcheck,
      click: () => onToggleSpellCheck(!spellcheckEnabled),
    });
  }

  return submenu;
}

/**
 * Builds a clean, localized Electron context-menu template organizing spellcheck
 * ignore and toggle actions under "Ortografía" / "Spelling" (word suggestions disabled).
 */
function buildContextMenuTemplate({
  params,
  language = "es",
  spellcheckEnabled = true,
  onReplaceMisspelling,
  onIgnoreWord,
  onAddToDictionary,
  onToggleSpellCheck,
}) {
  const labels = CONTEXT_LABELS[language === "en" ? "en" : "es"];
  const template = [];

  const misspelledWord =
    typeof params?.misspelledWord === "string" ? params.misspelledWord.trim() : "";

  if (params?.isEditable) {
    const effectiveEnabled =
      typeof params?.spellcheckEnabled === "boolean"
        ? params.spellcheckEnabled
        : spellcheckEnabled;

    if (misspelledWord || typeof onToggleSpellCheck === "function") {
      const spellingSubmenu = buildSpellingSubmenu({
        labels,
        misspelledWord,
        spellcheckEnabled: effectiveEnabled,
        onIgnoreWord,
        onToggleSpellCheck,
      });
      if (spellingSubmenu.length > 0) {
        template.push({
          label: labels.spellingCategory,
          submenu: spellingSubmenu,
        });
      }
    }
  }

  const hasSelection =
    typeof params?.selectionText === "string" && params.selectionText.trim().length > 0;
  const editFlags = params?.editFlags || {};

  if (params?.isEditable) {
    if (template.length > 0) {
      template.push({ type: "separator" });
    }
    template.push(
      { label: labels.cut, role: "cut", enabled: Boolean(editFlags.canCut) },
      { label: labels.copy, role: "copy", enabled: Boolean(editFlags.canCopy) },
      { label: labels.paste, role: "paste", enabled: Boolean(editFlags.canPaste) }
    );
    if (editFlags.canSelectAll !== false) {
      template.push({ label: labels.selectAll, role: "selectAll", enabled: true });
    }
  } else if (hasSelection) {
    if (template.length > 0) {
      template.push({ type: "separator" });
    }
    template.push({
      label: labels.copy,
      role: "copy",
      enabled: Boolean(editFlags.canCopy ?? true),
    });
  }

  return template;
}

const configuredSessions = new WeakSet();

/**
 * Attaches native Chromium spellchecker configuration and localized context-menu popup
 * handling to an Electron `BrowserWindow`.
 */
function setupWindowSpellChecker(win, { Menu, initialLanguage = "es" }) {
  let activeLanguage = initialLanguage === "en" ? "en" : "es";
  let activeEnabled = true;
  const ignoredSessionWords = new Set();
  const explicitlyAddedWords = new Set();
  let permanentWordsPromise = null;
  const ses = win.webContents.session;

  const ensurePermanentWords = async () => {
    if (permanentWordsPromise) return permanentWordsPromise;
    if (typeof ses.listWordsInSpellCheckerDictionary !== "function") {
      permanentWordsPromise = Promise.resolve(new Set());
      return permanentWordsPromise;
    }
    permanentWordsPromise = Promise.resolve(ses.listWordsInSpellCheckerDictionary())
      .then((words) => new Set(Array.isArray(words) ? words : []))
      .catch(() => new Set());
    return permanentWordsPromise;
  };

  if (!configuredSessions.has(ses)) {
    configuredSessions.add(ses);
    ses.on("spellcheck-dictionary-download-failure", (_event, languageCode) => {
      console.warn(`[SpellCheck] Dictionary download skipped/failed for "${languageCode}".`);
    });
  }

  const applySpellCheckConfig = ({ enabled = true, language } = {}) => {
    if (language === "en" || language === "es") {
      activeLanguage = language;
    }

    try {
      const nextEnabled = Boolean(enabled);
      activeEnabled = nextEnabled;
      if (typeof ses.setSpellCheckerEnabled === "function") {
        ses.setSpellCheckerEnabled(nextEnabled);
      }
      if (nextEnabled) {
        const resolvedLanguages = resolveSpellCheckLanguages(
          ses.availableSpellCheckerLanguages,
          activeLanguage
        );
        if (resolvedLanguages.length > 0) {
          ses.setSpellCheckerLanguages(resolvedLanguages);
        }
      }
      return { success: true };
    } catch (err) {
      console.error("[SpellCheck] Configuration error:", err);
      return { success: false, error: err.message };
    }
  };

  const addWordToDictionary = (word) => {
    const cleanWord = typeof word === "string" ? word.trim() : "";
    if (!cleanWord) return { success: false, error: "Word is required" };
    ignoredSessionWords.delete(cleanWord);
    explicitlyAddedWords.add(cleanWord);
    ses.addWordToSpellCheckerDictionary?.(cleanWord);
    return { success: true };
  };

  const ignoreWord = async (word) => {
    const cleanWord = typeof word === "string" ? word.trim() : "";
    if (!cleanWord) return { success: false, error: "Word is required" };
    const permanentWords = await ensurePermanentWords();
    if (!permanentWords.has(cleanWord) && !explicitlyAddedWords.has(cleanWord)) {
      ignoredSessionWords.add(cleanWord);
    }
    ses.addWordToSpellCheckerDictionary?.(cleanWord);
    return { success: true };
  };

  const cleanupIgnoredWords = () => {
    for (const word of ignoredSessionWords) {
      ses.removeWordFromSpellCheckerDictionary?.(word);
    }
    ignoredSessionWords.clear();
  };

  if (typeof win.on === "function") {
    win.on("closed", cleanupIgnoredWords);
  }

  applySpellCheckConfig({ enabled: true, language: activeLanguage });

  win.webContents.on("context-menu", (_event, params) => {
    if (win.isDestroyed()) return;

    const template = buildContextMenuTemplate({
      params,
      language: activeLanguage,
      spellcheckEnabled: activeEnabled,
      onReplaceMisspelling: (suggestion) => {
        if (!win.isDestroyed()) {
          win.webContents.replaceMisspelling(suggestion);
        }
      },
      onIgnoreWord: (word) => {
        if (!win.isDestroyed() && word) {
          void ignoreWord(word);
        }
      },
      onAddToDictionary: (word) => {
        if (!win.isDestroyed() && word) {
          addWordToDictionary(word);
        }
      },
      onToggleSpellCheck: (nextEnabled) => {
        if (!win.isDestroyed()) {
          applySpellCheckConfig({ enabled: nextEnabled });
          win.webContents.send?.("spellcheck-config-changed", { enabled: nextEnabled });
        }
      },
    });

    if (template.length > 0) {
      Menu.buildFromTemplate(template).popup({ window: win });
    }
  });

  return { applySpellCheckConfig, ignoreWord, addWordToDictionary };
}

module.exports = {
  resolveSpellCheckLanguages,
  buildContextMenuTemplate,
  setupWindowSpellChecker,
};
