import type {
  CreateSnippetInput,
  Folder,
  GlobalSearchResult,
  Snippet,
  SnippetFilter,
  Tag,
  UpdateSnippetInput,
} from "@/core/types";
import type { AssetRepository, SnippetRepository } from "@/shared/api/contracts";
import { pruneOrphanAssetsForSnippets } from "@/shared/api/assets/assetGarbageCollector";
import {
  IDB_STORES,
  buildSnippetSearchText,
  enrichSnippetRecord,
  idbRequest,
  notifyIndexedDbMutation,
  runIdbTransaction,
  toSnippetSummary,
} from "./codestashIndexedDb";

function generateSnippetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `s-${crypto.randomUUID()}`;
  }
  return `s-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function sortSnippetsNewestFirst(items: Snippet[]): Snippet[] {
  return [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

function filterSnippets(items: Snippet[], filter?: SnippetFilter): Snippet[] {
  let result = items;

  if (filter?.is_deleted !== undefined) {
    result = result.filter((s) => Boolean(s.is_deleted) === filter.is_deleted);
  } else {
    result = result.filter((s) => !s.is_deleted);
  }

  if (filter) {
    if (filter.folder_id !== undefined) {
      result = result.filter((s) => s.folder_id === filter.folder_id);
    }
    if (filter.is_favorite !== undefined) {
      result = result.filter((s) => s.is_favorite === filter.is_favorite);
    }
    if (filter.tag_id) {
      result = result.filter((s) => s.tags?.some((t) => t.id === filter.tag_id));
    }
    if (filter.language) {
      result = result.filter((s) => s.language === filter.language);
    }
    if (filter.search_query && filter.search_query.trim()) {
      const q = filter.search_query.trim().toLowerCase();
      result = result.filter((s) => {
        const searchText = s.search_text ?? buildSnippetSearchText(s);
        return searchText.includes(q);
      });
    }
  }

  return sortSnippetsNewestFirst(result);
}

export class IndexedDbSnippetRepository implements SnippetRepository {
  constructor(private readonly assetRepo?: AssetRepository) {}

  async getAll(): Promise<Snippet[]> {
    const items = await runIdbTransaction(IDB_STORES.snippets, "readonly", (tx) =>
      idbRequest<Snippet[]>(tx.objectStore(IDB_STORES.snippets).getAll())
    );
    return sortSnippetsNewestFirst(items).map((s) => ({ ...s, is_summary: false }));
  }

  async getSummaries(): Promise<Snippet[]> {
    const items = await runIdbTransaction(IDB_STORES.snippets, "readonly", (tx) =>
      idbRequest<Snippet[]>(tx.objectStore(IDB_STORES.snippets).getAll())
    );
    return sortSnippetsNewestFirst(items).map(toSnippetSummary);
  }

  async getFiltered(filter?: SnippetFilter): Promise<Snippet[]> {
    const items = await this.getAll();
    return filterSnippets(items, filter);
  }

  async getById(id: string): Promise<Snippet | null> {
    const found = await runIdbTransaction(IDB_STORES.snippets, "readonly", (tx) =>
      idbRequest<Snippet | undefined>(tx.objectStore(IDB_STORES.snippets).get(id))
    );
    return found ? { ...found, is_summary: false } : null;
  }

  async create(input: CreateSnippetInput): Promise<Snippet> {
    const now = new Date().toISOString();
    const created = await runIdbTransaction(
      [IDB_STORES.snippets, IDB_STORES.tags],
      "readwrite",
      async (tx) => {
        const tagStore = tx.objectStore(IDB_STORES.tags);
        const allTags = await idbRequest<Tag[]>(tagStore.getAll());
        const tagIds = new Set(input.tag_ids ?? []);
        const assignedTags = allTags.filter((t) => tagIds.has(t.id));

        const record = enrichSnippetRecord({
          id: generateSnippetId(),
          title: input.title,
          description: input.description,
          code: input.code,
          language: input.language,
          folder_id: input.folder_id ?? null,
          is_favorite: input.is_favorite ?? false,
          tags: assignedTags,
          created_at: now,
          updated_at: now,
          fragments: input.fragments,
          is_deleted: input.is_deleted ?? false,
          deleted_at: input.deleted_at ?? null,
        });

        tx.objectStore(IDB_STORES.snippets).put(record);
        return record;
      }
    );

    notifyIndexedDbMutation(IDB_STORES.snippets);
    return created;
  }

  async update(id: string, input: UpdateSnippetInput): Promise<Snippet> {
    const now = new Date().toISOString();
    const updated = await runIdbTransaction(
      [IDB_STORES.snippets, IDB_STORES.tags],
      "readwrite",
      async (tx) => {
        const snippetStore = tx.objectStore(IDB_STORES.snippets);
        const current = await idbRequest<Snippet | undefined>(snippetStore.get(id));
        if (!current) {
          throw new Error(`Snippet ${id} not found`);
        }

        let assignedTags = current.tags;
        if (input.tag_ids !== undefined) {
          const allTags = await idbRequest<Tag[]>(tx.objectStore(IDB_STORES.tags).getAll());
          const tagIds = new Set(input.tag_ids);
          assignedTags = allTags.filter((t) => tagIds.has(t.id));
        }

        const record = enrichSnippetRecord({
          ...current,
          title: input.title !== undefined ? input.title : current.title,
          description:
            input.description !== undefined ? input.description : current.description,
          code: input.code !== undefined ? input.code : current.code,
          language: input.language !== undefined ? input.language : current.language,
          folder_id:
            input.folder_id !== undefined ? input.folder_id : current.folder_id,
          is_favorite:
            input.is_favorite !== undefined ? input.is_favorite : current.is_favorite,
          fragments: input.fragments !== undefined ? input.fragments : current.fragments,
          is_deleted:
            input.is_deleted !== undefined ? input.is_deleted : current.is_deleted,
          deleted_at:
            input.deleted_at !== undefined ? input.deleted_at : current.deleted_at,
          tags: assignedTags,
          updated_at: now,
        });

        snippetStore.put(record);
        return record;
      }
    );

    notifyIndexedDbMutation(IDB_STORES.snippets);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.deleteMany([id]);
  }

  async deleteMany(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    await runIdbTransaction(IDB_STORES.snippets, "readwrite", async (tx) => {
      const store = tx.objectStore(IDB_STORES.snippets);
      for (const id of idSet) {
        const item = await idbRequest<Snippet | undefined>(store.get(id));
        if (item) {
          store.put({
            ...item,
            is_deleted: true,
            deleted_at: now,
          });
        }
      }
    });
    notifyIndexedDbMutation(IDB_STORES.snippets);
  }

  async restore(id: string, targetFolderId?: string | null): Promise<void> {
    await runIdbTransaction(IDB_STORES.snippets, "readwrite", async (tx) => {
      const store = tx.objectStore(IDB_STORES.snippets);
      const item = await idbRequest<Snippet | undefined>(store.get(id));
      if (item) {
        store.put({
          ...item,
          is_deleted: false,
          deleted_at: null,
          folder_id: targetFolderId !== undefined ? targetFolderId : null,
        });
      }
    });
    notifyIndexedDbMutation(IDB_STORES.snippets);
  }

  async restoreMany(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    await runIdbTransaction(IDB_STORES.snippets, "readwrite", async (tx) => {
      const store = tx.objectStore(IDB_STORES.snippets);
      for (const id of idSet) {
        const item = await idbRequest<Snippet | undefined>(store.get(id));
        if (item) {
          store.put({
            ...item,
            is_deleted: false,
            deleted_at: null,
            folder_id: null,
          });
        }
      }
    });
    notifyIndexedDbMutation(IDB_STORES.snippets);
  }

  async permanentlyDelete(id: string): Promise<void> {
    await this.permanentlyDeleteMany([id]);
  }

  async permanentlyDeleteMany(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const remaining = await runIdbTransaction(
      IDB_STORES.snippets,
      "readwrite",
      async (tx) => {
        const store = tx.objectStore(IDB_STORES.snippets);
        for (const id of idSet) {
          store.delete(id);
        }
        return idbRequest<Snippet[]>(store.getAll());
      }
    );
    notifyIndexedDbMutation(IDB_STORES.snippets);
    await pruneOrphanAssetsForSnippets(remaining, this.assetRepo);
  }

  async emptyTrash(): Promise<void> {
    const remaining = await runIdbTransaction(
      IDB_STORES.snippets,
      "readwrite",
      async (tx) => {
        const store = tx.objectStore(IDB_STORES.snippets);
        const all = await idbRequest<Snippet[]>(store.getAll());
        const kept: Snippet[] = [];
        for (const item of all) {
          if (item.is_deleted) {
            store.delete(item.id);
          } else {
            kept.push(item);
          }
        }
        return kept;
      }
    );
    notifyIndexedDbMutation(IDB_STORES.snippets);
    await pruneOrphanAssetsForSnippets(remaining, this.assetRepo);
  }

  async toggleFavorite(id: string): Promise<boolean> {
    const result = await runIdbTransaction(IDB_STORES.snippets, "readwrite", async (tx) => {
      const store = tx.objectStore(IDB_STORES.snippets);
      const item = await idbRequest<Snippet | undefined>(store.get(id));
      if (!item) {
        throw new Error(`Snippet ${id} not found`);
      }
      const nextFav = !item.is_favorite;
      store.put({
        ...item,
        is_favorite: nextFav,
      });
      return nextFav;
    });
    notifyIndexedDbMutation(IDB_STORES.snippets);
    return result;
  }

  async searchIds(query: string): Promise<string[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all = await runIdbTransaction(IDB_STORES.snippets, "readonly", (tx) =>
      idbRequest<Snippet[]>(tx.objectStore(IDB_STORES.snippets).getAll())
    );
    return all
      .filter((s) => !s.is_deleted)
      .filter((s) => (s.search_text ?? buildSnippetSearchText(s)).includes(q))
      .map((s) => s.id);
  }

  async searchAll(query: string): Promise<GlobalSearchResult> {
    const q = query.trim().toLowerCase();
    const { snippets, folders, tags } = await runIdbTransaction(
      [IDB_STORES.snippets, IDB_STORES.folders, IDB_STORES.tags],
      "readonly",
      async (tx) => {
        const [allSnippets, allFolders, allTags] = await Promise.all([
          idbRequest<Snippet[]>(tx.objectStore(IDB_STORES.snippets).getAll()),
          idbRequest<Folder[]>(tx.objectStore(IDB_STORES.folders).getAll()),
          idbRequest<Tag[]>(tx.objectStore(IDB_STORES.tags).getAll()),
        ]);
        return {
          snippets: allSnippets,
          folders: allFolders,
          tags: allTags,
        };
      }
    );

    if (!q) {
      return { snippets: [], folders: [], tags: [] };
    }

    return {
      snippets: sortSnippetsNewestFirst(
        snippets.filter(
          (s) => !s.is_deleted && (s.search_text ?? buildSnippetSearchText(s)).includes(q)
        )
      ),
      folders: folders.filter((f) => f.name.toLowerCase().includes(q)),
      tags: tags.filter((t) => t.name.toLowerCase().includes(q)),
    };
  }
}
