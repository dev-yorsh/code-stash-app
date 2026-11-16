use super::{Db, SnippetFragment};
use crate::error::AppError;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

const ASSET_URI_PREFIX: &str = "codestash-asset://";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredAssetMeta {
    pub id: String,
    pub ext: String,
    pub mime_type: String,
    pub size_bytes: usize,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadAssetPayload {
    pub meta: StoredAssetMeta,
    pub bytes: Vec<u8>,
}

pub fn is_valid_asset_id(id: &str) -> bool {
    let trimmed = id.trim();
    (16..=64).contains(&trimmed.len()) && trimmed.chars().all(|c| c.is_ascii_hexdigit())
}

pub fn sanitize_asset_ext(ext: &str) -> String {
    let clean = ext.trim().trim_start_matches('.').to_ascii_lowercase();
    if (2..=8).contains(&clean.len()) && clean.chars().all(|c| c.is_ascii_alphanumeric()) {
        clean
    } else {
        "webp".to_string()
    }
}

fn guess_mime_from_ext(ext: &str) -> &'static str {
    match ext {
        "webp" => "image/webp",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

pub fn extract_asset_ids_from_text(text: &str) -> Vec<String> {
    if !text.contains(ASSET_URI_PREFIX) {
        return Vec::new();
    }

    let mut seen = HashSet::new();
    let mut ids = Vec::new();
    let mut cursor = text;

    while let Some(pos) = cursor.find(ASSET_URI_PREFIX) {
        let after = &cursor[pos + ASSET_URI_PREFIX.len()..];
        let hex_len = after
            .bytes()
            .take_while(|b| b.is_ascii_hexdigit())
            .count();

        if (16..=64).contains(&hex_len) {
            let candidate = after[..hex_len].to_ascii_lowercase();
            if seen.insert(candidate.clone()) {
                ids.push(candidate);
            }
        }

        let advance = ASSET_URI_PREFIX.len() + hex_len.max(1);
        cursor = if advance <= cursor[pos..].len() {
            &cursor[pos + advance..]
        } else {
            ""
        };
    }

    ids
}

pub fn collect_snippet_asset_ids(
    code: &str,
    description: Option<&str>,
    fragments: Option<&[SnippetFragment]>,
) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for id in extract_asset_ids_from_text(code) {
        if seen.insert(id.clone()) {
            result.push(id);
        }
    }

    if let Some(desc) = description {
        for id in extract_asset_ids_from_text(desc) {
            if seen.insert(id.clone()) {
                result.push(id);
            }
        }
    }

    if let Some(frags) = fragments {
        for frag in frags {
            for id in extract_asset_ids_from_text(&frag.code) {
                if seen.insert(id.clone()) {
                    result.push(id);
                }
            }
        }
    }

    result
}

pub fn sync_snippet_asset_refs(
    conn: &Connection,
    snippet_id: &str,
    code: &str,
    description: Option<&str>,
    fragments: Option<&[SnippetFragment]>,
) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM snippet_asset_refs WHERE snippet_id = ?1",
        params![snippet_id],
    )?;

    let asset_ids = collect_snippet_asset_ids(code, description, fragments);
    if asset_ids.is_empty() {
        return Ok(());
    }

    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO snippet_asset_refs (snippet_id, asset_id) VALUES (?1, ?2)",
    )?;
    for asset_id in asset_ids {
        stmt.execute(params![snippet_id, asset_id])?;
    }
    Ok(())
}

fn ensure_safe_asset_path(dir: &Path, id: &str, ext: &str) -> Result<PathBuf, AppError> {
    if !is_valid_asset_id(id) {
        return Err(AppError::Validation("Invalid asset SHA-256 identifier".to_string()));
    }
    let clean_ext = sanitize_asset_ext(ext);
    let file_name = format!("{}.{}", id.to_ascii_lowercase(), clean_ext);
    let target = dir.join(&file_name);
    if target.parent() != Some(dir) {
        return Err(AppError::Validation("Unsafe asset file path".to_string()));
    }
    Ok(target)
}

fn atomic_write_bytes(target: &Path, bytes: &[u8]) -> Result<(), AppError> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Internal(format!("Failed creating assets dir: {}", e)))?;
    }
    let temp = target.with_extension(format!("tmp-{}", uuid::Uuid::new_v4()));
    {
        let mut f = fs::File::create(&temp)
            .map_err(|e| AppError::Internal(format!("Failed creating temp asset file: {}", e)))?;
        f.write_all(bytes)
            .map_err(|e| AppError::Internal(format!("Failed writing temp asset file: {}", e)))?;
        f.sync_all()
            .map_err(|e| AppError::Internal(format!("Failed flushing temp asset file: {}", e)))?;
    }
    fs::rename(&temp, target)
        .map_err(|e| AppError::Internal(format!("Failed finalizing asset file: {}", e)))?;
    Ok(())
}

impl Db {
    pub fn save_asset(
        &self,
        id: &str,
        ext: &str,
        mime_type: &str,
        bytes: Vec<u8>,
        width: Option<u32>,
        height: Option<u32>,
    ) -> Result<StoredAssetMeta, AppError> {
        let clean_id = id.trim().to_ascii_lowercase();
        if !is_valid_asset_id(&clean_id) {
            return Err(AppError::Validation("Invalid SHA-256 asset id".to_string()));
        }
        if bytes.is_empty() {
            return Err(AppError::Validation("Asset binary payload cannot be empty".to_string()));
        }

        let clean_ext = sanitize_asset_ext(ext);
        let dir = self
            .assets_dir
            .clone()
            .ok_or_else(|| AppError::Internal("Assets directory is not configured".to_string()))?;

        let file_path = ensure_safe_asset_path(&dir, &clean_id, &clean_ext)?;
        if !file_path.exists() {
            atomic_write_bytes(&file_path, &bytes)?;
        }

        let created_at = chrono::Utc::now().to_rfc3339();
        let resolved_mime = if mime_type.trim().is_empty() {
            guess_mime_from_ext(&clean_ext).to_string()
        } else {
            mime_type.trim().to_string()
        };
        let size_bytes = bytes.len();

        let conn = self.conn.lock().unwrap();
        let existing: Option<StoredAssetMeta> = conn
            .query_row(
                "SELECT id, ext, mime_type, size_bytes, width, height, created_at FROM assets WHERE id = ?1",
                params![clean_id],
                |row| {
                    Ok(StoredAssetMeta {
                        id: row.get(0)?,
                        ext: row.get(1)?,
                        mime_type: row.get(2)?,
                        size_bytes: row.get::<_, i64>(3)? as usize,
                        width: row.get(4)?,
                        height: row.get(5)?,
                        created_at: row.get(6)?,
                    })
                },
            )
            .ok();

        if let Some(meta) = existing {
            return Ok(meta);
        }

        conn.execute(
            "INSERT INTO assets (id, ext, mime_type, size_bytes, width, height, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                clean_id,
                clean_ext,
                resolved_mime,
                size_bytes as i64,
                width,
                height,
                created_at
            ],
        )?;

        Ok(StoredAssetMeta {
            id: clean_id,
            ext: clean_ext,
            mime_type: resolved_mime,
            size_bytes,
            width,
            height,
            created_at,
        })
    }

    pub fn read_asset(&self, id: &str) -> Result<Option<ReadAssetPayload>, AppError> {
        let clean_id = id.trim().to_ascii_lowercase();
        if !is_valid_asset_id(&clean_id) {
            return Ok(None);
        }

        let dir = match &self.assets_dir {
            Some(d) => d.clone(),
            None => return Ok(None),
        };

        let meta_opt: Option<StoredAssetMeta> = {
            let conn = self.conn.lock().unwrap();
            conn.query_row(
                "SELECT id, ext, mime_type, size_bytes, width, height, created_at FROM assets WHERE id = ?1",
                params![clean_id],
                |row| {
                    Ok(StoredAssetMeta {
                        id: row.get(0)?,
                        ext: row.get(1)?,
                        mime_type: row.get(2)?,
                        size_bytes: row.get::<_, i64>(3)? as usize,
                        width: row.get(4)?,
                        height: row.get(5)?,
                        created_at: row.get(6)?,
                    })
                },
            )
            .ok()
        };

        let meta = match meta_opt {
            Some(m) => m,
            None => return Ok(None),
        };

        let file_path = ensure_safe_asset_path(&dir, &meta.id, &meta.ext)?;
        if !file_path.exists() {
            return Ok(None);
        }

        let bytes = fs::read(&file_path)
            .map_err(|e| AppError::Internal(format!("Failed reading asset binary: {}", e)))?;

        Ok(Some(ReadAssetPayload { meta, bytes }))
    }

    pub fn list_assets(&self) -> Result<Vec<StoredAssetMeta>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, ext, mime_type, size_bytes, width, height, created_at FROM assets ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(StoredAssetMeta {
                id: row.get(0)?,
                ext: row.get(1)?,
                mime_type: row.get(2)?,
                size_bytes: row.get::<_, i64>(3)? as usize,
                width: row.get(4)?,
                height: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn prune_orphan_assets(
        &self,
        referenced_ids: Option<Vec<String>>,
    ) -> Result<usize, AppError> {
        let keep_set: HashSet<String> = match referenced_ids {
            Some(ids) => ids
                .into_iter()
                .filter(|id| is_valid_asset_id(id))
                .map(|id| id.trim().to_ascii_lowercase())
                .collect(),
            None => {
                let conn = self.conn.lock().unwrap();
                let mut stmt = conn.prepare("SELECT DISTINCT asset_id FROM snippet_asset_refs")?;
                let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
                let mut set = HashSet::new();
                for r in rows {
                    set.insert(r?.to_ascii_lowercase());
                }
                set
            }
        };

        let to_remove: Vec<(String, String)> = {
            let conn = self.conn.lock().unwrap();
            let mut stmt = conn.prepare("SELECT id, ext FROM assets")?;
            let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
            let mut list = Vec::new();
            for r in rows {
                let (id, ext) = r?;
                if !keep_set.contains(&id.to_ascii_lowercase()) {
                    list.push((id, ext));
                }
            }
            list
        };

        if to_remove.is_empty() {
            return Ok(0);
        }

        let dir = self.assets_dir.clone();
        let mut removed = 0;

        {
            let conn = self.conn.lock().unwrap();
            for (id, ext) in &to_remove {
                conn.execute("DELETE FROM assets WHERE id = ?1", params![id])?;
                if let Some(ref d) = dir {
                    if let Ok(path) = ensure_safe_asset_path(d, id, ext) {
                        if path.exists() {
                            let _ = fs::remove_file(path);
                        }
                    }
                }
                removed += 1;
            }
        }

        Ok(removed)
    }
}
