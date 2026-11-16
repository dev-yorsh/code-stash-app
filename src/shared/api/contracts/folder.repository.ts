import { Folder, UpdateFolderInput } from "@/core/types";

export interface FolderRepository {
  getAll(): Promise<Folder[]>;
  create(name: string, icon?: string, parentId?: string | null): Promise<Folder>;
  update(id: string, input: string | UpdateFolderInput): Promise<Folder>;
  delete(id: string): Promise<void>;
}
