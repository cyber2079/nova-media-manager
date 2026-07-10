use crate::commands::game::Game;
use crate::db::Database;
use std::path::Path;
use tauri::State;

fn find_game_exe(dir: &Path) -> Option<String> {
    if !dir.exists() { return None; }
    let mut exes: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().map(|e| e == "exe").unwrap_or(false) {
                exes.push(p);
            }
        }
    }
    let dir_name = dir.file_name().unwrap_or_default().to_string_lossy().to_lowercase()
        .replace([' ', '_', '-'], "");
    for exe in &exes {
        let exe_clean = exe.file_stem().unwrap_or_default().to_string_lossy().to_lowercase()
            .replace([' ', '_', '-'], "");
        if exe_clean.contains(&dir_name) || dir_name.contains(&exe_clean) {
            return Some(exe.to_string_lossy().to_string());
        }
    }
    let filtered: Vec<&std::path::PathBuf> = exes.iter().filter(|p| {
        let name = p.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
        !name.contains("unins") && !name.contains("crash") && !name.contains("redist") && !name.contains("vcredist")
    }).collect();
    if filtered.is_empty() { return None; }
    let mut best = filtered[0];
    let mut best_sz = 0u64;
    for f in &filtered {
        if let Ok(meta) = std::fs::metadata(f) {
            if meta.len() > best_sz { best_sz = meta.len(); best = f; }
        }
    }
    Some(best.to_string_lossy().to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub new_games: Vec<Game>,
    pub diagnostic: Vec<String>,
}

#[tauri::command]
pub fn scan_steam_games(db: State<Database>) -> Result<ScanResult, String> {
    let mut diag: Vec<String> = Vec::new();

    // Step 1: locate Steam
    diag.push("正在定位 Steam 安装目录...".into());
    let steam = match steamlocate::locate() {
        Ok(s) => {
            diag.push(format!("✓ 找到 Steam: {}", s.path().display()));
            s
        }
        Err(e) => {
            diag.push(format!("✗ 定位失败: {e}"));
            return Ok(ScanResult { new_games: vec![], diagnostic: diag });
        }
    };

    // Step 2: enumerate libraries
    diag.push("正在读取游戏库列表...".into());
    let libraries = match steam.libraries() {
        Ok(libs) => {
            diag.push(format!("✓ 找到 {} 个游戏库", libs.len()));
            libs
        }
        Err(e) => {
            diag.push(format!("✗ 读取库列表失败: {e}"));
            return Ok(ScanResult { new_games: vec![], diagnostic: diag });
        }
    };

    let add_time = chrono::Utc::now().to_rfc3339();
    let conn = db.conn();
    let mut new_games: Vec<Game> = Vec::new();
    let mut total_apps = 0u32;
    let mut skipped_exists = 0u32;
    let mut skipped_dir_missing = 0u32;

    for lib_result in libraries {
        let lib = match lib_result {
            Ok(l) => l,
            Err(e) => {
                diag.push(format!("✗ 跳过损坏的库: {e}"));
                continue;
            }
        };

        let steamapps = lib.path().join("steamapps");
        diag.push(format!("库: {} (steamapps exists: {})", lib.path().display(), steamapps.exists()));

        for app_result in lib.apps() {
            let app = match app_result {
                Ok(a) => a,
                Err(e) => {
                    diag.push(format!("  跳过损坏的 app: {e}"));
                    continue;
                }
            };
            total_apps += 1;

            let name = app.name.clone().unwrap_or_else(|| format!("App {}", app.app_id));
            let id = format!("steam_{}", app.app_id);
            let exists: bool = conn.query_row(
                "SELECT COUNT(*) > 0 FROM games WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get(0),
            ).unwrap_or(false);
            if exists {
                skipped_exists += 1;
                diag.push(format!("  · 已存在 → {} (id={id})", name));
                continue;
            }
            let install_path = steamapps.join("common").join(&app.install_dir);

            if !install_path.exists() {
                skipped_dir_missing += 1;
                diag.push(format!("  ✗ 目录不存在: {} ({name})", install_path.display()));
                continue;
            }

            let exe_path = find_game_exe(&install_path).unwrap_or_default();
            diag.push(format!("  ✓ [{}] {}", app.app_id, name));

            let game = Game {
                id,
                name,
                executable_path: exe_path,
                cover_path: String::new(),
                platform: "Steam".to_string(),
                tags: vec![],
                add_time: add_time.clone(),
            };

            let tags_json = serde_json::to_string(&game.tags).unwrap_or_default();
            conn.execute(
                "INSERT OR IGNORE INTO games (id, name, executable_path, cover_path, platform, tags, add_time) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                rusqlite::params![game.id, game.name, game.executable_path, game.cover_path, game.platform, tags_json, game.add_time],
            ).map_err(|e| e.to_string())?;

            new_games.push(game);
        }
    }

    diag.push(format!(
        "总计 {} 个 app | 已存在跳过 {} 个 | 安装目录缺失 {} 个 | 新增入库 {} 个",
        total_apps, skipped_exists, skipped_dir_missing, new_games.len()
    ));

    Ok(ScanResult { new_games, diagnostic: diag })
}
