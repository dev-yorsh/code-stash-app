pub mod commands;
pub mod db;
pub mod error;
pub mod state;

use commands::app_commands::*;
use db::{CreateSnippetInput, Db};
use state::AppState;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Resolve app data path
            let app_dir = app.path().app_data_dir().unwrap_or_else(|_| {
                std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
            });
            std::fs::create_dir_all(&app_dir).ok();

            let db_path = app_dir.join("codestash.db");
            let backup_path = app_dir.join("codestash-backup.jsonl");
            let assets_dir = app_dir.join("assets");
            let db = Db::new(&db_path)
                .expect("Failed to initialize SQLite database")
                .with_auto_backup_path(backup_path)
                .with_assets_dir(assets_dir);

            // Seed initial sample data if completely empty
            if let Ok(snippets) = db.get_snippets(None) {
                if snippets.is_empty() {
                    let f1 = db.create_folder("My code", Some("folder-code"), None).ok();
                    let t1 = db.create_tag("rust", Some("#ffa659")).ok();

                    let _ = db.create_snippet(CreateSnippetInput {
                        title: "Tauri v2 Command Handler Template".to_string(),
                        description: Some("Standard idiomatic Tauri 2 command with Result error handling".to_string()),
                        code: "#[tauri::command]\npub async fn fetch_data(id: String) -> Result<Item, AppError> {\n    let result = query_database(&id).await?;\n    Ok(result)\n}".to_string(),
                        language: "rust".to_string(),
                        folder_id: f1.map(|f| f.id),
                        tag_ids: t1.map(|t| vec![t.id]),
                        is_favorite: Some(true),
                        fragments: None,
                        is_deleted: Some(false),
                        deleted_at: None,
                    });
                }
            }

            let _ = db.sync_auto_backup();
            app.manage(AppState::new(db));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_snippets,
            get_snippet_summaries,
            get_snippet_by_id,
            create_snippet,
            update_snippet,
            delete_snippet,
            toggle_favorite,
            get_folders,
            create_folder,
            update_folder,
            delete_folder,
            get_tags,
            create_tag,
            update_tag,
            delete_tag,
            search_all,
            export_backup,
            import_backup,
            sync_backup_now,
            save_asset,
            read_asset,
            list_assets,
            prune_orphan_assets
        ])
        .run(tauri::generate_context!())
        .expect("error while running CodeStash application");
}
