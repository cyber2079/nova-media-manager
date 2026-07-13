//! Theme Studio — full CRUD for theme projects. Dev-only (gated by .env on frontend).

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
    pub total_asset_bytes: u64,
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
    pub asset_size: u64,
    pub prompt_preview: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeDetail {
    pub manifest: serde_json::Value,
    pub prompts: serde_json::Value,
    pub scenes: Vec<ThemeScene>,
    pub assets: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub id: String,
    pub name: String,
    pub theme_type: String,
    pub requires_license: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateResult {
    pub ok: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

// ═══════════════ COMMANDS ═══════════════

#[tauri::command]
pub fn theme_studio_list_projects() -> Result<Vec<ThemeProject>, String> {
    let themes_dir = Path::new(THEMES_DIR);
    if !themes_dir.exists() { return Ok(vec![]); }

    let mut projects = Vec::new();
    let entries = fs::read_dir(themes_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() { continue; }

        let manifest_path = path.join("manifest.json");
        if !manifest_path.exists() { continue; }

        let json_str = fs::read_to_string(&manifest_path).unwrap_or_default();
        let manifest: serde_json::Value = serde_json::from_str(&json_str).unwrap_or_default();
        let id = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        let scenes = manifest["scenes"].as_array().map(|a| a.len()).unwrap_or(0);
        let done = manifest["scenes"].as_array()
            .map(|a| a.iter().filter(|s| s["status"] == "done").count()).unwrap_or(0);

        let (asset_count, total_bytes) = count_assets(&id);

        projects.push(ThemeProject {
            id,
            name: manifest["name"].as_str().unwrap_or("?").to_string(),
            version: manifest["version"].as_str().unwrap_or("0.1.0").to_string(),
            theme_type: manifest["type"].as_str().unwrap_or("static").to_string(),
            status: manifest["status"].as_str().unwrap_or("draft").to_string(),
            requires_license: manifest["requiresLicense"].as_str().unwrap_or("pro").to_string(),
            description: manifest["description"].as_str().map(|s| s.to_string()),
            scene_count: scenes, done_count: done,
            asset_count, total_asset_bytes: total_bytes,
        });
    }

    projects.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(projects)
}

#[tauri::command]
pub fn theme_studio_get_project(theme_id: String) -> Result<ThemeDetail, String> {
    let proj_dir = Path::new(THEMES_DIR).join(&theme_id);
    if !proj_dir.exists() { return Err(format!("Theme not found: {theme_id}")); }

    let manifest: serde_json::Value = read_json(&proj_dir.join("manifest.json"));
    let prompts: serde_json::Value = read_json(&proj_dir.join("prompts.json"));

    let mut scenes = Vec::new();
    if let Some(arr) = manifest["scenes"].as_array() {
        for s in arr {
            let sid = s["id"].as_str().unwrap_or("?").to_string();
            let stype = s["type"].as_str().unwrap_or("image").to_string();
            let status = s["status"].as_str().unwrap_or("todo").to_string();
            let prompt_key = s["promptKey"].as_str().unwrap_or(&sid).to_string();
            let description = s["description"].as_str().map(|d| d.to_string());
            let asset_path = s["assetPath"].as_str().map(|p| p.to_string());

            let (exists, size) = if let Some(ref ap) = asset_path {
                let p = Path::new(ap);
                (p.exists(), p.metadata().map(|m| m.len()).unwrap_or(0))
            } else { (false, 0) };

            let prompt_preview = if let Some(spec) = prompts["scenes"].get(&prompt_key) {
                spec["prompt"].as_str().unwrap_or("").to_string()
            } else if let Some(spec) = prompts["faces"].get(&prompt_key.strip_prefix("face-").unwrap_or(&prompt_key)) {
                spec["prompt"].as_str().unwrap_or("").to_string()
            } else if let Some(spec) = prompts["background"].as_object() {
                if prompt_key == "bg-loop" { spec["prompt"].as_str().unwrap_or("").to_string() } else { String::new() }
            } else { String::new() };

            scenes.push(ThemeScene {
                id: sid, status, scene_type: stype, prompt_key,
                description, asset_path, thumbnail_exists: exists,
                asset_size: size, prompt_preview,
            });
        }
    }

    let assets = list_asset_files(&theme_id);

    Ok(ThemeDetail { manifest, prompts, scenes, assets })
}

#[tauri::command]
pub fn theme_studio_update_manifest(
    theme_id: String,
    manifest: serde_json::Value,
    prompts: Option<serde_json::Value>,
) -> Result<(), String> {
    // Basic validation
    if manifest["id"].is_null() { return Err("id is required".into()); }
    if manifest["name"].is_null() { return Err("name is required".into()); }
    let id_field = manifest["id"].as_str().unwrap_or("");
    if !id_field.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err("id must be alphanumeric (a-z, 0-9, ., -)".into());
    }

    let proj_dir = Path::new(THEMES_DIR).join(&theme_id);
    fs::create_dir_all(&proj_dir).map_err(|e| e.to_string())?;

    let json = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    let path = proj_dir.join("manifest.json");
    // Security: ensure resolved path stays within themes dir
    if !path.starts_with(Path::new(THEMES_DIR)) {
        return Err("path traversal denied".into());
    }
    fs::write(&path, json).map_err(|e| e.to_string())?;

    if let Some(p) = prompts {
        let pjson = serde_json::to_string_pretty(&p).map_err(|e| e.to_string())?;
        let ppath = proj_dir.join("prompts.json");
        fs::write(&ppath, pjson).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn theme_studio_create_project(input: CreateProjectInput) -> Result<ThemeProject, String> {
    // Validate
    if !input.id.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err("id must be a-z, 0-9, ., -".into());
    }
    let valid_types = ["story", "dynamic", "static", "hybrid"];
    if !valid_types.contains(&input.theme_type.as_str()) {
        return Err(format!("invalid type: {}", input.theme_type));
    }

    let proj_dir = Path::new(THEMES_DIR).join(&input.id);
    if proj_dir.exists() {
        return Err(format!("Project {} already exists", input.id));
    }
    fs::create_dir_all(&proj_dir).map_err(|e| e.to_string())?;

    // Build skeleton manifest
    let scenes: Vec<serde_json::Value> = match input.theme_type.as_str() {
        "dynamic" => {
            let faces = ["lofty", "happy", "angry", "cry", "naughty", "head"];
            let mut s: Vec<serde_json::Value> = faces.iter().map(|f| serde_json::json!({
                "id": format!("face-{}", f), "status": "todo", "type": "image",
                "promptKey": format!("face-{}", f),
                "description": format!("表情: {}", f),
            })).collect();
            s.push(serde_json::json!({"id":"bg-video","status":"todo","type":"video","promptKey":"bg-video","description":"背景视频"}));
            s
        }
        "story" => (1..=16).map(|i| serde_json::json!({
            "id": format!("scene-{:02}", i), "status": "todo", "type": if [1,6,7,9,10,11,15].contains(&i) {"video"} else {"image"},
            "promptKey": format!("scene-{:02}", i),
            "description": format!("场景 {}", i),
        })).collect(),
        "hybrid" => {
            let mut s: Vec<serde_json::Value> = (1..=16).map(|i| serde_json::json!({
                "id": format!("scene-{:02}", i), "status": "todo", "type": "image",
                "promptKey": format!("scene-{:02}", i), "description": format!("场景 {}", i),
            })).collect();
            for f in &["lofty","happy","angry","cry","naughty"] {
                s.push(serde_json::json!({"id":format!("face-{}",f),"status":"todo","type":"image","promptKey":format!("face-{}",f)}));
            }
            s
        }
        _ => vec![],
    };

    let manifest = serde_json::json!({
        "id": format!("com.nova.{}", input.id),
        "name": input.name,
        "version": "0.1.0",
        "type": input.theme_type,
        "status": "draft",
        "requiresLicense": input.requires_license,
        "author": "Nova",
        "description": "",
        "cssFile": "theme.css",
        "preview": "preview.webp",
        "config": { "accent": "#6366f1", "characters": [] },
        "scenes": scenes,
    });

    // Build skeleton prompts
    let prompts: serde_json::Value = match input.theme_type.as_str() {
        "dynamic" => serde_json::json!({
            "type": "dynamic",
            "model": "doubao-seedream-4-5-251128",
            "global": { "style": "", "ratio": "16:9", "negativePrompt": "模糊、低画质、水印、文字、logo" },
            "background": { "type": "video", "model": "doubao-seedance-1-0-pro-fast-251015", "prompt": "", "duration": 10 },
            "faces": {
                "lofty": { "type": "image", "prompt": "", "ratio": "1:1" },
                "happy": { "type": "image", "prompt": "", "ratio": "1:1" },
                "angry": { "type": "image", "prompt": "", "ratio": "1:1" },
                "cry": { "type": "image", "prompt": "", "ratio": "1:1" },
                "naughty": { "type": "image", "prompt": "", "ratio": "1:1" },
                "head": { "type": "image", "prompt": "", "ratio": "1:1" },
            }
        }),
        "story" => serde_json::json!({
            "type": "story",
            "model": "doubao-seedream-4-5-251128",
            "global": { "style": "", "ratio": "16:9", "negativePrompt": "模糊、低画质、水印、文字、logo" },
            "scenes": {}
        }),
        "hybrid" => serde_json::json!({
            "type": "hybrid",
            "model": "doubao-seedream-4-5-251128",
            "global": { "style": "", "ratio": "16:9", "negativePrompt": "模糊、低画质、水印、文字、logo" },
            "scenes": {}, "faces": {}, "background": {"type":"video","prompt":"","duration":10}
        }),
        _ => serde_json::json!({ "type": "static" }),
    };

    // Write files
    let mjson = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(proj_dir.join("manifest.json"), mjson).map_err(|e| e.to_string())?;
    if input.theme_type != "static" {
        let pjson = serde_json::to_string_pretty(&prompts).map_err(|e| e.to_string())?;
        fs::write(proj_dir.join("prompts.json"), pjson).map_err(|e| e.to_string())?;
    }

    Ok(ThemeProject {
        id: input.id,
        name: input.name,
        version: "0.1.0".into(),
        theme_type: input.theme_type,
        status: "draft".into(),
        requires_license: input.requires_license,
        description: None,
        scene_count: scenes.len(),
        done_count: 0,
        asset_count: 0,
        total_asset_bytes: 0,
    })
}

#[tauri::command]
pub fn theme_studio_delete_asset(theme_id: String, file_name: String) -> Result<(), String> {
    let path = Path::new(ASSETS_DIR).join(&theme_id).join(&file_name);
    // Security check
    if !path.starts_with(Path::new(ASSETS_DIR).join(&theme_id)) {
        return Err("path traversal denied".into());
    }
    if path.exists() { fs::remove_file(&path).map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
pub fn theme_studio_validate(theme_id: String) -> Result<ValidateResult, String> {
    let proj_dir = Path::new(THEMES_DIR).join(&theme_id);
    let manifest: serde_json::Value = read_json(&proj_dir.join("manifest.json"));
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Required fields
    for key in &["id", "name", "version", "type", "preview", "cssFile"] {
        if manifest[key].is_null() || manifest[key].as_str().map(|s| s.is_empty()).unwrap_or(true) {
            errors.push(format!("manifest.{} is required", key));
        }
    }

    // Scenes check
    if let Some(arr) = manifest["scenes"].as_array() {
        for s in arr {
            let sid = s["id"].as_str().unwrap_or("?");
            let status = s["status"].as_str().unwrap_or("todo");
            if status == "done" {
                let ap = s["assetPath"].as_str().unwrap_or("");
                if ap.is_empty() || !Path::new(ap).exists() {
                    errors.push(format!("scene {} status=done but asset not found", sid));
                }
            }
            if status != "done" && status != "todo" && status != "skip" {
                warnings.push(format!("scene {} has unknown status: {}", sid, status));
            }
        }
    } else {
        errors.push("no scenes defined".into());
    }

    // preview.webp must exist if status >= packaged
    let status = manifest["status"].as_str().unwrap_or("draft");
    if status == "packaged" || status == "published" {
        let assets_dir = Path::new(ASSETS_DIR).join(&theme_id);
        if !assets_dir.join("preview.webp").exists() && !proj_dir.join("preview.webp").exists() {
            errors.push("preview.webp not found — required for packaging".into());
        }
    }

    Ok(ValidateResult {
        ok: errors.is_empty(),
        errors,
        warnings,
    })
}

#[tauri::command]
pub async fn theme_studio_generate(theme_id: String) -> Result<String, String> {
    let script = r"D:\nova-media-manager\scripts\theme-generate.mjs";
    let output = std::process::Command::new("node")
        .arg(script).arg(&theme_id)
        .output().map_err(|e| format!("Failed to run generator: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() { Ok(stdout) } else { Err(format!("{stdout}\n{stderr}")) }
}

// ═══════════════ HELPERS ═══════════════

fn read_json(path: &Path) -> serde_json::Value {
    if !path.exists() { return serde_json::Value::Null; }
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::Value::Null)
}

fn count_assets(theme_id: &str) -> (usize, u64) {
    let dir = Path::new(ASSETS_DIR).join(theme_id);
    if !dir.exists() { return (0, 0); }
    let mut count = 0usize;
    let mut bytes = 0u64;
    if let Ok(entries) = fs::read_dir(&dir) {
        for e in entries.flatten() {
            if e.path().is_file() {
                count += 1;
                bytes += e.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }
    (count, bytes)
}

fn list_asset_files(theme_id: &str) -> Vec<String> {
    let dir = Path::new(ASSETS_DIR).join(theme_id);
    if !dir.exists() { return vec![]; }
    fs::read_dir(&dir)
        .map(|d| d.filter_map(|e| e.ok().map(|e| e.file_name().to_string_lossy().to_string())).collect())
        .unwrap_or_default()
}
