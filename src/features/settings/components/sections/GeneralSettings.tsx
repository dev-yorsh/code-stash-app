import React, { useState, useEffect } from "react";
import {
  Globe,
  Download,
  Upload,
  RefreshCw,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { SettingItem, SettingsCard, SettingsSectionHeader } from "../SettingItem";
import { Button, Modal } from "@/shared/ui";
import { useSettings } from "../../context/SettingsContext";
import { AppLanguage } from "../../types";
import { useTranslation } from "@/shared/i18n";
import {
  backupService,
  BackupSyncState,
  PendingBackupImport,
} from "@/services/backupService";
import { useSnippetStore } from "@/features/snippets/model/snippet.store";
import { useFolderStore } from "@/features/folders/model/folder.store";
import { useTagStore } from "@/features/tags/model/tag.store";

export const GeneralSettings: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const { t } = useTranslation();

  const [syncState, setSyncState] = useState<BackupSyncState>(() =>
    backupService.getSyncState()
  );
  const [pendingImport, setPendingImport] = useState<PendingBackupImport | null>(
    null
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = backupService.subscribe((nextState) => {
      setSyncState(nextState);
    });
    void backupService.refreshBackupInfo();
    return unsubscribe;
  }, []);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const handleExportBackup = async (format: "zip" | "jsonl" = "zip") => {
    setIsExporting(true);
    setFeedback(null);
    try {
      const result = await backupService.exportBackupFile(format);
      if (result.canceled) {
        return;
      }
      if (result.success && result.counts) {
        showFeedback(
          "success",
          t.settings.general.exportSuccessMessage(
            result.counts.snippets,
            result.counts.folders,
            result.counts.tags
          )
        );
      } else if (result.error) {
        showFeedback("error", result.error);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showFeedback("error", message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSelectBackupToImport = async () => {
    setFeedback(null);
    try {
      const result = await backupService.selectBackupFileForImport();
      if (result.error) {
        showFeedback("error", result.error);
        return;
      }
      if (result.canceled) {
        return;
      }
      if (result.pending) {
        setPendingImport(result.pending);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showFeedback("error", message);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    setIsImporting(true);
    try {
      const bundle = await backupService.applyBackupImport(pendingImport);

      // Update live application stores immediately
      useFolderStore.getState().setFolders(bundle.folders);
      useTagStore.getState().setTags(bundle.tags);
      useSnippetStore.getState().setSnippets(bundle.snippets);

      const firstActive = bundle.snippets.find((s) => !s.is_deleted);
      useSnippetStore
        .getState()
        .selectSnippet(firstActive ? firstActive.id : null);

      setPendingImport(null);
      showFeedback(
        "success",
        t.settings.general.importSuccessMessage(
          bundle.counts.snippets,
          bundle.counts.folders,
          bundle.counts.tags
        )
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showFeedback("error", message);
    } finally {
      setIsImporting(false);
    }
  };

  const formattedSyncTime = syncState.lastSyncedAt
    ? new Date(syncState.lastSyncedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title={t.settings.general.title}
        subtitle={t.settings.general.subtitle}
      />

      {/* Interface Language */}
      <SettingsCard>
        <SettingItem
          layout="inline"
          name={t.settings.general.languageName}
          description={t.settings.general.languageDescription}
        >
          <div className="relative w-52">
            <select
              aria-label={t.settings.general.languageName}
              value={settings.language}
              onChange={(e) =>
                updateSetting("language", e.target.value as AppLanguage)
              }
              className="w-full bg-[var(--ayu-sunk)] border border-[var(--ayu-border)] focus:border-[var(--ayu-fg-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--ayu-editor-fg)] outline-none transition-colors cursor-pointer appearance-none pr-8"
            >
              <option
                value="es"
                className="bg-[var(--ayu-popup)] text-[var(--ayu-editor-fg)]"
              >
                {t.settings.general.spanishOption}
              </option>
              <option
                value="en"
                className="bg-[var(--ayu-popup)] text-[var(--ayu-editor-fg)]"
              >
                {t.settings.general.englishOption}
              </option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[var(--ayu-fg)]">
              <Globe className="w-3.5 h-3.5" />
            </div>
          </div>
        </SettingItem>
      </SettingsCard>

      {/* Summarized & Organized Synchronization & Backup Card */}
      <SettingsCard>
        <SettingItem
          category={t.settings.general.backupCategory}
          name={t.settings.general.backupName}
          description={t.settings.general.backupDescription}
        >
          <div className="space-y-3">
            {/* Compact Status & Stats Box */}
            <div className="rounded-lg border border-[var(--ayu-line)] bg-[var(--ayu-base)]/75 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-[var(--ayu-success)]">
                  <RefreshCw
                    className={`w-3.5 h-3.5 shrink-0 ${
                      syncState.isSyncing ? "animate-spin" : ""
                    }`}
                  />
                  <span>{t.settings.general.autoSyncBadge}</span>
                </div>

                {formattedSyncTime && (
                  <span className="font-mono text-[10.5px] text-[var(--ayu-fg-subtle)] shrink-0">
                    {t.settings.general.lastSyncedLabel} {formattedSyncTime}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--ayu-line)]/70 text-[11px] text-[var(--ayu-fg)]">
                <span data-testid="backup-sync-counts">
                  {t.settings.general.autoSyncStats(
                    syncState.counts.snippets,
                    syncState.counts.folders,
                    syncState.counts.tags
                  )}
                  {(syncState.counts.assets ?? 0) > 0 && (
                    <span className="text-[var(--ayu-accent)]">
                      {" · "}
                      {t.settings.general.assetsCountLabel(syncState.counts.assets ?? 0)}
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-2 min-w-0 max-w-full">
                  <code
                    title={syncState.backupFilePath}
                    className="text-[10px] font-mono text-[var(--ayu-fg-subtle)] truncate max-w-[180px]"
                  >
                    {syncState.backupFilePath}
                  </code>
                  {typeof window !== "undefined" &&
                    window.electronAPI?.openBackupLocation && (
                      <button
                        type="button"
                        onClick={() => backupService.openBackupFileLocation()}
                        className="inline-flex items-center gap-1 text-[11px] text-[var(--ayu-fg)] hover:text-[var(--ayu-editor-fg)] transition-colors cursor-pointer shrink-0"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>{t.settings.general.openBackupLocationButton}</span>
                      </button>
                    )}
                </div>
              </div>
            </div>

            {/* Organized Export & Import Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExportBackup("zip")}
                  isLoading={isExporting}
                  data-testid="export-backup-btn"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {t.settings.general.exportBackupButton}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExportBackup("jsonl")}
                  disabled={isExporting}
                  data-testid="export-jsonl-backup-btn"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {t.settings.general.exportJsonlBackupButton}
                </Button>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSelectBackupToImport}
                disabled={isImporting}
                data-testid="import-backup-btn"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {t.settings.general.importBackupButton}
              </Button>
            </div>

            {/* Operation Feedback Banner */}
            {feedback && (
              <div
                role="status"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
                  feedback.type === "success"
                    ? "bg-[var(--ayu-success)]/10 border-[var(--ayu-success)]/30 text-[var(--ayu-success)]"
                    : "bg-[var(--ayu-error)]/10 border-[var(--ayu-error)]/30 text-[var(--ayu-error)]"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}
          </div>
        </SettingItem>
      </SettingsCard>

      {/* Confirmation Modal BEFORE Importing Backup */}
      {pendingImport && (
        <Modal
          isOpen={true}
          onClose={() => !isImporting && setPendingImport(null)}
          size="sm"
          title={t.settings.general.importConfirmModalTitle}
        >
          <div className="space-y-3" data-testid="backup-import-confirm-modal">
            <div className="flex items-start space-x-2.5 text-[var(--ayu-warning)] bg-[var(--ayu-warning)]/10 border border-[var(--ayu-warning)]/30 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[12px] text-[var(--ayu-editor-fg)] leading-relaxed">
                {t.settings.general.importConfirmModalWarning}
              </p>
            </div>

            <div className="rounded-lg bg-[var(--ayu-sunk)] border border-[var(--ayu-border)] p-2.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--ayu-fg-subtle)]">
                  {t.settings.general.importConfirmFileLabel}
                </span>
                <span className="font-mono text-[var(--ayu-editor-fg)] truncate max-w-[200px]">
                  {pendingImport.fileName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--ayu-fg-subtle)]">
                  {t.settings.general.importConfirmFormatLabel}
                </span>
                <span className="font-mono uppercase text-[var(--ayu-accent)]">
                  {pendingImport.bundle.format === "codestash-zip"
                    ? "Bundle (.codestash.zip)"
                    : pendingImport.bundle.format === "jsonl"
                      ? "NDJSON (.jsonl)"
                      : "JSON (.json)"}
                </span>
              </div>
              <div className="pt-1 border-t border-[var(--ayu-line)]/60 text-[var(--ayu-fg)] font-medium space-y-1">
                <div>
                  {t.settings.general.importConfirmSummaryLabel(
                    pendingImport.bundle.counts.snippets,
                    pendingImport.bundle.counts.folders,
                    pendingImport.bundle.counts.tags
                  )}
                </div>
                {(pendingImport.bundle.counts.assets ?? 0) > 0 && (
                  <div
                    className="text-[11px] text-[var(--ayu-accent)]"
                    data-testid="import-confirm-assets-count"
                  >
                    {t.settings.general.importConfirmAssetsLabel(
                      pendingImport.bundle.counts.assets ?? 0
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPendingImport(null)}
                disabled={isImporting}
                data-testid="cancel-import-backup-btn"
              >
                {t.common.cancel}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmImport}
                isLoading={isImporting}
                data-testid="confirm-import-backup-btn"
              >
                {t.settings.general.importConfirmButton}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
