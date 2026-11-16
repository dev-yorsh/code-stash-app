import type { Snippet, Tag } from "@/core/types";
import type { TagRepository } from "@/shared/api/contracts";
import {
  IDB_STORES,
  enrichSnippetRecord,
  idbRequest,
  notifyIndexedDbMutation,
  runIdbTransaction,
} from "./codestashIndexedDb";

function generateTagId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `t-${crypto.randomUUID()}`;
  }
  return `t-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export class IndexedDbTagRepository implements TagRepository {
  async getAll(): Promise<Tag[]> {
    const tags = await runIdbTransaction(IDB_STORES.tags, "readonly", (tx) =>
      idbRequest<Tag[]>(tx.objectStore(IDB_STORES.tags).getAll())
    );
    return tags.sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(name: string, color?: string): Promise<Tag> {
    const trimmed = name.trim();
    const { tag, created } = await runIdbTransaction(
      IDB_STORES.tags,
      "readwrite",
      async (tx) => {
        const store = tx.objectStore(IDB_STORES.tags);
        const all = await idbRequest<Tag[]>(store.getAll());
        const existing = all.find(
          (t) => t.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (existing) {
          return { tag: existing, created: false };
        }

        const next: Tag = {
          id: generateTagId(),
          name: trimmed,
          color,
        };
        store.put(next);
        return { tag: next, created: true };
      }
    );

    if (created) {
      notifyIndexedDbMutation(IDB_STORES.tags);
    }
    return tag;
  }

  async update(
    id: string,
    updates: { name?: string; color?: string }
  ): Promise<Tag> {
    const { name, color } = updates;
    const updatedTag = await runIdbTransaction(
      [IDB_STORES.tags, IDB_STORES.snippets],
      "readwrite",
      async (tx) => {
        const tagStore = tx.objectStore(IDB_STORES.tags);
        const snippetStore = tx.objectStore(IDB_STORES.snippets);
        const current = await idbRequest<Tag | undefined>(tagStore.get(id));
        if (!current) {
          throw new Error(`Tag ${id} not found`);
        }

        const nextName =
          name !== undefined && name.trim().length > 0 ? name.trim() : current.name;
        const nextTag: Tag = {
          ...current,
          name: nextName,
          color: color !== undefined ? color : current.color,
        };
        tagStore.put(nextTag);

        const allSnippets = await idbRequest<Snippet[]>(snippetStore.getAll());
        for (const snippet of allSnippets) {
          if (snippet.tags?.some((t) => t.id === id)) {
            const patched = enrichSnippetRecord({
              ...snippet,
              tags: snippet.tags.map((t) => (t.id === id ? nextTag : t)),
            });
            snippetStore.put(patched);
          }
        }

        return nextTag;
      }
    );

    notifyIndexedDbMutation(IDB_STORES.tags);
    return updatedTag;
  }

  async delete(id: string): Promise<void> {
    await runIdbTransaction(
      [IDB_STORES.tags, IDB_STORES.snippets],
      "readwrite",
      async (tx) => {
        const tagStore = tx.objectStore(IDB_STORES.tags);
        const snippetStore = tx.objectStore(IDB_STORES.snippets);
        tagStore.delete(id);

        const allSnippets = await idbRequest<Snippet[]>(snippetStore.getAll());
        for (const snippet of allSnippets) {
          if (snippet.tags?.some((t) => t.id === id)) {
            const patched = enrichSnippetRecord({
              ...snippet,
              tags: snippet.tags.filter((t) => t.id !== id),
            });
            snippetStore.put(patched);
          }
        }
      }
    );

    notifyIndexedDbMutation(IDB_STORES.tags);
  }
}
