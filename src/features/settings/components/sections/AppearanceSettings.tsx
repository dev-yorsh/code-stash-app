import React, { useState } from "react";
import { SettingItem, SettingsCard, SettingsSectionHeader } from "../SettingItem";
import { useSettings } from "../../context/SettingsContext";
import { BUILTIN_THEMES, THEME_CATEGORIES } from "../../themes";
import { FONT_SIZE_OPTIONS } from "../../constants";
import { useTranslation } from "@/shared/i18n";
import {
  FolderOpen,
  RefreshCw,
  Download,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  FileCode,
  Palette,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export const AppearanceSettings: React.FC = () => {
  const {
    settings,
    activeTheme,
    updateSetting,
    configFilePath,
    importCustomThemeFromFile,
    deleteCustomTheme,
    reloadConfigFromFile,
    openConfigFileLocation,
    downloadThemeTemplate,
  } = useSettings();
  const { t } = useTranslation();

  const [copiedPath, setCopiedPath] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [isReloading, setIsReloading] = useState(false);

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(configFilePath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleExploreTheme = async () => {
    setFeedback(null);
    const res = await importCustomThemeFromFile();
    if (res.success) {
      setFeedback({
        type: "success",
        text: t.settings.appearance.themeImportedSuccess(res.name || res.themeId || ""),
      });
    } else if (res.error && res.error !== "Selección cancelada.") {
      setFeedback({
        type: "error",
        text: res.error,
      });
    }
  };

  const handleReload = async () => {
    setIsReloading(true);
    setFeedback(null);
    const ok = await reloadConfigFromFile();
    setIsReloading(false);
    if (ok) {
      setFeedback({
        type: "success",
        text: t.settings.appearance.configReloadedSuccess,
      });
    } else {
      setFeedback({
        type: "error",
        text: t.settings.appearance.configReloadError,
      });
    }
  };

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title={t.settings.appearance.title}
        subtitle={t.settings.appearance.subtitle}
      />

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-xs transition-all ${
            feedback.type === "success"
              ? "bg-[var(--ayu-sunk)] border border-[var(--ayu-success)]/40 text-[var(--ayu-success)]"
              : "bg-[var(--ayu-sunk)] border border-[var(--ayu-error)]/40 text-[var(--ayu-error)]"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-auto text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Primary Appearance Controls: Theme + Font Size */}
      <SettingsCard className="divide-y divide-[var(--ayu-line)]">
        <SettingItem
          name={t.settings.appearance.themeName}
          description={t.settings.appearance.themeDescription}
        >
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <select
                  value={settings.theme}
                  onChange={(e) => updateSetting("theme", e.target.value)}
                  className="w-full bg-[var(--ayu-sunk)] border border-[var(--ayu-border)] focus:border-[var(--ayu-fg-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--ayu-editor-fg)] outline-none transition-colors cursor-pointer appearance-none pr-8"
                >
                  {THEME_CATEGORIES.map((category) => {
                    const themesInCategory = BUILTIN_THEMES.filter(
                      (thm) => thm.category === category
                    );
                    if (themesInCategory.length === 0) return null;
                    return (
                      <optgroup key={category} label={category}>
                        {themesInCategory.map((thm) => (
                          <option
                            key={thm.id}
                            value={thm.id}
                            className="bg-[var(--ayu-popup)] text-[var(--ayu-editor-fg)]"
                          >
                            {thm.name}{" "}
                            {thm.id === "codestash-onedark" ? t.common.defaultBadge : ""}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}

                  {settings.customThemes && settings.customThemes.length > 0 && (
                    <optgroup label={t.settings.appearance.customThemesGroup}>
                      {settings.customThemes.map((thm) => (
                        <option
                          key={thm.id}
                          value={thm.id}
                          className="bg-[var(--ayu-popup)] text-[var(--ayu-editor-fg)]"
                        >
                          {thm.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[var(--ayu-fg)]">
                  <Palette className="w-3.5 h-3.5" />
                </div>
              </div>

              <button
                type="button"
                onClick={handleExploreTheme}
                title={t.settings.appearance.exploreThemeTooltip}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--btn-primary-fg)] bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] border border-[var(--btn-primary-border)] transition-all shadow-xs cursor-pointer shrink-0 active:scale-95"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>{t.settings.appearance.exploreThemeButton}</span>
              </button>
            </div>

            {/* Active Theme Color Swatch Preview */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--ayu-base)]/75 border border-[var(--ayu-line)] text-[11px] text-[var(--ayu-fg)]">
              <span>{t.settings.appearance.activePaletteLabel}</span>
              <div className="flex items-center gap-1.5 ml-auto">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-black/20"
                  style={{ backgroundColor: activeTheme.colors.base }}
                  title={`Base: ${activeTheme.colors.base}`}
                />
                <span
                  className="w-3.5 h-3.5 rounded-full border border-black/20"
                  style={{ backgroundColor: activeTheme.colors.lift }}
                  title={`Lift: ${activeTheme.colors.lift}`}
                />
                <span
                  className="w-3.5 h-3.5 rounded-full border border-black/20"
                  style={{ backgroundColor: activeTheme.colors.accent }}
                  title={`Accent: ${activeTheme.colors.accent}`}
                />
                <span
                  className="w-3.5 h-3.5 rounded-full border border-black/20"
                  style={{ backgroundColor: activeTheme.colors.editorFg }}
                  title={`Editor Fg: ${activeTheme.colors.editorFg}`}
                />
                <span className="text-[10px] font-mono ml-1 text-[var(--ayu-editor-fg)]">
                  {activeTheme.isDark
                    ? t.settings.appearance.darkMode
                    : t.settings.appearance.lightMode}
                </span>
              </div>
            </div>
          </div>
        </SettingItem>

        <SettingItem
          layout="inline"
          name={t.settings.appearance.fontSizeName}
          description={t.settings.appearance.fontSizeDescription}
          note={t.settings.appearance.fontSizeNote}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={32}
              step={1}
              value={settings.fontSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 10 && val <= 32) {
                  updateSetting("fontSize", val);
                }
              }}
              className="w-20 bg-[var(--ayu-sunk)] border border-[var(--ayu-border)] focus:border-[var(--ayu-fg-subtle)] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[var(--ayu-editor-fg)] outline-none transition-colors"
            />

            <div className="flex items-center gap-1">
              {FONT_SIZE_OPTIONS.filter((s) => [12, 14, 16, 18].includes(s)).map((size) => (
                <button
                  type="button"
                  key={size}
                  onClick={() => updateSetting("fontSize", size)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                    settings.fontSize === size
                      ? "bg-[var(--ayu-lift)] text-[var(--ayu-editor-fg)] font-semibold border border-[var(--ayu-border)] shadow-xs"
                      : "bg-[var(--ayu-base)] text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] border border-[var(--ayu-line)]"
                  }`}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>
        </SettingItem>
      </SettingsCard>

      {/* Local JSON Configuration File Section with explicit Themes Tag */}
      <SettingsCard className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <FileCode className="w-4 h-4 text-[var(--ayu-fg)] shrink-0" />
            <h3 className="text-xs font-semibold text-[var(--ayu-editor-fg)]">
              {t.settings.appearance.jsonSectionTitle}
            </h3>
            <span
              data-testid="local-config-theme-tag"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--ayu-accent)]/15 text-[var(--ayu-accent)] border border-[var(--ayu-accent)]/30"
            >
              <Palette className="w-2.5 h-2.5 shrink-0" />
              <span>{t.settings.appearance.localConfigThemeTag}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleReload}
              disabled={isReloading}
              title={t.settings.appearance.reloadTooltip}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] bg-[var(--ayu-lift)] hover:bg-[var(--ayu-panel)] border border-[var(--ayu-border)] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isReloading ? "animate-spin" : ""}`} />
              <span>{t.settings.appearance.reloadButton}</span>
            </button>

            <button
              type="button"
              onClick={openConfigFileLocation}
              title={t.settings.appearance.openFolderTooltip}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] bg-[var(--ayu-lift)] hover:bg-[var(--ayu-panel)] border border-[var(--ayu-border)] transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              <span>{t.settings.appearance.openFolderButton}</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[var(--ayu-fg)] leading-relaxed">
          {t.settings.appearance.jsonDescriptionPrefix}{" "}
          <code className="px-1.5 py-0.5 rounded bg-[var(--ayu-lift)] text-[var(--ayu-editor-fg)] font-mono text-[10px] border border-[var(--ayu-line)]">
            appearance-config.json
          </code>{" "}
          {t.settings.appearance.jsonDescriptionSuffix}
        </p>

        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--ayu-base)]/75 border border-[var(--ayu-line)] font-mono text-[11px] text-[var(--ayu-fg)]">
          <span className="truncate select-all" title={configFilePath}>
            {configFilePath}
          </span>
          <button
            type="button"
            onClick={handleCopyPath}
            title={t.settings.appearance.copyPathTooltip}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:bg-[var(--ayu-panel)] transition-colors cursor-pointer shrink-0"
          >
            {copiedPath ? (
              <>
                <Check className="w-3 h-3 text-[var(--ayu-success)]" />
                <span className="text-[var(--ayu-success)] font-sans">
                  {t.settings.appearance.copiedButton}
                </span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="font-sans">{t.settings.appearance.copyButton}</span>
              </>
            )}
          </button>
        </div>

        <div className="pt-0.5 flex items-center justify-between">
          <button
            type="button"
            onClick={downloadThemeTemplate}
            className="inline-flex items-center gap-1 text-[11px] text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] hover:underline cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>{t.settings.appearance.downloadTemplateButton}</span>
          </button>
        </div>
      </SettingsCard>

      {/* Custom Themes Management (if user has imported themes) */}
      {settings.customThemes && settings.customThemes.length > 0 && (
        <SettingsCard className="p-4 space-y-2.5">
          <h3 className="text-xs font-semibold text-[var(--ayu-editor-fg)] flex items-center gap-1.5">
            <span>{t.settings.appearance.installedCustomThemesTitle}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--ayu-lift)] text-[var(--ayu-fg)] border border-[var(--ayu-line)]">
              {settings.customThemes.length}
            </span>
          </h3>

          <div className="space-y-1.5">
            {settings.customThemes.map((thm) => (
              <div
                key={thm.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--ayu-base)]/75 border border-[var(--ayu-line)]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full border border-black/20"
                    style={{ backgroundColor: thm.colors.accent }}
                  />
                  <div>
                    <span className="text-xs font-medium text-[var(--ayu-editor-fg)]">
                      {thm.name}
                    </span>
                    {thm.description && (
                      <p className="text-[10px] text-[var(--ayu-fg)]">{thm.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {settings.theme === thm.id ? (
                    <span className="text-[10px] font-medium text-[var(--ayu-editor-fg)] px-2 py-0.5 rounded bg-[var(--ayu-panel)] border border-[var(--ayu-border)]">
                      {t.settings.appearance.activeBadge}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateSetting("theme", thm.id)}
                      className="text-[10px] text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] px-2 py-0.5 rounded bg-[var(--ayu-panel)] hover:bg-[var(--ayu-sunk)] border border-[var(--ayu-border)] cursor-pointer"
                    >
                      {t.settings.appearance.activateButton}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteCustomTheme(thm.id)}
                    title={t.settings.appearance.deleteCustomThemeTooltip}
                    className="p-1 rounded text-[var(--ayu-fg)] hover:text-[var(--ayu-error)] hover:bg-[var(--ayu-error)]/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
      )}

      {/* Live Code Typography Preview */}
      <div className="pt-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ayu-fg)]">
            {t.settings.appearance.livePreviewTitle}
          </span>
          <span className="text-[10px] font-mono text-[var(--ayu-fg-subtle)]">
            {activeTheme.name} • {settings.fontSize}px
          </span>
        </div>

        <div
          className="p-4 rounded-xl border font-mono leading-relaxed transition-all shadow-inner"
          style={{
            fontSize: `${settings.fontSize}px`,
            backgroundColor: activeTheme.colors.lift,
            borderColor: activeTheme.colors.border,
            color: activeTheme.colors.editorFg,
          }}
        >
          <div style={{ color: activeTheme.colors.warning }}>
            const <span style={{ color: activeTheme.colors.accent }}>codestashTheme</span> = ():{" "}
            <span style={{ color: activeTheme.colors.info }}>string</span> =&gt; &#123;
          </div>
          <div className="pl-4" style={{ color: activeTheme.colors.fg }}>
            {t.settings.appearance.livePreviewComment(
              activeTheme.name,
              activeTheme.isDark
                ? t.settings.appearance.darkMode
                : t.settings.appearance.lightMode
            )}
          </div>
          <div className="pl-4">
            <span style={{ color: activeTheme.colors.warning }}>return</span>{" "}
            <span style={{ color: activeTheme.colors.success }}>
              {t.settings.appearance.livePreviewReturn}
            </span>
            ;
          </div>
          <div style={{ color: activeTheme.colors.warning }}>&#125;;</div>
        </div>
      </div>
    </div>
  );
};
