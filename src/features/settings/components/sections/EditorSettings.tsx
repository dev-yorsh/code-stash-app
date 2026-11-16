import React from "react";
import { SettingItem, SettingsCard, SettingsSectionHeader } from "../SettingItem";
import { useSettings } from "../../context/SettingsContext";
import { useTranslation } from "@/shared/i18n";

export const EditorSettings: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title={t.settings.editorSection.title}
        subtitle={t.settings.editorSection.subtitle}
      />

      <SettingsCard className="divide-y divide-[var(--ayu-line)]">
        <SettingItem
          layout="inline"
          name={t.settings.editorSection.tabSizeName}
          description={t.settings.editorSection.tabSizeDescription}
        >
          <select
            value={settings.tabSize}
            onChange={(e) => updateSetting("tabSize", Number(e.target.value))}
            className="w-32 bg-[var(--ayu-sunk)] border border-[var(--ayu-border)] focus:border-[var(--ayu-fg-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--ayu-editor-fg)] outline-none cursor-pointer"
          >
            <option value={2} className="bg-[var(--ayu-popup)] text-[var(--ayu-editor-fg)]">
              {t.settings.editorSection.spacesCount(2)}
            </option>
            <option value={4} className="bg-[var(--ayu-popup)] text-[var(--ayu-editor-fg)]">
              {t.settings.editorSection.spacesCount(4)}
            </option>
          </select>
        </SettingItem>

        <SettingItem
          layout="inline"
          name={t.settings.editorSection.lineNumbersName}
          description={t.settings.editorSection.lineNumbersDescription}
        >
          <label className="flex items-center space-x-2 cursor-pointer select-none text-xs text-[var(--ayu-editor-fg)]">
            <input
              type="checkbox"
              checked={settings.lineNumbers}
              onChange={(e) => updateSetting("lineNumbers", e.target.checked)}
              className="accent-[var(--ayu-accent)] w-4 h-4 rounded"
            />
            <span>{t.settings.editorSection.enableLineNumbers}</span>
          </label>
        </SettingItem>

        <SettingItem
          layout="inline"
          name={t.settings.editorSection.wordWrapName}
          description={t.settings.editorSection.wordWrapDescription}
        >
          <label className="flex items-center space-x-2 cursor-pointer select-none text-xs text-[var(--ayu-editor-fg)]">
            <input
              type="checkbox"
              checked={settings.wordWrap}
              onChange={(e) => updateSetting("wordWrap", e.target.checked)}
              className="accent-[var(--ayu-accent)] w-4 h-4 rounded"
            />
            <span>{t.settings.editorSection.enableWordWrap}</span>
          </label>
        </SettingItem>

        <SettingItem
          layout="inline"
          name={t.settings.editorSection.spellcheckName}
          description={t.settings.editorSection.spellcheckDescription}
        >
          <label className="flex items-center space-x-2 cursor-pointer select-none text-xs text-[var(--ayu-editor-fg)]">
            <input
              type="checkbox"
              data-testid="settings-spellcheck-checkbox"
              checked={settings.spellcheck}
              onChange={(e) => updateSetting("spellcheck", e.target.checked)}
              className="accent-[var(--ayu-accent)] w-4 h-4 rounded"
            />
            <span>{t.settings.editorSection.enableSpellcheck}</span>
          </label>
        </SettingItem>
      </SettingsCard>
    </div>
  );
};
