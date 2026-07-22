/// WebGL 3D 主题模块 — Rust Tauri commands
///
/// 所有命令入口执行会员权限二次校验（纵深防御）。
/// 真正的安全边界是 NV3D 文件加密体系。

mod nv3d;

use serde::Serialize;
use tauri::{command, State};

use crate::db::Database;
use crate::license::LicenseState;

// ─── Response types ──────────────────────────────────────────────────

macro_rules! camel_response {
    ($name:ident { $($field:ident : $ty:ty),* $(,)? }) => {
        #[derive(Debug, Serialize)]
        #[serde(rename_all = "camelCase")]
        pub struct $name { $(pub $field: $ty),* }
    };
}

camel_response!(OpenResponse {
    success: bool,
    manifest: Option<String>,
    format_version: Option<String>,
    error: Option<String>,
});

camel_response!(VerifyResponse {
    valid: bool,
    format_version: Option<String>,
    error: Option<String>,
});

camel_response!(ReadBlockResponse {
    success: bool,
    data: Option<Vec<u8>>,
    hash_match: Option<bool>,
    error: Option<String>,
});

camel_response!(DataResponse {
    success: bool,
    data: Option<String>,
    exists: Option<bool>,
    error: Option<String>,
});

camel_response!(DeleteResponse {
    success: bool,
    deleted_count: u32,
    error: Option<String>,
});

camel_response!(CacheSizeResponse {
    success: bool,
    size_bytes: u64,
    theme_count: u32,
});

camel_response!(ClearCacheResponse {
    success: bool,
    freed_bytes: u64,
    error: Option<String>,
});

// ─── Permission check (defence-in-depth) ─────────────────────────────

fn check_member(license: &State<LicenseState>) -> Result<(), String> {
    let info = license.info.lock().map_err(|e| e.to_string())?;
    match info.as_ref() {
        Some(li) if li.tier != "free" => Ok(()),
        _ => Err("NV3D_AUTH_PREMIUM_REQUIRED".to_string()),
    }
}

fn ensure_tables(db: &Database) -> Result<(), String> {
    let conn = db.conn();
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS webgl3d_user_data (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            theme_id    TEXT NOT NULL,
            slot        INTEGER NOT NULL DEFAULT 0,
            data        TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(theme_id, slot)
        );
        CREATE TABLE IF NOT EXISTS webgl3d_settings (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            key         TEXT NOT NULL UNIQUE,
            value       TEXT NOT NULL,
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── 1. nv3d_open ────────────────────────────────────────────────────

#[command]
pub fn nv3d_open(
    path: String,
    db: State<Database>,
    license: State<LicenseState>,
) -> Result<OpenResponse, String> {
    check_member(&license)?;
    ensure_tables(&db)?;

    match nv3d::open_nv3d(&path) {
        Ok(info) => Ok(OpenResponse {
            success: true,
            manifest: Some(info.manifest_json),
            format_version: Some(format!("{}.0", info.header.version)),
            error: None,
        }),
        Err(e) => Ok(OpenResponse {
            success: false,
            manifest: None,
            format_version: None,
            error: Some(e),
        }),
    }
}

// ─── 2. nv3d_verify ──────────────────────────────────────────────────

#[command]
pub fn nv3d_verify(
    path: String,
    license: State<LicenseState>,
) -> Result<VerifyResponse, String> {
    check_member(&license)?;

    match nv3d::open_nv3d(&path) {
        Ok(info) => Ok(VerifyResponse {
            valid: true,
            format_version: Some(format!("{}.0", info.header.version)),
            error: None,
        }),
        Err(e) => Ok(VerifyResponse {
            valid: false,
            format_version: None,
            error: Some(e),
        }),
    }
}

// ─── 3. nv3d_read_block ──────────────────────────────────────────────

#[command]
pub fn nv3d_read_block(
    path: String,
    block_id: String,
    expected_hash: String,
    license: State<LicenseState>,
) -> Result<ReadBlockResponse, String> {
    check_member(&license)?;

    let info = match nv3d::open_nv3d(&path) {
        Ok(i) => i,
        Err(e) => return Ok(ReadBlockResponse { success: false, data: None, hash_match: None, error: Some(e) }),
    };

    let block = info.blocks.iter().find(|b| b.id == block_id);
    let block = match block {
        Some(b) => b,
        None => return Ok(ReadBlockResponse {
            success: false, data: None, hash_match: None,
            error: Some(format!("资源不存在: {}", block_id)),
        }),
    };

    let expected_hex = expected_hash.trim_start_matches("sha256:");
    if block.hash != expected_hex {
        return Ok(ReadBlockResponse {
            success: false, data: None, hash_match: Some(false),
            error: Some("hash 不匹配".to_string()),
        });
    }

    match nv3d::read_block(&path, block) {
        Ok(data) => Ok(ReadBlockResponse { success: true, data: Some(data), hash_match: Some(true), error: None }),
        Err(e) => Ok(ReadBlockResponse { success: false, data: None, hash_match: Some(true), error: Some(e) }),
    }
}

// ─── 4. webgl3d_save_data ────────────────────────────────────────────

#[command]
pub fn webgl3d_save_data(
    db: State<Database>,
    license: State<LicenseState>,
    theme_id: String,
    slot: i32,
    data: String,
) -> Result<DataResponse, String> {
    check_member(&license)?;
    ensure_tables(&db)?;
    let conn = db.conn();

    conn.execute(
        "INSERT INTO webgl3d_user_data (theme_id, slot, data, updated_at)
         VALUES (?1, ?2, ?3, datetime('now'))
         ON CONFLICT(theme_id, slot) DO UPDATE SET data = ?3, updated_at = datetime('now')",
        rusqlite::params![theme_id, slot, data],
    ).map_err(|e| e.to_string())?;

    Ok(DataResponse { success: true, data: None, exists: None, error: None })
}

// ─── 5. webgl3d_load_data ────────────────────────────────────────────

#[command]
pub fn webgl3d_load_data(
    db: State<Database>,
    license: State<LicenseState>,
    theme_id: String,
    slot: i32,
) -> Result<DataResponse, String> {
    check_member(&license)?;
    ensure_tables(&db)?;
    let conn = db.conn();

    let result: Result<String, _> = conn.query_row(
        "SELECT data FROM webgl3d_user_data WHERE theme_id = ?1 AND slot = ?2",
        rusqlite::params![theme_id, slot],
        |row| row.get(0),
    );

    match result {
        Ok(data) => Ok(DataResponse { success: true, data: Some(data), exists: Some(true), error: None }),
        Err(rusqlite::Error::QueryReturnedNoRows) =>
            Ok(DataResponse { success: true, data: None, exists: Some(false), error: None }),
        Err(e) => Ok(DataResponse { success: false, data: None, exists: None, error: Some(e.to_string()) }),
    }
}

// ─── 6. webgl3d_delete_data ──────────────────────────────────────────

#[command]
pub fn webgl3d_delete_data(
    db: State<Database>,
    license: State<LicenseState>,
    theme_id: String,
    slot: Option<i32>,
) -> Result<DeleteResponse, String> {
    check_member(&license)?;
    ensure_tables(&db)?;
    let conn = db.conn();

    let deleted = if let Some(s) = slot {
        conn.execute(
            "DELETE FROM webgl3d_user_data WHERE theme_id = ?1 AND slot = ?2",
            rusqlite::params![theme_id, s],
        ).map_err(|e| e.to_string())?
    } else {
        conn.execute(
            "DELETE FROM webgl3d_user_data WHERE theme_id = ?1",
            rusqlite::params![theme_id],
        ).map_err(|e| e.to_string())?
    };

    Ok(DeleteResponse { success: true, deleted_count: deleted as u32, error: None })
}

// ─── 7. webgl3d_cache_size ───────────────────────────────────────────

#[command]
pub fn webgl3d_cache_size(
    db: State<Database>,
    license: State<LicenseState>,
    theme_id: Option<String>,
) -> Result<CacheSizeResponse, String> {
    check_member(&license)?;
    ensure_tables(&db)?;

    let cache_dir = db.app_data_dir().join("webgl3d_cache");
    if !cache_dir.exists() {
        return Ok(CacheSizeResponse { success: true, size_bytes: 0, theme_count: 0 });
    }

    let theme_count = match &theme_id {
        Some(tid) => if cache_dir.join(tid).exists() { 1 } else { 0 },
        None => std::fs::read_dir(&cache_dir)
            .map(|entries| entries.filter_map(|e| e.ok()).filter(|e| e.path().is_dir()).count() as u32)
            .unwrap_or(0),
    };

    let size_bytes = match &theme_id {
        Some(tid) => dir_size(&cache_dir.join(tid)),
        None => dir_size(&cache_dir),
    };

    Ok(CacheSizeResponse { success: true, size_bytes, theme_count })
}

// ─── 8. webgl3d_clear_cache ──────────────────────────────────────────

#[command]
pub fn webgl3d_clear_cache(
    db: State<Database>,
    license: State<LicenseState>,
    theme_id: Option<String>,
) -> Result<ClearCacheResponse, String> {
    check_member(&license)?;
    ensure_tables(&db)?;

    let cache_dir = db.app_data_dir().join("webgl3d_cache");
    if !cache_dir.exists() {
        return Ok(ClearCacheResponse { success: true, freed_bytes: 0, error: None });
    }

    let size_before = match &theme_id {
        Some(tid) => {
            let d = cache_dir.join(tid);
            let sz = dir_size(&d);
            if d.exists() { std::fs::remove_dir_all(&d).ok(); }
            sz
        }
        None => {
            let sz = dir_size(&cache_dir);
            if cache_dir.exists() { std::fs::remove_dir_all(&cache_dir).ok(); }
            sz
        }
    };

    Ok(ClearCacheResponse { success: true, freed_bytes: size_before, error: None })
}

// ─── Helpers ──────────────────────────────────────────────────────────

fn dir_size(path: &std::path::Path) -> u64 {
    if !path.exists() { return 0; }
    walk_dir(path).unwrap_or(0)
}

fn walk_dir(path: &std::path::Path) -> std::io::Result<u64> {
    let mut total = 0u64;
    if path.is_file() { return Ok(path.metadata()?.len()); }
    if !path.is_dir() { return Ok(0); }
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let ft = entry.file_type()?;
        if ft.is_dir() { total += walk_dir(&entry.path())?; }
        else if ft.is_file() { total += entry.metadata()?.len(); }
    }
    Ok(total)
}
