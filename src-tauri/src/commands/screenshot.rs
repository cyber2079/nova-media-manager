use base64::Engine;
use std::fs;
use std::path::PathBuf;

/// Returns the Pictures folder / Nova subdirectory, creating it if needed.
fn nova_screenshots_dir() -> Result<PathBuf, String> {
    let pics = dirs::picture_dir().ok_or("Could not find Pictures folder")?;
    let dir = pics.join("Nova");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create screenshot dir: {}", e))?;
    log::info!("[screenshot] dir={}", dir.display());
    Ok(dir)
}

fn timestamp() -> String {
    let now = chrono::Local::now();
    now.format("%Y-%m-%d_%H-%M-%S").to_string()
}

/// Save a base64-encoded PNG screenshot to the Pictures/Nova folder.
/// Returns the full saved path.
#[tauri::command]
pub fn save_screenshot(data: String) -> Result<String, String> {
    log::info!("[screenshot] called, data_len={}", data.len());

    // strip data URL prefix if present
    let b64 = if let Some(comma) = data.find(',') {
        &data[comma + 1..]
    } else {
        &data
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    log::info!("[screenshot] decoded {} bytes", bytes.len());

    let dir = nova_screenshots_dir()?;
    let filename = format!("Nova_Screenshot_{}.png", timestamp());
    let path = dir.join(&filename);

    fs::write(&path, &bytes).map_err(|e| format!("Failed to write screenshot: {}", e))?;

    log::info!("[screenshot] saved to {}", path.display());
    Ok(path.to_string_lossy().to_string())
}
