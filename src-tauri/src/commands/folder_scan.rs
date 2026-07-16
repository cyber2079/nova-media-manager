// ── 媒体路径展开：自动识别文件/文件夹 ──
// 传入任意路径数组：文件按扩展名过滤直接收，文件夹递归扫描；与库去重后返回新文件。
// 入库由前端调用各库现有 add 管线（封面/元数据/事件全复用），本模块纯只读。

use crate::db::Database;
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;
use tauri::State;

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExpandResult {
    pub files: Vec<String>,
    pub scanned_dirs: usize,
    pub truncated: bool, // 命中上限被截断 — 前端可提示再扫一次
}

const MOVIE_EXTS: &[&str] = &["mp4", "avi", "mov", "mkv", "flv", "wmv", "webm", "m4v", "ts", "m2ts", "rmvb"];
const MUSIC_EXTS: &[&str] = &["mp3", "flac", "wav", "m4a", "ogg", "wma", "aac"];
const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp"];

const MAX_DEPTH: usize = 8;
/// 单次扫描上限 — 防止误选盘符根目录一次灌爆媒体库
const MAX_FILES: usize = 2000;

fn exts_for(kind: &str) -> &'static [&'static str] {
    match kind {
        "movies" => MOVIE_EXTS,
        "music" => MUSIC_EXTS,
        "images" => IMAGE_EXTS,
        _ => &[],
    }
}

fn table_for(kind: &str) -> &'static str {
    match kind {
        "movies" => "movies",
        "music" => "music",
        _ => "images",
    }
}

fn walk(dir: &Path, depth: usize, exts: &[&str], existing: &HashSet<String>, out: &mut Vec<String>, dirs: &mut usize) {
    if depth > MAX_DEPTH || out.len() >= MAX_FILES { return; }
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    *dirs += 1;
    for e in entries.flatten() {
        let p = e.path();
        if p.is_dir() {
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            // 跳过隐藏目录和 Windows 系统目录
            if name.starts_with('.')
                || name.eq_ignore_ascii_case("$RECYCLE.BIN")
                || name.eq_ignore_ascii_case("System Volume Information") { continue; }
            walk(&p, depth + 1, exts, existing, out, dirs);
        } else {
            push_if_match(&p, exts, existing, out);
        }
        if out.len() >= MAX_FILES { return; }
    }
}

fn push_if_match(p: &Path, exts: &[&str], existing: &HashSet<String>, out: &mut Vec<String>) {
    if let Some(ext) = p.extension().and_then(|x| x.to_str()) {
        if exts.contains(&ext.to_lowercase().as_str()) {
            let s = p.to_string_lossy().to_string();
            if !existing.contains(&s) { out.push(s); }
        }
    }
}

fn existing_paths(conn: &rusqlite::Connection, table: &str) -> HashSet<String> {
    let mut set = HashSet::new();
    if let Ok(mut stmt) = conn.prepare(&format!("SELECT file_path FROM {}", table)) {
        if let Ok(rows) = stmt.query_map([], |r| r.get::<_, String>(0)) {
            for p in rows.flatten() { set.insert(p); }
        }
    }
    set
}

/// 自动识别路径类型并展开为待入库文件列表（去重后）
#[tauri::command]
pub fn expand_media_paths(db: State<Database>, paths: Vec<String>, kind: String) -> Result<ExpandResult, String> {
    let exts = exts_for(&kind);
    if exts.is_empty() { return Err(format!("未知媒体类型: {}", kind)); }

    // 先取已入库路径，锁尽早释放 — walk 期间不占 DB
    let existing = {
        let conn = db.conn();
        existing_paths(&conn, table_for(&kind))
    };

    let mut result = ExpandResult::default();
    for raw in &paths {
        let p = Path::new(raw);
        if p.is_dir() {
            walk(p, 0, exts, &existing, &mut result.files, &mut result.scanned_dirs);
        } else if p.is_file() {
            push_if_match(p, exts, &existing, &mut result.files);
        }
        if result.files.len() >= MAX_FILES { result.truncated = true; break; }
    }
    Ok(result)
}
