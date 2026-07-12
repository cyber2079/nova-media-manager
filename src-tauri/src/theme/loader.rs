//! Theme loader — manages installed .nvtp themes on disk.
//!
//! Themes are extracted to: {app_data_dir}/themes/{theme_id}/
//! Metadata is stored in a JSON registry: {app_data_dir}/themes/registry.json

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use super::packer::{self, ThemeManifest, unpack_theme};

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

/// Install a .nvtp file to the themes directory.
/// Returns the installed theme info.
pub fn install_theme(data_dir: &Path, nvtp_data: &[u8]) -> Result<InstalledTheme, String> {
    let (header, manifest, assets) = unpack_theme(nvtp_data)?;
    let theme_id = header.theme_id;

    // Check license requirement
    // (On the client side, we only check here. Server-side auth is separate.)
    // For now, allow installation regardless — the ThemeStore checks on selection.

    let themes_dir = data_dir.join("themes");
    let registry_path = themes_dir.join("registry.json");

    // Load registry
    let mut registry = load_registry(&registry_path);

    // Check if already installed — replace if so
    registry.themes.retain(|t| t.id != theme_id);

    // Extract theme assets
    let theme_dir = themes_dir.join(&theme_id);
    if theme_dir.exists() {
        fs::remove_dir_all(&theme_dir).ok();
    }
    fs::create_dir_all(&theme_dir)
        .map_err(|e| format!("Failed to create theme dir: {e}"))?;

    packer::extract_theme(&assets, &theme_dir)?;

    // Add to registry
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

    // Save registry
    fs::create_dir_all(&themes_dir).ok();
    let json = serde_json::to_string_pretty(&registry)
        .map_err(|e| format!("Registry JSON error: {e}"))?;
    fs::write(&registry_path, json).map_err(|e| format!("Failed to write registry: {e}"))?;

    Ok(installed)
}

/// List all installed themes.
pub fn list_themes(data_dir: &Path) -> Vec<InstalledTheme> {
    let registry_path = data_dir.join("themes").join("registry.json");
    let registry = load_registry(&registry_path);
    registry.themes
}

/// Remove a theme by ID.
pub fn remove_theme(data_dir: &Path, theme_id: &str) -> Result<(), String> {
    let themes_dir = data_dir.join("themes");
    let registry_path = themes_dir.join("registry.json");

    let mut registry = load_registry(&registry_path);
    let before = registry.themes.len();
    registry.themes.retain(|t| t.id != theme_id);
    if registry.themes.len() == before {
        return Err(format!("Theme '{theme_id}' is not installed"));
    }

    // Remove files
    let theme_dir = themes_dir.join(theme_id);
    if theme_dir.exists() {
        fs::remove_dir_all(&theme_dir).ok();
    }

    // Save registry
    let json = serde_json::to_string_pretty(&registry)
        .map_err(|e| format!("Registry JSON error: {e}"))?;
    fs::write(&registry_path, json).map_err(|e| format!("Failed to write registry: {e}"))?;

    Ok(())
}

/// Get the filesystem path to an installed theme's directory.
pub fn theme_dir(data_dir: &Path, theme_id: &str) -> PathBuf {
    data_dir.join("themes").join(theme_id)
}

/// Check if a theme is installed.
pub fn is_installed(data_dir: &Path, theme_id: &str) -> bool {
    let registry_path = data_dir.join("themes").join("registry.json");
    let registry = load_registry(&registry_path);
    registry.themes.iter().any(|t| t.id == theme_id)
}

// ═══════════════ INTERNAL ═══════════════

fn load_registry(registry_path: &Path) -> ThemeRegistry {
    match fs::read_to_string(registry_path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => ThemeRegistry::default(),
    }
}
