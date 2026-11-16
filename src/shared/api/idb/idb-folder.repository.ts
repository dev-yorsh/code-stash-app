import type { Folder, Snippet, UpdateFolderInput } from "@/core/types";
import type { FolderRepository } from "@/shared/api/contracts";
import {
  IDB_STORES,
  idbRequest,
  notifyIndexedDbMutation,
  runIdbTransaction,
} from "./codestashIndexedDb";

function generateFolderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `f-${crypto.randomUUID()}`;
  }
  return `f-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export class IndexedDbFolderRepository implements FolderRepository {
  async getAll(): Promise<Folder[]> {
    const folders = await runIdbTransaction(IDB_STORES.folders, "readonly", (tx) =>
      idbRequest<Folder[]>(tx.objectStore(IDB_STORES.folders).getAll())
    );
    return folders.sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(name: string, icon?: string, parentId?: string | null): Promise<Folder> {
    const newFolder: Folder = {
      id: generateFolderId(),
      name,
      icon,
      parent_id: parentId ?? null,
      created_at: new Date().toISOString(),
    };

    await runIdbTransaction(IDB_STORES.folders, "readwrite", (tx) => {
      tx.objectStore(IDB_STORES.folders).put(newFolder);
    });
    notifyIndexedDbMutation(IDB_STORES.folders);
    return newFolder;
  }

  async update(id: string, input: string | UpdateFolderInput): Promise<Folder> {
    const patch: UpdateFolderInput = typeof input === "string" ? { name: input } : input;

    const updated = await runIdbTransaction(IDB_STORES.folders, "readwrite", async (tx) => {
      const store = tx.objectStore(IDB_STORES.folders);
      const current = await idbRequest<Folder | undefined>(store.get(id));
      if (!current) {
        throw new Error(`Folder ${id} not found`);
      }

      const next: Folder = {
        ...current,
        name: patch.name !== undefined ? patch.name : current.name,
        icon: patch.icon !== undefined ? patch.icon : current.icon,
        parent_id: patch.parent_id !== undefined ? patch.parent_id : current.parent_id,
      };
      store.put(next);
      return next;
    });

    notifyIndexedDbMutation(IDB_STORES.folders);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const now = new Date().toISOString();

    await runIdbTransaction(
      [IDB_STORES.folders, IDB_STORES.snippets],
      "readwrite",
      async (tx) => {
        const folderStore = tx.objectStore(IDB_STORES.folders);
        const snippetStore = tx.objectStore(IDB_STORES.snippets);

        const [folders, snippets] = await Promise.all([
          idbRequest<Folder[]>(folderStore.getAll()),
          idbRequest<Snippet[]>(snippetStore.getAll()),
        ]);

        // Gather folder and all nested descendant folders
        const targetFolderIds = new Set<string>([id]);
        let added = true;
        while (added) {
          added = false;
          for (const folder of folders) {
            if (
              folder.parent_id &&
              targetFolderIds.has(folder.parent_id) &&
              !targetFolderIds.has(folder.id)
            ) {
              targetFolderIds.add(folder.id);
              added = true;
            }
          }
        }

        for (const folderId of targetFolderIds) {
          folderStore.delete(folderId);
        }

        for (const snippet of snippets) {
          if (snippet.folder_id && targetFolderIds.has(snippet.folder_id)) {
            snippetStore.put({
              ...snippet,
              is_deleted: true,
              deleted_at: now,
              folder_id: null,
            });
          }
        }
      }
    );

    notifyIndexedDbMutation(IDB_STORES.folders);
  }
}
