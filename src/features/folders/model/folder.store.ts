import { create } from "zustand";
import { Folder } from "@/core/types";
import { FolderRepository } from "@/shared/api/contracts/folder.repository";
import { folderRepository as defaultFolderRepo } from "@/shared/api";

export type SpecialFilter = "all" | "favorites" | "uncategorized" | "trash" | null;

export interface FolderState {
  folders: Folder[];
  activeFolderId: string | null;
  selectedFolderIds: Set<string>;
  activeSpecialFilter: SpecialFilter;
  editingFolderId: string | null;
  foldersToDelete: Folder[] | null;
  isLoading: boolean;

  // Actions
  setRepository: (repo: FolderRepository) => void;
  setFolders: (folders: Folder[]) => void;
  loadFolders: () => Promise<void>;
  selectFolder: (folderId: string | null, multiSelect?: boolean) => void;
  selectAllFolders: () => void;
  selectSpecial: (type: SpecialFilter) => void;
  setEditingFolderId: (id: string | null) => void;
  createFolder: (parentId?: string | null) => Promise<Folder>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  requestDeleteFolder: (folder: Folder) => void;
  requestDeleteFolders: (folders: Folder[]) => void;
  clearFoldersToDelete: () => void;
  confirmDeleteFolders: (onDeleted?: () => Promise<void>) => Promise<void>;
  moveFolder: (draggedFolderId: string, targetParentId: string | null) => Promise<void>;
}

export const createFolderStore = (initialRepository: FolderRepository = defaultFolderRepo) => {
  let repository = initialRepository;

  return create<FolderState>((set, get) => ({
    folders: [],
    activeFolderId: null,
    selectedFolderIds: new Set<string>(),
    activeSpecialFilter: "all",
    editingFolderId: null,
    foldersToDelete: null,
    isLoading: false,

    setRepository(repo: FolderRepository) {
      repository = repo;
    },

    setFolders(folders: Folder[]) {
      set({ folders });
    },

    async loadFolders() {
      set({ isLoading: true });
      try {
        const folders = await repository.getAll();
        set({ folders, isLoading: false });
      } catch (err) {
        console.error("Failed to load folders:", err);
        set({ isLoading: false });
      }
    },

    selectFolder(folderId, multiSelect = false) {
      if (!folderId) {
        set({ activeFolderId: null, selectedFolderIds: new Set() });
        return;
      }
      set((state) => {
        if (multiSelect) {
          const next = new Set(state.selectedFolderIds);
          if (next.has(folderId)) {
            next.delete(folderId);
            const remaining = Array.from(next);
            const nextActive = state.activeFolderId === folderId ? (remaining.length > 0 ? remaining[0] : null) : state.activeFolderId;
            return {
              selectedFolderIds: next,
              activeFolderId: nextActive,
              activeSpecialFilter: null,
            };
          } else {
            next.add(folderId);
            return {
              selectedFolderIds: next,
              activeFolderId: folderId,
              activeSpecialFilter: null,
            };
          }
        }
        return {
          selectedFolderIds: new Set([folderId]),
          activeFolderId: folderId,
          activeSpecialFilter: null,
        };
      });
    },

    selectAllFolders() {
      const allIds = get().folders.map((f) => f.id);
      set({
        selectedFolderIds: new Set(allIds),
        activeFolderId: allIds.length > 0 ? allIds[0] : null,
        activeSpecialFilter: null,
      });
    },

    selectSpecial(type) {
      set({
        activeSpecialFilter: type,
        activeFolderId: null,
        selectedFolderIds: new Set(),
      });
    },

    setEditingFolderId(id) {
      set({ editingFolderId: id });
    },

    async createFolder(parentId = null) {
      const defaultName = "Carpeta sin título";
      const created = await repository.create(defaultName, "folder", parentId);
      set((state) => ({
        folders: [...state.folders, created],
        selectedFolderIds: new Set([created.id]),
        activeFolderId: created.id,
        activeSpecialFilter: null,
        editingFolderId: created.id,
      }));
      return created;
    },

    async renameFolder(folderId, newName) {
      const updated = await repository.update(folderId, { name: newName });
      set((state) => ({
        folders: state.folders.map((f) => (f.id === folderId ? { ...f, name: updated.name } : f)),
        editingFolderId: null,
      }));
    },

    requestDeleteFolder(folder) {
      set({ foldersToDelete: [folder] });
    },

    requestDeleteFolders(folderList) {
      if (folderList.length > 0) {
        set({ foldersToDelete: folderList });
      }
    },

    clearFoldersToDelete() {
      set({ foldersToDelete: null });
    },

    async confirmDeleteFolders(onDeleted) {
      const { foldersToDelete, activeFolderId } = get();
      if (!foldersToDelete || foldersToDelete.length === 0) return;

      const deleteIds = new Set(foldersToDelete.map((f) => f.id));
      for (const f of foldersToDelete) {
        await repository.delete(f.id);
      }

      set((state) => {
        const nextSelected = new Set(state.selectedFolderIds);
        deleteIds.forEach((id) => nextSelected.delete(id));
        const nextActive = activeFolderId && deleteIds.has(activeFolderId) ? null : activeFolderId;
        const nextFilter = nextActive === null ? "all" : state.activeSpecialFilter;

        return {
          folders: state.folders.filter((f) => !deleteIds.has(f.id)),
          selectedFolderIds: nextSelected,
          activeFolderId: nextActive,
          activeSpecialFilter: nextFilter,
          foldersToDelete: null,
        };
      });

      if (onDeleted) {
        await onDeleted();
      }
    },

    async moveFolder(draggedFolderId, targetParentId) {
      const updated = await repository.update(draggedFolderId, { parent_id: targetParentId });
      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === draggedFolderId ? { ...f, parent_id: updated.parent_id } : f
        ),
      }));
    },
  }));
};

export const useFolderStore = createFolderStore();
