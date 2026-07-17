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

    let mut images: Vec<ImageItem> = stmt.query_map([], |row| {
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

    // Validate cover file existence — fall back to original if missing
    for img in images.iter_mut() {
        if img.cover_path.is_empty() {
            img.cover_path = img.file_path.clone();
        } else if !std::path::Path::new(&img.cover_path).exists() {
            img.cover_path = img.file_path.clone();
            let _ = conn.execute("UPDATE images SET cover_path=?1 WHERE id=?2", rusqlite::params![img.file_path, img.id]);
        }
    }

    Ok(images)
}

#[tauri::command]
pub fn add_images(db: State<Database>, paths: Vec<String>) -> Result<Vec<ImageItem>, String> {
    let data_dir = db.data_dir().to_path_buf();
    let covers_dir = data_dir.join("covers");
    std::fs::create_dir_all(&covers_dir).ok();

    // Ensure ffmpeg available
    let ffmpeg_bin = crate::commands::ffmpeg_helper::ffmpeg_path();
    if !ffmpeg_bin.exists() {
        ffmpeg_sidecar::download::auto_download().ok();
    }

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

        // ── 缩略图：JPEG 800px 高品质，单图约 150-300KB ──
        let thumb_path = covers_dir.join(format!("img_{}.jpg", id));
        let cover_path = if ffmpeg_bin.exists() {
            let _ = Command::new(&ffmpeg_bin)
                .args(["-y", "-i", path, "-vf", "scale=800:-1", "-q:v", "2", "-frames:v", "1"])
                .arg(thumb_path.to_str().unwrap_or(""))
                .arg(thumb_path.to_str().unwrap_or(""))
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status();
            if thumb_path.exists() { thumb_path.to_string_lossy().to_string() } else { path.clone() }
        } else {
            path.clone()
        };

        let img = ImageItem {
            id: id.clone(), name, file_path: path.clone(),
            cover_path, resolution,
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

/// 重建所有图片缩略图（后台异步调用，不阻塞 UI）
#[tauri::command]
pub fn backfill_image_thumbnails(db: State<Database>) -> Result<i64, String> {
    let data_dir = db.data_dir().to_path_buf();
    let covers_dir = data_dir.join("covers");
    std::fs::create_dir_all(&covers_dir).ok();

    let ffmpeg_bin = crate::commands::ffmpeg_helper::ffmpeg_path();
    if !ffmpeg_bin.exists() {
        ffmpeg_sidecar::download::auto_download().ok();
    }
    if !ffmpeg_bin.exists() {
        return Err("ffmpeg not available".to_string());
    }

    let conn = db.conn();
    // 全量重建（包括首次生成 + 替换旧的低品质 webp）
    let mut stmt = conn
        .prepare("SELECT id, file_path FROM images")
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    let mut count: i64 = 0;
    for (id, file_path) in rows {
        if !std::path::Path::new(&file_path).exists() {
            continue;
        }
        // 先清理旧的 webp 缩略图（如果存在）
        let old_webp = covers_dir.join(format!("img_{}.webp", id));
        if old_webp.exists() {
            let _ = std::fs::remove_file(&old_webp);
        }
        let old_jpg = covers_dir.join(format!("img_{}.jpg", id));
        if old_jpg.exists() {
            let _ = std::fs::remove_file(&old_jpg);
        }

        let thumb_path = covers_dir.join(format!("img_{}.jpg", id));
        let ok = Command::new(&ffmpeg_bin)
            .args(["-y", "-i", &file_path, "-vf", "scale=800:-1", "-q:v", "2", "-frames:v", "1"])
            .arg(thumb_path.to_str().unwrap_or(""))
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false);

        if ok && thumb_path.exists() {
            let thumb = thumb_path.to_string_lossy().to_string();
            let _ = conn.execute("UPDATE images SET cover_path=?1 WHERE id=?2", rusqlite::params![thumb, id]);
            count += 1;
        }
    }
    Ok(count)
}
