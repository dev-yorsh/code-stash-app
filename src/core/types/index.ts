export interface Folder {
  id: string;
  name: string;
  icon?: string;
  parent_id?: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface SnippetFragment {
  id: string;
  label: string;
  code: string;
  language: string;
}

export interface Snippet {
  id: string;
  title: string;
  description?: string;
  code: string;
  language: string;
  folder_id?: string | null;
  is_favorite: boolean;
  tags: Tag[];
  created_at: string;
  updated_at: string;
  fragments?: SnippetFragment[];
  is_deleted?: boolean;
  deleted_at?: string | null;
  has_images?: boolean;
  is_summary?: boolean;
  search_text?: string;
}

export interface StoredAssetMeta {
  id: string;
  ext: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  createdAt: string;
}

export interface SaveAssetInput {
  id: string;
  ext: string;
  mimeType: string;
  bytes: Uint8Array;
  width?: number;
  height?: number;
}

export interface CreateSnippetInput {
  title: string;
  description?: string;
  code: string;
  language: string;
  folder_id?: string | null;
  tag_ids?: string[];
  is_favorite?: boolean;
  fragments?: SnippetFragment[];
  is_deleted?: boolean;
  deleted_at?: string | null;
}

export interface UpdateSnippetInput {
  title?: string;
  description?: string;
  code?: string;
  language?: string;
  folder_id?: string | null;
  tag_ids?: string[];
  is_favorite?: boolean;
  fragments?: SnippetFragment[];
  is_deleted?: boolean;
  deleted_at?: string | null;
}

export interface UpdateFolderInput {
  name?: string;
  icon?: string;
  parent_id?: string | null;
}

export interface SnippetFilter {
  folder_id?: string | null;
  tag_id?: string | null;
  is_favorite?: boolean;
  search_query?: string;
  language?: string;
  is_deleted?: boolean;
}

export interface GlobalSearchResult {
  snippets: Snippet[];
  folders: Folder[];
  tags: Tag[];
}
