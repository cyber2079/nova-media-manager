//! Theme Studio — read/write theme project files from the frontend.
//! Reads from D:\nova-proprietary\themes\ and D:\nova-themes-assets\

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

const THEMES_DIR: &str = r"D:\nova-proprietary\themes";
const ASSETS_DIR: &str = r"D:\nova-themes-assets";

// ═══════════════ TYPES ═══════════════

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeProject {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(rename = "type")]
    pub theme_type: String,
    pub status: String,
    pub requires_license: String,
    pub description: Option<String>,
    pub scene_count: usize,
    pub done_count: usize,
    pub asset_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeScene {
    pub id: String,
    pub status: String,
    #[serde(rename = "type")]
    pub scene_type: String,
    pub prompt_key: String,
    pub description: Option<String>,
    pub asset_path: Option<String>,
    pub thumbnail_exists: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeDetail {
    pub manifest: serde_json::Value,
    pub prompts: serde_json::Value,
    pub scenes: Vec<ThemeScene>,
    pub assets: Vec<String>,
}

// ═══════════════ COMMANDS ═══════════════

/// List all theme projects with summary stats.
#[tauri::command]
pub fn theme_studio_list_projects() -> Result<Vec<ThemeProject>, String> {
    let themes_dir = Path::new(THEMES_DIR);
    if !themes_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();
    let entries = fs::read_dir(themes_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let manifest_path = path.join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }

        let json_str = fs::read_to_string(&manifest_path).unwrap_or_default();
        let manifest: serde_json::Value = serde_json::from_str(&json_str).unwrap_or_default();

        let id = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let name = manifest["name"].as_str().unwrap_or(&id).to_string();
        let version = manifest["version"].as_str().unwrap_or("0.1.0").to_string();
        let theme_type = manifest["type"].as_str().unwrap_or("static").to_string();
        let status = manifest["status"].as_str().unwrap_or("draft").to_string();
        let requires_license = manifest["requiresLicense"].as_str().unwrap_or("pro").to_string();
        let description = manifest["description"].as_str().map(|s| s.to_string());

        let scenes = manifest["scenes"].as_array().map(|a| a.len()).unwrap_or(0);
        let done = manifest["scenes"]
            .as_array()
            .map(|a| a.iter().filter(|s| s["status"] == "done").count())
            .unwrap_or(0);

        // Count assets
        let asset_dir = Path::new(ASSETS_DIR).join(&id);
        let asset_count = if asset_dir.exists() {
            fs::read_dir(&asset_dir)
                .map(|d| d.filter(|e| e.is_ok() && e.as_ref().unwrap().path().is_file()).count())
                .unwrap_or(0)
        } else {
            0
        };

        projects.push(ThemeProject {
            id,
            name,
            version,
            theme_type,
            status,
            requires_license,
            description,
            scene_count: scenes,
            done_count: done,
            asset_count,
        });
    }

    projects.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(projects)
}

/// Get full detail for a single theme project.
#[tauri::command]
pub fn theme_studio_get_project(theme_id: String) -> Result<ThemeDetail, String> {
    let proj_dir = Path::new(THEMES_DIR).join(&theme_id);
    if !proj_dir.exists() {
        return Err(format!("Theme project not found: {theme_id}"));
    }

    let manifest_path = proj_dir.join("manifest.json");
    let manifest: serde_json::Value = if manifest_path.exists() {
        let raw = fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&raw).unwrap_or_default()
    } else {
        serde_json::Value::Null
    };

    let prompts_path = proj_dir.join("prompts.json");
    let prompts: serde_json::Value = if prompts_path.exists() {
        let raw = fs::read_to_string(&prompts_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&raw).unwrap_or_default()
    } else {
        serde_json::Value::Null
    };

    // Build scenes list
    let mut scenes = Vec::new();
    if let Some(arr) = manifest["scenes"].as_array() {
        for s in arr {
            let sid = s["id"].as_str().unwrap_or("?").to_string();
            let stype = s["type"].as_str().unwrap_or("image").to_string();
            let status = s["status"].as_str().unwrap_or("todo").to_string();
            let prompt_key = s["promptKey"].as_str().unwrap_or(&sid).to_string();
            let description = s["description"].as_str().map(|d| d.to_string());
            let asset_path = s["assetPath"].as_str().map(|p| p.to_string());

            let thumbnail_exists = if let Some(ref ap) = asset_path {
                Path::new(ap).exists()
            } else {
                false
            };

            scenes.push(ThemeScene {
                id: sid,
                status,
                scene_type: stype,
                prompt_key,
                description,
                asset_path,
                thumbnail_exists,
            });
        }
    }

    // List assets
    let asset_dir = Path::new(ASSETS_DIR).join(&theme_id);
    let assets = if asset_dir.exists() {
        fs::read_dir(&asset_dir)
            .map(|d| {
                d.filter_map(|e| {
                    e.ok()
                        .map(|e| e.file_name().to_string_lossy().to_string())
                })
                .collect()
            })
            .unwrap_or_default()
    } else {
        vec![]
    };

    Ok(ThemeDetail {
        manifest,
        prompts,
        scenes,
        assets,
    })
}

/// Update a theme project's manifest.json.
#[tauri::command]
pub fn theme_studio_update_manifest(
    theme_id: String,
    manifest: serde_json::Value,
) -> Result<(), String> {
    let proj_dir = Path::new(THEMES_DIR).join(&theme_id);
    fs::create_dir_all(&proj_dir).map_err(|e| e.to_string())?;
    let path = proj_dir.join("manifest.json");
    let json = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

/// Run the generate script for a theme project.
#[tauri::command]
pub async fn theme_studio_generate(theme_id: String) -> Result<String, String> {
    let script = r"D:\nova-media-manager\scripts\theme-generate.mjs";
    let output = std::process::Command::new("node")
        .arg(script)
        .arg(&theme_id)
        .output()
        .map_err(|e| format!("Failed to run generator: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("{stdout}\n{stderr}"))
    }
}
