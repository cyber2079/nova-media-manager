use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;

static CACHE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

#[tauri::command]
pub fn extract_exe_icon(path: String) -> Result<String, String> {
    {
        let c = CACHE.lock().unwrap();
        if let Some(ref map) = *c {
            if let Some(cached) = map.get(&path) {
                return Ok(cached.clone());
            }
        }
    }

    let data_url = extract_icon_inner(&path).unwrap_or_default();

    if !data_url.is_empty() {
        let mut c = CACHE.lock().unwrap();
        if let Some(ref mut map) = *c {
            map.insert(path, data_url.clone());
            if map.len() > 32 { map.clear(); }
        }
    }

    Ok(data_url)
}

fn extract_icon_inner(path: &str) -> Option<String> {
    // Pass path via env var to avoid PowerShell injection through special characters
    let ps = r#"Add-Type -As System.Drawing;
$i=[System.Drawing.Icon]::ExtractAssociatedIcon($env:EXTRACT_PATH);
if(!$i){exit 1}
$b=$i.ToBitmap();$m=New-Object IO.MemoryStream;
$b.Save($m,[System.Drawing.Imaging.ImageFormat]::Png);
[Convert]::ToBase64String($m.ToArray())"#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", ps])
        .env("EXTRACT_PATH", path)
        .output()
        .ok()?;

    if !output.status.success() || output.stdout.is_empty() {
        return None;
    }

    let b64 = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if b64.is_empty() { return None; }
    Some(format!("data:image/png;base64,{}", b64))
}
