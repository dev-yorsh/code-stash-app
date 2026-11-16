import {
  Snippet,
  CreateSnippetInput,
  UpdateSnippetInput,
  SnippetFilter,
  GlobalSearchResult,
  Tag,
  Folder,
} from "@/core/types";
import { SnippetRepository } from "../contracts/snippet.repository";
import type { AssetRepository } from "../contracts/asset.repository";
import { pruneOrphanAssetsForSnippets } from "../assets/assetGarbageCollector";
import {
  FALLBACK_STORAGE_KEYS,
  getLocal,
  setLocal,
  initSeedData,
} from "./fallback-storage";

let fallbackIdCounter = 0;

function nextFallbackId(prefix: string): string {
  fallbackIdCounter += 1;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${fallbackIdCounter}`;
}

export class FallbackSnippetRepository implements SnippetRepository {
  constructor(private readonly assetRepo?: AssetRepository) {
    initSeedData();
  }

  async getAll(): Promise<Snippet[]> {
    return getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
  }

  async getFiltered(filter?: SnippetFilter): Promise<Snippet[]> {
    let snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);

    if (filter?.is_deleted !== undefined) {
      snippets = snippets.filter((s) => Boolean(s.is_deleted) === filter.is_deleted);
    } else {
      snippets = snippets.filter((s) => !s.is_deleted);
    }

    if (filter) {
      if (filter.folder_id !== undefined) {
        snippets = snippets.filter((s) => s.folder_id === filter.folder_id);
      }
      if (filter.is_favorite !== undefined) {
        snippets = snippets.filter((s) => s.is_favorite === filter.is_favorite);
      }
      if (filter.tag_id) {
        snippets = snippets.filter((s) => s.tags?.some((t) => t.id === filter.tag_id));
      }
      if (filter.language) {
        snippets = snippets.filter((s) => s.language === filter.language);
      }
      if (filter.search_query) {
        const q = filter.search_query.toLowerCase();
        const folders = getLocal<Folder[]>(FALLBACK_STORAGE_KEYS.FOLDERS, []);
        const folderNameMap = new Map(folders.map((f) => [f.id, f.name.toLowerCase()]));
        snippets = snippets.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q) ||
            s.language.toLowerCase().includes(q) ||
            s.tags?.some((t) => t.name.toLowerCase().includes(q)) ||
            (s.folder_id && folderNameMap.get(s.folder_id)?.includes(q)) ||
            s.fragments?.some(
              (frag) =>
                frag.label.toLowerCase().includes(q) ||
                frag.code.toLowerCase().includes(q) ||
                frag.language.toLowerCase().includes(q)
            )
        );
      }
    }

    return snippets;
  }

  async getById(id: string): Promise<Snippet | null> {
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    return snippets.find((s) => s.id === id) || null;
  }

  async create(input: CreateSnippetInput): Promise<Snippet> {
    const tags = getLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []);
    const assignedTags = (input.tag_ids || [])
      .map((tid) => tags.find((t) => t.id === tid))
      .filter((t): t is Tag => Boolean(t));

    const newSnippet: Snippet = {
      id: nextFallbackId("s"),
      title: input.title,
      description: input.description,
      code: input.code,
      language: input.language,
      folder_id: input.folder_id || null,
      is_favorite: input.is_favorite || false,
      tags: assignedTags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      fragments:
        input.fragments && input.fragments.length > 0
          ? input.fragments
          : [
              {
                id: nextFallbackId("f"),
                label: "Fragment",
                code: input.code,
                language: input.language,
              },
            ],
    };

    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, [newSnippet, ...snippets]);
    return newSnippet;
  }

  async update(id: string, input: UpdateSnippetInput): Promise<Snippet> {
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    const index = snippets.findIndex((s) => s.id === id);
    if (index === -1) throw new Error("Snippet not found");

    const current = snippets[index];
    const tags = getLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []);
    let assignedTags = current.tags;

    if (input.tag_ids !== undefined) {
      assignedTags = input.tag_ids
        .map((tid) => tags.find((t) => t.id === tid))
        .filter((t): t is Tag => Boolean(t));
    }

    const updated: Snippet = {
      ...current,
      title: input.title !== undefined ? input.title : current.title,
      description: input.description !== undefined ? input.description : current.description,
      code: input.code !== undefined ? input.code : current.code,
      language: input.language !== undefined ? input.language : current.language,
      folder_id: input.folder_id !== undefined ? input.folder_id : current.folder_id,
      is_favorite: input.is_favorite !== undefined ? input.is_favorite : current.is_favorite,
      tags: assignedTags,
      fragments: input.fragments !== undefined ? input.fragments : current.fragments,
      is_deleted: input.is_deleted !== undefined ? input.is_deleted : current.is_deleted,
      deleted_at: input.deleted_at !== undefined ? input.deleted_at : current.deleted_at,
      updated_at: new Date().toISOString(),
    };

    snippets[index] = updated;
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, snippets);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    const updated = snippets.map((s) =>
      s.id === id ? { ...s, is_deleted: true, deleted_at: new Date().toISOString() } : s
    );
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, updated);
  }

  async deleteMany(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    const now = new Date().toISOString();
    const updated = snippets.map((s) =>
      idSet.has(s.id) ? { ...s, is_deleted: true, deleted_at: now } : s
    );
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, updated);
  }

  async restore(id: string, targetFolderId?: string | null): Promise<void> {
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    const updated = snippets.map((s) =>
      s.id === id
        ? { ...s, is_deleted: false, deleted_at: null, folder_id: targetFolderId ?? null }
        : s
    );
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, updated);
  }

  async restoreMany(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    const updated = snippets.map((s) =>
      idSet.has(s.id) ? { ...s, is_deleted: false, deleted_at: null, folder_id: null } : s
    );
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, updated);
  }

  async permanentlyDelete(id: string): Promise<void> {
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    const remaining = snippets.filter((s) => s.id !== id);
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, remaining);
    await pruneOrphanAssetsForSnippets(remaining, this.assetRepo);
  }

  async permanentlyDeleteMany(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    const remaining = snippets.filter((s) => !idSet.has(s.id));
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, remaining);
    await pruneOrphanAssetsForSnippets(remaining, this.assetRepo);
  }

  async emptyTrash(): Promise<void> {
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    const remaining = snippets.filter((s) => !s.is_deleted);
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, remaining);
    await pruneOrphanAssetsForSnippets(remaining, this.assetRepo);
  }

  async toggleFavorite(id: string): Promise<boolean> {
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    const snippet = snippets.find((s) => s.id === id);
    if (!snippet) return false;
    snippet.is_favorite = !snippet.is_favorite;
    snippet.updated_at = new Date().toISOString();
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, snippets);
    return snippet.is_favorite;
  }

  async searchAll(query: string): Promise<GlobalSearchResult> {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        snippets: await this.getFiltered(),
        folders: getLocal<Folder[]>(FALLBACK_STORAGE_KEYS.FOLDERS, []),
        tags: getLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []),
      };
    }

    const allFolders = getLocal<Folder[]>(FALLBACK_STORAGE_KEYS.FOLDERS, []);
    const folderNameMap = new Map(allFolders.map((f) => [f.id, f.name.toLowerCase()]));

    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []).filter(
      (s) =>
        !s.is_deleted &&
        (s.title.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.language.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.name.toLowerCase().includes(q)) ||
          (s.folder_id && folderNameMap.get(s.folder_id)?.includes(q)) ||
          s.fragments?.some(
            (frag) =>
              frag.label.toLowerCase().includes(q) ||
              frag.code.toLowerCase().includes(q) ||
              frag.language.toLowerCase().includes(q)
          ))
    );

    const folders = allFolders.filter((f) =>
      f.name.toLowerCase().includes(q)
    );

    const tags = getLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []).filter((t) =>
      t.name.toLowerCase().includes(q)
    );

    return { snippets, folders, tags };
  }
}
