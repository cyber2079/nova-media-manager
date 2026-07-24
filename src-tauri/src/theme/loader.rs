//! Theme loader — manages .nvtp themes as encrypted blobs on disk.
//!
//! .nvtp files are stored at: {app_data_dir}/themes/nvtp/{theme_id}.nvtp
//! Metadata registry:        {app_data_dir}/themes/registry.json
//!
//! Theme assets are NEVER extracted to disk. Instead, the custom protocol
//! (nova://) decrypts ZIP contents in memory on-demand.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use super::packer::unpack_theme;

// ═══════════════ REGISTRY ═══════════════

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledTheme {
    pub id: String,
    pub name: String,
    pub author: String,
    pub version: String,
    pub requires_license: String,
    pub preview: String,
    pub css_file: String,
    pub installed_at: String,
    /// Whether this theme is active/selectable
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ThemeRegistry {
    pub themes: Vec<InstalledTheme>,
}

// ═══════════════ PUBLIC API ═══════════════

/// Install a .nvtp: store encrypted blob on disk + update registry.
/// No extraction. Protocol handles decryption on demand.
pub fn install_theme(data_dir: &Path, nvtp_data: &[u8]) -> Result<InstalledTheme, String> {
    let (header, manifest, _assets) = unpack_theme(nvtp_data)?;
    let theme_id = header.theme_id;

    let themes_dir = data_dir.join("themes");
    let nvtp_dir = themes_dir.join("nvtp");
    let registry_path = themes_dir.join("registry.json");

    // Ensure directories exist
    fs::create_dir_all(&nvtp_dir)
        .map_err(|e| format!("Failed to create nvtp dir: {e}"))?;

    // Store the encrypted .nvtp blob on disk
    let nvtp_path = nvtp_dir.join(format!("{}.nvtp", &theme_id));
    fs::write(&nvtp_path, nvtp_data)
        .map_err(|e| format!("Failed to write theme blob: {e}"))?;

    // Update registry
    let mut registry = load_registry(&registry_path);
    registry.themes.retain(|t| t.id != theme_id);

    let installed = InstalledTheme {
        id: theme_id.clone(),
        name: manifest.name,
        author: manifest.author,
        version: manifest.version,
        requires_license: manifest.requires_license.clone(),
        preview: manifest.preview,
        css_file: manifest.css_file,
        installed_at: chrono::Utc::now().to_rfc3339(),
        enabled: true,
    };
    registry.themes.push(installed.clone());

    let json = serde_json::to_string_pretty(&registry)
        .map_err(|e| format!("Registry JSON error: {e}"))?;
    fs::write(&registry_path, json)
        .map_err(|e| format!("Failed to write registry: {e}"))?;

    // Clean up old plaintext extraction from previous versions (migration)
    let old_extraction = themes_dir.join(&theme_id);
    if old_extraction.exists() && old_extraction.is_dir() {
        let _ = fs::remove_dir_all(&old_extraction);
    }

    Ok(installed)
}

/// List all installed themes from the registry.
pub fn list_themes(data_dir: &Path) -> Vec<InstalledTheme> {
    let registry_path = data_dir.join("themes").join("registry.json");
    let mut registry = load_registry(&registry_path);
    // One-off migration: rename "Cyberpunk" → "Cyberpunk2079"
    let mut changed = false;
    for t in &mut registry.themes {
        if t.id == "cyberpunk" && t.name == "Cyberpunk" {
            t.name = "Cyberpunk2079".into();
            changed = true;
        }
    }
    if changed {
        let _ = serde_json::to_string_pretty(&registry)
            .map(|json| std::fs::write(&registry_path, json));
    }
    registry.themes
}

/// Remove a theme by ID — deletes the .nvtp blob and registry entry.
pub fn remove_theme(data_dir: &Path, theme_id: &str) -> Result<(), String> {
    let themes_dir = data_dir.join("themes");
    let registry_path = themes_dir.join("registry.json");
    let nvtp_path = themes_dir.join("nvtp").join(format!("{}.nvtp", theme_id));

    let mut registry = load_registry(&registry_path);
    let before = registry.themes.len();
    registry.themes.retain(|t| t.id != theme_id);
    if registry.themes.len() == before {
        return Err(format!("Theme '{theme_id}' is not installed"));
    }

    // Remove .nvtp blob
    if nvtp_path.exists() {
        fs::remove_file(&nvtp_path).ok();
    }

    // Save registry
    let json = serde_json::to_string_pretty(&registry)
        .map_err(|e| format!("Registry JSON error: {e}"))?;
    fs::write(&registry_path, json)
        .map_err(|e| format!("Failed to write registry: {e}"))?;

    Ok(())
}

// ═══════════════ INTERNAL ═══════════════

fn load_registry(registry_path: &Path) -> ThemeRegistry {
    match fs::read_to_string(registry_path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => ThemeRegistry::default(),
    }
}
