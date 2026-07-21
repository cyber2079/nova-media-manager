use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: String,
    pub name: String,
    pub executable_path: String,
    pub cover_path: String,
    pub landscape_path: String,
    pub platform: String,
    pub tags: Vec<String>,
    pub add_time: String,
    #[serde(default = "default_installed")]
    pub installed: bool,
}

fn default_installed() -> bool { true }

#[tauri::command]
pub fn get_all_games(db: State<Database>) -> Result<Vec<Game>, String> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT id, name, executable_path, cover_path, landscape_path, platform, tags, add_time FROM games"
    ).map_err(|e| e.to_string())?;

    let mut games: Vec<Game> = stmt.query_map([], |row| {
        let tags_str: String = row.get::<_, String>(6).unwrap_or_default();
        let exec: String = row.get(2)?;
        Ok(Game {
            id: row.get(0)?, name: row.get(1)?,
            executable_path: exec.clone(),
            installed: !exec.starts_with("steam://"),
            cover_path: row.get::<_, String>(3).unwrap_or_default(),
            landscape_path: row.get::<_, String>(4).unwrap_or_default(),
            platform: row.get::<_, String>(5).unwrap_or_default(),
            tags: serde_json::from_str(&tags_str).unwrap_or_default(),
            add_time: row.get::<_, String>(7).unwrap_or_default(),
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    // Validate local cover files — stale paths produce blank cards.
    // CDN URLs (https://...) skip filesystem validation.
    for g in games.iter_mut() {
        if !g.cover_path.is_empty()
            && !g.cover_path.starts_with("http")
            && !std::path::Path::new(&g.cover_path).exists()
        {
            g.cover_path.clear();
            let _ = conn.execute(
                "UPDATE games SET cover_path='' WHERE id=?1",
                rusqlite::params![g.id],
            );
        }
        if !g.landscape_path.is_empty()
            && !g.landscape_path.starts_with("http")
            && !std::path::Path::new(&g.landscape_path).exists()
        {
            g.landscape_path.clear();
            let _ = conn.execute(
                "UPDATE games SET landscape_path='' WHERE id=?1",
                rusqlite::params![g.id],
            );
        }
    }

    Ok(games)
}

#[tauri::command]
pub fn add_game(db: State<Database>, executable_path: String) -> Result<Vec<Game>, String> {
    let fp = Path::new(&executable_path);
    if !fp.exists() { return Err("File not found".to_string()); }
    let name = fp.file_stem().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
    let id = uuid::Uuid::new_v4().to_string();
    let add_time = chrono::Utc::now().to_rfc3339();

    // Detect platform
    let platform = if cfg!(target_os = "windows") { "Windows" }
        else if cfg!(target_os = "macos") { "macOS" }
        else { "Linux" };

    let game = Game {
        id: id.clone(), name, executable_path: executable_path.clone(),
        cover_path: String::new(), landscape_path: String::new(),
        platform: platform.to_string(),
        tags: vec![], add_time: add_time.clone(), installed: true,
    };

    let conn = db.conn();
    let tags_json = serde_json::to_string(&game.tags).unwrap_or_default();
    conn.execute(
        "INSERT OR IGNORE INTO games (id, name, executable_path, cover_path, platform, tags, add_time) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        rusqlite::params![game.id, game.name, game.executable_path, game.cover_path, game.platform, tags_json, game.add_time],
    ).map_err(|e| e.to_string())?;

    Ok(vec![game])
}

#[tauri::command]
pub fn delete_game(db: State<Database>, id: String) -> Result<bool, String> {
    let conn = db.conn();
    // Read cover paths before deleting the row so we can clean up local files
    let (cover_path, landscape): (String, String) = conn.query_row(
        "SELECT cover_path, landscape_path FROM games WHERE id = ?1",
        rusqlite::params![&id],
        |row| Ok((row.get(0).unwrap_or_default(), row.get(1).unwrap_or_default())),
    ).unwrap_or_default();
    let affected = conn.execute("DELETE FROM games WHERE id = ?1", rusqlite::params![&id])
        .map_err(|e| format!("删除失败: {e}"))?;
    if affected == 0 {
        return Err(format!("未找到游戏: {id}"));
    }
    // Clean up local cover files (silent best-effort)
    for p in [cover_path, landscape] {
        if !p.is_empty() && !p.starts_with("http") {
            let _ = std::fs::remove_file(&p);
        }
    }
    Ok(true)
}

#[tauri::command]
pub fn update_game_tags(db: State<Database>, id: String, tags: Vec<String>) -> Result<bool, String> {
    let conn = db.conn();
    let tags_json = serde_json::to_string(&tags).unwrap_or_default();
    conn.execute("UPDATE games SET tags = ?1 WHERE id = ?2", rusqlite::params![tags_json, id])
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn launch_game(db: State<Database>, id: String) -> Result<bool, String> {
    let conn = db.conn();
    let path: String = conn.query_row(
        "SELECT executable_path FROM games WHERE id = ?1",
        rusqlite::params![id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    // Strip Zone.Identifier ADS (Mark of the Web) to prevent SmartScreen prompt
    let _ = std::fs::remove_file(format!("{}:Zone.Identifier", &path));

    // Launch the game (open crate uses ShellExecuteW on Windows)
    open::that(&path).map_err(|e| e.to_string())?;

    Ok(true)
}
