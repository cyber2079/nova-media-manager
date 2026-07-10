use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageItem {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub cover_path: String,
    pub resolution: String,
    pub file_size: i64,
    pub width: i64,
    pub height: i64,
    pub tags: Vec<String>,
    pub add_time: String,
}

#[tauri::command]
pub fn get_all_images(db: State<Database>) -> Result<Vec<ImageItem>, String> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT id, name, file_path, cover_path, resolution, file_size, width, height, tags, add_time FROM images"
    ).map_err(|e| e.to_string())?;

    let images = stmt.query_map([], |row| {
        let tags_str: String = row.get(8)?;
        Ok(ImageItem {
            id: row.get(0)?, name: row.get(1)?, file_path: row.get(2)?,
            cover_path: row.get(3)?, resolution: row.get(4)?, file_size: row.get(5)?,
            width: row.get(6)?, height: row.get(7)?,
            tags: serde_json::from_str(&tags_str).unwrap_or_default(),
            add_time: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(images)
}

#[tauri::command]
pub fn add_images(db: State<Database>, paths: Vec<String>) -> Result<Vec<ImageItem>, String> {
    let mut images = Vec::new();
    for path in &paths {
        let fp = Path::new(path);
        if !fp.exists() { continue; }
        let name = fp.file_stem().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
        let size = std::fs::metadata(path).map(|m| m.len() as i64).unwrap_or(0);
        let (width, height) = probe_image_dims(path);
        let resolution = if width > 0 && height > 0 { format!("{} x {}", width, height) } else { String::new() };
        let id = uuid::Uuid::new_v4().to_string();
        let add_time = chrono::Utc::now().to_rfc3339();

        let img = ImageItem {
            id: id.clone(), name, file_path: path.clone(),
            cover_path: path.clone(), resolution,
            file_size: size, width, height, tags: vec![], add_time,
        };

        let conn = db.conn();
        let tags_json = serde_json::to_string(&img.tags).unwrap_or_default();
        conn.execute(
            "INSERT OR IGNORE INTO images (id, name, file_path, cover_path, resolution, file_size, width, height, tags, add_time) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            rusqlite::params![img.id, img.name, img.file_path, img.cover_path, img.resolution, img.file_size, img.width, img.height, tags_json, img.add_time],
        ).map_err(|e| e.to_string())?;

        images.push(img);
    }
    Ok(images)
}

#[tauri::command]
pub fn delete_image(db: State<Database>, id: String) -> Result<bool, String> {
    let conn = db.conn();
    conn.execute("DELETE FROM images WHERE id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(true)
}

fn probe_image_dims(path: &str) -> (i64, i64) {
    #[cfg(target_os = "windows")]
    {
        // Pass path via env var to prevent PowerShell injection
        let ps = r#"Add-Type -As System.Drawing;$i=[System.Drawing.Image]::FromFile($env:PROBE_IMG_PATH);Write-Output "$($i.Width)x$($i.Height)";$i.Dispose()"#;
        if let Ok(out) = Command::new("powershell")
            .args(["-NoProfile", "-Command", ps])
            .env("PROBE_IMG_PATH", path)
            .output() {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout);
                if let Some((w, h)) = s.trim().split_once('x') {
                    if let (Ok(w), Ok(h)) = (w.parse(), h.parse()) { return (w, h); }
                }
            }
        }
    }
    (0, 0)
}

#[tauri::command]
pub fn update_image_tags(db: State<Database>, id: String, tags: Vec<String>) -> Result<bool, String> {
    let conn = db.conn();
    let tags_json = serde_json::to_string(&tags).unwrap_or_default();
    conn.execute("UPDATE images SET tags = ?1 WHERE id = ?2", rusqlite::params![tags_json, id])
        .map_err(|e| e.to_string())?;
    Ok(true)
}
