use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Movie {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub cover_path: String,
    pub duration: String,
    pub duration_seconds: i64,
    pub resolution: String,
    pub file_size: i64,
    pub format: String,
    pub tags: Vec<String>,
    pub add_time: String,
    pub status: String,
    #[serde(default)]
    pub error_msg: String,
}

impl Movie {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        let tags_str: String = row.get::<_, String>(9)?;
        let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
        let error_msg: String = row.get::<_, String>(12).unwrap_or_default();
        Ok(Movie {
            id: row.get(0)?, name: row.get(1)?, file_path: row.get(2)?,
            cover_path: row.get(3)?, duration: row.get(4)?,
            duration_seconds: row.get(5)?, resolution: row.get(6)?,
            file_size: row.get(7)?, format: row.get(8)?, tags,
            add_time: row.get(10)?, status: row.get(11)?, error_msg,
        })
    }
}

fn format_duration(seconds: f64) -> String {
    let h = (seconds / 3600.0) as u64;
    let m = ((seconds % 3600.0) / 60.0) as u64;
    let s = (seconds % 60.0) as u64;
    if h > 0 { format!("{:02}:{:02}:{:02}", h, m, s) }
    else { format!("{:02}:{:02}", m, s) }
}

/// Combined video processing: metadata + cover via ffmpeg-sidecar.
/// Returns (duration_secs, formatted_duration, resolution, cover_path, error_msg).
fn process_video(video_path: &str, cover_output: &str) -> (f64, String, String, String, String) {
    let mut error_msg = String::new();

    let ffprobe_bin = crate::commands::ffmpeg_helper::ffprobe_path();
    let (duration, resolution) = if ffprobe_bin.exists() {
        let output = Command::new(&ffprobe_bin)
            .args(["-v", "error", "-show_entries", "format=duration:stream=width,height",
                   "-of", "csv=p=0", video_path])
            .output();
        match output {
            Ok(out) if out.status.success() => {
                let text = String::from_utf8_lossy(&out.stdout);
                let lines: Vec<&str> = text.trim().lines().collect();
                let dur = lines.last().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
                let res = if lines.len() >= 2 {
                    let dims: Vec<&str> = lines[0].split(',').collect();
                    if dims.len() >= 2 { format!("{}x{}", dims[0].trim(), dims[1].trim()) }
                    else { String::new() }
                } else { String::new() };
                (dur, res)
            }
            _ => { error_msg.push_str("ffprobe failed; "); (0.0, String::new()) }
        }
    } else {
        error_msg.push_str("ffprobe not found; ");
        (0.0, String::new())
    };

    let ffmpeg_bin = crate::commands::ffmpeg_helper::ffmpeg_path();
    let cover_path = if ffmpeg_bin.exists() {
        let mut cover = String::new();
        // Try 5 seek points spread evenly through the video
        for offset in [0u32, 15, 30, 60, 120] {
            let out = Command::new(&ffmpeg_bin)
                .args([
                    "-y", "-ss", &offset.to_string(), "-i", video_path,
                    "-vframes", "1", "-q:v", "4",
                    "-vf", "scale=400:-1",
                    cover_output,
                ])
                .output();
            match out {
                Ok(o) if o.status.success() => {
                    cover = cover_output.to_string();
                    break;
                }
                Ok(o) => {
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    error_msg.push_str(&format!("seek {}s err: {}; ", offset, stderr.lines().last().unwrap_or("").chars().take(60).collect::<String>()));
                }
                Err(e) => {
                    error_msg.push_str(&format!("spawn err: {}; ", e));
                    break;
                }
            }
        }
        cover
    } else {
        error_msg.push_str("ffmpeg not found; ");
        String::new()
    };

    let formatted = if duration > 0.0 { format_duration(duration) } else { String::new() };
    (duration, formatted, resolution, cover_path, error_msg)
}

#[tauri::command]
pub fn get_all_movies(db: State<Database>) -> Result<Vec<Movie>, String> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT id, name, file_path, cover_path, duration, duration_seconds,          resolution, file_size, format, tags, add_time, status, error_msg FROM movies"
    ).map_err(|e| e.to_string())?;

    let mut movies: Vec<Movie> = stmt.query_map([], |row| Movie::from_row(row))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Validate cover file existence on load — stale paths produce blank cards
    for m in movies.iter_mut() {
        if !m.cover_path.is_empty() && !std::path::Path::new(&m.cover_path).exists() {
            m.cover_path.clear();
            // Update DB so it stays fixed across restarts
            let _ = conn.execute(
                "UPDATE movies SET cover_path='' WHERE id=?1",
                rusqlite::params![m.id],
            );
        }
    }

    Ok(movies)
}

#[tauri::command]
pub fn add_movies(app: AppHandle, db: State<'_, Database>, paths: Vec<String>) -> Result<Vec<Movie>, String> {
    // Auto-download FFmpeg if not installed
    if !crate::commands::ffmpeg_helper::ffmpeg_path().exists() {
        eprintln!("[tauri] FFmpeg not found, auto-downloading...");
        ffmpeg_sidecar::download::auto_download().ok();
    }

    let mut movies = Vec::new();

    for path in &paths {
        let file_path = Path::new(path);
        if !file_path.exists() { continue; }
        let name = file_path.file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        let ext = file_path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let file_size = std::fs::metadata(path).map(|m| m.len() as i64).unwrap_or(0);
        let id = uuid::Uuid::new_v4().to_string();
        let add_time = chrono::Utc::now().to_rfc3339();

        let movie = Movie {
            id: id.clone(), name, file_path: path.clone(),
            cover_path: String::new(), duration: String::new(),
            duration_seconds: 0, resolution: String::new(),
            file_size, format: ext, tags: vec![],
            add_time: add_time.clone(), status: "processing".to_string(),
            error_msg: String::new(),
        };

        {
            let conn = db.conn();
            let tags_json = serde_json::to_string(&movie.tags).unwrap_or_default();
            conn.execute(
                "INSERT OR IGNORE INTO movies (id, name, file_path, cover_path, duration,                  duration_seconds, resolution, file_size, format, tags, add_time, status, error_msg)                  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                rusqlite::params![movie.id, movie.name, movie.file_path, movie.cover_path,
                    movie.duration, movie.duration_seconds, movie.resolution, movie.file_size,
                    movie.format, tags_json, movie.add_time, movie.status, movie.error_msg],
            ).map_err(|e| e.to_string())?;
        }

        movies.push(movie.clone());

        // Background processing on dedicated thread
        let app_clone = app.clone();
        let path_owned = path.clone();
        let movie_id = id.clone();
        std::thread::spawn(move || {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let covers_dir = app_clone.path().app_data_dir().unwrap().join("data").join("covers");
                std::fs::create_dir_all(&covers_dir).ok();
                let cover_out = covers_dir.join(format!("{}.png", movie_id));
                let cover_out_str = cover_out.to_string_lossy().to_string();

                eprintln!("[bg] processing video: {}", path_owned);
                process_video(&path_owned, &cover_out_str)
            }));

            let (duration, formatted, resolution, cover_path, error_msg, status) = match result {
                Ok((d, f, r, c, e)) => (d, f, r, c, e, "ready"),
                Err(_) => {
                    let err = "后台处理异常，请重新导入".to_string();
                    (0.0, String::new(), String::new(), String::new(), err, "error")
                }
            };

            // Update DB
            {
                let db = app_clone.state::<Database>();
                let conn = db.conn();
                let _ = conn.execute(
                    "UPDATE movies SET duration=?1, duration_seconds=?2, \
                     resolution=?3, cover_path=?4, status=?5, error_msg=?6 WHERE id=?7",
                    rusqlite::params![
                        formatted, duration as i64,
                        if !resolution.is_empty() { &resolution } else { "Unknown" },
                        if !cover_path.is_empty() { &cover_path } else { "" },
                        status, error_msg, movie_id,
                    ],
                );
            }

            // Re-read and emit
            {
                let db = app_clone.state::<Database>();
                let conn = db.conn();
                if let Ok(movie) = conn.query_row(
                    "SELECT id, name, file_path, cover_path, duration, duration_seconds, \
                     resolution, file_size, format, tags, add_time, status, error_msg \
                     FROM movies WHERE id=?1",
                    rusqlite::params![movie_id],
                    |r: &rusqlite::Row| Movie::from_row(r),
                ) {
                    let _ = app_clone.emit("movie-updated", &movie);
                }
            }
        });
    }

    Ok(movies)
}

#[tauri::command]
pub fn delete_movie(db: State<Database>, id: String) -> Result<bool, String> {
    let conn = db.conn();
    conn.execute("DELETE FROM movies WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn update_movie_tags(db: State<Database>, id: String, tags: Vec<String>) -> Result<bool, String> {
    let conn = db.conn();
    let tags_json = serde_json::to_string(&tags).unwrap_or_default();
    conn.execute("UPDATE movies SET tags = ?1 WHERE id = ?2", rusqlite::params![tags_json, id])
        .map_err(|e| e.to_string())?;
    Ok(true)
}
