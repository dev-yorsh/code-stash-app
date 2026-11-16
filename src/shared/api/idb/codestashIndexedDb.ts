import type { Folder, Snippet, Tag } from "@/core/types";
import {
  FALLBACK_STORAGE_KEYS,
  getLocal,
  initSeedData,
} from "@/shared/api/fallback/fallback-storage";
import {
  hasAssetReferenceInSnippet,
  stripAssetUrisForSearch,
} from "@/shared/api/assets/assetReferences";

export const IDB_NAME = "codestash_db_v2";
export const IDB_VERSION = 1;

export const IDB_STORES = {
  snippets: "snippets",
  folders: "folders",
  tags: "tags",
  assetsMeta: "assets_meta",
  assetsBlobs: "assets_blobs",
  meta: "meta",
} as const;

type IndexedDbMutationListener = (storeName: string) => void;
const indexedDbMutationListeners = new Set<IndexedDbMutationListener>();

export function registerIndexedDbMutationListener(
  listener: IndexedDbMutationListener
): () => void {
  indexedDbMutationListeners.add(listener);
  return () => {
    indexedDbMutationListeners.delete(listener);
  };
}

export function notifyIndexedDbMutation(storeName: string): void {
  indexedDbMutationListeners.forEach((listener) => listener(storeName));
}

export function buildSnippetSearchText(snippet: {
  title?: string;
  description?: string;
  code?: string;
  language?: string;
  tags?: Array<{ name?: string }>;
  fragments?: Array<{ label?: string; code?: string; language?: string }>;
}): string {
  const parts: string[] = [];
  if (snippet.title) parts.push(snippet.title);
  if (snippet.description) parts.push(snippet.description);
  if (snippet.language) parts.push(snippet.language);
  if (Array.isArray(snippet.tags)) {
    for (const tag of snippet.tags) {
      if (tag?.name) parts.push(tag.name);
    }
  }
  if (snippet.code) {
    const cleanCode = stripAssetUrisForSearch(snippet.code);
    parts.push(cleanCode.length > 16000 ? cleanCode.slice(0, 16000) : cleanCode);
  }
  if (Array.isArray(snippet.fragments)) {
    for (const frag of snippet.fragments) {
      if (frag.label) parts.push(frag.label);
      if (frag.code) {
        const cleanFrag = stripAssetUrisForSearch(frag.code);
        parts.push(cleanFrag.length > 8000 ? cleanFrag.slice(0, 8000) : cleanFrag);
      }
    }
  }
  return parts.join("\n").toLowerCase();
}

export function enrichSnippetRecord(snippet: Snippet): Snippet {
  return {
    ...snippet,
    has_images: hasAssetReferenceInSnippet(snippet),
    is_summary: false,
    search_text: buildSnippetSearchText(snippet),
  };
}

export function toSnippetSummary(raw: Snippet): Snippet {
  const hasImages = raw.has_images ?? hasAssetReferenceInSnippet(raw);
  const hasLargeFragment =
    Array.isArray(raw.fragments) &&
    raw.fragments.some(
      (f) => f.code.length > 512 || f.code.includes("codestash-asset://")
    );
  const needsLazyDetail =
    hasImages || raw.code.length > 512 || hasLargeFragment;

  if (!needsLazyDetail) {
    return {
      ...raw,
      has_images: hasImages,
      is_summary: false,
      search_text: raw.search_text ?? buildSnippetSearchText(raw),
    };
  }

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    code: "",
    language: raw.language,
    folder_id: raw.folder_id,
    is_favorite: raw.is_favorite,
    tags: raw.tags,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    fragments: Array.isArray(raw.fragments)
      ? raw.fragments.map((f) => ({
          id: f.id,
          label: f.label,
          language: f.language,
          code: "",
        }))
      : undefined,
    is_deleted: raw.is_deleted,
    deleted_at: raw.deleted_at,
    has_images: hasImages,
    is_summary: true,
    search_text: raw.search_text ?? buildSnippetSearchText(raw),
  };
}

export function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request error"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB transaction error"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
let migrationPromise: Promise<void> | null = null;

function openRawDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment."));
      return;
    }

    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORES.snippets)) {
        const snippetStore = db.createObjectStore(IDB_STORES.snippets, {
          keyPath: "id",
        });
        snippetStore.createIndex("folder_id", "folder_id", { unique: false });
        snippetStore.createIndex("updated_at", "updated_at", { unique: false });
        snippetStore.createIndex("is_deleted", "is_deleted", { unique: false });
      }
      if (!db.objectStoreNames.contains(IDB_STORES.folders)) {
        db.createObjectStore(IDB_STORES.folders, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(IDB_STORES.tags)) {
        db.createObjectStore(IDB_STORES.tags, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(IDB_STORES.assetsMeta)) {
        db.createObjectStore(IDB_STORES.assetsMeta, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(IDB_STORES.assetsBlobs)) {
        db.createObjectStore(IDB_STORES.assetsBlobs, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(IDB_STORES.meta)) {
        db.createObjectStore(IDB_STORES.meta, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
        migrationPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("Failed to open IndexedDB database."));
    };
  });

  return dbPromise;
}

function readLegacyLocalStorageCollection<T>(key: string): T[] | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

async function runInitialMigrationIfNeeded(db: IDBDatabase): Promise<void> {
  const checkTx = db.transaction(
    [IDB_STORES.meta, IDB_STORES.snippets],
    "readonly"
  );
  const [metaEntry, existingSnippetCount] = await Promise.all([
    idbRequest<{ key: string; value: unknown } | undefined>(
      checkTx.objectStore(IDB_STORES.meta).get("migration_v1_done")
    ),
    idbRequest<number>(checkTx.objectStore(IDB_STORES.snippets).count()),
  ]);
  if (metaEntry?.value === true) {
    return;
  }

  let seedFolders: Folder[] = [];
  let seedTags: Tag[] = [];
  let seedSnippets: Snippet[] = [];

  if (existingSnippetCount === 0) {
    const lsFolders = readLegacyLocalStorageCollection<Folder>(FALLBACK_STORAGE_KEYS.FOLDERS);
    const lsTags = readLegacyLocalStorageCollection<Tag>(FALLBACK_STORAGE_KEYS.TAGS);
    const lsSnippets = readLegacyLocalStorageCollection<Snippet>(
      FALLBACK_STORAGE_KEYS.SNIPPETS
    );

    if (lsFolders || lsTags || lsSnippets) {
      seedFolders = lsFolders ?? [];
      seedTags = lsTags ?? [];
      seedSnippets = lsSnippets ?? [];
    } else {
      initSeedData();
      seedFolders = getLocal<Folder[]>(FALLBACK_STORAGE_KEYS.FOLDERS, []);
      seedTags = getLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []);
      seedSnippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    }
  }

  const writeTx = db.transaction(
    [
      IDB_STORES.folders,
      IDB_STORES.tags,
      IDB_STORES.snippets,
      IDB_STORES.meta,
    ],
    "readwrite"
  );

  if (existingSnippetCount === 0) {
    const folderStore = writeTx.objectStore(IDB_STORES.folders);
    const tagStore = writeTx.objectStore(IDB_STORES.tags);
    const snippetStore = writeTx.objectStore(IDB_STORES.snippets);

    for (const folder of seedFolders) {
      folderStore.put(folder);
    }
    for (const tag of seedTags) {
      tagStore.put(tag);
    }
    for (const snippet of seedSnippets) {
      snippetStore.put(enrichSnippetRecord(snippet));
    }
  }

  writeTx.objectStore(IDB_STORES.meta).put({
    key: "migration_v1_done",
    value: true,
    migratedAt: new Date().toISOString(),
  });

  await transactionDone(writeTx);
}

export async function getCodeStashDb(): Promise<IDBDatabase> {
  const db = await openRawDatabase();
  if (!migrationPromise) {
    migrationPromise = runInitialMigrationIfNeeded(db).catch((err) => {
      migrationPromise = null;
      throw err;
    });
  }
  await migrationPromise;
  return db;
}

export async function runIdbTransaction<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  executor: (tx: IDBTransaction) => Promise<T> | T
): Promise<T> {
  const db = await getCodeStashDb();
  const tx = db.transaction(storeNames, mode);
  const donePromise = transactionDone(tx);
  const result = await executor(tx);
  await donePromise;
  return result;
}

export async function replaceAllIndexedDbCollections(payload: {
  folders: Folder[];
  tags: Tag[];
  snippets: Snippet[];
}): Promise<void> {
  await runIdbTransaction(
    [IDB_STORES.folders, IDB_STORES.tags, IDB_STORES.snippets, IDB_STORES.meta],
    "readwrite",
    (tx) => {
      const folderStore = tx.objectStore(IDB_STORES.folders);
      const tagStore = tx.objectStore(IDB_STORES.tags);
      const snippetStore = tx.objectStore(IDB_STORES.snippets);

      folderStore.clear();
      tagStore.clear();
      snippetStore.clear();

      for (const folder of payload.folders) {
        folderStore.put(folder);
      }
      for (const tag of payload.tags) {
        tagStore.put(tag);
      }
      for (const snippet of payload.snippets) {
        snippetStore.put(enrichSnippetRecord(snippet));
      }
      tx.objectStore(IDB_STORES.meta).put({
        key: "migration_v1_done",
        value: true,
      });
    }
  );
  notifyIndexedDbMutation(IDB_STORES.snippets);
}

export async function resetIndexedDbForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // Ignore close failures in test cleanup
    }
  }
  dbPromise = null;
  migrationPromise = null;
}
