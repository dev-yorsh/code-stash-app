import { create } from "zustand";
import { Tag } from "@/core/types";
import { TagRepository } from "@/shared/api/contracts/tag.repository";
import { tagRepository as defaultTagRepo } from "@/shared/api";

export interface TagState {
  tags: Tag[];
  activeTagId: string | null;
  isTagModalOpen: boolean;
  isLoading: boolean;

  setRepository: (repo: TagRepository) => void;
  setTags: (tags: Tag[]) => void;
  loadTags: () => Promise<void>;
  selectTag: (tagId: string | null) => void;
  openTagModal: () => void;
  closeTagModal: () => void;
  createTag: (name: string, color?: string) => Promise<Tag>;
  updateTag: (
    id: string,
    updates: { name?: string; color?: string },
    onUpdated?: (updated: Tag) => void
  ) => Promise<Tag>;
  deleteTag: (id: string, onDeleted?: (id: string) => void) => Promise<void>;
}

export const createTagStore = (initialRepository: TagRepository = defaultTagRepo) => {
  let repository = initialRepository;

  return create<TagState>((set) => ({
    tags: [],
    activeTagId: null,
    isTagModalOpen: false,
    isLoading: false,

    setRepository(repo: TagRepository) {
      repository = repo;
    },

    setTags(tags: Tag[]) {
      set({ tags });
    },

    async loadTags() {
      set({ isLoading: true });
      try {
        const tags = await repository.getAll();
        set({ tags, isLoading: false });
      } catch (err) {
        console.error("Failed to load tags:", err);
        set({ isLoading: false });
      }
    },

    selectTag(tagId) {
      set({ activeTagId: tagId });
    },

    openTagModal() {
      set({ isTagModalOpen: true });
    },

    closeTagModal() {
      set({ isTagModalOpen: false });
    },

    async createTag(name, color) {
      const created = await repository.create(name, color);
      set((state) => {
        if (state.tags.some((t) => t.id === created.id)) return state;
        return { tags: [...state.tags, created], isTagModalOpen: false };
      });
      return created;
    },

    async updateTag(id, updates, onUpdated) {
      const updated = await repository.update(id, updates);
      set((state) => ({
        tags: state.tags.map((t) => (t.id === id ? updated : t)),
      }));
      if (onUpdated) onUpdated(updated);
      return updated;
    },

    async deleteTag(id, onDeleted) {
      await repository.delete(id);
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
        activeTagId: state.activeTagId === id ? null : state.activeTagId,
      }));
      if (onDeleted) onDeleted(id);
    },
  }));
};

export const useTagStore = createTagStore();
