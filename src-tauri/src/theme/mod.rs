pub mod crypto;
pub mod loader;
pub mod packer;

use crate::db::Database;
use loader::InstalledTheme;
use tauri::State;

// ═══════════════ TAURI COMMANDS ═══════════════

/// Install a .nvtp theme file from a given path.
/// The file must be a valid .nvtp format.
#[tauri::command]
pub fn install_theme_file(
    db: State<'_, Database>,
    file_path: String,
) -> Result<InstalledTheme, String> {
    let nvtp_data =
        std::fs::read(&file_path).map_err(|e| format!("Failed to read file: {e}"))?;
    loader::install_theme(db.data_dir(), &nvtp_data)
}

/// Install a .nvtp from raw bytes (used when downloading from server).
#[tauri::command]
pub fn install_theme_bytes(
    db: State<'_, Database>,
    data: Vec<u8>,
) -> Result<InstalledTheme, String> {
    loader::install_theme(db.data_dir(), &data)
}

/// List all installed themes.
#[tauri::command]
pub fn list_installed_themes(db: State<'_, Database>) -> Vec<InstalledTheme> {
    loader::list_themes(db.data_dir())
}

/// Remove an installed theme by ID.
#[tauri::command]
pub fn remove_installed_theme(db: State<'_, Database>, theme_id: String) -> Result<(), String> {
    loader::remove_theme(db.data_dir(), &theme_id)
}

/// Get the filesystem path to an installed theme's assets directory.
/// Returns the path as a string for use with asset protocol.
#[tauri::command]
pub fn get_theme_asset_path(
    db: State<'_, Database>,
    theme_id: String,
    asset_path: String,
) -> Result<String, String> {
    let dir = loader::theme_dir(db.data_dir(), &theme_id);
    let full = dir.join(&asset_path);

    // Security: ensure the resolved path is within the theme directory
    let canonical = full
        .canonicalize()
        .map_err(|e| format!("Asset not found: {e}"))?;
    if !canonical.starts_with(&dir) {
        return Err("Path traversal denied".to_string());
    }

    Ok(canonical.to_string_lossy().to_string())
}
