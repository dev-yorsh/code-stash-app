import { Tag } from "@/core/types";

export interface TagRepository {
  getAll(): Promise<Tag[]>;
  create(name: string, color?: string): Promise<Tag>;
  update(id: string, updates: { name?: string; color?: string }): Promise<Tag>;
  delete(id: string): Promise<void>;
}
