import { Tag, Snippet } from "@/core/types";
import { TagRepository } from "../contracts/tag.repository";
import {
  FALLBACK_STORAGE_KEYS,
  getLocal,
  setLocal,
  initSeedData,
} from "./fallback-storage";

export class FallbackTagRepository implements TagRepository {
  constructor() {
    initSeedData();
  }

  async getAll(): Promise<Tag[]> {
    return getLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []);
  }

  async create(name: string, color?: string): Promise<Tag> {
    const tags = getLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []);
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const newTag: Tag = {
      id: "t-" + Date.now(),
      name,
      color: color || "#ffcc66",
    };
    setLocal(FALLBACK_STORAGE_KEYS.TAGS, [...tags, newTag]);
    return newTag;
  }

  async update(id: string, updates: { name?: string; color?: string }): Promise<Tag> {
    const tags = getLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []);
    const idx = tags.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`Tag ${id} not found`);

    const updated: Tag = {
      ...tags[idx],
      name: updates.name !== undefined ? updates.name : tags[idx].name,
      color: updates.color !== undefined ? updates.color : tags[idx].color,
    };
    tags[idx] = updated;
    setLocal(FALLBACK_STORAGE_KEYS.TAGS, tags);

    // Also update any snippets that embed this tag
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    snippets.forEach((s) => {
      s.tags = s.tags.map((t) => (t.id === id ? updated : t));
    });
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, snippets);

    return updated;
  }

  async delete(id: string): Promise<void> {
    const tags = getLocal<Tag[]>(FALLBACK_STORAGE_KEYS.TAGS, []);
    setLocal(
      FALLBACK_STORAGE_KEYS.TAGS,
      tags.filter((t) => t.id !== id)
    );

    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    snippets.forEach((s) => {
      s.tags = s.tags.filter((t) => t.id !== id);
    });
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, snippets);
  }
}
