import { invoke } from "@tauri-apps/api/core";
import { Tag } from "@/core/types";
import { TagRepository } from "../contracts/tag.repository";

export class TauriTagRepository implements TagRepository {
  async getAll(): Promise<Tag[]> {
    return await invoke<Tag[]>("get_tags");
  }

  async create(name: string, color?: string): Promise<Tag> {
    return await invoke<Tag>("create_tag", { name, color: color || null });
  }

  async update(id: string, updates: { name?: string; color?: string }): Promise<Tag> {
    return await invoke<Tag>("update_tag", {
      id,
      name: updates.name ?? null,
      color: updates.color ?? null,
    });
  }

  async delete(id: string): Promise<void> {
    await invoke("delete_tag", { id });
  }
}
