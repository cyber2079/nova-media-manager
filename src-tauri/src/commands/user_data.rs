use crate::db::Database;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

// ── KV Store (settings, theme, language, layout, etc.) ──

#[tauri::command]
pub fn kv_get(db: State<Database>, key: String) -> Result<Option<String>, String> {
    let conn = db.conn();
    let mut stmt = conn.prepare("SELECT value FROM kv_store WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let result: Option<String> = stmt.query_row(params![key], |row| row.get(0)).ok();
    Ok(result)
}

#[tauri::command]
pub fn kv_set(db: State<Database>, key: String, value: String) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?1, ?2)",
        params![key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn kv_delete(db: State<Database>, key: String) -> Result<(), String> {
    let conn = db.conn();
    conn.execute("DELETE FROM kv_store WHERE key = ?1", params![key])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn kv_get_all(db: State<Database>) -> Result<Vec<(String, String)>, String> {
    let conn = db.conn();
    let mut stmt = conn.prepare("SELECT key, value FROM kv_store")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

// ── Playlists ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    #[serde(rename = "musicIds")]
    pub music_ids: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[tauri::command]
pub fn pl_get_all(db: State<Database>) -> Result<Vec<Playlist>, String> {
    let conn = db.conn();
    let mut stmt = conn.prepare("SELECT id, name, music_ids, created_at FROM playlists ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(Playlist {
            id: row.get(0)?,
            name: row.get(1)?,
            music_ids: row.get(2)?,
            created_at: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn pl_save(db: State<Database>, playlist: Playlist) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT OR REPLACE INTO playlists (id, name, music_ids, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![playlist.id, playlist.name, playlist.music_ids, playlist.created_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pl_delete(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn();
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pl_save_all(db: State<Database>, playlists: Vec<Playlist>) -> Result<(), String> {
    let conn = db.conn();
    conn.execute("DELETE FROM playlists", []).map_err(|e| e.to_string())?;
    for pl in playlists {
        conn.execute(
            "INSERT INTO playlists (id, name, music_ids, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![pl.id, pl.name, pl.music_ids, pl.created_at],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Favorites ──

#[derive(Debug, Serialize, Deserialize)]
pub struct FavItem {
    #[serde(rename = "itemId")]
    pub item_id: String,
    #[serde(rename = "itemType")]
    pub item_type: String,
}

#[tauri::command]
pub fn fav_get_all(db: State<Database>) -> Result<Vec<FavItem>, String> {
    let conn = db.conn();
    let mut stmt = conn.prepare("SELECT item_id, item_type FROM favorites")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(FavItem { item_id: row.get(0)?, item_type: row.get(1)? })
    }).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn fav_toggle(db: State<Database>, item_id: String, item_type: String) -> Result<bool, String> {
    let conn = db.conn();
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM favorites WHERE item_id = ?1 AND item_type = ?2",
        params![item_id, item_type],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    if exists {
        conn.execute(
            "DELETE FROM favorites WHERE item_id = ?1 AND item_type = ?2",
            params![item_id, item_type],
        ).map_err(|e| e.to_string())?;
        Ok(false) // now unfavorited
    } else {
        conn.execute(
            "INSERT INTO favorites (item_id, item_type, created_at) VALUES (?1, ?2, datetime('now'))",
            params![item_id, item_type],
        ).map_err(|e| e.to_string())?;
        Ok(true) // now favorited
    }
}

// ── Play History ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlayEvent {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub item_type: String,
    #[serde(rename = "playedAt")]
    pub played_at: String,
}

#[tauri::command]
pub fn hist_get_recent(db: State<Database>, limit: usize) -> Result<Vec<PlayEvent>, String> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT id, name, item_type, played_at FROM play_history ORDER BY played_at DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![limit as i64], |row| {
        Ok(PlayEvent {
            id: row.get(0)?,
            name: row.get(1)?,
            item_type: row.get(2)?,
            played_at: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn hist_add(db: State<Database>, event: PlayEvent) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT OR REPLACE INTO play_history (id, name, item_type, played_at) VALUES (?1, ?2, ?3, ?4)",
        params![event.id, event.name, event.item_type, event.played_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn hist_clear(db: State<Database>) -> Result<(), String> {
    let conn = db.conn();
    conn.execute("DELETE FROM play_history", []).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Music Cache ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MusicCacheEntry {
    pub id: String,
    pub name: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "coverPath")]
    pub cover_path: String,
    pub artist: String,
    pub album: String,
    pub duration: String,
    #[serde(rename = "fileSize")]
    pub file_size: i64,
    pub tags: String, // JSON array
    #[serde(rename = "addTime")]
    pub add_time: String,
}

#[tauri::command]
pub fn mc_get_all(db: State<Database>) -> Result<Vec<MusicCacheEntry>, String> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT id, name, file_path, cover_path, artist, album, duration, file_size, tags, add_time FROM music_cache ORDER BY add_time DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(MusicCacheEntry {
            id: row.get(0)?, name: row.get(1)?, file_path: row.get(2)?,
            cover_path: row.get(3)?, artist: row.get(4)?, album: row.get(5)?,
            duration: row.get(6)?, file_size: row.get(7)?, tags: row.get(8)?,
            add_time: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn mc_save(db: State<Database>, entries: Vec<MusicCacheEntry>) -> Result<(), String> {
    let conn = db.conn();
    for e in entries {
        conn.execute(
            "INSERT OR REPLACE INTO music_cache (id, name, file_path, cover_path, artist, album, duration, file_size, tags, add_time)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![e.id, e.name, e.file_path, e.cover_path, e.artist, e.album, e.duration, e.file_size, e.tags, e.add_time],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn mc_delete(db: State<Database>, ids: Vec<String>) -> Result<(), String> {
    let conn = db.conn();
    for id in ids {
        conn.execute("DELETE FROM music_cache WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Data Export / Import ──

use std::fs;
use std::io::{Write, Read};
use std::path::Path;

#[tauri::command]
pub fn export_data(db: State<Database>, dest_path: String) -> Result<(), String> {
    let data_dir = db.data_dir();
    let db_path = data_dir.join("media_library.db");
    let covers_dir = data_dir.join("covers");

    // Build zip
    let dest = Path::new(&dest_path);
    let file = fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut zip_writer = zip::ZipWriter::new(file);
    let opts = zip::write::SimpleFileOptions::default();

    // Add database
    if db_path.exists() {
        let mut db_file = fs::File::open(&db_path).map_err(|e| e.to_string())?;
        let mut buf = Vec::new();
        db_file.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        zip_writer.start_file("media_library.db", opts).map_err(|e| e.to_string())?;
        zip_writer.write_all(&buf).map_err(|e| e.to_string())?;
    }

    // Add covers directory
    if covers_dir.exists() {
        for entry in fs::read_dir(&covers_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("music_cover_") || name_str.ends_with(".png") || name_str.ends_with(".jpg") {
                let mut f = fs::File::open(entry.path()).map_err(|e| e.to_string())?;
                let mut buf = Vec::new();
                f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
                zip_writer.start_file(&*format!("covers/{}", name_str), opts).map_err(|e| e.to_string())?;
                zip_writer.write_all(&buf).map_err(|e| e.to_string())?;
            }
        }
    }

    zip_writer.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn import_data(db: State<Database>, src_path: String) -> Result<(), String> {
    let data_dir = db.data_dir();
    let src = Path::new(&src_path);
    let file = fs::File::open(src).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    // Close database connection before overwriting (by letting conn go out of scope)
    // Extract all files to data_dir
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        let dest = data_dir.join(&name);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        if entry.is_dir() { continue; }
        let mut out = fs::File::create(&dest).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
    }

    Ok(())
}
