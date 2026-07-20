// ── HEVC video extension auto-installer ──
// WebView2 can only play H.264/VP8/VP9 natively. HEVC (H.265) requires a
// system codec. This module detects whether HEVC decoding is available and, if
// not, silently installs the bundled Microsoft HEVC Video Extension (.AppxBundle).
//
// The bundled .AppxBundle is the free "Device Manufacturer" edition from:
//   https://www.free-codecs.com/hevc-video-extensions-from-device-manufacturer_download.htm

use std::path::PathBuf;
use std::process::Command;

/// Resolve the bundled HEVC .AppxBundle path at runtime.
/// Tauri 2 places bundle resources next to the executable, preserving directory structure.
fn bundled_hevc_path() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    // Find any .AppxBundle in the plugins directory
    let plugins_dir = dir.join("_up_").join("plugins");
    if !plugins_dir.exists() {
        // fallback: directly next to exe (dev mode)
        let alt = dir.join("plugins");
        if alt.exists() {
            if let Ok(entries) = std::fs::read_dir(&alt) {
                for e in entries.flatten() {
                    let p = e.path();
                    if p.extension().and_then(|s| s.to_str()) == Some("AppxBundle") {
                        return Some(p);
                    }
                }
            }
        }
        return None;
    }
    if let Ok(entries) = std::fs::read_dir(&plugins_dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.extension().and_then(|s| s.to_str()) == Some("AppxBundle") {
                return Some(p);
            }
        }
    }
    None
}

/// Check whether HEVC decoding is available by querying the installed AppX package.
fn hevc_installed() -> bool {
    let output = Command::new("powershell")
        .args([
            "-NoProfile", "-NonInteractive", "-Command",
            "(Get-AppxPackage -Name Microsoft.HEVCVideoExtension*).Count -gt 0",
        ])
        .output();
    match output {
        Ok(o) => {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_lowercase();
            s == "true"
        }
        Err(_) => false,
    }
}

/// Silently install the bundled HEVC Video Extension via Add-AppxPackage.
/// Returns true if installation succeeded, false otherwise.
pub fn ensure_hevc() -> bool {
    if hevc_installed() {
        return true;
    }

    let path = match bundled_hevc_path() {
        Some(p) => p,
        None => {
            eprintln!("[hevc] Bundled .AppxBundle not found");
            return false;
        }
    };

    eprintln!("[hevc] Installing HEVC extension from {}", path.display());

    // Add-AppxPackage requires a path — we pass the bundle path directly.
    let output = Command::new("powershell")
        .args([
            "-NoProfile", "-NonInteractive", "-Command",
            &format!(
                "Add-AppxPackage -Path '{}'",
                path.to_string_lossy().replace('\'', "''")
            ),
        ])
        .output();

    match output {
        Ok(o) => {
            if o.status.success() {
                eprintln!("[hevc] Installation succeeded");
                true
            } else {
                let err = String::from_utf8_lossy(&o.stderr);
                eprintln!("[hevc] Installation failed: {}", err.trim());
                false
            }
        }
        Err(e) => {
            eprintln!("[hevc] Failed to run Add-AppxPackage: {}", e);
            false
        }
    }
}

/// Tauri command: check if HEVC is installed and install if not.
/// Call this once on startup; the check is fast (PowerShell Get-AppxPackage).
#[tauri::command]
pub fn install_hevc_if_needed() -> bool {
    // Guard: skip in dev — dev server might not have the bundled file
    if cfg!(debug_assertions) {
        // In dev mode, try to install but don't block startup if it fails
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|e| e.parent().map(|p| p.to_path_buf()));
        // Dev mode: exe is in src-tauri/target/debug — plugins won't be there
        // So check the static path relative to the project root
        if let Some(ref exe_dir) = exe_dir {
            let dev_path = exe_dir
                .parent().and_then(|p| p.parent())
                .map(|p| p.join("plugins"));
            if let Some(ref dp) = dev_path {
                if !dp.exists() {
                    eprintln!("[hevc] Dev mode — plugins dir not found next to exe, skipping auto-install");
                    return hevc_installed();
                }
            }
        }
        // Try install but fall through gracefully
        let result = ensure_hevc();
        return result;
    }

    ensure_hevc()
}
