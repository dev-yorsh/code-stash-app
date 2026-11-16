import { invoke } from "@tauri-apps/api/core";
import { Folder, UpdateFolderInput } from "@/core/types";
import { FolderRepository } from "../contracts/folder.repository";

export class TauriFolderRepository implements FolderRepository {
  async getAll(): Promise<Folder[]> {
    return await invoke<Folder[]>("get_folders");
  }

  async create(name: string, icon?: string, parentId?: string | null): Promise<Folder> {
    return await invoke<Folder>("create_folder", {
      name,
      icon: icon || null,
      parentId: parentId || null,
    });
  }

  async update(id: string, input: string | UpdateFolderInput): Promise<Folder> {
    const name = typeof input === "string" ? input : input.name || "";
    return await invoke<Folder>("update_folder", { id, name });
  }

  async delete(id: string): Promise<void> {
    await invoke("delete_folder", { id });
  }
}
