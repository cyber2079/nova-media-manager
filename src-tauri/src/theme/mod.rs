pub mod crypto;
pub mod loader;
pub mod packer;
pub mod protocol;

use crate::db::Database;
use loader::InstalledTheme;
use tauri::State;

// ═══════════════ TAURI COMMANDS ═══════════════

/// Install a .nvtp theme file from a given path and register in the protocol.
#[tauri::command]
pub fn install_theme_file(
    db: State<'_, Database>,
    file_path: String,
) -> Result<InstalledTheme, String> {
    let nvtp_data =
        std::fs::read(&file_path).map_err(|e| format!("Failed to read file: {e}"))?;
    let theme = loader::install_theme(db.data_dir(), &nvtp_data)?;
    // Pre-load into memory so assets are available immediately
    protocol::global().lock().map_err(|e| e.to_string())?.ensure_loaded(&theme.id).ok();
    Ok(theme)
}

/// Install a .nvtp from raw bytes (downloaded from server) and register in protocol.
#[tauri::command]
pub fn install_theme_bytes(
    db: State<'_, Database>,
    data: Vec<u8>,
) -> Result<InstalledTheme, String> {
    let theme = loader::install_theme(db.data_dir(), &data)?;
    // Pre-load into memory
    protocol::global().lock().map_err(|e| e.to_string())?.ensure_loaded(&theme.id).ok();
    Ok(theme)
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
