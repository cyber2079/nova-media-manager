use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QuickLaunchItem {
    pub id: String,
    pub name: String,
    pub program_path: String,
    pub icon_path: String,
    pub sort_order: i32,
}

#[tauri::command]
pub fn get_quick_launch(db: State<Database>) -> Result<Vec<QuickLaunchItem>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare("SELECT id, name, program_path, icon_path, sort_order FROM quick_launch ORDER BY sort_order")
        .map_err(|e| e.to_string())?;
    let items = stmt.query_map([], |row| {
        Ok(QuickLaunchItem { id: row.get(0)?, name: row.get(1)?, program_path: row.get(2)?, icon_path: row.get(3)?, sort_order: row.get(4)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(items)
}

#[tauri::command]
pub fn add_quick_launch(db: State<Database>, program_path: String) -> Result<QuickLaunchItem, String> {
    let fp = Path::new(&program_path);
    let name = fp.file_stem().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
    let id = uuid::Uuid::new_v4().to_string();
    let conn = db.conn();
    let max_order: i32 = conn.query_row("SELECT COALESCE(MAX(sort_order), -1) FROM quick_launch", [], |row| row.get(0)).unwrap_or(-1);
    let item = QuickLaunchItem { id: id.clone(), name, program_path: program_path.clone(), icon_path: String::new(), sort_order: max_order + 1 };
    conn.execute("INSERT OR IGNORE INTO quick_launch (id, name, program_path, icon_path, sort_order) VALUES (?1,?2,?3,?4,?5)",
        rusqlite::params![item.id, item.name, item.program_path, item.icon_path, item.sort_order]).map_err(|e| e.to_string())?;
    Ok(item)
}

#[tauri::command]
pub fn remove_quick_launch(db: State<Database>, id: String) -> Result<bool, String> {
    let conn = db.conn();
    conn.execute("DELETE FROM quick_launch WHERE id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn launch_quick_item(program_path: String) -> Result<bool, String> {
    // Strip Zone.Identifier ADS (Mark of the Web) to prevent SmartScreen prompt
    let _ = std::fs::remove_file(format!("{}:Zone.Identifier", &program_path));

    // open crate uses ShellExecuteW on Windows, xdg-open/macOS open elsewhere
    open::that(&program_path).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Batch check: given a list of program paths, return which ones are currently running.
/// Uses a single sysinfo enumeration — no per-item overhead.
#[tauri::command]
pub fn check_programs_running(program_paths: Vec<String>) -> Result<Vec<bool>, String> {
    use sysinfo::System;
    use std::collections::HashSet;

    let sys = System::new_all();
    let mut running_exe_names: HashSet<String> = HashSet::new();
    let mut running_full_paths: HashSet<String> = HashSet::new();

    for proc in sys.processes().values() {
        if let Some(exe) = proc.exe() {
            let full = exe.to_string_lossy().to_lowercase();
            // Collect the exe filename only (last component) for fast matching
            if let Some(name) = exe.file_name() {
                running_exe_names.insert(name.to_string_lossy().to_lowercase());
            }
            running_full_paths.insert(full);
        }
    }

    let results: Vec<bool> = program_paths.iter().map(|p| {
        let p_lower = p.to_lowercase();
        let p_name = std::path::Path::new(p)
            .file_name()
            .map(|n| n.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        // Exact full-path match
        if running_full_paths.contains(&p_lower) {
            return true;
        }
        // Executable name match (e.g. "notepad.exe" found in process list)
        if !p_name.is_empty() && running_exe_names.contains(&p_name) {
            return true;
        }
        false
    }).collect();

    Ok(results)
}
