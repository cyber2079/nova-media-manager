//! Theme Studio — CRUD for theme projects. Dev-only (.env gate on frontend).

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

const THEMES_DIR: &str = r"D:\nova-proprietary\themes";
const ASSETS_DIR: &str = r"D:\nova-themes-assets";
const PUBLIC_THEMES: &str = r"D:\nova-media-manager\public\themes";

fn public_dir(theme_id: &str) -> String {
    match theme_id { "ice-girl" => "ice girl".into(), "cyber-girl" => "cyber girl".into(), _ => theme_id.to_string() }
}

// ═══════════════ TYPES ═══════════════

#[derive(Debug, Serialize, Deserialize, Clone)] #[serde(rename_all = "camelCase")]
pub struct ThemeProject {
    pub id: String, pub name: String, pub version: String,
    #[serde(rename = "type")] pub theme_type: String,
    pub status: String, pub requires_license: String,
    pub description: Option<String>,
    pub asset_count: usize, pub done_count: usize,
    pub script_node_count: usize, pub total_asset_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)] #[serde(rename_all = "camelCase")]
pub struct ScriptNode {
    pub id: String, pub label: String,
    pub background: String,
    pub face: String, pub text: String, pub bgm: String,
    pub skill_show: bool,
    pub thumb_ok: bool, pub thumb_url: String, pub thumb_size: u64,
    pub i18n_preview: String,
    pub face_ok: bool, pub face_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)] #[serde(rename_all = "camelCase")]
pub struct AssetItem {
    pub id: String, pub status: String, #[serde(rename = "type")] pub asset_type: String,
    pub path: String, pub description: String,
    pub exists: bool, pub thumb_url: String, pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)] #[serde(rename_all = "camelCase")]
pub struct ThemeDetail {
    pub manifest: serde_json::Value, pub prompts: serde_json::Value,
    pub script: Vec<ScriptNode>, pub assets: Vec<AssetItem>,
    pub type_description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)] #[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub id: String, pub name: String, pub theme_type: String, pub requires_license: String,
}

#[derive(Debug, Serialize, Deserialize)] #[serde(rename_all = "camelCase")]
pub struct ValidateResult { pub ok: bool, pub errors: Vec<String>, pub warnings: Vec<String> }

// ═══════════════ COMMANDS ═══════════════

#[tauri::command]
pub fn theme_studio_list_projects() -> Result<Vec<ThemeProject>, String> {
    let dir = Path::new(THEMES_DIR);
    if !dir.exists() { return Ok(vec![]); }
    let mut projs = Vec::new();
    for e in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        let p = e.path();
        if !p.is_dir() { continue; }
        let mp = p.join("manifest.json");
        if !mp.exists() { continue; }
        let raw = fs::read_to_string(&mp).unwrap_or_default();
        let m: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
        let id = p.file_name().unwrap_or_default().to_string_lossy().to_string();
        let ac = m["assets"].as_array().map(|a| a.len()).unwrap_or(0);
        let done = m["assets"].as_array().map(|a| a.iter().filter(|x| x["status"]=="done").count()).unwrap_or(0);
        let sn = m["script"].as_array().map(|a| a.len()).unwrap_or(0);
        let (_, tb) = count_public_assets(&id);
        projs.push(ThemeProject {
            id,
            name: m["name"].as_str().unwrap_or("?").to_string(),
            version: m["version"].as_str().unwrap_or("0.1").to_string(),
            theme_type: m["type"].as_str().unwrap_or("static").to_string(),
            status: m["status"].as_str().unwrap_or("draft").to_string(),
            requires_license: m["requiresLicense"].as_str().unwrap_or("pro").to_string(),
            description: m["description"].as_str().map(|s| s.to_string()),
            asset_count: ac, done_count: done, script_node_count: sn, total_asset_bytes: tb,
        });
    }
    projs.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(projs)
}

#[tauri::command]
pub fn theme_studio_get_project(theme_id: String) -> Result<ThemeDetail, String> {
    let proj_dir = Path::new(THEMES_DIR).join(&theme_id);
    if !proj_dir.exists() { return Err(format!("not found: {}", theme_id)); }
    let manifest: serde_json::Value = read_json(&proj_dir.join("manifest.json"));
    let prompts: serde_json::Value = read_json(&proj_dir.join("prompts.json"));
    let theme_type = manifest["type"].as_str().unwrap_or("static");
    let pd = &public_dir(&theme_id);
    let pub_dir = Path::new(PUBLIC_THEMES).join(pd);
    let bg_default = manifest["backgroundDefault"].as_str().unwrap_or("").to_string();

    let assets = build_assets(&manifest, &pub_dir, pd);
    let script = build_script(&manifest, &pub_dir, pd, theme_type, &bg_default);

    let type_desc = match theme_type {
        "story" => "线性剧情推进 · 背景图按脚本切换 + BGM分区",
        "dynamic" => "背景视频 + 打字机轮播 + 表情随机切换",
        "static" => "纯壁纸/渐变 · 无剧情无交互",
        "hybrid" => "story + dynamic 组合模式",
        _ => "",
    }.to_string();

    Ok(ThemeDetail { manifest, prompts, script, assets, type_description: type_desc })
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

    let assets: Vec<serde_json::Value> = match input.theme_type.as_str() {
        "dynamic" => {
            let mut a = vec![];
            for f in ["smug","happy","angry","cry","petty","naughty","neutral","surprise"] {
                a.push(serde_json::json!({"id":format!("face-{}",f),"status":"todo","type":"image","path":format!("faces/{}.webp",f),"description":format!("表情: {}",f)}));
            }
            a.push(serde_json::json!({"id":"bg-video","status":"todo","type":"video","path":"video/bg-loop.mp4","description":"背景视频"}));
            a.push(serde_json::json!({"id":"head","status":"todo","type":"image","path":"head.webp","description":"头像"}));
            a
        }
        _ => vec![],
    };

    let manifest = serde_json::json!({
        "id": format!("com.nova.{}", input.id), "name": input.name, "version": "0.1.0",
        "type": input.theme_type, "status": "draft", "requiresLicense": input.requires_license,
        "author":"Nova","description":"","cssFile":"theme.css","preview":"preview.webp",
        "config":{"accent":"#6366f1","characters":[]},
        "assets": assets, "script": [],
    });

    let prompts = match input.theme_type.as_str() {
        "dynamic" => serde_json::json!({"type":"dynamic","model":"doubao-seedream-4-5-251128","global":{"style":"","ratio":"16:9","negativePrompt":"模糊、低画质、水印、文字、logo"},"background":{"type":"video","model":"doubao-seedance-1-0-pro-fast-251015","prompt":"","duration":10},"faces":{"smug":{"type":"image","prompt":"","ratio":"1:1"},"happy":{"type":"image","prompt":"","ratio":"1:1"},"angry":{"type":"image","prompt":"","ratio":"1:1"},"cry":{"type":"image","prompt":"","ratio":"1:1"},"petty":{"type":"image","prompt":"","ratio":"1:1"},"naughty":{"type":"image","prompt":"","ratio":"1:1"},"neutral":{"type":"image","prompt":"","ratio":"1:1"},"surprise":{"type":"image","prompt":"","ratio":"1:1"},"head":{"type":"image","prompt":"","ratio":"1:1"}}}),
        "story" => serde_json::json!({"type":"story","model":"doubao-seedream-4-5-251128","global":{"style":"","ratio":"16:9","negativePrompt":"模糊、低画质、水印、文字、logo"},"scenes":{}}),
        _ => serde_json::json!({"type":"static"}),
    };

    fs::write(proj_dir.join("manifest.json"), serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    if input.theme_type != "static" { fs::write(proj_dir.join("prompts.json"), serde_json::to_string_pretty(&prompts).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?; }

    Ok(ThemeProject { id: input.id, name: input.name, version: "0.1.0".into(), theme_type: input.theme_type, status: "draft".into(), requires_license: input.requires_license, description: None, asset_count: assets.len(), done_count: 0, script_node_count: 0, total_asset_bytes: 0 })
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
    let pub_dir = Path::new(PUBLIC_THEMES).join(&pd);
    if let Some(script) = m["script"].as_array() {
        for node in script {
            let bg = node["background"].as_str().unwrap_or("");
            if !bg.is_empty() && !pub_dir.join(bg).exists() {
                errs.push(format!("script.{}.background '{}' not found", node["id"].as_str().unwrap_or("?"), bg));
            }
        }
    }
    Ok(ValidateResult { ok: errs.is_empty(), errors: errs, warnings: vec![] })
}

/// Update the script array, re-serialize to manifest.json
#[tauri::command]
pub fn theme_studio_update_script(theme_id: String, script: Vec<serde_json::Value>) -> Result<(), String> {
    let proj_dir = Path::new(THEMES_DIR).join(&theme_id);
    let path = proj_dir.join("manifest.json");
    let mut manifest: serde_json::Value = read_json(&path);
    manifest["script"] = serde_json::json!(script);
    fs::write(&path, serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

/// Runtime command — used by Home.tsx to drive rendering from manifest.script
#[tauri::command]
pub fn theme_get_script(theme_id: String) -> Result<Vec<ScriptNode>, String> {
    let proj_dir = Path::new(THEMES_DIR).join(&theme_id);
    let manifest: serde_json::Value = read_json(&proj_dir.join("manifest.json"));
    let pd = &public_dir(&theme_id);
    let pub_dir = Path::new(PUBLIC_THEMES).join(pd);
    let bg_default = manifest["backgroundDefault"].as_str().unwrap_or("").to_string();
    let theme_type = manifest["type"].as_str().unwrap_or("static");
    Ok(build_script(&manifest, &pub_dir, pd, theme_type, &bg_default))
}

#[tauri::command]
pub async fn theme_studio_generate(theme_id: String) -> Result<String, String> {
    let s = std::process::Command::new("node").arg("D:\\nova-media-manager\\scripts\\theme-generate.mjs").arg(&theme_id).output().map_err(|e| format!("Fail: {e}"))?;
    let o = String::from_utf8_lossy(&s.stdout).to_string(); let e = String::from_utf8_lossy(&s.stderr).to_string();
    if s.status.success() { Ok(o) } else { Err(format!("{o}\n{e}")) }
}

// ═══════════════ BUILDERS ═══════════════

fn build_assets(manifest: &serde_json::Value, pub_dir: &Path, pd: &str) -> Vec<AssetItem> {
    let mut items: Vec<AssetItem> = Vec::new();
    let mut known_paths = std::collections::HashSet::new();

    // 1. Collect from manifest
    if let Some(arr) = manifest["assets"].as_array() {
        for a in arr {
            let path = a["path"].as_str().unwrap_or(a["id"].as_str().unwrap_or("?")).to_string();
            let fp = pub_dir.join(&path);
            let (exists, size) = if fp.exists() { (true, fp.metadata().map(|m| m.len()).unwrap_or(0)) } else { (false, 0) };
            known_paths.insert(path.clone().to_lowercase());
            items.push(AssetItem {
                id: a["id"].as_str().unwrap_or("?").to_string(),
                status: if exists { "done".into() } else { a["status"].as_str().unwrap_or("todo").into() },
                asset_type: a["type"].as_str().unwrap_or("image").into(),
                path: path.clone(),
                description: a["description"].as_str().unwrap_or("").into(),
                exists,
                thumb_url: if exists { format!("themes/{}/{}", pd, path) } else { String::new() },
                size,
            });
        }
    }

    // 2. Scan disk for files not listed in manifest (e.g. new/deleted face, missing nav icon)
    // Only scan known subdirs to avoid picking up .DS_Store etc.
    for prefix in &["faces", "icons", "scenes", "video"] {
        let scan_dir = pub_dir.join(prefix);
        if !scan_dir.exists() || !scan_dir.is_dir() { continue; }
        if let Ok(entries) = std::fs::read_dir(&scan_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') { continue; }
                let rel = format!("{}/{}", prefix, name);
                if known_paths.contains(&rel.to_lowercase()) { continue; }
                let fp = scan_dir.join(&name);
                let size = fp.metadata().map(|m| m.len()).unwrap_or(0);
                let id = format!("disk-{}-{}", prefix, name.replace('.', "-"));
                items.push(AssetItem {
                    id,
                    status: "done".into(),
                    asset_type: guess_asset_type(&name),
                    path: rel.clone(),
                    description: String::new(),
                    exists: true,
                    thumb_url: format!("themes/{}/{}", pd, rel),
                    size,
                });
                known_paths.insert(rel.to_lowercase());
            }
        }
    }

    items
}

fn guess_asset_type(name: &str) -> String {
    let n = name.to_lowercase();
    if n.ends_with(".mp4") || n.ends_with(".webm") { "video".into() }
    else if n.ends_with(".mp3") || n.ends_with(".m4a") { "audio".into() }
    else { "image".into() }
}

fn build_script(manifest: &serde_json::Value, pub_dir: &Path, pd: &str, _theme_type: &str, bg_default: &str) -> Vec<ScriptNode> {
    manifest["script"].as_array().map(|arr| arr.iter().map(|node| {
        let bg = if let Some(s) = node["background"].as_str() { s }
            else if !bg_default.is_empty() { bg_default }
            else { "" };
        let face = node["face"].as_str().unwrap_or("");
        let text = node["text"].as_str().unwrap_or("");

        // background thumb
        let (thumb_ok, thumb_url, thumb_size) = if bg.is_empty() {
            (false, String::new(), 0u64)
        } else {
            let full = pub_dir.join(bg);
            if full.exists() { (true, format!("themes/{}/{}", pd, bg), full.metadata().map(|m| m.len()).unwrap_or(0)) }
            else { (false, String::new(), 0) }
        };

        // face thumb
        let (face_ok, face_url) = if face.is_empty() || face == "video:secretary" {
            (false, String::new())
        } else {
            let fp = pub_dir.join("faces").join(format!("{}.webp", face));
            if fp.exists() { (true, format!("themes/{}/faces/{}.webp", pd, face)) }
            else { (false, String::new()) }
        };

        // i18n preview
        let i18n_preview = if !text.is_empty() { format!("🗣️ {}", text) } else { String::new() };

        ScriptNode {
            id: node["id"].as_str().unwrap_or("?").to_string(),
            label: node["label"].as_str().unwrap_or("").to_string(),
            background: bg.to_string(),
            face: face.to_string(),
            text: text.to_string(),
            bgm: node["bgm"].as_str().unwrap_or("").to_string(),
            skill_show: node["skillShow"].as_bool().unwrap_or(false),
            thumb_ok, thumb_url, thumb_size,
            i18n_preview,
            face_ok, face_url,
        }
    }).collect()).unwrap_or_default()
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
    walk_files(&d, &mut c, &mut b); (c, b)
}

fn walk_files(dir: &Path, count: &mut usize, bytes: &mut u64) {
    if let Ok(entries) = fs::read_dir(dir) { for e in entries.flatten() { let p = e.path(); if p.is_dir() { walk_files(&p, count, bytes); } else { *count += 1; *bytes += e.metadata().map(|m| m.len()).unwrap_or(0); } } }
}
