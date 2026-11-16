import { create } from "zustand";
import { Snippet, CreateSnippetInput, UpdateSnippetInput } from "@/core/types";
import { SnippetRepository } from "@/shared/api/contracts/snippet.repository";
import { snippetRepository as defaultSnippetRepo } from "@/shared/api";
import { useFormattingBarSessionStore } from "../editor/model/formattingBarSession.store";

export interface SnippetSelectionOptions {
  isMulti?: boolean;
  isRange?: boolean;
  visibleSnippets?: Snippet[];
}

export interface SnippetState {
  snippets: Snippet[];
  hydratedDetails: Record<string, Snippet>;
  hydratedOrder: string[];
  selectedSnippetId: string | null;
  selectedSnippetIds: Set<string>;
  batchSnippetIdsToDelete: string[] | null;
  permDeleteSnippetIds: string[] | null;
  isCreating: boolean;
  isLoading: boolean;

  // Actions
  setRepository: (repo: SnippetRepository) => void;
  setSnippets: (snippets: Snippet[]) => void;
  loadSnippets: () => Promise<void>;
  hydrateSnippet: (id: string) => Promise<Snippet | null>;
  selectSnippet: (id: string | null, options?: SnippetSelectionOptions) => void;
  selectAll: (visibleSnippets: Snippet[]) => void;
  clearSelection: () => void;
  setIsCreating: (value: boolean) => void;

  createSnippet: (input: CreateSnippetInput) => Promise<Snippet>;
  updateSnippet: (id: string, input: UpdateSnippetInput) => Promise<Snippet>;
  deleteSnippet: (id: string) => Promise<void>;
  requestBatchDelete: (ids: string[]) => void;
  clearBatchDelete: () => void;
  confirmBatchDelete: () => Promise<void>;
  restoreSnippets: (ids: string[]) => Promise<void>;
  requestPermanentDelete: (ids: string[]) => void;
  clearPermanentDelete: () => void;
  confirmPermanentDelete: () => Promise<void>;
  duplicateSnippet: (target: Snippet) => Promise<Snippet>;
  toggleFavorite: (id: string) => Promise<boolean>;
  softDeleteSnippets: (ids: string[]) => Promise<void>;
  updateSnippetFolder: (ids: string[], folderId: string | null) => Promise<void>;
}

const MAX_HYDRATED_CACHE = 40;

function mergeHydratedLru(
  details: Record<string, Snippet>,
  order: string[],
  snippet: Snippet
): { hydratedDetails: Record<string, Snippet>; hydratedOrder: string[] } {
  const normalized: Snippet = { ...snippet, is_summary: false };
  const nextDetails = { ...details, [normalized.id]: normalized };
  const nextOrder = order.filter((itemId) => itemId !== normalized.id);
  nextOrder.push(normalized.id);

  while (nextOrder.length > MAX_HYDRATED_CACHE) {
    const oldest = nextOrder.shift();
    if (oldest && oldest !== normalized.id) {
      delete nextDetails[oldest];
    }
  }

  return { hydratedDetails: nextDetails, hydratedOrder: nextOrder };
}

export const createSnippetStore = (initialRepository: SnippetRepository = defaultSnippetRepo) => {
  let repository = initialRepository;
  const inflightHydrations = new Map<string, Promise<Snippet | null>>();

  return create<SnippetState>((set, get) => ({
    snippets: [],
    hydratedDetails: {},
    hydratedOrder: [],
    selectedSnippetId: null,
    selectedSnippetIds: new Set<string>(),
    batchSnippetIdsToDelete: null,
    permDeleteSnippetIds: null,
    isCreating: false,
    isLoading: false,

    setRepository(repo: SnippetRepository) {
      repository = repo;
    },

    setSnippets(snippets: Snippet[]) {
      set({ snippets, hydratedDetails: {}, hydratedOrder: [] });
    },

    async hydrateSnippet(id: string) {
      if (!id) return null;
      const cached = get().hydratedDetails[id];
      if (cached && !cached.is_summary) {
        const touched = mergeHydratedLru(get().hydratedDetails, get().hydratedOrder, cached);
        set(touched);
        return cached;
      }

      const inList = get().snippets.find((s) => s.id === id);
      if (inList && !inList.is_summary) {
        const touched = mergeHydratedLru(get().hydratedDetails, get().hydratedOrder, inList);
        set(touched);
        return inList;
      }

      const pending = inflightHydrations.get(id);
      if (pending) return pending;

      const req = (async () => {
        try {
          const full = await repository.getById(id);
          if (!full) return null;
          const fullNormalized: Snippet = { ...full, is_summary: false };
          set((state) => ({
            ...mergeHydratedLru(state.hydratedDetails, state.hydratedOrder, fullNormalized),
            snippets: state.snippets.map((s) => (s.id === id ? fullNormalized : s)),
          }));
          return fullNormalized;
        } catch (err) {
          console.error(`Failed hydrating snippet ${id}:`, err);
          return null;
        } finally {
          inflightHydrations.delete(id);
        }
      })();

      inflightHydrations.set(id, req);
      return req;
    },

    async loadSnippets() {
      set({ isLoading: true });
      try {
        const snippets = repository.getSummaries
          ? await repository.getSummaries()
          : await repository.getAll();
        set({
          snippets,
          hydratedDetails: {},
          hydratedOrder: [],
          isLoading: false,
        });

        const active = snippets.filter((s) => !s.is_deleted);
        if (active.length > 0 && !get().selectedSnippetId) {
          set({
            selectedSnippetId: active[0].id,
            selectedSnippetIds: new Set([active[0].id]),
          });
          if (active[0].is_summary) {
            void get().hydrateSnippet(active[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load snippets:", err);
        set({ isLoading: false });
      }
    },

    selectSnippet(id, options) {
      if (!id) {
        set({ selectedSnippetId: null, selectedSnippetIds: new Set(), isCreating: false });
        return;
      }

      const { isMulti = false, isRange = false, visibleSnippets = [] } = options || {};
      const { selectedSnippetId, selectedSnippetIds } = get();

      // Range Selection (Shift + Click)
      if (isRange && selectedSnippetId && visibleSnippets.length > 0) {
        const lastIdx = visibleSnippets.findIndex((s) => s.id === selectedSnippetId);
        const currIdx = visibleSnippets.findIndex((s) => s.id === id);

        if (lastIdx !== -1 && currIdx !== -1) {
          const start = Math.min(lastIdx, currIdx);
          const end = Math.max(lastIdx, currIdx);
          const rangeIds = visibleSnippets.slice(start, end + 1).map((s) => s.id);

          set({
            selectedSnippetIds: new Set(rangeIds),
            selectedSnippetId: id,
            isCreating: false,
          });
          return;
        }
      }

      // Multi Selection Toggle (Ctrl/Cmd + Click)
      if (isMulti) {
        const next = new Set(selectedSnippetIds);
        if (next.has(id)) {
          next.delete(id);
          const remaining = Array.from(next);
          const nextSelected = selectedSnippetId === id ? (remaining.length > 0 ? remaining[0] : null) : selectedSnippetId;
          set({
            selectedSnippetIds: next,
            selectedSnippetId: nextSelected,
            isCreating: false,
          });
        } else {
          next.add(id);
          set({
            selectedSnippetIds: next,
            selectedSnippetId: id,
            isCreating: false,
          });
        }
        return;
      }

      // Normal single selection
      set({
        selectedSnippetId: id,
        selectedSnippetIds: new Set([id]),
        isCreating: false,
      });

      const target = get().snippets.find((s) => s.id === id);
      if (target?.is_summary && !get().hydratedDetails[id]) {
        void get().hydrateSnippet(id);
      }
    },

    selectAll(visibleSnippets) {
      const allIds = visibleSnippets.map((s) => s.id);
      const { selectedSnippetId } = get();
      const nextSelected =
        allIds.length > 0 && (!selectedSnippetId || !allIds.includes(selectedSnippetId))
          ? allIds[0]
          : selectedSnippetId;

      set({
        selectedSnippetIds: new Set(allIds),
        selectedSnippetId: nextSelected,
      });
    },

    clearSelection() {
      set({ selectedSnippetId: null, selectedSnippetIds: new Set(), isCreating: false });
    },

    setIsCreating(value) {
      set({ isCreating: value });
    },

    async createSnippet(input) {
      const created = await repository.create(input);
      if (!input.code?.trim()) {
        useFormattingBarSessionStore.getState().markNewSnippetPendingReveal(created.id);
      }
      set((state) => ({
        ...mergeHydratedLru(state.hydratedDetails, state.hydratedOrder, created),
        snippets: [created, ...state.snippets],
        selectedSnippetId: created.id,
        selectedSnippetIds: new Set([created.id]),
        isCreating: false,
      }));
      return created;
    },

    async updateSnippet(id, input) {
      const updated = await repository.update(id, input);
      set((state) => ({
        ...mergeHydratedLru(state.hydratedDetails, state.hydratedOrder, updated),
        snippets: state.snippets.map((s) => (s.id === id ? updated : s)),
      }));
      return updated;
    },

    async deleteSnippet(id) {
      await repository.delete(id);
      const now = new Date().toISOString();
      set((state) => {
        const nextSelectedIds = new Set(state.selectedSnippetIds);
        nextSelectedIds.delete(id);
        const nextSelectedId = state.selectedSnippetId === id ? null : state.selectedSnippetId;

        return {
          snippets: state.snippets.map((s) =>
            s.id === id ? { ...s, is_deleted: true, deleted_at: now } : s
          ),
          selectedSnippetIds: nextSelectedIds,
          selectedSnippetId: nextSelectedId,
          isCreating: false,
        };
      });
    },

    requestBatchDelete(ids) {
      if (ids.length > 0) set({ batchSnippetIdsToDelete: ids });
    },

    clearBatchDelete() {
      set({ batchSnippetIdsToDelete: null });
    },

    async confirmBatchDelete() {
      const { batchSnippetIdsToDelete, selectedSnippetId } = get();
      if (!batchSnippetIdsToDelete || batchSnippetIdsToDelete.length === 0) return;

      await repository.deleteMany(batchSnippetIdsToDelete);
      const idSet = new Set(batchSnippetIdsToDelete);
      const now = new Date().toISOString();

      set((state) => ({
        snippets: state.snippets.map((s) =>
          idSet.has(s.id) ? { ...s, is_deleted: true, deleted_at: now } : s
        ),
        selectedSnippetIds: new Set(),
        selectedSnippetId: selectedSnippetId && idSet.has(selectedSnippetId) ? null : selectedSnippetId,
        batchSnippetIdsToDelete: null,
      }));
    },

    async restoreSnippets(ids) {
      await repository.restoreMany(ids);
      const idSet = new Set(ids);
      set((state) => ({
        snippets: state.snippets.map((s) =>
          idSet.has(s.id)
            ? { ...s, is_deleted: false, deleted_at: null, folder_id: null }
            : s
        ),
        selectedSnippetIds: new Set(),
      }));
    },

    requestPermanentDelete(ids) {
      if (ids.length > 0) set({ permDeleteSnippetIds: ids });
    },

    clearPermanentDelete() {
      set({ permDeleteSnippetIds: null });
    },

    async confirmPermanentDelete() {
      const { permDeleteSnippetIds, selectedSnippetId } = get();
      if (!permDeleteSnippetIds || permDeleteSnippetIds.length === 0) return;

      await repository.permanentlyDeleteMany(permDeleteSnippetIds);
      const idSet = new Set(permDeleteSnippetIds);

      set((state) => {
        const nextDetails = { ...state.hydratedDetails };
        for (const deletedId of idSet) {
          delete nextDetails[deletedId];
        }
        return {
          snippets: state.snippets.filter((s) => !idSet.has(s.id)),
          hydratedDetails: nextDetails,
          hydratedOrder: state.hydratedOrder.filter((id) => !idSet.has(id)),
          selectedSnippetIds: new Set(),
          selectedSnippetId: selectedSnippetId && idSet.has(selectedSnippetId) ? null : selectedSnippetId,
          permDeleteSnippetIds: null,
        };
      });
    },

    async duplicateSnippet(target) {
      const source = target.is_summary
        ? ((await get().hydrateSnippet(target.id)) ?? target)
        : target;
      const duplicateInput: CreateSnippetInput = {
        title: `${source.title || "Untitled Snippet"} (Copy)`,
        description: source.description || "",
        code: source.code || "",
        language: source.language || "plaintext",
        folder_id: source.folder_id || null,
        tag_ids: source.tags?.map((t) => t.id) || [],
        is_favorite: source.is_favorite || false,
        fragments: (source.fragments || []).map((frag, idx) => ({
          id: `f-${Date.now()}-${idx}`,
          label: frag.label,
          code: frag.code,
          language: frag.language,
        })),
      };

      const created = await repository.create(duplicateInput);
      set((state) => ({
        ...mergeHydratedLru(state.hydratedDetails, state.hydratedOrder, created),
        snippets: [created, ...state.snippets],
        selectedSnippetId: created.id,
        selectedSnippetIds: new Set([created.id]),
        isCreating: false,
      }));
      return created;
    },

    async toggleFavorite(id) {
      const isFav = await repository.toggleFavorite(id);
      set((state) => {
        const cached = state.hydratedDetails[id];
        return {
          snippets: state.snippets.map((s) => (s.id === id ? { ...s, is_favorite: isFav } : s)),
          hydratedDetails: cached
            ? { ...state.hydratedDetails, [id]: { ...cached, is_favorite: isFav } }
            : state.hydratedDetails,
        };
      });
      return isFav;
    },

    async softDeleteSnippets(ids) {
      await repository.deleteMany(ids);
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      set((state) => ({
        snippets: state.snippets.map((s) =>
          idSet.has(s.id) ? { ...s, is_deleted: true, deleted_at: now } : s
        ),
      }));
    },

    async updateSnippetFolder(ids, folderId) {
      const now = new Date().toISOString();
      for (const id of ids) {
        await repository.update(id, {
          folder_id: folderId,
          is_deleted: false,
          deleted_at: null,
        });
      }
      const idSet = new Set(ids);
      set((state) => ({
        snippets: state.snippets.map((s) =>
          idSet.has(s.id)
            ? { ...s, folder_id: folderId, is_deleted: false, deleted_at: null, updated_at: now }
            : s
        ),
      }));
    },
  }));
};

export const useSnippetStore = createSnippetStore();
