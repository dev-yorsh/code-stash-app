import {
  Snippet,
  CreateSnippetInput,
  UpdateSnippetInput,
  SnippetFilter,
  GlobalSearchResult,
} from "@/core/types";

export interface SnippetRepository {
  getAll(): Promise<Snippet[]>;
  getSummaries?(): Promise<Snippet[]>;
  getFiltered(filter?: SnippetFilter): Promise<Snippet[]>;
  getById(id: string): Promise<Snippet | null>;
  create(input: CreateSnippetInput): Promise<Snippet>;
  update(id: string, input: UpdateSnippetInput): Promise<Snippet>;
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  restore(id: string, targetFolderId?: string | null): Promise<void>;
  restoreMany(ids: string[]): Promise<void>;
  permanentlyDelete(id: string): Promise<void>;
  permanentlyDeleteMany(ids: string[]): Promise<void>;
  emptyTrash(): Promise<void>;
  toggleFavorite(id: string): Promise<boolean>;
  searchAll(query: string): Promise<GlobalSearchResult>;
  searchIds?(query: string): Promise<string[]>;
}
