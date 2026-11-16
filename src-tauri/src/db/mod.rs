mod assets;
pub use assets::{ReadAssetPayload, StoredAssetMeta};

use crate::error::AppError;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub parent_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetFragment {
    pub id: String,
    pub label: String,
    pub code: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub code: String,
    pub language: String,
    pub folder_id: Option<String>,
    pub is_favorite: bool,
    pub tags: Vec<Tag>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub fragments: Option<Vec<SnippetFragment>>,
    #[serde(default)]
    pub is_deleted: bool,
    #[serde(default)]
    pub deleted_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_images: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_summary: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSnippetInput {
    pub title: String,
    pub description: Option<String>,
    pub code: String,
    pub language: String,
    pub folder_id: Option<String>,
    pub tag_ids: Option<Vec<String>>,
    pub is_favorite: Option<bool>,
    pub fragments: Option<Vec<SnippetFragment>>,
    #[serde(default)]
    pub is_deleted: Option<bool>,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSnippetInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub code: Option<String>,
    pub language: Option<String>,
    pub folder_id: Option<String>,
    pub tag_ids: Option<Vec<String>>,
    pub is_favorite: Option<bool>,
    pub fragments: Option<Vec<SnippetFragment>>,
    #[serde(default)]
    pub is_deleted: Option<bool>,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct SnippetFilter {
    pub folder_id: Option<String>,
    pub tag_id: Option<String>,
    pub is_favorite: Option<bool>,
    pub search_query: Option<String>,
    pub language: Option<String>,
    pub is_deleted: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct GlobalSearchResult {
    pub snippets: Vec<Snippet>,
    pub folders: Vec<Folder>,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupCounts {
    pub folders: usize,
    pub tags: usize,
    pub snippets: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "record_type", rename_all = "snake_case")]
pub enum BackupRecord {
    Metadata {
        schema_version: u32,
        format: String,
        app: String,
        exported_at: String,
        counts: BackupCounts,
    },
    Folder {
        data: Folder,
    },
    Tag {
        data: Tag,
    },
    Snippet {
        data: Snippet,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupSummary {
    pub folders_count: usize,
    pub tags_count: usize,
    pub snippets_count: usize,
    pub exported_at: String,
}

#[derive(Debug, Deserialize)]
struct StandardJsonBackup {
    #[serde(default)]
    exported_at: Option<String>,
    #[serde(default)]
    folders: Vec<Folder>,
    #[serde(default)]
    tags: Vec<Tag>,
    #[serde(default)]
    snippets: Vec<Snippet>,
}

pub struct Db {
    conn: std::sync::Mutex<Connection>,
    auto_backup_path: Option<PathBuf>,
    assets_dir: Option<PathBuf>,
}

impl Db {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self, AppError> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
        let db = Self {
            conn: std::sync::Mutex::new(conn),
            auto_backup_path: None,
            assets_dir: None,
        };
        db.init_schema()?;
        Ok(db)
    }

    pub fn new_in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        let db = Self {
            conn: std::sync::Mutex::new(conn),
            auto_backup_path: None,
            assets_dir: None,
        };
        db.init_schema()?;
        Ok(db)
    }

    pub fn with_auto_backup_path<P: Into<PathBuf>>(mut self, backup_path: P) -> Self {
        self.auto_backup_path = Some(backup_path.into());
        self
    }

    pub fn with_assets_dir<P: Into<PathBuf>>(mut self, assets_dir: P) -> Self {
        self.assets_dir = Some(assets_dir.into());
        self
    }

    pub fn auto_backup_path(&self) -> Option<&Path> {
        self.auto_backup_path.as_deref()
    }

    fn init_schema(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT,
                parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT
            );

            CREATE TABLE IF NOT EXISTS snippets (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                code TEXT NOT NULL,
                language TEXT NOT NULL,
                folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                fragments TEXT,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT
            );

            CREATE TABLE IF NOT EXISTS snippet_tags (
                snippet_id TEXT NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
                tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (snippet_id, tag_id)
            );

            CREATE INDEX IF NOT EXISTS idx_snippets_folder ON snippets(folder_id);
            CREATE INDEX IF NOT EXISTS idx_snippets_favorite ON snippets(is_favorite);
            CREATE INDEX IF NOT EXISTS idx_snippets_language ON snippets(language);
            CREATE INDEX IF NOT EXISTS idx_snippets_updated_at ON snippets(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_snippets_deleted ON snippets(is_deleted);
            CREATE INDEX IF NOT EXISTS idx_snippet_tags_tag ON snippet_tags(tag_id);

            CREATE TABLE IF NOT EXISTS assets (
                id TEXT PRIMARY KEY,
                ext TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                width INTEGER,
                height INTEGER,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS snippet_asset_refs (
                snippet_id TEXT NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
                asset_id TEXT NOT NULL,
                PRIMARY KEY (snippet_id, asset_id)
            );
            CREATE INDEX IF NOT EXISTS idx_snippet_asset_refs_asset ON snippet_asset_refs(asset_id);
            "#,
        )?;

        // Ensure columns exist for existing databases
        let _ = conn.execute("ALTER TABLE snippets ADD COLUMN fragments TEXT;", []);
        let _ = conn.execute("ALTER TABLE snippets ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;", []);
        let _ = conn.execute("ALTER TABLE snippets ADD COLUMN deleted_at TEXT;", []);

        Ok(())
    }

    // --- FOLDERS ---
    pub fn get_folders(&self) -> Result<Vec<Folder>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, icon, parent_id, created_at FROM folders ORDER BY name ASC")?;
        let rows = stmt.query_map([], |row| {
            Ok(Folder {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                parent_id: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut folders = Vec::new();
        for r in rows {
            folders.push(r?);
        }
        Ok(folders)
    }

    pub fn create_folder(&self, name: &str, icon: Option<&str>, parent_id: Option<&str>) -> Result<Folder, AppError> {
        let id = format!("f-{}", uuid::Uuid::new_v4());
        let now = chrono::Utc::now().to_rfc3339();
        {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO folders (id, name, icon, parent_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, name, icon, parent_id, now],
            )?;
        }

        let folder = Folder {
            id,
            name: name.to_string(),
            icon: icon.map(String::from),
            parent_id: parent_id.map(String::from),
            created_at: now,
        };
        let _ = self.sync_auto_backup();
        Ok(folder)
    }

    pub fn update_folder(&self, id: &str, name: &str) -> Result<Folder, AppError> {
        let folder = {
            let conn = self.conn.lock().unwrap();
            let affected = conn.execute(
                "UPDATE folders SET name = ?1 WHERE id = ?2",
                params![name, id],
            )?;

            if affected == 0 {
                return Err(AppError::NotFound(format!("Folder {} not found", id)));
            }

            let mut stmt = conn.prepare("SELECT id, name, icon, parent_id, created_at FROM folders WHERE id = ?1")?;
            stmt.query_row(params![id], |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    parent_id: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?
        };

        let _ = self.sync_auto_backup();
        Ok(folder)
    }

    pub fn delete_folder(&self, id: &str) -> Result<(), AppError> {
        {
            let conn = self.conn.lock().unwrap();
            let affected = conn.execute("DELETE FROM folders WHERE id = ?1", params![id])?;
            if affected == 0 {
                return Err(AppError::NotFound(format!("Folder {} not found", id)));
            }
        }
        let _ = self.sync_auto_backup();
        Ok(())
    }

    // --- TAGS ---
    pub fn get_tags(&self) -> Result<Vec<Tag>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, color FROM tags ORDER BY name ASC")?;
        let rows = stmt.query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        })?;

        let mut tags = Vec::new();
        for r in rows {
            tags.push(r?);
        }
        Ok(tags)
    }

    pub fn create_tag(&self, name: &str, color: Option<&str>) -> Result<Tag, AppError> {
        let tag = {
            let conn = self.conn.lock().unwrap();
            let mut stmt = conn.prepare("SELECT id, name, color FROM tags WHERE LOWER(name) = LOWER(?1)")?;
            if let Ok(existing) = stmt.query_row(params![name], |row| {
                Ok(Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                })
            }) {
                return Ok(existing);
            }

            let id = format!("t-{}", uuid::Uuid::new_v4());
            conn.execute(
                "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
                params![id, name, color],
            )?;

            Tag {
                id,
                name: name.to_string(),
                color: color.map(String::from),
            }
        };

        let _ = self.sync_auto_backup();
        Ok(tag)
    }

    pub fn update_tag(&self, id: &str, name: Option<&str>, color: Option<&str>) -> Result<Tag, AppError> {
        let tag = {
            let conn = self.conn.lock().unwrap();
            let mut stmt = conn.prepare("SELECT id, name, color FROM tags WHERE id = ?1")?;
            let current = stmt
                .query_row(params![id], |row| {
                    Ok(Tag {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        color: row.get(2)?,
                    })
                })
                .map_err(|_| AppError::NotFound(format!("Tag {} not found", id)))?;

            let new_name = match name {
                Some(n) => {
                    let trimmed = n.trim();
                    if trimmed.is_empty() {
                        return Err(AppError::Validation("Tag name cannot be empty".to_string()));
                    }
                    let mut check = conn.prepare(
                        "SELECT id FROM tags WHERE LOWER(name) = LOWER(?1) AND id != ?2",
                    )?;
                    if check.exists(params![trimmed, id])? {
                        return Err(AppError::Validation(format!(
                            "A tag with name '{}' already exists",
                            trimmed
                        )));
                    }
                    trimmed.to_string()
                }
                None => current.name,
            };

            let new_color = match color {
                Some(c) => Some(c.to_string()),
                None => current.color,
            };

            conn.execute(
                "UPDATE tags SET name = ?1, color = ?2 WHERE id = ?3",
                params![new_name, new_color, id],
            )?;

            Tag {
                id: id.to_string(),
                name: new_name,
                color: new_color,
            }
        };

        let _ = self.sync_auto_backup();
        Ok(tag)
    }

    pub fn delete_tag(&self, id: &str) -> Result<(), AppError> {
        {
            let conn = self.conn.lock().unwrap();
            let affected = conn.execute("DELETE FROM tags WHERE id = ?1", params![id])?;
            if affected == 0 {
                return Err(AppError::NotFound(format!("Tag {} not found", id)));
            }
        }
        let _ = self.sync_auto_backup();
        Ok(())
    }

    // --- SNIPPETS ---
    pub fn get_snippets(&self, filter: Option<SnippetFilter>) -> Result<Vec<Snippet>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut query = String::from(
            "SELECT s.id, s.title, s.description, s.code, s.language, s.folder_id, s.is_favorite, s.created_at, s.updated_at, s.fragments, s.is_deleted, s.deleted_at FROM snippets s WHERE 1=1 "
        );
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(f) = filter {
            if let Some(fid) = f.folder_id {
                query.push_str("AND s.folder_id = ? ");
                params_vec.push(Box::new(fid));
            }
            if let Some(fav) = f.is_favorite {
                query.push_str("AND s.is_favorite = ? ");
                params_vec.push(Box::new(if fav { 1 } else { 0 }));
            }
            if let Some(del) = f.is_deleted {
                query.push_str("AND s.is_deleted = ? ");
                params_vec.push(Box::new(if del { 1 } else { 0 }));
            }
            if let Some(lang) = f.language {
                query.push_str("AND s.language = ? ");
                params_vec.push(Box::new(lang));
            }
            if let Some(tid) = f.tag_id {
                query.push_str("AND EXISTS (SELECT 1 FROM snippet_tags st WHERE st.snippet_id = s.id AND st.tag_id = ?) ");
                params_vec.push(Box::new(tid));
            }
            if let Some(q) = f.search_query {
                let pattern = format!("%{}%", q);
                query.push_str(
                    "AND (
                        s.title LIKE ?
                        OR s.description LIKE ?
                        OR s.code LIKE ?
                        OR s.language LIKE ?
                        OR s.fragments LIKE ?
                        OR EXISTS (SELECT 1 FROM folders fl WHERE fl.id = s.folder_id AND fl.name LIKE ?)
                        OR EXISTS (SELECT 1 FROM snippet_tags st INNER JOIN tags tg ON tg.id = st.tag_id WHERE st.snippet_id = s.id AND tg.name LIKE ?)
                    ) ",
                );
                for _ in 0..7 {
                    params_vec.push(Box::new(pattern.clone()));
                }
            }
        }

        query.push_str("ORDER BY s.updated_at DESC");

        let mut stmt = conn.prepare(&query)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            let id: String = row.get(0)?;
            let is_fav_int: i32 = row.get(6)?;
            let fragments_raw: Option<String> = row.get(9)?;
            let is_del_int: i32 = row.get::<_, Option<i32>>(10)?.unwrap_or(0);
            let deleted_at: Option<String> = row.get(11)?;
            Ok((
                id,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                is_fav_int == 1,
                row.get(7)?,
                row.get(8)?,
                fragments_raw,
                is_del_int == 1,
                deleted_at,
            ))
        })?;

        let mut tags_map = Self::load_tags_map(&conn)?;
        let mut snippets = Vec::new();
        for r in rows {
            let (id, title, description, code, language, folder_id, is_favorite, created_at, updated_at, fragments_raw, is_deleted, deleted_at) = r?;
            let fragments = fragments_raw.and_then(|raw| serde_json::from_str::<Vec<SnippetFragment>>(&raw).ok());
            let tags = tags_map.remove(&id).unwrap_or_default();
            let has_images = code.contains("codestash-asset://")
                || fragments
                    .as_ref()
                    .map(|fs| fs.iter().any(|f| f.code.contains("codestash-asset://")))
                    .unwrap_or(false);

            snippets.push(Snippet {
                id,
                title,
                description,
                code,
                language,
                folder_id,
                is_favorite,
                tags,
                created_at,
                updated_at,
                fragments,
                is_deleted,
                deleted_at,
                has_images: Some(has_images),
                is_summary: Some(false),
            });
        }

        Ok(snippets)
    }

    pub fn get_snippet_by_id(&self, id: &str) -> Result<Snippet, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, description, code, language, folder_id, is_favorite, created_at, updated_at, fragments, is_deleted, deleted_at FROM snippets WHERE id = ?1"
        )?;

        let snippet_tuple = stmt.query_row(params![id], |row| {
            let is_fav_int: i32 = row.get(6)?;
            let fragments_raw: Option<String> = row.get(9)?;
            let is_del_int: i32 = row.get::<_, Option<i32>>(10)?.unwrap_or(0);
            let deleted_at: Option<String> = row.get(11)?;
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                is_fav_int == 1,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                fragments_raw,
                is_del_int == 1,
                deleted_at,
            ))
        }).map_err(|_| AppError::NotFound(format!("Snippet {} not found", id)))?;

        let fragments = snippet_tuple.9.and_then(|raw| serde_json::from_str::<Vec<SnippetFragment>>(&raw).ok());

        let mut tag_stmt = conn.prepare(
            "SELECT t.id, t.name, t.color FROM tags t INNER JOIN snippet_tags st ON t.id = st.tag_id WHERE st.snippet_id = ?1 ORDER BY t.name ASC"
        )?;
        let tag_rows = tag_stmt.query_map(params![id], |tr| {
            Ok(Tag {
                id: tr.get(0)?,
                name: tr.get(1)?,
                color: tr.get(2)?,
            })
        })?;
        let mut tags = Vec::new();
        for tr in tag_rows {
            tags.push(tr?);
        }

        Ok(Snippet {
            id: snippet_tuple.0,
            title: snippet_tuple.1,
            description: snippet_tuple.2,
            code: snippet_tuple.3.clone(),
            language: snippet_tuple.4,
            folder_id: snippet_tuple.5,
            is_favorite: snippet_tuple.6,
            tags,
            created_at: snippet_tuple.7,
            updated_at: snippet_tuple.8,
            has_images: Some(
                snippet_tuple.3.contains("codestash-asset://")
                    || fragments
                        .as_ref()
                        .map(|fs| fs.iter().any(|f| f.code.contains("codestash-asset://")))
                        .unwrap_or(false),
            ),
            is_summary: Some(false),
            fragments,
            is_deleted: snippet_tuple.10,
            deleted_at: snippet_tuple.11,
        })
    }

    fn load_tags_map(conn: &Connection) -> Result<HashMap<String, Vec<Tag>>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT st.snippet_id, t.id, t.name, t.color
             FROM snippet_tags st
             INNER JOIN tags t ON t.id = st.tag_id
             ORDER BY t.name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                Tag {
                    id: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3)?,
                },
            ))
        })?;
        let mut map: HashMap<String, Vec<Tag>> = HashMap::new();
        for row in rows {
            let (snippet_id, tag) = row?;
            map.entry(snippet_id).or_default().push(tag);
        }
        Ok(map)
    }

    pub fn get_snippet_summaries(&self) -> Result<Vec<Snippet>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut tags_map = Self::load_tags_map(&conn)?;

        let mut stmt = conn.prepare(
            "SELECT id, title, description, code, language, folder_id, is_favorite, created_at, updated_at, fragments, is_deleted, deleted_at
             FROM snippets
             ORDER BY updated_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let code: String = row.get(3)?;
            let fragments_raw: Option<String> = row.get(9)?;
            Ok((
                id,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                code,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, i32>(6)? == 1,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                fragments_raw,
                row.get::<_, Option<i32>>(10)?.unwrap_or(0) == 1,
                row.get::<_, Option<String>>(11)?,
            ))
        })?;

        let mut summaries = Vec::new();
        for row in rows {
            let (
                id,
                title,
                description,
                code,
                language,
                folder_id,
                is_favorite,
                created_at,
                updated_at,
                fragments_raw,
                is_deleted,
                deleted_at,
            ) = row?;

            let parsed_frags = fragments_raw
                .and_then(|raw| serde_json::from_str::<Vec<SnippetFragment>>(&raw).ok());
            let has_images = code.contains("codestash-asset://")
                || parsed_frags
                    .as_ref()
                    .map(|fs| fs.iter().any(|f| f.code.contains("codestash-asset://")))
                    .unwrap_or(false);
            let has_large_frag = parsed_frags
                .as_ref()
                .map(|fs| fs.iter().any(|f| f.code.len() > 512 || f.code.contains("codestash-asset://")))
                .unwrap_or(false);
            let is_summary = has_images || code.len() > 512 || has_large_frag;

            let summary_code = if is_summary { String::new() } else { code };
            let summary_frags = if is_summary {
                parsed_frags.map(|fs| {
                    fs.into_iter()
                        .map(|f| SnippetFragment {
                            id: f.id,
                            label: f.label,
                            code: String::new(),
                            language: f.language,
                        })
                        .collect()
                })
            } else {
                parsed_frags
            };

            let tags = tags_map.remove(&id).unwrap_or_default();
            summaries.push(Snippet {
                id,
                title,
                description,
                code: summary_code,
                language,
                folder_id,
                is_favorite,
                tags,
                created_at,
                updated_at,
                fragments: summary_frags,
                is_deleted,
                deleted_at,
                has_images: Some(has_images),
                is_summary: Some(is_summary),
            });
        }

        Ok(summaries)
    }

    pub fn create_snippet(&self, input: CreateSnippetInput) -> Result<Snippet, AppError> {
        let id = format!("s-{}", uuid::Uuid::new_v4());
        let now = chrono::Utc::now().to_rfc3339();
        let is_fav = input.is_favorite.unwrap_or(false);
        let is_del = input.is_deleted.unwrap_or(false);
        let fragments_json = input.fragments.as_ref().and_then(|f| serde_json::to_string(f).ok());

        let mut tags = Vec::new();
        {
            let mut conn = self.conn.lock().unwrap();
            let tx = conn.transaction()?;

            tx.execute(
                r#"INSERT INTO snippets (id, title, description, code, language, folder_id, is_favorite, created_at, updated_at, fragments, is_deleted, deleted_at)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"#,
                params![
                    id,
                    input.title,
                    input.description,
                    input.code,
                    input.language,
                    input.folder_id,
                    if is_fav { 1 } else { 0 },
                    now,
                    now,
                    fragments_json,
                    if is_del { 1 } else { 0 },
                    input.deleted_at,
                ],
            )?;

            if let Some(tag_ids) = input.tag_ids {
                for tid in tag_ids {
                    tx.execute(
                        "INSERT OR IGNORE INTO snippet_tags (snippet_id, tag_id) VALUES (?1, ?2)",
                        params![id, tid],
                    )?;
                    let mut t_stmt = tx.prepare("SELECT id, name, color FROM tags WHERE id = ?1")?;
                    if let Ok(t) = t_stmt.query_row(params![tid], |r| {
                        Ok(Tag {
                            id: r.get(0)?,
                            name: r.get(1)?,
                            color: r.get(2)?,
                        })
                    }) {
                        tags.push(t);
                    }
                }
            }

            assets::sync_snippet_asset_refs(
                &tx,
                &id,
                &input.code,
                input.description.as_deref(),
                input.fragments.as_deref(),
            )?;

            tx.commit()?;
        }

        let has_images = input.code.contains("codestash-asset://")
            || input
                .fragments
                .as_ref()
                .map(|fs| fs.iter().any(|f| f.code.contains("codestash-asset://")))
                .unwrap_or(false);

        let created = Snippet {
            id,
            title: input.title,
            description: input.description,
            code: input.code,
            language: input.language,
            folder_id: input.folder_id,
            is_favorite: is_fav,
            tags,
            created_at: now.clone(),
            updated_at: now,
            fragments: input.fragments,
            is_deleted: is_del,
            deleted_at: input.deleted_at,
            has_images: Some(has_images),
            is_summary: Some(false),
        };
        let _ = self.sync_auto_backup();
        Ok(created)
    }

    pub fn update_snippet(&self, id: &str, input: UpdateSnippetInput) -> Result<Snippet, AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        {
            let mut conn = self.conn.lock().unwrap();
            let tx = conn.transaction()?;

            let current: (String, Option<String>, String, String, Option<String>, bool, Option<String>, bool, Option<String>) = tx.query_row(
                "SELECT title, description, code, language, folder_id, is_favorite, fragments, is_deleted, deleted_at FROM snippets WHERE id = ?1",
                params![id],
                |row| {
                    let fav_int: i32 = row.get(5)?;
                    let del_int: i32 = row.get::<_, Option<i32>>(7)?.unwrap_or(0);
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        fav_int == 1,
                        row.get(6)?,
                        del_int == 1,
                        row.get(8)?,
                    ))
                },
            ).map_err(|_| AppError::NotFound(format!("Snippet {} not found", id)))?;

            let new_title = input.title.unwrap_or(current.0);
            let new_desc = if input.description.is_some() { input.description } else { current.1 };
            let new_code = input.code.unwrap_or(current.2);
            let new_lang = input.language.unwrap_or(current.3);
            let new_folder = if input.folder_id.is_some() { input.folder_id } else { current.4 };
            let new_fav = input.is_favorite.unwrap_or(current.5);
            let new_fragments_json = match input.fragments {
                Some(ref frags) => serde_json::to_string(frags).ok(),
                None => current.6,
            };
            let new_is_del = input.is_deleted.unwrap_or(current.7);
            let new_deleted_at = if input.deleted_at.is_some() {
                input.deleted_at
            } else if input.is_deleted == Some(false) {
                None
            } else {
                current.8
            };

            tx.execute(
                r#"UPDATE snippets SET
                    title = ?1, description = ?2, code = ?3, language = ?4, folder_id = ?5, is_favorite = ?6, updated_at = ?7, fragments = ?8, is_deleted = ?9, deleted_at = ?10
                   WHERE id = ?11"#,
                params![
                    new_title,
                    new_desc,
                    new_code,
                    new_lang,
                    new_folder,
                    if new_fav { 1 } else { 0 },
                    now,
                    new_fragments_json,
                    if new_is_del { 1 } else { 0 },
                    new_deleted_at,
                    id
                ],
            )?;

            if let Some(tag_ids) = input.tag_ids {
                tx.execute("DELETE FROM snippet_tags WHERE snippet_id = ?1", params![id])?;
                for tid in tag_ids {
                    tx.execute(
                        "INSERT OR IGNORE INTO snippet_tags (snippet_id, tag_id) VALUES (?1, ?2)",
                        params![id, tid],
                    )?;
                }
            }

            tx.commit()?;
        }

        let updated = self.get_snippet_by_id(id)?;
        {
            let conn = self.conn.lock().unwrap();
            let _ = assets::sync_snippet_asset_refs(
                &conn,
                &updated.id,
                &updated.code,
                updated.description.as_deref(),
                updated.fragments.as_deref(),
            );
        }
        let _ = self.sync_auto_backup();
        Ok(updated)
    }

    pub fn delete_snippet(&self, id: &str) -> Result<(), AppError> {
        {
            let conn = self.conn.lock().unwrap();
            let affected = conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
            if affected == 0 {
                return Err(AppError::NotFound(format!("Snippet {} not found", id)));
            }
        }
        let _ = self.sync_auto_backup();
        Ok(())
    }

    pub fn toggle_favorite(&self, id: &str) -> Result<bool, AppError> {
        let new_fav = {
            let conn = self.conn.lock().unwrap();
            let is_fav: i32 = conn.query_row(
                "SELECT is_favorite FROM snippets WHERE id = ?1",
                params![id],
                |r| r.get(0),
            ).map_err(|_| AppError::NotFound(format!("Snippet {} not found", id)))?;

            let next = if is_fav == 1 { 0 } else { 1 };
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE snippets SET is_favorite = ?1, updated_at = ?2 WHERE id = ?3",
                params![next, now, id],
            )?;
            next == 1
        };

        let _ = self.sync_auto_backup();
        Ok(new_fav)
    }

    // --- BACKUP & AUTO-SYNCHRONIZATION (NDJSON / JSONL STREAMING FORMAT) ---
    /// Serializes all folders, tags, and snippets into NDJSON (`.jsonl`) format.
    /// Designed for O(1) line-by-line streaming scalability on large datasets.
    pub fn export_backup_jsonl(&self) -> Result<String, AppError> {
        let folders = self.get_folders()?;
        let tags = self.get_tags()?;
        let snippets = self.get_snippets(None)?;
        let exported_at = chrono::Utc::now().to_rfc3339();

        let mut buffer: Vec<u8> = Vec::with_capacity(
            256 + (folders.len() * 128) + (tags.len() * 64) + (snippets.len() * 512),
        );

        let metadata = BackupRecord::Metadata {
            schema_version: 1,
            format: "jsonl".to_string(),
            app: "CodeStash".to_string(),
            exported_at,
            counts: BackupCounts {
                folders: folders.len(),
                tags: tags.len(),
                snippets: snippets.len(),
            },
        };
        serde_json::to_writer(&mut buffer, &metadata)
            .map_err(|e| AppError::Internal(format!("Serialization error: {}", e)))?;
        buffer.write_all(b"\n")?;

        for folder in folders {
            let rec = BackupRecord::Folder { data: folder };
            serde_json::to_writer(&mut buffer, &rec)
                .map_err(|e| AppError::Internal(format!("Folder serialization error: {}", e)))?;
            buffer.write_all(b"\n")?;
        }

        for tag in tags {
            let rec = BackupRecord::Tag { data: tag };
            serde_json::to_writer(&mut buffer, &rec)
                .map_err(|e| AppError::Internal(format!("Tag serialization error: {}", e)))?;
            buffer.write_all(b"\n")?;
        }

        for snippet in snippets {
            let rec = BackupRecord::Snippet { data: snippet };
            serde_json::to_writer(&mut buffer, &rec)
                .map_err(|e| AppError::Internal(format!("Snippet serialization error: {}", e)))?;
            buffer.write_all(b"\n")?;
        }

        String::from_utf8(buffer)
            .map_err(|e| AppError::Internal(format!("UTF-8 conversion error: {}", e)))
    }

    /// Atomically writes the current database state to `auto_backup_path` if configured.
    pub fn sync_auto_backup(&self) -> Result<Option<PathBuf>, AppError> {
        let target_path = match &self.auto_backup_path {
            Some(p) => p.clone(),
            None => return Ok(None),
        };

        let jsonl = self.export_backup_jsonl()?;
        if let Some(parent) = target_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let tmp_path = target_path.with_extension("jsonl.tmp");
        std::fs::write(&tmp_path, jsonl.as_bytes())?;
        std::fs::rename(&tmp_path, &target_path)?;
        Ok(Some(target_path))
    }

    /// Imports a `.jsonl` (NDJSON) or standard `.json` backup payload inside a single
    /// atomic SQLite transaction. If any record is invalid, rolls back completely.
    pub fn import_backup_jsonl(&self, payload: &str) -> Result<BackupSummary, AppError> {
        let trimmed = payload.trim();
        if trimmed.is_empty() {
            return Err(AppError::Validation("Backup file is empty".to_string()));
        }

        let mut folders: Vec<Folder> = Vec::new();
        let mut tags: Vec<Tag> = Vec::new();
        let mut snippets: Vec<Snippet> = Vec::new();
        let mut exported_at = chrono::Utc::now().to_rfc3339();

        // Detect whether it's a single JSON object (`{ "folders": [...], ... }`) or NDJSON (`.jsonl`)
        let first_line = trimmed.lines().next().unwrap_or("");
        let is_ndjson = first_line.contains("\"record_type\"");

        if is_ndjson {
            for (idx, line) in trimmed.lines().enumerate() {
                let l = line.trim();
                if l.is_empty() {
                    continue;
                }
                let record: BackupRecord = serde_json::from_str(l).map_err(|e| {
                    AppError::Validation(format!("Invalid NDJSON backup record at line {}: {}", idx + 1, e))
                })?;
                match record {
                    BackupRecord::Metadata { exported_at: exp, .. } => {
                        exported_at = exp;
                    }
                    BackupRecord::Folder { data } => folders.push(data),
                    BackupRecord::Tag { data } => tags.push(data),
                    BackupRecord::Snippet { data } => snippets.push(data),
                }
            }
        } else {
            let parsed: StandardJsonBackup = serde_json::from_str(trimmed).map_err(|e| {
                AppError::Validation(format!("Invalid backup format: {}", e))
            })?;
            if let Some(exp) = parsed.exported_at {
                exported_at = exp;
            }
            folders = parsed.folders;
            tags = parsed.tags;
            snippets = parsed.snippets;
        }

        {
            let mut conn = self.conn.lock().unwrap();
            let tx = conn.transaction()?;
            tx.execute_batch("PRAGMA defer_foreign_keys = ON;")?;

            tx.execute("DELETE FROM snippet_tags", [])?;
            tx.execute("DELETE FROM snippets", [])?;
            tx.execute("DELETE FROM folders", [])?;
            tx.execute("DELETE FROM tags", [])?;

            for folder in &folders {
                tx.execute(
                    "INSERT INTO folders (id, name, icon, parent_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![folder.id, folder.name, folder.icon, folder.parent_id, folder.created_at],
                )?;
            }

            for tag in &tags {
                tx.execute(
                    "INSERT OR REPLACE INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
                    params![tag.id, tag.name, tag.color],
                )?;
            }

            for snippet in &snippets {
                let fragments_json = snippet
                    .fragments
                    .as_ref()
                    .and_then(|f| serde_json::to_string(f).ok());

                tx.execute(
                    r#"INSERT INTO snippets (id, title, description, code, language, folder_id, is_favorite, created_at, updated_at, fragments, is_deleted, deleted_at)
                       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"#,
                    params![
                        snippet.id,
                        snippet.title,
                        snippet.description,
                        snippet.code,
                        snippet.language,
                        snippet.folder_id,
                        if snippet.is_favorite { 1 } else { 0 },
                        snippet.created_at,
                        snippet.updated_at,
                        fragments_json,
                        if snippet.is_deleted { 1 } else { 0 },
                        snippet.deleted_at,
                    ],
                )?;

                for tag in &snippet.tags {
                    tx.execute(
                        "INSERT OR IGNORE INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
                        params![tag.id, tag.name, tag.color],
                    )?;
                    tx.execute(
                        "INSERT OR IGNORE INTO snippet_tags (snippet_id, tag_id) VALUES (?1, ?2)",
                        params![snippet.id, tag.id],
                    )?;
                }

                assets::sync_snippet_asset_refs(
                    &tx,
                    &snippet.id,
                    &snippet.code,
                    snippet.description.as_deref(),
                    snippet.fragments.as_deref(),
                )?;
            }

            tx.commit()?;
        }

        let _ = self.sync_auto_backup();

        Ok(BackupSummary {
            folders_count: folders.len(),
            tags_count: tags.len(),
            snippets_count: snippets.len(),
            exported_at,
        })
    }

    // --- GLOBAL SEARCH ---
    pub fn search_all(&self, query: &str) -> Result<GlobalSearchResult, AppError> {
        let q = query.trim();
        if q.is_empty() {
            return Ok(GlobalSearchResult {
                snippets: self.get_snippets(None)?,
                folders: self.get_folders()?,
                tags: self.get_tags()?,
            });
        }

        let filter = SnippetFilter {
            search_query: Some(q.to_string()),
            ..Default::default()
        };
        let snippets = self.get_snippets(Some(filter))?;

        let conn = self.conn.lock().unwrap();
        let pattern = format!("%{}%", q);

        let mut f_stmt = conn.prepare("SELECT id, name, icon, parent_id, created_at FROM folders WHERE name LIKE ?1 ORDER BY name ASC")?;
        let f_rows = f_stmt.query_map(params![pattern.clone()], |r| {
            Ok(Folder {
                id: r.get(0)?,
                name: r.get(1)?,
                icon: r.get(2)?,
                parent_id: r.get(3)?,
                created_at: r.get(4)?,
            })
        })?;
        let mut folders = Vec::new();
        for r in f_rows {
            folders.push(r?);
        }

        let mut t_stmt = conn.prepare("SELECT id, name, color FROM tags WHERE name LIKE ?1 ORDER BY name ASC")?;
        let t_rows = t_stmt.query_map(params![pattern], |r| {
            Ok(Tag {
                id: r.get(0)?,
                name: r.get(1)?,
                color: r.get(2)?,
            })
        })?;
        let mut tags = Vec::new();
        for r in t_rows {
            tags.push(r?);
        }

        Ok(GlobalSearchResult {
            snippets,
            folders,
            tags,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_in_memory_db_crud() {
        let db = Db::new_in_memory().unwrap();

        // 1. Create Folder
        let folder = db.create_folder("Backend", Some("server"), None).unwrap();
        assert_eq!(folder.name, "Backend");

        // 2. Create Tag
        let tag = db.create_tag("rust", Some("#6366f1")).unwrap();
        assert_eq!(tag.name, "rust");

        // 2b. Update Tag
        let updated_tag = db.update_tag(&tag.id, Some("rustacean"), Some("#ffcc66")).unwrap();
        assert_eq!(updated_tag.name, "rustacean");
        assert_eq!(updated_tag.color.as_deref(), Some("#ffcc66"));

        // 3. Create Snippet
        let snippet = db.create_snippet(CreateSnippetInput {
            title: "Hello World".to_string(),
            description: Some("Prints hello".to_string()),
            code: "fn main() { println!(\"Hello\"); }".to_string(),
            language: "rust".to_string(),
            folder_id: Some(folder.id.clone()),
            tag_ids: Some(vec![tag.id.clone()]),
            is_favorite: Some(true),
            fragments: None,
            is_deleted: None,
            deleted_at: None,
        }).unwrap();
        assert_eq!(snippet.title, "Hello World");
        assert_eq!(snippet.tags.len(), 1);
        assert!(snippet.is_favorite);

        // 4. Search
        let search = db.search_all("Hello").unwrap();
        assert_eq!(search.snippets.len(), 1);

        // 5. Update Snippet
        let updated = db.update_snippet(&snippet.id, UpdateSnippetInput {
            title: Some("Hello World v2".to_string()),
            description: None,
            code: None,
            language: None,
            folder_id: None,
            tag_ids: None,
            is_favorite: None,
            fragments: None,
            is_deleted: None,
            deleted_at: None,
        }).unwrap();
        assert_eq!(updated.title, "Hello World v2");

        // 6. Delete
        db.delete_snippet(&snippet.id).unwrap();
        assert!(db.get_snippet_by_id(&snippet.id).is_err());
    }

    #[test]
    fn test_backup_jsonl_export_import_and_auto_sync() {
        let temp_backup = std::env::temp_dir().join(format!("codestash-test-{}.jsonl", uuid::Uuid::new_v4()));
        let db1 = Db::new_in_memory().unwrap().with_auto_backup_path(&temp_backup);

        let folder = db1.create_folder("Systems", Some("folder"), None).unwrap();
        let tag = db1.create_tag("rust", Some("#ffa659")).unwrap();
        let _snippet = db1.create_snippet(CreateSnippetInput {
            title: "Zero Copy Parser".to_string(),
            description: Some("Streaming NDJSON parser".to_string()),
            code: "pub fn parse(line: &str) {}".to_string(),
            language: "rust".to_string(),
            folder_id: Some(folder.id.clone()),
            tag_ids: Some(vec![tag.id.clone()]),
            is_favorite: Some(true),
            fragments: Some(vec![SnippetFragment {
                id: "frag-1".to_string(),
                label: "lib.rs".to_string(),
                code: "pub fn parse(line: &str) {}".to_string(),
                language: "rust".to_string(),
            }]),
            is_deleted: Some(false),
            deleted_at: None,
        }).unwrap();

        // Auto-sync file must exist and contain 4 NDJSON lines (1 metadata + 1 folder + 1 tag + 1 snippet)
        assert!(temp_backup.exists());
        let synced_content = std::fs::read_to_string(&temp_backup).unwrap();
        assert_eq!(synced_content.lines().count(), 4);

        // Import into a second fresh DB
        let db2 = Db::new_in_memory().unwrap();
        let summary = db2.import_backup_jsonl(&synced_content).unwrap();
        assert_eq!(summary.folders_count, 1);
        assert_eq!(summary.tags_count, 1);
        assert_eq!(summary.snippets_count, 1);

        let restored_snippets = db2.get_snippets(None).unwrap();
        assert_eq!(restored_snippets.len(), 1);
        assert_eq!(restored_snippets[0].title, "Zero Copy Parser");
        assert_eq!(restored_snippets[0].tags.len(), 1);
        assert_eq!(restored_snippets[0].fragments.as_ref().unwrap().len(), 1);

        let _ = std::fs::remove_file(&temp_backup);
    }
}
