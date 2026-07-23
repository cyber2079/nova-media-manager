pub mod crypto;
pub mod loader;
pub mod packer;
pub mod protocol;
pub mod tokens;

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

/// Resolve the full CSS variable block for a theme.
///
/// * `theme_id` — the active theme id ("default" or installed theme id)
/// * `user_overrides` — optional JSON of user-customized tokens (from SettingsStore)
///
/// Returns a CSS string like `:root { --nv-color-primary: #...; ... }`.
#[tauri::command]
pub fn get_theme_css_vars(
    theme_id: String,
    user_overrides: Option<String>,
) -> Result<String, String> {
    // 1. Load default as base
    let base = tokens::load_default();

    // 2. If the active theme is not "default", try to load its theme.json from the nvtp
    let merged = if theme_id == "default" {
        base
    } else {
        let proto = protocol::global().lock().map_err(|e| e.to_string())?;
        match proto.ensure_loaded(&theme_id) {
            Ok(()) => {},
            Err(e) => { log::warn!("[theme] ensure_loaded failed for '{theme_id}': {e}"); return Err(e); }
        }
        match proto.read_file(&theme_id, "theme.json") {
            Some(theme_json_bytes) => {
                let theme_json = String::from_utf8_lossy(&theme_json_bytes);
                tokens::merge_tokens(&base, &theme_json).unwrap_or(base)
            }
            None => {
                log::warn!("[theme] theme.json not found in '{theme_id}' .nvtp");
                base
            }
        }
    };

    // 3. Apply user overrides on top
    let final_tokens = match user_overrides {
        Some(ref ov) if !ov.is_empty() => tokens::merge_tokens(&merged, ov)?,
        _ => merged,
    };

    // 4. Flatten to CSS
    Ok(tokens::to_css_vars(&final_tokens))
}

/// Return the theme.css content from a loaded theme (if any).
#[tauri::command]
pub fn get_theme_css_content(theme_id: String) -> Result<String, String> {
    if theme_id == "default" { return Ok(String::new()); }
    let proto = protocol::global().lock().map_err(|e| e.to_string())?;
    match proto.ensure_loaded(&theme_id) {
        Ok(()) => {},
        Err(e) => return Err(e),
    }
    match proto.read_file(&theme_id, "theme.css") {
        Some(bytes) => Ok(String::from_utf8_lossy(&bytes).to_string()),
        None => Ok(String::new()),
    }
}

/// Return the default theme token JSON (for SettingsDialog palette defaults, etc.).
#[tauri::command]
pub fn get_default_theme_tokens() -> String {
    let t = tokens::load_default();
    serde_json::to_string_pretty(&t).unwrap_or_default()
}

/// Return all --nv-* CSS variables as a flat JSON object, already merged with
/// inherit + user overrides. Frontend writes them as inline styles on <html>.
#[tauri::command]
pub fn get_theme_css_json(
    theme_id: String,
    user_overrides: Option<String>,
) -> Result<String, String> {
    let base = tokens::load_default();
    let merged = if theme_id == "default" {
        base
    } else {
        let proto = protocol::global().lock().map_err(|e| e.to_string())?;
        match proto.ensure_loaded(&theme_id) {
            Ok(()) => {},
            Err(e) => { log::warn!("[theme] ensure_loaded failed for '{theme_id}': {e}"); return Err(e); }
        }
        match proto.read_file(&theme_id, "theme.json") {
            Some(b) => tokens::merge_tokens(&base, &String::from_utf8_lossy(&b)).unwrap_or(base),
            None => base,
        }
    };
    let final_tokens = match user_overrides {
        Some(ref ov) if !ov.is_empty() => tokens::merge_tokens(&merged, ov)?,
        _ => merged,
    };
    let css = tokens::to_css_vars(&final_tokens);
    // Parse the :root {} CSS into a flat JSON object
    let flat = tokens::parse_css_vars_to_json(&css);
    serde_json::to_string(&flat).map_err(|e| e.to_string())
}
