use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Music {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub artist: String,
    pub album: String,
    pub duration_seconds: i32,
    pub duration: String,
    pub cover_path: String,
    pub tags: Vec<String>,
    pub add_time: String,
    pub status: String,
}

fn format_duration(seconds: f64) -> String {
    let m = (seconds / 60.0) as i32;
    let s = (seconds % 60.0) as i32;
    format!("{}:{:02}", m, s)
}

/// Parse artist/album/title from filename when tags are missing.
/// Supported formats: "Artist - Title.ext", "Artist - Album - Title.ext"
fn parse_filename_meta(file_stem: &str) -> Option<(String, String, String)> {
    let parts: Vec<&str> = file_stem.split(" - ").map(|s| s.trim()).collect();
    match parts.len() {
        2 => {
            // "Artist - Title"
            if !parts[0].is_empty() && !parts[1].is_empty() {
                Some((parts[0].to_string(), String::new(), parts[1].to_string()))
            } else { None }
        }
        3 => {
            // "Artist - Album - Title"
            Some((parts[0].to_string(), parts[1].to_string(), parts[2].to_string()))
        }
        _ => None,
    }
}

fn probe_metadata(path: &str) -> Option<(String, String, String, i32)> {
    // Use ffprobe from ffmpeg-sidecar to get artist, album, title, duration
    let ffprobe_bin = crate::commands::ffmpeg_helper::ffprobe_path();
    if !ffprobe_bin.exists() {
        crate::commands::ffmpeg_helper::ensure_ffmpeg();
    }
    let output = Command::new(&ffprobe_bin)
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            path,
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    let v: serde_json::Value = serde_json::from_str(&json_str).ok()?;

    let format = v.get("format")?;
    let tags = format.get("tags");

    let artist = tags
        .and_then(|t| t.get("artist").or_else(|| t.get("ARTIST")))
        .and_then(|a| a.as_str())
        .unwrap_or("")
        .to_string();

    let album = tags
        .and_then(|t| t.get("album").or_else(|| t.get("ALBUM")))
        .and_then(|a| a.as_str())
        .unwrap_or("")
        .to_string();

    let title = tags
        .and_then(|t| t.get("title").or_else(|| t.get("TITLE")))
        .and_then(|a| a.as_str())
        .unwrap_or("")
        .to_string();

    let duration_secs = format
        .get("duration")
        .and_then(|d| d.as_str())
        .and_then(|d| d.parse::<f64>().ok())
        .unwrap_or(0.0) as i32;

    Some((artist, album, title, duration_secs))
}

fn extract_cover(source_path: &str, cover_path: &str) -> bool {
    // Extract embedded album art using ffmpeg from ffmpeg-sidecar
    let ffmpeg_bin = crate::commands::ffmpeg_helper::ffmpeg_path();
    if !ffmpeg_bin.exists() {
        crate::commands::ffmpeg_helper::ensure_ffmpeg();
    }
    let output = Command::new(&ffmpeg_bin)
        .args([
            "-y",
            "-i", source_path,
            "-an",
            "-vcodec", "copy",
            cover_path,
        ])
        .output();

    match output {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

/// Generate a 128px-wide WebP thumbnail from an extracted cover image.
fn generate_thumbnail(cover_path: &str, thumb_path: &str) -> bool {
    let ffmpeg_bin = crate::commands::ffmpeg_helper::ffmpeg_path();
    if !ffmpeg_bin.exists() {
        crate::commands::ffmpeg_helper::ensure_ffmpeg();
    }
    let output = Command::new(&ffmpeg_bin)
        .args([
            "-y",
            "-i", cover_path,
            "-vf", "scale=128:-1",
            "-q:v", "80",
            "-frames:v", "1",
            thumb_path,
        ])
        .output();

    match output {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

#[tauri::command]
pub fn get_all_music(
    db: State<Database>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Music>, String> {
    let conn = db.conn();
    conn.execute(
        "CREATE TABLE IF NOT EXISTS music (
            id TEXT PRIMARY KEY, name TEXT, file_path TEXT, artist TEXT, album TEXT,
            duration_seconds INTEGER DEFAULT 0, duration TEXT, cover_path TEXT,
            tags TEXT DEFAULT '[]', add_time TEXT, status TEXT DEFAULT 'ready'
        )",
        [],
    ).map_err(|e| e.to_string())?;

    let mut sql = String::from(
        "SELECT id, name, file_path, artist, album, duration_seconds, duration, cover_path, tags, add_time, status FROM music"
    );
    if limit.unwrap_or(0) > 0 {
        sql.push_str(&format!(" LIMIT {}", limit.unwrap()));
        if let Some(off) = offset {
            if off > 0 { sql.push_str(&format!(" OFFSET {}", off)); }
        }
    }

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let music = stmt.query_map([], |row| {
        let tags_str: String = row.get(8)?;
        Ok(Music {
            id: row.get(0)?, name: row.get(1)?, file_path: row.get(2)?,
            artist: row.get(3)?, album: row.get(4)?,
            duration_seconds: row.get(5)?, duration: row.get(6)?,
            cover_path: row.get(7)?,
            tags: serde_json::from_str(&tags_str).unwrap_or_default(),
            add_time: row.get(9)?, status: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(music)
}

#[tauri::command]
pub fn add_music(db: State<Database>, file_paths: Vec<String>) -> Result<Vec<Music>, String> {
    let mut results = Vec::new();

    for path in &file_paths {
        let fp = Path::new(path);
        if !fp.exists() { continue; }

        let metadata = probe_metadata(path).unwrap_or_default();
        let (mut artist, mut album, mut title, duration_secs) = metadata;

        // Fallback: parse from filename if tags are empty
        let file_stem = fp.file_stem().and_then(|n| n.to_str()).unwrap_or("");
        if artist.is_empty() || title.is_empty() {
            if let Some((fa, fb, ft)) = parse_filename_meta(file_stem) {
                if artist.is_empty() { artist = fa; }
                if album.is_empty() { album = fb; }
                if title.is_empty() { title = ft; }
            }
        }

        let name = if !title.is_empty() { title }
            else { file_stem.to_string() };

        let id = uuid::Uuid::new_v4().to_string();
        let add_time = chrono::Utc::now().to_rfc3339();
        let duration = format_duration(duration_secs as f64);

        // Extract cover + generate 128px thumbnail
        let cover_path = if !db.data_dir().to_string_lossy().is_empty() {
            let cover = format!("{}/music_cover_{}.jpg", db.data_dir().to_string_lossy(), id);
            if extract_cover(path, &cover) {
                // Generate thumbnail in background (fire-and-forget)
                let thumb = format!("{}/music_cover_{}_thumb.webp", db.data_dir().to_string_lossy(), id);
                let cover_clone = cover.clone();
                std::thread::spawn(move || { generate_thumbnail(&cover_clone, &thumb); });
                cover
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        let music = Music {
            id: id.clone(), name, file_path: path.clone(),
            artist, album, duration_seconds: duration_secs, duration,
            cover_path, tags: vec![], add_time: add_time.clone(),
            status: "ready".into(),
        };

        let conn = db.conn();
        let tags_json = serde_json::to_string(&music.tags).unwrap_or_default();
        conn.execute(
            "INSERT OR IGNORE INTO music (id, name, file_path, artist, album, duration_seconds, duration, cover_path, tags, add_time, status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            rusqlite::params![music.id, music.name, music.file_path, music.artist, music.album, music.duration_seconds, music.duration, music.cover_path, tags_json, music.add_time, music.status],
        ).map_err(|e| e.to_string())?;

        results.push(music);
    }

    Ok(results)
}

#[tauri::command]
pub fn delete_music(db: State<Database>, id: String) -> Result<bool, String> {
    let conn = db.conn();
    conn.execute("DELETE FROM music WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn update_music_tags(db: State<Database>, id: String, tags: Vec<String>) -> Result<bool, String> {
    let conn = db.conn();
    let tags_json = serde_json::to_string(&tags).unwrap_or_default();
    conn.execute("UPDATE music SET tags = ?1 WHERE id = ?2", rusqlite::params![tags_json, id])
        .map_err(|e| e.to_string())?;
    Ok(true)
}
