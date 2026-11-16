import { invoke } from "@tauri-apps/api/core";
import {
  Snippet,
  CreateSnippetInput,
  UpdateSnippetInput,
  SnippetFilter,
  GlobalSearchResult,
} from "@/core/types";
import { SnippetRepository } from "../contracts/snippet.repository";

export class TauriSnippetRepository implements SnippetRepository {
  async getAll(): Promise<Snippet[]> {
    return await invoke<Snippet[]>("get_snippets");
  }

  async getSummaries(): Promise<Snippet[]> {
    try {
      return await invoke<Snippet[]>("get_snippet_summaries");
    } catch {
      return await this.getAll();
    }
  }

  async getFiltered(filter?: SnippetFilter): Promise<Snippet[]> {
    return await invoke<Snippet[]>("get_snippets", { filter });
  }

  async getById(id: string): Promise<Snippet | null> {
    try {
      return await invoke<Snippet>("get_snippet_by_id", { id });
    } catch {
      return null;
    }
  }

  async create(input: CreateSnippetInput): Promise<Snippet> {
    return await invoke<Snippet>("create_snippet", { snippet: input });
  }

  async update(id: string, input: UpdateSnippetInput): Promise<Snippet> {
    return await invoke<Snippet>("update_snippet", { id, snippet: input });
  }

  async delete(id: string): Promise<void> {
    await invoke("delete_snippet", { id });
  }

  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await invoke("delete_snippet", { id });
    }
  }

  async restore(id: string, targetFolderId?: string | null): Promise<void> {
    await invoke("update_snippet", {
      id,
      snippet: {
        is_deleted: false,
        deleted_at: null,
        folder_id: targetFolderId || null,
      },
    });
  }

  async restoreMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.restore(id, null);
    }
  }

  async permanentlyDelete(id: string): Promise<void> {
    await invoke("delete_snippet", { id });
  }

  async permanentlyDeleteMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await invoke("delete_snippet", { id });
    }
  }

  async emptyTrash(): Promise<void> {
    const trashed = await this.getFiltered({ is_deleted: true });
    for (const s of trashed) {
      await invoke("delete_snippet", { id: s.id });
    }
  }

  async toggleFavorite(id: string): Promise<boolean> {
    return await invoke<boolean>("toggle_favorite", { id });
  }

  async searchAll(query: string): Promise<GlobalSearchResult> {
    return await invoke<GlobalSearchResult>("search_all", { query });
  }
}
