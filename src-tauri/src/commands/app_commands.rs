use crate::db::{
    BackupSummary, CreateSnippetInput, Folder, GlobalSearchResult, Snippet, SnippetFilter, Tag,
    UpdateSnippetInput,
};
use crate::db::{ReadAssetPayload, StoredAssetMeta};
use crate::error::AppError;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_snippets(
    state: State<'_, AppState>,
    filter: Option<SnippetFilter>,
) -> Result<Vec<Snippet>, AppError> {
    state.db.get_snippets(filter)
}

#[tauri::command]
pub async fn get_snippet_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<Snippet, AppError> {
    state.db.get_snippet_by_id(&id)
}

#[tauri::command]
pub async fn create_snippet(
    state: State<'_, AppState>,
    snippet: CreateSnippetInput,
) -> Result<Snippet, AppError> {
    if snippet.title.trim().is_empty() {
        return Err(AppError::Validation("Snippet title cannot be empty".to_string()));
    }
    state.db.create_snippet(snippet)
}

#[tauri::command]
pub async fn update_snippet(
    state: State<'_, AppState>,
    id: String,
    snippet: UpdateSnippetInput,
) -> Result<Snippet, AppError> {
    state.db.update_snippet(&id, snippet)
}

#[tauri::command]
pub async fn delete_snippet(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    state.db.delete_snippet(&id)
}

#[tauri::command]
pub async fn toggle_favorite(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, AppError> {
    state.db.toggle_favorite(&id)
}

#[tauri::command]
pub async fn get_folders(
    state: State<'_, AppState>,
) -> Result<Vec<Folder>, AppError> {
    state.db.get_folders()
}

#[tauri::command]
pub async fn create_folder(
    state: State<'_, AppState>,
    name: String,
    icon: Option<String>,
    parent_id: Option<String>,
) -> Result<Folder, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Validation("Folder name cannot be empty".to_string()));
    }
    state.db.create_folder(&name, icon.as_deref(), parent_id.as_deref())
}

#[tauri::command]
pub async fn update_folder(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<Folder, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Validation("Folder name cannot be empty".to_string()));
    }
    state.db.update_folder(&id, &name)
}

#[tauri::command]
pub async fn delete_folder(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    state.db.delete_folder(&id)
}

#[tauri::command]
pub async fn get_tags(
    state: State<'_, AppState>,
) -> Result<Vec<Tag>, AppError> {
    state.db.get_tags()
}

#[tauri::command]
pub async fn create_tag(
    state: State<'_, AppState>,
    name: String,
    color: Option<String>,
) -> Result<Tag, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Validation("Tag name cannot be empty".to_string()));
    }
    state.db.create_tag(&name, color.as_deref())
}

#[tauri::command]
pub async fn update_tag(
    state: State<'_, AppState>,
    id: String,
    name: Option<String>,
    color: Option<String>,
) -> Result<Tag, AppError> {
    if let Some(ref n) = name {
        if n.trim().is_empty() {
            return Err(AppError::Validation("Tag name cannot be empty".to_string()));
        }
    }
    state.db.update_tag(&id, name.as_deref(), color.as_deref())
}

#[tauri::command]
pub async fn delete_tag(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    state.db.delete_tag(&id)
}

#[tauri::command]
pub async fn search_all(
    state: State<'_, AppState>,
    query: String,
) -> Result<GlobalSearchResult, AppError> {
    state.db.search_all(&query)
}

#[tauri::command]
pub async fn export_backup(state: State<'_, AppState>) -> Result<String, AppError> {
    state.db.export_backup_jsonl()
}

#[tauri::command]
pub async fn import_backup(
    state: State<'_, AppState>,
    content: String,
) -> Result<BackupSummary, AppError> {
    state.db.import_backup_jsonl(&content)
}

#[tauri::command]
pub async fn sync_backup_now(state: State<'_, AppState>) -> Result<Option<String>, AppError> {
    let path = state.db.sync_auto_backup()?;
    Ok(path.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub async fn get_snippet_summaries(state: State<'_, AppState>) -> Result<Vec<Snippet>, AppError> {
    state.db.get_snippet_summaries()
}

#[tauri::command]
pub async fn save_asset(
    state: State<'_, AppState>,
    id: String,
    ext: String,
    mime_type: String,
    bytes: Vec<u8>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<StoredAssetMeta, AppError> {
    state
        .db
        .save_asset(&id, &ext, &mime_type, bytes, width, height)
}

#[tauri::command]
pub async fn read_asset(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<ReadAssetPayload>, AppError> {
    state.db.read_asset(&id)
}

#[tauri::command]
pub async fn list_assets(state: State<'_, AppState>) -> Result<Vec<StoredAssetMeta>, AppError> {
    state.db.list_assets()
}

#[tauri::command]
pub async fn prune_orphan_assets(
    state: State<'_, AppState>,
    referenced_ids: Option<Vec<String>>,
) -> Result<usize, AppError> {
    state.db.prune_orphan_assets(referenced_ids)
}
