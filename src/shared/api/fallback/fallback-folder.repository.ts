import { Folder, Snippet, UpdateFolderInput } from "@/core/types";
import { FolderRepository } from "../contracts/folder.repository";
import {
  FALLBACK_STORAGE_KEYS,
  getLocal,
  setLocal,
  initSeedData,
} from "./fallback-storage";

export class FallbackFolderRepository implements FolderRepository {
  constructor() {
    initSeedData();
  }

  async getAll(): Promise<Folder[]> {
    return getLocal<Folder[]>(FALLBACK_STORAGE_KEYS.FOLDERS, []);
  }

  async create(name: string, icon?: string, parentId?: string | null): Promise<Folder> {
    const folders = getLocal<Folder[]>(FALLBACK_STORAGE_KEYS.FOLDERS, []);
    const newFolder: Folder = {
      id: "f-" + Date.now(),
      name,
      icon: icon || "folder",
      parent_id: parentId || null,
      created_at: new Date().toISOString(),
    };
    setLocal(FALLBACK_STORAGE_KEYS.FOLDERS, [...folders, newFolder]);
    return newFolder;
  }

  async update(id: string, input: string | UpdateFolderInput): Promise<Folder> {
    const folders = getLocal<Folder[]>(FALLBACK_STORAGE_KEYS.FOLDERS, []);
    const folder = folders.find((f) => f.id === id);
    if (!folder) throw new Error("Folder not found");

    if (typeof input === "string") {
      folder.name = input;
    } else {
      if (input.name !== undefined) folder.name = input.name;
      if (input.icon !== undefined) folder.icon = input.icon;
      if (input.parent_id !== undefined) folder.parent_id = input.parent_id;
    }

    setLocal(FALLBACK_STORAGE_KEYS.FOLDERS, folders);
    return folder;
  }

  async delete(id: string): Promise<void> {
    const folders = getLocal<Folder[]>(FALLBACK_STORAGE_KEYS.FOLDERS, []);

    // Collect target folder and any subfolder IDs
    const targetFolderIds = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      folders.forEach((f) => {
        if (f.parent_id && targetFolderIds.has(f.parent_id) && !targetFolderIds.has(f.id)) {
          targetFolderIds.add(f.id);
          added = true;
        }
      });
    }

    // Delete folders from list
    setLocal(
      FALLBACK_STORAGE_KEYS.FOLDERS,
      folders.filter((f) => !targetFolderIds.has(f.id))
    );

    // Move all snippets in these folders to Trash
    const snippets = getLocal<Snippet[]>(FALLBACK_STORAGE_KEYS.SNIPPETS, []);
    const now = new Date().toISOString();
    const updatedSnippets = snippets.map((s) => {
      if (s.folder_id && targetFolderIds.has(s.folder_id)) {
        return {
          ...s,
          is_deleted: true,
          deleted_at: now,
          folder_id: null,
        };
      }
      return s;
    });
    setLocal(FALLBACK_STORAGE_KEYS.SNIPPETS, updatedSnippets);
  }
}
