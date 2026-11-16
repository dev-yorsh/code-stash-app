import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";
import { ThemeDefinition } from "@/features/settings/types";
import { CODESTASH_ONEDARK_THEME } from "@/features/settings/themes";

const codeMirrorThemeCache = new Map<string, Extension>();

/**
 * Creates a dynamic CodeMirror extension matching any given ThemeDefinition.
 * Results are cached by theme ID and color fingerprint for instant reuse.
 */
export function createCodeMirrorTheme(theme: ThemeDefinition): Extension {
  const cacheKey = `${theme.id}:${theme.colors.lift}:${theme.colors.accent}:${theme.isDark}`;
  const cached = codeMirrorThemeCache.get(cacheKey);
  if (cached) return cached;

  const isDark = theme.isDark !== false;
  const { colors } = theme;

  const isOneDark = theme.id === "one-dark";
  const isCodeStashOneDark = theme.id === "codestash-onedark";
  const isSpacegray = theme.id === "codestash-spacegray";
  const isLightModern = theme.id === "codestash-light-modern";

  const viewTheme = EditorView.theme(
    {
      "&": {
        color: isCodeStashOneDark
          ? "#d7dae0"
          : isSpacegray
            ? "#dfe1e8"
            : isOneDark
              ? "#abb2bf"
              : isLightModern
                ? "#24292f"
                : colors.editorFg,
        backgroundColor: colors.lift,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--editor-font-size, 13px)",
        ...(isLightModern
          ? {
              WebkitFontSmoothing: "subpixel-antialiased",
              textRendering: "optimizeLegibility",
            }
          : {}),
      },
      ".cm-content": {
        caretColor: `var(--editor-cursor, ${isDark ? "#0a84ff" : "#007aff"})`,
        ...(isLightModern ? { fontWeight: "450" } : {}),
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: `var(--editor-cursor, ${isDark ? "#0a84ff" : "#007aff"})`,
        borderLeftWidth: "2px",
      },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: `var(--editor-selection-bg, ${
          isDark
            ? "rgba(56, 139, 253, 0.34)"
            : "rgba(0, 122, 255, 0.22)"
        }) !important`,
      },
      ".cm-content ::selection, .cm-line ::selection, .cm-line > span::selection": {
        backgroundColor: "transparent !important",
      },
      ".cm-panels": {
        backgroundColor: colors.base,
        color: isOneDark || isCodeStashOneDark ? "#abb2bf" : colors.editorFg,
      },
      ".cm-panels.cm-panels-top": {
        borderBottom: `1px solid ${colors.line}`,
      },
      ".cm-panels.cm-panels-bottom": {
        borderTop: `1px solid ${colors.line}`,
      },
      ".cm-searchMatch": {
        backgroundColor: isDark ? "rgba(10, 132, 255, 0.25)" : "rgba(0, 122, 255, 0.2)",
        outline: `1px solid ${colors.accent}`,
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: colors.accent,
        color: colors.accentOn || "#ffffff",
      },
      ".cm-activeLine": {
        backgroundColor: `var(--editor-active-line-bg, ${
          isLightModern ? "rgba(0, 0, 0, 0.03)" : "rgba(255, 255, 255, 0.04)"
        })`,
      },
      ".cm-scroller:has(.cm-selectionBackground) .cm-activeLine": {
        backgroundColor: "transparent !important",
      },
      ".cm-selectionMatch": {
        backgroundColor: `var(--editor-selection-match, ${isDark ? "rgba(56, 139, 253, 0.18)" : "rgba(0, 122, 255, 0.14)"})`,
      },
      "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
        backgroundColor: isOneDark || isCodeStashOneDark ? "rgba(97, 175, 239, 0.2)" : "rgba(0, 122, 255, 0.2)",
        outline: `1px solid ${isOneDark || isCodeStashOneDark ? "#528bff" : colors.accent}`,
      },
      ".cm-gutters": {
        backgroundColor: `var(--editor-gutter-bg, ${colors.lift})`,
        color: `var(--editor-gutter-fg, ${
          isLightModern
            ? "#aeaeb2"
            : isCodeStashOneDark
              ? "#4c5158"
              : isSpacegray
                ? "#65737e"
                : isOneDark
                  ? "#5c6370"
                  : colors.fgSubtle || colors.fg
        })`,
        border: "none !important",
        borderRight: "none !important",
      },
      ".cm-activeLineGutter": {
        backgroundColor: `var(--editor-active-line-bg, ${isLightModern ? "#f8f9fa" : colors.sunk})`,
        color: `var(--editor-gutter-active-fg, ${isDark ? "#0a84ff" : "#007aff"})`,
      },
      ".cm-foldPlaceholder": {
        backgroundColor: colors.base,
        border: `1px solid ${colors.line}`,
        color: colors.fg,
      },
      ".cm-tooltip": {
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.popup || colors.panel,
        color: isOneDark || isCodeStashOneDark ? "#abb2bf" : colors.editorFg,
      },
      ".cm-tooltip .cm-tooltip-arrow:before": {
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
      },
      ".cm-tooltip-autocomplete": {
        "& > ul > li[aria-selected]": {
          backgroundColor: isDark ? "rgba(99, 117, 153, 0.25)" : "rgba(64, 159, 255, 0.2)",
          color: isOneDark || isCodeStashOneDark ? "#abb2bf" : colors.editorFg,
        },
      },
    },
    { dark: isDark }
  );

  let highlightSpecs = [
    { tag: t.keyword, color: colors.warning },
    {
      tag: [t.operatorKeyword, t.definitionKeyword, t.moduleKeyword, t.controlKeyword],
      color: colors.warning,
    },
    { tag: t.operator, color: colors.warning },
    { tag: [t.punctuation, t.separator, t.bracket, t.paren, t.brace], color: colors.editorFg },
    { tag: t.variableName, color: colors.editorFg },
    {
      tag: [t.definition(t.variableName), t.function(t.variableName), t.function(t.propertyName)],
      color: colors.accent,
    },
    { tag: [t.typeName, t.className, t.namespace], color: colors.info },
    { tag: t.propertyName, color: colors.info },
    { tag: [t.tagName, t.angleBracket], color: isDark ? "#5ccfe6" : "#2f86d2" },
    { tag: t.attributeName, color: colors.warning },
    { tag: [t.string, t.character], color: colors.success },
    { tag: [t.regexp, t.special(t.string)], color: isDark ? "#95e6cb" : "#4cbf99" },
    { tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom], color: isDark ? "#dfbfff" : "#a37acc" },
    {
      tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
      color: colors.fg,
      fontStyle: "italic",
    },
    {
      tag: [t.heading, t.heading1, t.heading2, t.heading3],
      color: isDark ? "#f28779" : "#e65050",
      fontWeight: "bold",
    },
    { tag: t.quote, color: colors.fgSubtle || colors.fg },
    { tag: t.link, color: colors.info, textDecoration: "underline" },
    { tag: t.invalid, color: colors.error },
    { tag: t.deleted, color: colors.error },
    { tag: t.inserted, color: colors.success },
    { tag: t.changed, color: colors.info },
  ];

  if (isCodeStashOneDark) {
    // CodeStash - OneDark syntax palette matching reference screenshot
    highlightSpecs = [
      {
        tag: [t.keyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword, t.controlKeyword],
        color: "#c885de", // Orchid purple for class, def, end, attr_reader, raise, if, alias_method
      },
      { tag: t.operator, color: "#d7dae0" },
      { tag: [t.punctuation, t.separator, t.bracket, t.paren, t.brace], color: "#d7dae0" },
      { tag: t.variableName, color: "#61afef" }, // Sky blue for instance/member variables like @order, @values
      {
        tag: [t.definition(t.variableName), t.function(t.variableName), t.function(t.propertyName)],
        color: "#e06c75", // Coral red for method names like initialize, push, delete
      },
      {
        tag: [t.typeName, t.className, t.namespace],
        color: "#e5c07b", // Warm gold for classes & exceptions like ArgumentError, Heap
      },
      {
        tag: [t.definition(t.typeName), t.definition(t.className)],
        color: "#56b6c2", // Teal cyan for class definitions like BinaryHeap
      },
      { tag: t.propertyName, color: "#98c379" }, // Sage green for symbols like :values, :order, :push
      { tag: [t.tagName, t.angleBracket], color: "#e06c75" },
      { tag: t.attributeName, color: "#d19a66" },
      { tag: [t.string, t.character], color: "#98c379" }, // Sage green for strings
      { tag: [t.regexp, t.special(t.string)], color: "#56b6c2" },
      { tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom], color: "#d19a66" }, // Warm amber for numbers 1, 0
      {
        tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
        color: "#656b72", // Muted slate grey comments
        fontStyle: "italic",
      },
      {
        tag: [t.heading, t.heading1, t.heading2, t.heading3],
        color: "#e06c75",
        fontWeight: "bold",
      },
      { tag: t.quote, color: "#656b72" },
      { tag: t.link, color: "#61afef", textDecoration: "underline" },
      { tag: t.invalid, color: "#e06c75" },
      { tag: t.deleted, color: "#e06c75" },
      { tag: t.inserted, color: "#98c379" },
      { tag: t.changed, color: "#e5c07b" },
    ];
  } else if (isOneDark) {
    highlightSpecs = [
      { tag: t.keyword, color: "#c678dd" },
      {
        tag: [t.operatorKeyword, t.definitionKeyword, t.moduleKeyword, t.controlKeyword],
        color: "#c678dd",
      },
      { tag: t.operator, color: "#56b6c2" },
      { tag: [t.punctuation, t.separator, t.bracket, t.paren, t.brace], color: "#abb2bf" },
      { tag: t.variableName, color: "#e06c75" },
      {
        tag: [t.definition(t.variableName), t.function(t.variableName), t.function(t.propertyName)],
        color: "#61afef",
      },
      { tag: [t.typeName, t.className, t.namespace], color: "#e5c07b" },
      { tag: t.propertyName, color: "#e06c75" },
      { tag: [t.tagName, t.angleBracket], color: "#e06c75" },
      { tag: t.attributeName, color: "#d19a66" },
      { tag: [t.string, t.character], color: "#98c379" },
      { tag: [t.regexp, t.special(t.string)], color: "#56b6c2" },
      { tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom], color: "#d19a66" },
      {
        tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
        color: "#5c6370",
        fontStyle: "italic",
      },
      {
        tag: [t.heading, t.heading1, t.heading2, t.heading3],
        color: "#e06c75",
        fontWeight: "bold",
      },
      { tag: t.quote, color: "#5c6370" },
      { tag: t.link, color: "#61afef", textDecoration: "underline" },
      { tag: t.invalid, color: "#e06c75" },
      { tag: t.deleted, color: "#e06c75" },
      { tag: t.inserted, color: "#98c379" },
      { tag: t.changed, color: "#e5c07b" },
    ];
  } else if (isSpacegray) {
    // Spacegray / Base16 Ocean syntax palette matching reference screenshot
    highlightSpecs = [
      {
        tag: [t.keyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword, t.controlKeyword],
        color: "#b48ead", // Soft mauve purple for class, def, end, attr_reader, raise, if
      },
      { tag: t.operator, color: "#dfe1e8" },
      { tag: [t.punctuation, t.separator, t.bracket, t.paren, t.brace], color: "#dfe1e8" },
      { tag: t.variableName, color: "#8fa1b3" }, // Steel blue for instance/member variables
      {
        tag: [t.definition(t.variableName), t.function(t.variableName), t.function(t.propertyName)],
        color: "#d06f79", // Coral red for method names like initialize, push, delete
      },
      {
        tag: [t.typeName, t.className, t.namespace],
        color: "#ebcb8b", // Warm gold for classes & exceptions like ArgumentError, Heap
      },
      { tag: t.propertyName, color: "#a3be8c" }, // Sage green for symbols like :values, :order
      { tag: [t.tagName, t.angleBracket], color: "#bf616a" },
      { tag: t.attributeName, color: "#d08770" },
      { tag: [t.string, t.character], color: "#a3be8c" }, // Sage green for strings
      { tag: [t.regexp, t.special(t.string)], color: "#96b5b4" },
      { tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom], color: "#d08770" }, // Terracotta orange for numbers 1, 0
      {
        tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
        color: "#65737e", // Muted slate comments
        fontStyle: "italic",
      },
      {
        tag: [t.heading, t.heading1, t.heading2, t.heading3],
        color: "#8fa1b3",
        fontWeight: "bold",
      },
      { tag: t.quote, color: "#65737e" },
      { tag: t.link, color: "#8fa1b3", textDecoration: "underline" },
      { tag: t.invalid, color: "#bf616a" },
      { tag: t.deleted, color: "#bf616a" },
      { tag: t.inserted, color: "#a3be8c" },
      { tag: t.changed, color: "#ebcb8b" },
    ];
  } else if (isLightModern) {
    // High-definition Material Light syntax palette with crisp contrast on white background
    highlightSpecs = [
      {
        tag: [t.keyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword, t.controlKeyword],
        color: "#9c27b0", // Crisp Material Purple for class, def, end, attr_reader, raise, if
        fontWeight: "500",
      },
      { tag: t.operator, color: "#24292f" },
      { tag: [t.punctuation, t.separator, t.bracket, t.paren, t.brace], color: "#24292f" },
      { tag: t.variableName, color: "#00838f" }, // Crisp Material Cyan-Teal for instance/member variables (@order, @values)
      {
        tag: [t.definition(t.variableName), t.function(t.variableName), t.function(t.propertyName)],
        color: "#3949ab", // Crisp Material Royal Blue for methods (initialize, push, delete)
        fontWeight: "500",
      },
      {
        tag: [t.typeName, t.className, t.namespace],
        color: "#4527a0", // Crisp Deep Indigo-Violet for referenced classes & exceptions (ArgumentError, Heap)
        fontWeight: "500",
      },
      {
        tag: [t.definition(t.typeName), t.definition(t.className)],
        color: "#00695c", // Crisp Deep Teal for class definitions (BinaryHeap)
        fontWeight: "600",
      },
      { tag: t.propertyName, color: "#2e8540" }, // Crisp Material Emerald Green for symbols (:values, :order, :push)
      { tag: [t.tagName, t.angleBracket], color: "#c62828" },
      { tag: t.attributeName, color: "#9c27b0" },
      { tag: [t.string, t.character], color: "#2e8540" }, // Crisp Material Emerald Green for strings
      { tag: [t.regexp, t.special(t.string)], color: "#00838f" },
      {
        tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom],
        color: "#1976d2", // Crisp Material Blue for numbers (1, 0)
        fontWeight: "500",
      },
      {
        tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
        color: "#78858f", // Crisp readable slate-grey comments
        fontStyle: "italic",
      },
      {
        tag: [t.heading, t.heading1, t.heading2, t.heading3],
        color: "#3949ab",
        fontWeight: "bold",
      },
      { tag: t.quote, color: "#78858f" },
      { tag: t.link, color: "#1976d2", textDecoration: "underline" },
      { tag: t.invalid, color: "#c62828" },
      { tag: t.deleted, color: "#c62828" },
      { tag: t.inserted, color: "#2e8540" },
      { tag: t.changed, color: "#1976d2" },
    ];
  }

  const highlightStyle = HighlightStyle.define(highlightSpecs);
  const ext: Extension = [viewTheme, syntaxHighlighting(highlightStyle)];
  codeMirrorThemeCache.set(cacheKey, ext);
  return ext;
}

/**
 * Default CodeMirror extension (CodeStash - OneDark)
 */
export const ayuMirage: Extension = createCodeMirrorTheme(CODESTASH_ONEDARK_THEME);
