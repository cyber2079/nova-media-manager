//! Custom URI scheme protocol — nova://theme/{id}/{path}
//!
//! Theme assets stored as XOR-encrypted ZIP blobs on disk.
//! On first access, the ZIP is decrypted in memory.
//! Plaintext assets NEVER touch disk.

use std::collections::HashMap;
use std::io::{Cursor, Read};
use std::sync::{Mutex, OnceLock};
use zip::ZipArchive;

use super::packer::unpack_theme;

// ═══════════════ STATE ═══════════════

struct ThemeArchive {
    zip: ZipArchive<Cursor<Vec<u8>>>,
}

pub struct ProtocolState {
    archives: Mutex<HashMap<String, ThemeArchive>>,
    nvtp_dir: std::path::PathBuf,
}

impl ProtocolState {
    pub fn new(nvtp_dir: std::path::PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&nvtp_dir);
        Self { archives: Mutex::new(HashMap::new()), nvtp_dir }
    }

    pub fn ensure_loaded(&self, theme_id: &str) -> Result<(), String> {
        let mut guard = self.archives.lock().map_err(|e| e.to_string())?;
        if guard.contains_key(theme_id) { return Ok(()); }

        let nvtp_path = self.nvtp_dir.join(format!("{}.nvtp", theme_id));
        let encrypted = std::fs::read(&nvtp_path)
            .map_err(|e| format!("Failed to read {}: {}", nvtp_path.display(), e))?;
        let (_header, _manifest, zip_bytes) = unpack_theme(&encrypted)?;
        let cursor = Cursor::new(zip_bytes);
        let zip = ZipArchive::new(cursor)
            .map_err(|e| format!("ZIP parse error for {}: {}", theme_id, e))?;
        guard.insert(theme_id.to_string(), ThemeArchive { zip });
        Ok(())
    }

    #[allow(dead_code)]
    pub fn has_theme(&self, theme_id: &str) -> bool {
        self.nvtp_dir.join(format!("{}.nvtp", theme_id)).exists()
    }

    /// Read a single file from a loaded theme's ZIP archive.
    /// Returns `None` if the theme is not loaded or the file doesn't exist.
    pub fn read_file(&self, theme_id: &str, asset_path: &str) -> Option<Vec<u8>> {
        let mut guard = self.archives.lock().ok()?;
        let archive = guard.get_mut(theme_id)?;

        // Try exact match
        if let Ok(mut file) = archive.zip.by_name(asset_path) {
            let mut buf = Vec::new();
            if file.read_to_end(&mut buf).is_ok() {
                return Some(buf);
            }
        }

        // Case-insensitive fallback
        let lower = asset_path.to_lowercase();
        for i in 0..archive.zip.len() {
            if let Ok(mut file) = archive.zip.by_index(i) {
                if let Some(n) = file.name().to_lowercase().into() {
                    if n == lower {
                        let mut buf = Vec::new();
                        if file.read_to_end(&mut buf).is_ok() {
                            return Some(buf);
                        }
                    }
                }
            }
        }
        None
    }

    fn serve_impl(&self, uri: &str) -> (u16, String, Vec<u8>) {
        let path = uri
            .strip_prefix("https://nova.localhost/")
            .or_else(|| uri.strip_prefix("nova://localhost/"))
            .or_else(|| uri.strip_prefix("nova://theme/"))
            .unwrap_or("");

        let (theme_id, asset_path) = match path.split_once('/') {
            Some((id, rest)) if !id.is_empty() && !rest.is_empty() => (id, rest),
            _ => return (404, "text/plain".into(), b"Missing theme_id or asset path".to_vec()),
        };
        if asset_path.contains("..") || asset_path.contains('\\') {
            return (404, "text/plain".into(), b"Invalid path".into());
        }

        // Ensure loaded
        if let Err(e) = self.ensure_loaded(theme_id) {
            return (500, "text/plain".into(), format!("Load fail: {}", e).into_bytes());
        }

        let mut guard = match self.archives.lock() {
            Ok(g) => g,
            Err(_) => return (500, "text/plain".into(), b"Lock error".into()),
        };
        let archive = match guard.get_mut(theme_id) {
            Some(a) => a,
            None => return (404, "text/plain".into(), b"Theme not found".into()),
        };

        // Try exact match first
        if let Ok(mut file) = archive.zip.by_name(asset_path) {
            let mut buf = Vec::new();
            if file.read_to_end(&mut buf).is_ok() {
                return (200, mime(asset_path).into(), buf);
            }
        }

        // Case-insensitive fallback
        let lower = asset_path.to_lowercase();
        for i in 0..archive.zip.len() {
            if let Ok(mut file) = archive.zip.by_index(i) {
                if let Some(n) = file.name().to_lowercase().into() {
                    if n == lower {
                        let mut buf = Vec::new();
                        if file.read_to_end(&mut buf).is_ok() {
                            return (200, mime(asset_path).into(), buf);
                        }
                    }
                }
            }
        }
        (404, "text/plain".into(), format!("Not found: {}", asset_path).into_bytes())
    }
}

// ═══════════════ GLOBAL ═══════════════

static PROTOCOL: OnceLock<Mutex<ProtocolState>> = OnceLock::new();

pub fn init_protocol(nvtp_dir: std::path::PathBuf) {
    let _ = PROTOCOL.set(Mutex::new(ProtocolState::new(nvtp_dir)));
}

pub fn global() -> &'static Mutex<ProtocolState> {
    PROTOCOL.get().expect("Protocol not initialized")
}

pub fn handle_request(request: &tauri::http::Request<Vec<u8>>) -> tauri::http::Response<Vec<u8>> {
    let state = match PROTOCOL.get() {
        Some(s) => s,
        None => return tauri::http::Response::new(b"Protocol not ready".to_vec()),
    };
    let guard = match state.lock() {
        Ok(g) => g,
        Err(_) => return tauri::http::Response::new(b"Lock error".to_vec()),
    };

    let uri = request.uri().to_string();
    let (status, content_type, body) = guard.serve_impl(&uri);

    // Build response manually (no builder in Tauri 2.x http::Response)
    let mut resp = tauri::http::Response::new(body);
    *resp.status_mut() = tauri::http::StatusCode::from_u16(status).unwrap_or(tauri::http::StatusCode::OK);
    resp.headers_mut().insert(
        tauri::http::header::CONTENT_TYPE,
        tauri::http::HeaderValue::from_str(&content_type).unwrap_or(tauri::http::HeaderValue::from_static("application/octet-stream")),
    );
    if status == 200 {
        resp.headers_mut().insert(
            tauri::http::header::CACHE_CONTROL,
            tauri::http::HeaderValue::from_static("public, max-age=604800, immutable"),
        );
    }
    resp
}

// ═══════════════ HELPERS ═══════════════

fn mime(path: &str) -> &'static str {
    let l = path.to_lowercase();
    if l.ends_with(".webp") { "image/webp" }
    else if l.ends_with(".png") { "image/png" }
    else if l.ends_with(".jpg") || l.ends_with(".jpeg") { "image/jpeg" }
    else if l.ends_with(".mp4") { "video/mp4" }
    else if l.ends_with(".webm") { "video/webm" }
    else if l.ends_with(".css") { "text/css" }
    else { "application/octet-stream" }
}
