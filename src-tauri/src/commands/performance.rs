// ── 性能调优命令 ──
// Windows 进程优先级 + 缓存清理

use serde::{Deserialize, Serialize};
use tauri::command;
use tauri::State;
use std::collections::HashSet;

use crate::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceInfo {
    pub priority_level: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CleanupResult {
    pub deleted: u32,
    pub freed_bytes: u64,
}

/// 获取当前性能信息
#[command]
pub fn get_performance_info() -> Result<PerformanceInfo, String> {
    let level = get_current_priority();
    Ok(PerformanceInfo {
        priority_level: level,
    })
}

/// 设置进程优先级
#[command]
pub fn set_process_priority(level: String) -> Result<(), String> {
    set_priority(&level)
}

/// 清理 covers 目录中的无效文件（DB 中已不存在对应 media 记录的封面/缩略图）
#[command]
pub fn cleanup_invalid_covers(db: State<Database>) -> Result<CleanupResult, String> {
    let conn = db.conn();
    let covers_dir = db.data_dir().join("covers");

    if !covers_dir.exists() {
        return Ok(CleanupResult { deleted: 0, freed_bytes: 0 });
    }

    // ── 收集所有有效 ID ──
    let mut valid_ids: HashSet<String> = HashSet::new();

    let mut collect = |query: &str| -> Result<(), String> {
        let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        for r in rows {
            if let Ok(id) = r {
                valid_ids.insert(id);
            }
        }
        Ok(())
    };

    // 有 cover_path 的表：movies, images, music, games
    // Track success count — if all fail, abort to avoid wiping all covers.
    let mut collect_ok = 0u8;
    if collect("SELECT id FROM movies").is_ok() { collect_ok += 1; }
    if collect("SELECT id FROM images").is_ok() { collect_ok += 1; }
    if collect("SELECT id FROM music").is_ok() { collect_ok += 1; }
    if collect("SELECT id FROM games").is_ok() { collect_ok += 1; }
    if collect_ok == 0 {
        return Err("Failed to query any cover tables — aborting cleanup to avoid data loss".into());
    }

    // ── 遍历 covers 目录，按前缀匹配删除孤儿文件 ──
    // 文件名规则:
    //   movie:         {uuid}_{timestamp}.jpg
    //   image:         img_{uuid}.jpg / img_{uuid}.webp
    //   music:         music_cover_{uuid}.jpg / music_cover_{uuid}_thumb.webp
    //   game (Steam):  game_steam_{app_id}_portrait.jpg / game_steam_{app_id}_landscape.jpg
    //
    // UUID 格式: 8-4-4-4-12 hex digits，如 "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

    let mut deleted = 0u32;
    let mut freed_bytes = 0u64;

    if let Ok(entries) = std::fs::read_dir(&covers_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Skip non-cover files
            let is_movie = name.ends_with(".jpg") && !name.starts_with("img_") && !name.starts_with("music_cover_") && !name.starts_with("game_");
            let is_image = name.starts_with("img_");
            let is_music = name.starts_with("music_cover_");
            let is_game = name.starts_with("game_steam_") && (name.ends_with(".jpg") || name.ends_with(".webp"));
            if !is_movie && !is_image && !is_music && !is_game {
                continue;
            }

            // Extract ID from filename
            let id = if is_game {
                // game_steam_{app_id}_portrait.jpg → steam_{app_id}
                extract_steam_app_id(name)
            } else {
                extract_uuid_from_filename(name)
            };
            if id.is_empty() || valid_ids.contains(&id) {
                continue;
            }

            // Invalid — safe to delete
            if let Ok(meta) = std::fs::metadata(&path) {
                freed_bytes += meta.len();
            }
            if std::fs::remove_file(&path).is_ok() {
                deleted += 1;
            }
        }
    }

    Ok(CleanupResult { deleted, freed_bytes })
}

// ═══════════════ Windows 实现 ═══════════════

/// Extract a UUID v4 string from a filename, e.g. "img_a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
fn extract_uuid_from_filename(name: &str) -> String {
    let n = name.len();
    if n < 36 { return String::new(); }
    // Slide a 36-char window over the filename bytes (no heap alloc needed)
    let bytes = name.as_bytes();
    for i in 0..=n - 36 {
        if likely_uuid_36(&bytes[i..]) {
            return name[i..i + 36].to_string();
        }
    }
    String::new()
}

/// Extract Steam app ID from game cover filename like "game_steam_524410_portrait.jpg"
/// Returns "steam_524410" to match the games table primary key.
fn extract_steam_app_id(name: &str) -> String {
    let rest = name.strip_prefix("game_steam_").unwrap_or(name);
    // Find suffix like _portrait or _landscape
    if let Some(suffix_pos) = rest.rfind("_portrait.").or_else(|| rest.rfind("_landscape.")) {
        let digits = &rest[..suffix_pos];
        if !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit()) {
            return format!("steam_{digits}");
        }
    }
    String::new()
}

fn likely_uuid_36(s: &[u8]) -> bool {
    // positions: 8 hex, '-', 4 hex, '-', 4 hex, '-', 4 hex, '-', 12 hex
    const DASH: bool = false;
    const HEX: bool = true;
    const PAT: [bool; 36] = [
        HEX,HEX,HEX,HEX,HEX,HEX,HEX,HEX, DASH,
        HEX,HEX,HEX,HEX, DASH,
        HEX,HEX,HEX,HEX, DASH,
        HEX,HEX,HEX,HEX, DASH,
        HEX,HEX,HEX,HEX,HEX,HEX,HEX,HEX,HEX,HEX,HEX,HEX,
    ];
    for i in 0..36 {
        let expect_hex = PAT[i];
        let c = s[i];
        match (expect_hex, c) {
            (DASH, b'-') => continue,
            (HEX, c) if c.is_ascii_hexdigit() => continue,
            _ => return false,
        }
    }
    true
}

#[cfg(target_os = "windows")]
fn get_current_priority() -> String {
    match std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command",
            "(Get-Process -Id $pid).PriorityClass"
        ])
        .output()
    {
        Ok(o) => {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_lowercase();
            if s.contains("abovenormal") { "above_normal".into() }
            else if s.contains("high") { "high".into() }
            else { "normal".into() }
        }
        Err(_) => "normal".into(),
    }
}

#[cfg(not(target_os = "windows"))]
fn get_current_priority() -> String { "normal".into() }

#[cfg(target_os = "windows")]
fn set_priority(level: &str) -> Result<(), String> {
    // Strict whitelist — reject anything not explicitly allowed (prevents command injection)
    let class = match level {
        "normal" => "Normal",
        "above_normal" => "AboveNormal",
        "high" => "High",
        other => return Err(format!("Invalid priority level: {}", other)),
    };
    let script = format!("(Get-Process -Id $pid).PriorityClass = '{}'", class);
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| format!("Failed to set priority: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Set priority failed: {}", err));
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_priority(_level: &str) -> Result<(), String> { Ok(()) }
