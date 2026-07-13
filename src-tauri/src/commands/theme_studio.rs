//! Theme Studio — full CRUD for theme projects. Dev-only.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

const THEMES_DIR: &str = r"D:\nova-proprietary\themes";
const ASSETS_DIR: &str = r"D:\nova-themes-assets";
const PUBLIC_THEMES: &str = r"D:\nova-media-manager\public\themes";

/// theme-id → public/themes directory name
fn public_dir(theme_id: &str) -> &'static str {
    match theme_id {
        "ice-girl" => "ice girl",
        "cyber-girl" => "cyber girl",
        _ => theme_id,
    }
}

// ═══════════════ TYPES ═══════════════

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeProject {
    pub id: String, pub name: String, pub version: String,
    #[serde(rename = "type")] pub theme_type: String,
    pub status: String, pub requires_license: String,
    pub description: Option<String>,
    pub scene_count: usize, pub done_count: usize,
    pub asset_count: usize, pub total_asset_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeScene {
    pub id: String, pub status: String, pub scene_type: String,
    pub prompt_key: String, pub description: String,
    /// Absolute path to actual thumbnail file (for convertFileSrc)
    pub thumbnail_path: String,
    pub thumbnail_exists: bool,
    pub asset_size: u64,
    /// AI prompt text
    pub prompt_text: String,
    /// i18n key for typewriter/story text (for frontend t())
    pub i18n_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeDetail {
    pub manifest: serde_json::Value,
    pub prompts: serde_json::Value,
    pub scenes: Vec<ThemeScene>,
    pub assets: Vec<String>,
    /// Theme type explanation
    pub type_description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub id: String, pub name: String, pub theme_type: String, pub requires_license: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateResult {
    pub ok: bool, pub errors: Vec<String>, pub warnings: Vec<String>,
}

// ═══════════════ COMMANDS ═══════════════

#[tauri::command]
pub fn theme_studio_list_projects() -> Result<Vec<ThemeProject>, String> {
    let dir = Path::new(THEMES_DIR);
    if !dir.exists() { return Ok(vec![]); }
    let mut projects = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() { continue; }
        let mp = path.join("manifest.json");
        if !mp.exists() { continue; }
        let raw = fs::read_to_string(&mp).unwrap_or_default();
        let m: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
        let id = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let nscenes = m["scenes"].as_array().map(|a| a.len()).unwrap_or(0);
        let done = m["scenes"].as_array().map(|a| a.iter().filter(|s| s["status"]=="done").count()).unwrap_or(0);
        let (ac, tb) = count_public_assets(&id);
        projects.push(ThemeProject {
            id,
            name: m["name"].as_str().unwrap_or("?").to_string(),
            version: m["version"].as_str().unwrap_or("0.1").to_string(),
            theme_type: m["type"].as_str().unwrap_or("static").to_string(),
            status: m["status"].as_str().unwrap_or("draft").to_string(),
            requires_license: m["requiresLicense"].as_str().unwrap_or("pro").to_string(),
            description: m["description"].as_str().map(|s| s.to_string()),
            scene_count: nscenes, done_count: done,
            asset_count: ac, total_asset_bytes: tb,
        });
    }
    projects.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(projects)
}

#[tauri::command]
pub fn theme_studio_get_project(theme_id: String) -> Result<ThemeDetail, String> {
    let proj_dir = Path::new(THEMES_DIR).join(&theme_id);
    if !proj_dir.exists() { return Err(format!("not found: {}", theme_id)); }

    let manifest: serde_json::Value = read_json(&proj_dir.join("manifest.json"));
    let prompts: serde_json::Value = read_json(&proj_dir.join("prompts.json"));
    let theme_type = manifest["type"].as_str().unwrap_or("static").to_string();
    let pd = public_dir(&theme_id);
    let pub_dir = Path::new(PUBLIC_THEMES).join(pd);

    // Build scenes with actual file mapping
    let mut scenes = Vec::new();
    if let Some(arr) = manifest["scenes"].as_array() {
        for s in arr {
            let sid = s["id"].as_str().unwrap_or("?").to_string();
            let stype = s["type"].as_str().unwrap_or("image").to_string();
            let status = s["status"].as_str().unwrap_or("todo").to_string();
            let pkey = s["promptKey"].as_str().unwrap_or(&sid).to_string();
            let desc = s["description"].as_str().unwrap_or("").to_string();

            // Resolve actual file path
            let (real_path, exists, size) = resolve_scene_file(&pub_dir, &sid, &stype);

            // Prompt text from prompts.json
            let prompt_text = find_prompt_text(&prompts, &theme_type, &pkey);

            // i18n key for typewriter/story text
            let i18n_key = if theme_type == "dynamic" && sid.starts_with("face-") {
                // dynamic faces don't have individual i18n keys; the text is in quotes
                format!("home.ice_quote_{}", sid.strip_prefix("face-").unwrap_or("1"))
            } else if theme_type == "story" {
                // story scenes: e.g. scene1 → home.cg_scene1_text
                let num: String = sid.chars().filter(|c| c.is_ascii_digit()).collect();
                format!("home.cg_scene{}_text", num)
            } else { String::new() };

            let actual_status = if exists { "done".to_string() } else { status };

            scenes.push(ThemeScene {
                id: sid, status: actual_status, scene_type: stype,
                prompt_key: pkey, description: desc,
                thumbnail_path: real_path,
                thumbnail_exists: exists,
                asset_size: size,
                prompt_text,
                i18n_key,
            });
        }
    }

    let type_desc = match theme_type.as_str() {
        "story" => "线性剧情推进 · 背景图切换 + BGM 分区 + 场景文案",
        "dynamic" => "背景视频 + 打字机轮播 + 表情随机切换",
        "static" => "纯壁纸/渐变背景 · 无剧情无交互",
        "hybrid" => "story + dynamic 组合模式",
        _ => "",
    }.to_string();

    let mut assets = list_files_recursive(&pub_dir);
    // Also list from ASSETS_DIR if it has something
    let assets2 = Path::new(ASSETS_DIR).join(&theme_id);
    if assets2.exists() {
        assets.extend(list_files_recursive(&assets2));
    }
    assets.sort(); assets.dedup();

    Ok(ThemeDetail { manifest, prompts, scenes, assets, type_description: type_desc })
}

#[tauri::command]
pub fn theme_studio_update_manifest(theme_id: String, manifest: serde_json::Value, prompts: Option<serde_json::Value>) -> Result<(), String> {
    if manifest["id"].is_null() { return Err("id required".into()); }
    let proj_dir = Path::new(THEMES_DIR).join(&theme_id);
    fs::create_dir_all(&proj_dir).map_err(|e| e.to_string())?;
    let path = proj_dir.join("manifest.json");
    if !path.starts_with(Path::new(THEMES_DIR)) { return Err("path traversal denied".into()); }
    fs::write(&path, serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    if let Some(p) = prompts {
        fs::write(proj_dir.join("prompts.json"), serde_json::to_string_pretty(&p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn theme_studio_create_project(input: CreateProjectInput) -> Result<ThemeProject, String> {
    if !input.id.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') { return Err("id must be a-z,0-9,.,-".into()); }
    if !["story","dynamic","static","hybrid"].contains(&input.theme_type.as_str()) { return Err("invalid type".into()); }
    let proj_dir = Path::new(THEMES_DIR).join(&input.id);
    if proj_dir.exists() { return Err("already exists".into()); }
    fs::create_dir_all(&proj_dir).map_err(|e| e.to_string())?;

    let scenes: Vec<serde_json::Value> = match input.theme_type.as_str() {
        "dynamic" => {
            let faces = ["lofty","happy","angry","cry","naughty","head"];
            let mut s: Vec<_> = faces.iter().map(|f| serde_json::json!({"id":format!("face-{}",f),"status":"todo","type":"image","promptKey":format!("face-{}",f),"description":format!("表情: {}",f)})).collect();
            s.push(serde_json::json!({"id":"bg-video","status":"todo","type":"video","promptKey":"bg-video","description":"背景视频"}));
            s
        }
        "story" => (1..=16).map(|i| {
            let iv = [1,6,7,9,10,11,15].contains(&i);
            serde_json::json!({"id":format!("scene{}",i),"status":"todo","type":if iv{"video"}else{"image"},"promptKey":format!("scene{}",i),"description":format!("场景{}",i)})
        }).collect(),
        "hybrid" => {
            let mut s: Vec<_> = (1..=16).map(|i| serde_json::json!({"id":format!("scene{}",i),"status":"todo","type":"image","promptKey":format!("scene{}",i)})).collect();
            for f in &["lofty","happy","angry","cry","naughty"] { s.push(serde_json::json!({"id":format!("face-{}",f),"status":"todo","type":"image","promptKey":format!("face-{}",f)})); }
            s
        }
        _ => vec![],
    };

    let manifest = serde_json::json!({
        "id": format!("com.nova.{}", input.id), "name": input.name, "version": "0.1.0",
        "type": input.theme_type, "status": "draft", "requiresLicense": input.requires_license,
        "author":"Nova","description":"","cssFile":"theme.css","preview":"preview.webp",
        "config":{"accent":"#6366f1","characters":[]},"scenes":scenes,
    });

    let prompts = match input.theme_type.as_str() {
        "dynamic" => serde_json::json!({"type":"dynamic","model":"doubao-seedream-4-5-251128","global":{"style":"","ratio":"16:9","negativePrompt":"模糊、低画质、水印、文字、logo"},"background":{"type":"video","model":"doubao-seedance-1-0-pro-fast-251015","prompt":"","duration":10},"faces":{"lofty":{"type":"image","prompt":"","ratio":"1:1"},"happy":{"type":"image","prompt":"","ratio":"1:1"},"angry":{"type":"image","prompt":"","ratio":"1:1"},"cry":{"type":"image","prompt":"","ratio":"1:1"},"naughty":{"type":"image","prompt":"","ratio":"1:1"},"head":{"type":"image","prompt":"","ratio":"1:1"}}}),
        "story" => serde_json::json!({"type":"story","model":"doubao-seedream-4-5-251128","global":{"style":"","ratio":"16:9","negativePrompt":"模糊、低画质、水印、文字、logo"},"scenes":{}}),
        _ => serde_json::json!({"type":"static"}),
    };

    fs::write(proj_dir.join("manifest.json"), serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    if input.theme_type != "static" { fs::write(proj_dir.join("prompts.json"), serde_json::to_string_pretty(&prompts).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?; }

    Ok(ThemeProject { id: input.id, name: input.name, version: "0.1.0".into(), theme_type: input.theme_type, status: "draft".into(), requires_license: input.requires_license, description: None, scene_count: scenes.len(), done_count: 0, asset_count: 0, total_asset_bytes: 0 })
}

#[tauri::command]
pub fn theme_studio_delete_asset(theme_id: String, file_name: String) -> Result<(), String> {
    let p = Path::new(ASSETS_DIR).join(&theme_id).join(&file_name);
    if !p.starts_with(Path::new(ASSETS_DIR).join(&theme_id)) { return Err("path traversal denied".into()); }
    if p.exists() { fs::remove_file(&p).map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
pub fn theme_studio_validate(theme_id: String) -> Result<ValidateResult, String> {
    let proj_dir = Path::new(THEMES_DIR).join(&theme_id);
    let m: serde_json::Value = read_json(&proj_dir.join("manifest.json"));
    let mut errs = vec![];
    for k in &["id","name","version","type","preview","cssFile"] {
        if m[*k].is_null() || m[*k].as_str().map(|s| s.is_empty()).unwrap_or(true) { errs.push(format!("manifest.{} is required", k)); }
    }
    let pd = public_dir(&theme_id);
    let pub_dir = Path::new(PUBLIC_THEMES).join(pd);
    if let Some(arr) = m["scenes"].as_array() {
        for s in arr {
            let sid = s["id"].as_str().unwrap_or("?");
            let st = s["status"].as_str().unwrap_or("todo");
            if st == "done" {
                let stype = s["type"].as_str().unwrap_or("image");
                let (_, exists, _) = resolve_scene_file(&pub_dir, sid, stype);
                if !exists { errs.push(format!("scene {} status=done but file not found", sid)); }
            }
        }
    }
    Ok(ValidateResult { ok: errs.is_empty(), errors: errs, warnings: vec![] })
}

#[tauri::command]
pub async fn theme_studio_generate(theme_id: String) -> Result<String, String> {
    let s = std::process::Command::new("node").arg("D:\\nova-media-manager\\scripts\\theme-generate.mjs").arg(&theme_id).output().map_err(|e| format!("Fail: {e}"))?;
    let o = String::from_utf8_lossy(&s.stdout).to_string();
    let e = String::from_utf8_lossy(&s.stderr).to_string();
    if s.status.success() { Ok(o) } else { Err(format!("{o}\n{e}")) }
}

// ═══════════════ HELPERS ═══════════════

fn read_json(p: &Path) -> serde_json::Value {
    if !p.exists() { return serde_json::Value::Null; }
    fs::read_to_string(p).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or(serde_json::Value::Null)
}

fn count_public_assets(theme_id: &str) -> (usize, u64) {
    let d = Path::new(PUBLIC_THEMES).join(public_dir(theme_id));
    if !d.exists() { return (0, 0); }
    let (mut c, mut b) = (0, 0u64);
    walk_files(&d, &mut c, &mut b);
    (c, b)
}

fn walk_files(dir: &Path, count: &mut usize, bytes: &mut u64) {
    if let Ok(entries) = fs::read_dir(dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() { walk_files(&p, count, bytes); }
            else { *count += 1; *bytes += e.metadata().map(|m| m.len()).unwrap_or(0); }
        }
    }
}

fn list_files_recursive(dir: &Path) -> Vec<String> {
    let mut v = vec![];
    if !dir.exists() { return v; }
    let prefix = dir.to_string_lossy().to_string();
    walk_list(dir, &prefix, &mut v);
    v
}

fn walk_list(dir: &Path, prefix: &str, out: &mut Vec<String>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() { walk_list(&p, prefix, out); }
            else { out.push(p.to_string_lossy().strip_prefix(prefix).unwrap_or("").trim_start_matches(&['\\','/']).to_string()); }
        }
    }
}

/// Map scene ID to actual file in public/themes/{dir}/
fn resolve_scene_file(pub_dir: &Path, scene_id: &str, scene_type: &str) -> (String, bool, u64) {
    // Try multiple naming conventions
    let candidates: Vec<String> = if scene_id.starts_with("face-") {
        let name = scene_id.strip_prefix("face-").unwrap();
        vec![
            pub_dir.join("faces").join(format!("{}.webp", name)),
            pub_dir.join("faces").join(format!("{} face.webp", name)), // legacy
        ]
    } else if scene_id == "head" {
        vec![pub_dir.join("head.webp")]
    } else if scene_id == "bg-video" || scene_id == "bg-loop" {
        vec![
            pub_dir.join("video").join("bg-loop.mp4"),
            pub_dir.join("video").join("bg-loop.webm"),
        ]
    } else if scene_id == "video-secretary" {
        vec![pub_dir.join("video").join("secretary.mp4")]
    } else if scene_id.starts_with("scene") {
        let num: String = scene_id.chars().filter(|c| c.is_ascii_digit()).collect();
        let ext = if scene_type == "video" { "mp4" } else { "webp" };
        vec![
            pub_dir.join("scenes").join(format!("scene-{:0>2}.{}", num, ext)), // scene-01.webp
            pub_dir.join("pic").join(format!("{}.{}", scene_id, ext)),          // legacy scene1.webp
        ]
    } else {
        let ext = if scene_type == "video" { "mp4" } else { "webp" };
        vec![pub_dir.join(format!("{}.{}", scene_id, ext))]
    };

    for p in &candidates {
        if p.exists() {
            let size = p.metadata().map(|m| m.len()).unwrap_or(0);
            return (p.to_string_lossy().to_string(), true, size);
        }
    }

    (candidates.first().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(), false, 0)
}

fn find_prompt_text(prompts: &serde_json::Value, theme_type: &str, prompt_key: &str) -> String {
    if theme_type == "dynamic" {
        if let Some(f) = prompts["faces"].get(prompt_key.strip_prefix("face-").unwrap_or(prompt_key)) {
            return f["prompt"].as_str().unwrap_or("").to_string();
        }
        if prompt_key == "bg-video" || prompt_key == "bg-loop" {
            return prompts["background"]["prompt"].as_str().unwrap_or("").to_string();
        }
    }
    if let Some(s) = prompts["scenes"].get(prompt_key) {
        return s["prompt"].as_str().unwrap_or("").to_string();
    }
    String::new()
}
