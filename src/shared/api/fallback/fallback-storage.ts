import { Folder, Snippet, Tag } from "@/core/types";

export const FALLBACK_STORAGE_KEYS = {
  SNIPPETS: "codestash_snippets",
  FOLDERS: "codestash_folders",
  TAGS: "codestash_tags",
};

export const getLocal = <T>(key: string, defaultValue: T): T => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return defaultValue;
    const data = window.localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
};

type StorageMutationListener = (key: string) => void;
const mutationListeners = new Set<StorageMutationListener>();

export const registerStorageMutationListener = (
  listener: StorageMutationListener
): (() => void) => {
  mutationListeners.add(listener);
  return () => {
    mutationListeners.delete(listener);
  };
};

export const setLocal = <T>(key: string, value: T): void => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
      if (
        key === FALLBACK_STORAGE_KEYS.SNIPPETS ||
        key === FALLBACK_STORAGE_KEYS.FOLDERS ||
        key === FALLBACK_STORAGE_KEYS.TAGS
      ) {
        mutationListeners.forEach((listener) => listener(key));
      }
    }
  } catch (e) {
    console.error("Local storage error:", e);
  }
};

export const initSeedData = (): void => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const hasFoldersKey = window.localStorage.getItem(FALLBACK_STORAGE_KEYS.FOLDERS) !== null;
    const hasSnippetsKey = window.localStorage.getItem(FALLBACK_STORAGE_KEYS.SNIPPETS) !== null;
    if (hasFoldersKey || hasSnippetsKey) return;

    const defaultFolders: Folder[] = [
      { id: "f-1", name: "My code", icon: "folder-code", created_at: new Date().toISOString() },
    ];
    window.localStorage.setItem(FALLBACK_STORAGE_KEYS.FOLDERS, JSON.stringify(defaultFolders));

    const defaultTags: Tag[] = [{ id: "t-1", name: "rust", color: "#ffa659" }];
    window.localStorage.setItem(FALLBACK_STORAGE_KEYS.TAGS, JSON.stringify(defaultTags));

    const defaultSnippets: Snippet[] = [
      {
        id: "s-1",
        title: "Tauri v2 Command Handler Template",
        description: "Standard idiomatic Tauri 2 command with Result error handling",
        language: "rust",
        code: `#[tauri::command]\npub async fn fetch_data(id: String) -> Result<Item, AppError> {\n    let result = query_database(&id).await?;\n    Ok(result)\n}`,
        folder_id: "f-1",
        is_favorite: true,
        tags: [defaultTags[0]],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        fragments: [
          {
            id: "f-1-1",
            label: "Fragment",
            code: `#[tauri::command]\npub async fn fetch_data(id: String) -> Result<Item, AppError> {\n    let result = query_database(&id).await?;\n    Ok(result)\n}`,
            language: "rust",
          },
        ],
      },
    ];
    window.localStorage.setItem(FALLBACK_STORAGE_KEYS.SNIPPETS, JSON.stringify(defaultSnippets));
  } catch (e) {
    console.error("Failed to initialize seed data:", e);
  }
};
