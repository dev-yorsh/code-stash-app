import { invoke } from "@tauri-apps/api/core";
import { Folder, Snippet, SnippetFragment, Tag } from "@/core/types";
import {
  assetRepository,
  folderRepository,
  isIndexedDbAvailable,
  isTauriEnvironment,
  snippetRepository,
  tagRepository,
} from "@/shared/api/repository.factory";
import {
  FALLBACK_STORAGE_KEYS,
  registerStorageMutationListener,
} from "@/shared/api/fallback/fallback-storage";
import {
  registerIndexedDbMutationListener,
  replaceAllIndexedDbCollections,
} from "@/shared/api/idb/codestashIndexedDb";
import { pruneOrphanAssetsForSnippets } from "@/shared/api/assets/assetGarbageCollector";
import { assetUrlManager } from "@/shared/api/assets/assetUrlManager";
import { isZipMagicBytes } from "./zipArchive";
import {
  BackupAssetBinary,
  BackupCounts,
  BackupZipManifest,
  ParsedBackupBundle,
  PendingBackupImport,
  parseZipBackupBytes,
  serializeBackupToZipBundle,
} from "./backupBundle";

export type {
  BackupAssetBinary,
  BackupCounts,
  BackupZipManifest,
  ParsedBackupBundle,
  PendingBackupImport,
};
export { parseZipBackupBytes, serializeBackupToZipBundle };

export const BACKUP_SYNC_META_STORAGE_KEY = "codestash_backup_sync_meta";
export const AUTO_BACKUP_DEFAULT_FILENAME = "codestash-backup.jsonl";

export interface BackupMetadataRecord {
  record_type: "metadata";
  schema_version: number;
  format: "jsonl";
  app: "CodeStash";
  exported_at: string;
  counts: BackupCounts;
}

export interface BackupFolderRecord {
  record_type: "folder";
  data: Folder;
}

export interface BackupTagRecord {
  record_type: "tag";
  data: Tag;
}

export interface BackupSnippetRecord {
  record_type: "snippet";
  data: Snippet;
}

export type BackupRecord =
  | BackupMetadataRecord
  | BackupFolderRecord
  | BackupTagRecord
  | BackupSnippetRecord;

export interface BackupSyncState {
  lastSyncedAt: string | null;
  backupFilePath: string;
  counts: BackupCounts;
  sizeBytes: number;
  isSyncing: boolean;
}

type SyncListener = (state: BackupSyncState) => void;

const listeners = new Set<SyncListener>();

function readRawLocal<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined" || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeRawLocal<T>(key: string, value: T): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.error("[BackupService] Failed to write localStorage key:", key, e);
  }
}

let currentSyncState: BackupSyncState = (() => {
  const savedMeta = readRawLocal<Partial<BackupSyncState>>(BACKUP_SYNC_META_STORAGE_KEY, {});
  const folders = readRawLocal<Folder[]>(FALLBACK_STORAGE_KEYS.FOLDERS, []);
  const tags = readRawLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []);
  const snippets = readRawLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);

  return {
    lastSyncedAt: savedMeta.lastSyncedAt ?? null,
    backupFilePath: savedMeta.backupFilePath ?? `./${AUTO_BACKUP_DEFAULT_FILENAME}`,
    counts: savedMeta.counts ?? {
      folders: folders.length,
      tags: tags.length,
      snippets: snippets.length,
    },
    sizeBytes: savedMeta.sizeBytes ?? 0,
    isSyncing: false,
  };
})();

let lastSyncedPayloadSignature = "";

function notifyListeners(): void {
  const snapshot = { ...currentSyncState, counts: { ...currentSyncState.counts } };
  listeners.forEach((listener) => listener(snapshot));
}

function normalizeFolder(raw: unknown): Folder | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id.trim()) return null;
  if (typeof obj.name !== "string" || !obj.name.trim()) return null;

  return {
    id: obj.id.trim(),
    name: obj.name.trim(),
    icon: typeof obj.icon === "string" ? obj.icon : "folder",
    parent_id: typeof obj.parent_id === "string" && obj.parent_id.trim() ? obj.parent_id : null,
    created_at:
      typeof obj.created_at === "string" && obj.created_at
        ? obj.created_at
        : new Date().toISOString(),
  };
}

function normalizeTag(raw: unknown): Tag | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id.trim()) return null;
  if (typeof obj.name !== "string" || !obj.name.trim()) return null;

  return {
    id: obj.id.trim(),
    name: obj.name.trim(),
    color: typeof obj.color === "string" && obj.color.trim() ? obj.color : "#ffcc66",
  };
}

function normalizeFragment(raw: unknown, index: number, fallbackLang: string): SnippetFragment | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.code !== "string") return null;

  return {
    id: typeof obj.id === "string" && obj.id.trim() ? obj.id : `frag-${index + 1}`,
    label: typeof obj.label === "string" && obj.label.trim() ? obj.label : `Fragment ${index + 1}`,
    code: obj.code,
    language:
      typeof obj.language === "string" && obj.language.trim() ? obj.language : fallbackLang,
  };
}

function normalizeSnippet(raw: unknown, knownTagsMap: Map<string, Tag>): Snippet | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id.trim()) return null;
  if (typeof obj.title !== "string") return null;

  const language =
    typeof obj.language === "string" && obj.language.trim() ? obj.language : "plaintext";
  const code = typeof obj.code === "string" ? obj.code : "";
  const nowIso = new Date().toISOString();

  const rawTags = Array.isArray(obj.tags) ? obj.tags : [];
  const normalizedTags: Tag[] = [];
  for (const item of rawTags) {
    const tag = normalizeTag(item);
    if (tag) {
      if (!knownTagsMap.has(tag.id)) {
        knownTagsMap.set(tag.id, tag);
      }
      normalizedTags.push(knownTagsMap.get(tag.id) || tag);
    }
  }

  const rawFragments = Array.isArray(obj.fragments) ? obj.fragments : [];
  const fragments = rawFragments
    .map((frag, idx) => normalizeFragment(frag, idx, language))
    .filter((f): f is SnippetFragment => f !== null);

  return {
    id: obj.id.trim(),
    title: obj.title,
    description: typeof obj.description === "string" ? obj.description : "",
    code,
    language,
    folder_id:
      typeof obj.folder_id === "string" && obj.folder_id.trim() ? obj.folder_id : null,
    is_favorite: Boolean(obj.is_favorite),
    tags: normalizedTags,
    created_at:
      typeof obj.created_at === "string" && obj.created_at ? obj.created_at : nowIso,
    updated_at:
      typeof obj.updated_at === "string" && obj.updated_at ? obj.updated_at : nowIso,
    fragments:
      fragments.length > 0
        ? fragments
        : [
            {
              id: `${obj.id.trim()}-f1`,
              label: "Fragment",
              code,
              language,
            },
          ],
    is_deleted: Boolean(obj.is_deleted),
    deleted_at:
      typeof obj.deleted_at === "string" && obj.deleted_at ? obj.deleted_at : null,
  };
}

/**
 * Serializes all folders, tags, and snippets into NDJSON / JSON Lines (`.jsonl`) format.
 * Each entity is written on an independent single line for O(1) streaming scalability on large backups.
 */
export function serializeBackupToJsonl(payload: {
  folders: Folder[];
  tags: Tag[];
  snippets: Snippet[];
  exportedAt?: string;
}): string {
  const exportedAt = payload.exportedAt || new Date().toISOString();
  const lines: string[] = [];

  const metadata: BackupMetadataRecord = {
    record_type: "metadata",
    schema_version: 1,
    format: "jsonl",
    app: "CodeStash",
    exported_at: exportedAt,
    counts: {
      folders: payload.folders.length,
      tags: payload.tags.length,
      snippets: payload.snippets.length,
    },
  };
  lines.push(JSON.stringify(metadata));

  for (const folder of payload.folders) {
    const record: BackupFolderRecord = { record_type: "folder", data: folder };
    lines.push(JSON.stringify(record));
  }

  for (const tag of payload.tags) {
    const record: BackupTagRecord = { record_type: "tag", data: tag };
    lines.push(JSON.stringify(record));
  }

  for (const snippet of payload.snippets) {
    const record: BackupSnippetRecord = { record_type: "snippet", data: snippet };
    lines.push(JSON.stringify(record));
  }

  return lines.join("\n") + "\n";
}

/**
 * Parses and validates either a streaming `.jsonl` (NDJSON) backup file or a standard `.json` backup file.
 */
export function parseBackupContent(rawContent: string): ParsedBackupBundle {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    throw new Error("El archivo de copia de seguridad está vacío.");
  }

  const foldersMap = new Map<string, Folder>();
  const tagsMap = new Map<string, Tag>();
  const snippetsMap = new Map<string, Snippet>();
  let exportedAt = new Date().toISOString();
  let schemaVersion = 1;

  const firstLine = trimmed.split(/\r?\n/, 1)[0]?.trim() || "";
  const isJsonl = firstLine.includes('"record_type"');

  if (isJsonl) {
    const lines = trimmed.split(/\r?\n/);
    let validRecordCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let parsedLine: unknown;
      try {
        parsedLine = JSON.parse(line);
      } catch {
        throw new Error(`Error de formato en la línea ${i + 1} del archivo .jsonl.`);
      }

      if (!parsedLine || typeof parsedLine !== "object") {
        throw new Error(`Registro inválido en la línea ${i + 1}.`);
      }

      const rec = parsedLine as Record<string, unknown>;
      const recordType = rec.record_type;

      if (recordType === "metadata") {
        validRecordCount++;
        if (typeof rec.exported_at === "string" && rec.exported_at) {
          exportedAt = rec.exported_at;
        }
        if (typeof rec.schema_version === "number") {
          schemaVersion = rec.schema_version;
        }
      } else if (recordType === "folder") {
        const folder = normalizeFolder(rec.data);
        if (!folder) {
          throw new Error(`Carpeta inválida en la línea ${i + 1}.`);
        }
        foldersMap.set(folder.id, folder);
        validRecordCount++;
      } else if (recordType === "tag") {
        const tag = normalizeTag(rec.data);
        if (!tag) {
          throw new Error(`Etiqueta inválida en la línea ${i + 1}.`);
        }
        tagsMap.set(tag.id, tag);
        validRecordCount++;
      } else if (recordType === "snippet") {
        const snippet = normalizeSnippet(rec.data, tagsMap);
        if (!snippet) {
          throw new Error(`Snippet inválido en la línea ${i + 1}.`);
        }
        snippetsMap.set(snippet.id, snippet);
        validRecordCount++;
      } else {
        throw new Error(`Tipo de registro desconocido en la línea ${i + 1}: ${String(recordType)}`);
      }
    }

    if (validRecordCount === 0) {
      throw new Error("No se encontraron registros válidos en el archivo de respaldo.");
    }

    const folders = Array.from(foldersMap.values());
    const tags = Array.from(tagsMap.values());
    const snippets = Array.from(snippetsMap.values());

    return {
      format: "jsonl",
      schemaVersion,
      exportedAt,
      folders,
      tags,
      snippets,
      counts: {
        folders: folders.length,
        tags: tags.length,
        snippets: snippets.length,
      },
    };
  }

  // Fallback support for standard structured JSON backup `{ folders, tags, snippets }`
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(trimmed);
  } catch {
    throw new Error("El archivo seleccionado no tiene un formato .jsonl o .json válido.");
  }

  if (!parsedJson || typeof parsedJson !== "object") {
    throw new Error("Estructura de respaldo JSON inválida.");
  }

  const root = parsedJson as Record<string, unknown>;
  if (
    !Array.isArray(root.snippets) &&
    !Array.isArray(root.folders) &&
    !Array.isArray(root.tags)
  ) {
    throw new Error(
      "El archivo JSON no contiene colecciones de CodeStash (snippets, folders, tags)."
    );
  }

  if (typeof root.exported_at === "string" && root.exported_at) {
    exportedAt = root.exported_at;
  }
  if (typeof root.schema_version === "number") {
    schemaVersion = root.schema_version;
  }

  if (Array.isArray(root.folders)) {
    for (const rawFolder of root.folders) {
      const f = normalizeFolder(rawFolder);
      if (f) foldersMap.set(f.id, f);
    }
  }

  if (Array.isArray(root.tags)) {
    for (const rawTag of root.tags) {
      const t = normalizeTag(rawTag);
      if (t) tagsMap.set(t.id, t);
    }
  }

  if (Array.isArray(root.snippets)) {
    for (const rawSnippet of root.snippets) {
      const s = normalizeSnippet(rawSnippet, tagsMap);
      if (s) snippetsMap.set(s.id, s);
    }
  }

  const folders = Array.from(foldersMap.values());
  const tags = Array.from(tagsMap.values());
  const snippets = Array.from(snippetsMap.values());

  return {
    format: "json",
    schemaVersion,
    exportedAt,
    folders,
    tags,
    snippets,
    counts: {
      folders: folders.length,
      tags: tags.length,
      snippets: snippets.length,
    },
  };
}

let debouncedSyncTimer: ReturnType<typeof setTimeout> | null = null;
let activeAsyncSync: Promise<BackupSyncState> | null = null;
let queuedSyncAfterActive = false;
let queuedSyncForce = false;

async function readDatasetsForBackup(): Promise<{
  folders: Folder[];
  tags: Tag[];
  snippets: Snippet[];
  assetCount: number;
}> {
  if (isTauriEnvironment()) {
    const jsonlContent = await invoke<string>("export_backup");
    const parsed = parseBackupContent(jsonlContent);
    const metas = await assetRepository.listMeta().catch(() => []);
    return {
      folders: parsed.folders,
      tags: parsed.tags,
      snippets: parsed.snippets,
      assetCount: metas.length,
    };
  }

  if (isIndexedDbAvailable()) {
    const [folders, tags, snippets, metas] = await Promise.all([
      folderRepository.getAll(),
      tagRepository.getAll(),
      snippetRepository.getAll(),
      assetRepository.listMeta().catch(() => []),
    ]);
    return {
      folders,
      tags,
      snippets,
      assetCount: metas.length,
    };
  }

  const folders = readRawLocal<Folder[]>(FALLBACK_STORAGE_KEYS.FOLDERS, []);
  const tags = readRawLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []);
  const snippets = readRawLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
  const metas = await assetRepository.listMeta().catch(() => []);
  return {
    folders,
    tags,
    snippets,
    assetCount: metas.length,
  };
}

function buildCountsWithOptionalAssets(
  folders: Folder[],
  tags: Tag[],
  snippets: Snippet[],
  assetCount: number
): BackupCounts {
  return assetCount > 0
    ? {
        folders: folders.length,
        tags: tags.length,
        snippets: snippets.length,
        assets: assetCount,
      }
    : {
        folders: folders.length,
        tags: tags.length,
        snippets: snippets.length,
      };
}

function runFallbackAutoSyncNow(force: boolean): Promise<BackupSyncState> | BackupSyncState {
  const folders = readRawLocal<Folder[]>(FALLBACK_STORAGE_KEYS.FOLDERS, []);
  const tags = readRawLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []);
  const snippets = readRawLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);

  const currentSignature = JSON.stringify({ folders, tags, snippets });
  const hasSavedMeta =
    readRawLocal<Partial<BackupSyncState> | null>(BACKUP_SYNC_META_STORAGE_KEY, null) !== null;
  if (
    !force &&
    hasSavedMeta &&
    lastSyncedPayloadSignature &&
    currentSignature === lastSyncedPayloadSignature
  ) {
    return backupService.getSyncState();
  }
  lastSyncedPayloadSignature = currentSignature;

  currentSyncState = { ...currentSyncState, isSyncing: true };
  notifyListeners();

  const now = new Date().toISOString();
  const jsonl = serializeBackupToJsonl({
    folders,
    tags,
    snippets,
    exportedAt: now,
  });

  const baseSizeBytes = new Blob([jsonl]).size;

  const commitState = (filePath: string, updatedAt: string, sizeBytes: number) => {
    currentSyncState = {
      lastSyncedAt: updatedAt,
      backupFilePath: filePath,
      counts: {
        folders: folders.length,
        tags: tags.length,
        snippets: snippets.length,
      },
      sizeBytes,
      isSyncing: false,
    };
    writeRawLocal(BACKUP_SYNC_META_STORAGE_KEY, currentSyncState);
    notifyListeners();
    return backupService.getSyncState();
  };

  if (typeof window !== "undefined" && window.electronAPI?.writeAutoBackup) {
    return (async () => {
      let filePath = currentSyncState.backupFilePath;
      let updatedAt = now;
      let sizeBytes = baseSizeBytes;
      try {
        const res = await window.electronAPI!.writeAutoBackup!(jsonl);
        if (res.success) {
          filePath = res.path || filePath;
          updatedAt = res.updatedAt || now;
          sizeBytes = res.sizeBytes ?? sizeBytes;
        }
      } catch (err) {
        console.warn("[BackupService] Electron writeAutoBackup error:", err);
      }
      return commitState(filePath, updatedAt, sizeBytes);
    })();
  }

  return commitState(currentSyncState.backupFilePath, now, baseSizeBytes);
}

async function executeAsyncAutoSync(force: boolean): Promise<BackupSyncState> {
  if (isTauriEnvironment()) {
    currentSyncState = { ...currentSyncState, isSyncing: true };
    notifyListeners();
    const syncedPath = await invoke<string | null>("sync_backup_now");
    const metas = await assetRepository.listMeta().catch(() => []);
    const now = new Date().toISOString();
    currentSyncState = {
      ...currentSyncState,
      lastSyncedAt: now,
      backupFilePath: syncedPath || currentSyncState.backupFilePath,
      counts: {
        ...currentSyncState.counts,
        ...(metas.length > 0 ? { assets: metas.length } : {}),
      },
      isSyncing: false,
    };
    writeRawLocal(BACKUP_SYNC_META_STORAGE_KEY, currentSyncState);
    notifyListeners();
    return backupService.getSyncState();
  }

  const { folders, tags, snippets, assetCount } = await readDatasetsForBackup();

  const currentSignature = JSON.stringify({ folders, tags, snippets });
  const hasSavedMeta =
    readRawLocal<Partial<BackupSyncState> | null>(BACKUP_SYNC_META_STORAGE_KEY, null) !== null;
  if (
    !force &&
    hasSavedMeta &&
    lastSyncedPayloadSignature &&
    currentSignature === lastSyncedPayloadSignature
  ) {
    return backupService.getSyncState();
  }
  lastSyncedPayloadSignature = currentSignature;

  currentSyncState = { ...currentSyncState, isSyncing: true };
  notifyListeners();

  const now = new Date().toISOString();
  const jsonl = serializeBackupToJsonl({
    folders,
    tags,
    snippets,
    exportedAt: now,
  });

  let filePath = currentSyncState.backupFilePath;
  let updatedAt = now;
  let sizeBytes = new Blob([jsonl]).size;

  if (typeof window !== "undefined" && window.electronAPI?.writeAutoBackup) {
    try {
      const res = await window.electronAPI.writeAutoBackup(jsonl);
      if (res.success) {
        filePath = res.path || filePath;
        updatedAt = res.updatedAt || now;
        sizeBytes = res.sizeBytes ?? sizeBytes;
      }
    } catch (err) {
      console.warn("[BackupService] Electron writeAutoBackup error:", err);
    }
  }

  currentSyncState = {
    lastSyncedAt: updatedAt,
    backupFilePath: filePath,
    counts: buildCountsWithOptionalAssets(folders, tags, snippets, assetCount),
    sizeBytes,
    isSyncing: false,
  };

  writeRawLocal(BACKUP_SYNC_META_STORAGE_KEY, currentSyncState);
  notifyListeners();
  return backupService.getSyncState();
}

function triggerDownloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Normalizes IPC or serialized binary buffer payloads into a `Uint8Array`.
 */
function toUint8Array(raw: unknown): Uint8Array | null {
  if (!raw) return null;
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  }
  if (Array.isArray(raw)) {
    return new Uint8Array(raw);
  }
  return null;
}

export const backupService = {
  /**
   * Returns current synchronization state snapshot.
   */
  getSyncState(): BackupSyncState {
    return { ...currentSyncState, counts: { ...currentSyncState.counts } };
  },

  /**
   * Subscribes to live CRUD synchronization updates.
   */
  subscribe(listener: SyncListener): () => void {
    listeners.add(listener);
    listener(this.getSyncState());
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Refreshes backup file metadata from active repositories and Electron on mount.
   */
  async refreshBackupInfo(): Promise<BackupSyncState> {
    const { folders, tags, snippets, assetCount } = isTauriEnvironment()
      ? {
          folders: await folderRepository.getAll().catch(() => []),
          tags: await tagRepository.getAll().catch(() => []),
          snippets: await snippetRepository.getAll().catch(() => []),
          assetCount: (await assetRepository.listMeta().catch(() => [])).length,
        }
      : await readDatasetsForBackup();

    lastSyncedPayloadSignature = JSON.stringify({ folders, tags, snippets });

    currentSyncState = {
      ...currentSyncState,
      counts: buildCountsWithOptionalAssets(folders, tags, snippets, assetCount),
    };

    if (typeof window !== "undefined" && window.electronAPI?.getBackupInfo) {
      try {
        const info = await window.electronAPI.getBackupInfo();
        if (info.success) {
          currentSyncState = {
            ...currentSyncState,
            backupFilePath: info.path || currentSyncState.backupFilePath,
            lastSyncedAt: info.updatedAt || currentSyncState.lastSyncedAt,
            sizeBytes: info.sizeBytes ?? currentSyncState.sizeBytes,
          };
        }
      } catch (e) {
        console.warn("[BackupService] Could not query Electron backup info:", e);
      }
    }

    writeRawLocal(BACKUP_SYNC_META_STORAGE_KEY, currentSyncState);
    notifyListeners();
    return this.getSyncState();
  },

  /**
   * Schedules a debounced auto-sync (default 1500ms) for high-throughput IndexedDB edits.
   */
  scheduleAutoBackupSync(delayMs = 1500): void {
    if (debouncedSyncTimer !== null) {
      clearTimeout(debouncedSyncTimer);
    }
    debouncedSyncTimer = setTimeout(() => {
      debouncedSyncTimer = null;
      void this.syncAllToAutoBackup();
    }, delayMs);
  },

  /**
   * Flushes any pending debounced auto-sync immediately (used before app unload).
   */
  async flushAutoBackupSync(): Promise<BackupSyncState> {
    if (debouncedSyncTimer !== null) {
      clearTimeout(debouncedSyncTimer);
      debouncedSyncTimer = null;
      return this.syncAllToAutoBackup();
    }
    if (activeAsyncSync) {
      return activeAsyncSync;
    }
    return this.getSyncState();
  },

  /**
   * Automatically synchronizes all current data (Folders, Tags, Snippets) into the
   * persistent `.jsonl` backup file whenever any CRUD operation happens.
   */
  async syncAllToAutoBackup(force = false): Promise<BackupSyncState> {
    try {
      // Preserve synchronous write invocation before any microtask yield for Fallback tests.
      if (!isTauriEnvironment() && !isIndexedDbAvailable()) {
        return await runFallbackAutoSyncNow(force);
      }

      if (activeAsyncSync) {
        queuedSyncAfterActive = true;
        queuedSyncForce = queuedSyncForce || force;
        return await activeAsyncSync;
      }

      const runCoalesced = async (initialForce: boolean): Promise<BackupSyncState> => {
        let state = await executeAsyncAutoSync(initialForce);
        while (queuedSyncAfterActive) {
          const nextForce = queuedSyncForce;
          queuedSyncAfterActive = false;
          queuedSyncForce = false;
          state = await executeAsyncAutoSync(nextForce);
        }
        return state;
      };

      activeAsyncSync = runCoalesced(force).finally(() => {
        activeAsyncSync = null;
      });
      return await activeAsyncSync;
    } catch (err) {
      console.error("[BackupService] Failed to sync auto backup:", err);
      currentSyncState = { ...currentSyncState, isSyncing: false };
      notifyListeners();
      return this.getSyncState();
    }
  },

  /**
   * Opens the auto-synced backup file location in the native OS file explorer.
   */
  async openBackupFileLocation(): Promise<void> {
    if (typeof window !== "undefined" && window.electronAPI?.openBackupLocation) {
      await window.electronAPI.openBackupLocation();
    }
  },

  /**
   * Exports user data as a portable `.codestash.zip` bundle (default, includes deduplicated images)
   * or lightweight text-only `.jsonl`.
   */
  async exportBackupFile(format: "zip" | "jsonl" = "zip"): Promise<{
    success: boolean;
    canceled?: boolean;
    filePath?: string;
    counts?: BackupCounts;
    error?: string;
  }> {
    try {
      const { folders, tags, snippets } = await readDatasetsForBackup();
      const exportedAt = new Date().toISOString();
      const jsonlContent = serializeBackupToJsonl({
        folders,
        tags,
        snippets,
        exportedAt,
      });
      const dateStamp = exportedAt.slice(0, 10);

      if (format === "jsonl") {
        const counts: BackupCounts = {
          folders: folders.length,
          tags: tags.length,
          snippets: snippets.length,
        };
        const defaultFileName = `codestash-backup-${dateStamp}.jsonl`;

        if (typeof window !== "undefined" && window.electronAPI?.exportBackupFile) {
          const res = await window.electronAPI.exportBackupFile({
            content: jsonlContent,
            defaultFileName,
          });
          if (res.canceled) {
            return { success: false, canceled: true };
          }
          if (!res.success) {
            return { success: false, error: res.error || "Error al exportar archivo." };
          }
          return {
            success: true,
            filePath: res.filePath || defaultFileName,
            counts,
          };
        }

        triggerDownloadBlob(
          new Blob([jsonlContent], { type: "application/x-ndjson;charset=utf-8" }),
          defaultFileName
        );
        return { success: true, filePath: defaultFileName, counts };
      }

      const { zipBytes, counts } = await serializeBackupToZipBundle({
        folders,
        tags,
        snippets,
        exportedAt,
        jsonlContent,
        readAsset: (id) => assetRepository.read(id),
      });
      const defaultFileName = `codestash-backup-${dateStamp}.codestash.zip`;

      if (typeof window !== "undefined" && window.electronAPI?.exportBinaryBackupFile) {
        const res = await window.electronAPI.exportBinaryBackupFile({
          bytes: zipBytes,
          defaultFileName,
        });
        if (res.canceled) {
          return { success: false, canceled: true };
        }
        if (!res.success) {
          return { success: false, error: res.error || "Error al exportar archivo ZIP." };
        }
        return {
          success: true,
          filePath: res.filePath || defaultFileName,
          counts,
        };
      }

      triggerDownloadBlob(
        new Blob([new Uint8Array(zipBytes)], { type: "application/zip" }),
        defaultFileName
      );
      return {
        success: true,
        filePath: defaultFileName,
        counts,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  },

  /**
   * Prompts the user to pick a `.codestash.zip`, `.jsonl`, or `.json` backup file,
   * validates and parses it, and returns `PendingBackupImport` for confirmation.
   */
  async selectBackupFileForImport(): Promise<{
    canceled: boolean;
    pending?: PendingBackupImport;
    error?: string;
  }> {
    try {
      // 1a. Binary-capable Electron Open Dialog (.codestash.zip / .jsonl / .json)
      if (typeof window !== "undefined" && window.electronAPI?.chooseBinaryBackupImportFile) {
        const res = await window.electronAPI.chooseBinaryBackupImportFile();
        if (res.error) {
          return { canceled: false, error: res.error };
        }
        if (res.canceled) {
          return { canceled: true };
        }
        const bytes = toUint8Array(res.bytes);

        if (bytes && isZipMagicBytes(bytes)) {
          const { rawContent, bundle } = await parseZipBackupBytes(bytes, parseBackupContent);
          return {
            canceled: false,
            pending: {
              fileName: res.fileName || "codestash-backup.codestash.zip",
              filePath: res.filePath,
              rawContent,
              bundle,
            },
          };
        }

        const rawContent =
          res.textContent ?? (bytes ? new TextDecoder("utf-8").decode(bytes) : "");
        if (!rawContent) {
          return {
            canceled: false,
            error: "El archivo seleccionado está vacío o no pudo leerse.",
          };
        }

        const bundle = parseBackupContent(rawContent);
        return {
          canceled: false,
          pending: {
            fileName: res.fileName || "codestash-backup.jsonl",
            filePath: res.filePath,
            rawContent,
            bundle,
          },
        };
      }

      // 1b. Legacy text-only Electron Open Dialog fallback
      if (typeof window !== "undefined" && window.electronAPI?.chooseBackupImportFile) {
        const res = await window.electronAPI.chooseBackupImportFile();
        if (res.error) {
          return { canceled: false, error: res.error };
        }
        if (res.canceled || !res.content) {
          return { canceled: true };
        }
        const bundle = parseBackupContent(res.content);
        return {
          canceled: false,
          pending: {
            fileName: res.fileName || "codestash-backup.jsonl",
            filePath: res.filePath,
            rawContent: res.content,
            bundle,
          },
        };
      }

      // 2. Browser / Webview file input fallback
      return await new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept =
          ".zip,.codestash.zip,.jsonl,.ndjson,.json,application/zip,application/json,text/plain";
        input.style.display = "none";

        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve({ canceled: true });
            return;
          }
          try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (isZipMagicBytes(bytes)) {
              const { rawContent, bundle } = await parseZipBackupBytes(bytes, parseBackupContent);
              resolve({
                canceled: false,
                pending: {
                  fileName: file.name,
                  rawContent,
                  bundle,
                },
              });
              return;
            }

            const rawContent = new TextDecoder("utf-8").decode(bytes);
            const bundle = parseBackupContent(rawContent);
            resolve({
              canceled: false,
              pending: {
                fileName: file.name,
                rawContent,
                bundle,
              },
            });
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            resolve({ canceled: false, error: message });
          } finally {
            if (input.parentNode) {
              input.parentNode.removeChild(input);
            }
          }
        };

        input.oncancel = () => {
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
          resolve({ canceled: true });
        };

        document.body.appendChild(input);
        input.click();
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { canceled: false, error: message };
    }
  },

  /**
   * Applies a validated backup import AFTER the user confirms in the confirmation modal.
   * Restores binary assets first, replaces catalog data, prunes orphans, and syncs backup.
   */
  async applyBackupImport(pending: PendingBackupImport): Promise<ParsedBackupBundle> {
    const { bundle, rawContent } = pending;

    if (debouncedSyncTimer !== null) {
      clearTimeout(debouncedSyncTimer);
      debouncedSyncTimer = null;
    }

    // 1. Restore referenced binary assets before UI stores re-render snippets
    if (bundle.assets && bundle.assets.size > 0) {
      for (const asset of bundle.assets.values()) {
        await assetRepository.save({
          id: asset.id,
          ext: asset.ext,
          mimeType: asset.mimeType,
          bytes: asset.bytes,
          width: asset.width,
          height: asset.height,
        });
      }
      assetUrlManager.clearCache();
    }

    // 2. Replace active catalog storage cleanly
    if (isTauriEnvironment()) {
      await invoke("import_backup", { content: rawContent });
    } else if (isIndexedDbAvailable()) {
      await replaceAllIndexedDbCollections({
        folders: bundle.folders,
        tags: bundle.tags,
        snippets: bundle.snippets,
      });
    } else {
      writeRawLocal(FALLBACK_STORAGE_KEYS.FOLDERS, bundle.folders);
      writeRawLocal(FALLBACK_STORAGE_KEYS.TAGS, bundle.tags);
      writeRawLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, bundle.snippets);
    }

    // 3. Garbage collect any obsolete binary assets no longer referenced by restored snippets
    await pruneOrphanAssetsForSnippets(bundle.snippets, assetRepository);
    await this.syncAllToAutoBackup(true);
    return bundle;
  },
};

// Automatically synchronize backup on Fallback mutations (immediate) and IndexedDB mutations (debounced)
registerStorageMutationListener(() => {
  void backupService.syncAllToAutoBackup();
});

registerIndexedDbMutationListener(() => {
  backupService.scheduleAutoBackupSync(1500);
});

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    void backupService.flushAutoBackupSync();
  });
}
