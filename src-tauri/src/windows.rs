//! Multi-window management for dual-display support (Ultra tier feature).
//!
//! Main window = primary display (main UI)
//! Secondary window = external/secondary display (widget panel / lyrics / info)

use crate::license::LicenseState;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use serde::Serialize;

const SECONDARY_LABEL: &str = "secondary-display";

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryWindowInfo {
    pub open: bool,
    pub label: String,
    pub title: String,
}

/// Open the secondary display window on the second monitor.
/// Requires Ultra tier license.
#[tauri::command]
pub fn open_secondary_window(
    app: AppHandle,
    license: tauri::State<'_, LicenseState>,
) -> Result<SecondaryWindowInfo, String> {
    // ── License check ──
    {
        let info = license.info.lock().map_err(|e| e.to_string())?;
        match info.as_ref() {
            Some(li) if li.tier == "ultra" || li.tier == "custom" => { /* allowed */ }
            _ => return Err("多显示器功能需要旗舰版（Ultra）。请升级您的许可证。".to_string()),
        }
    }

    // Check if already open
    if let Some(w) = app.get_webview_window(SECONDARY_LABEL) {
        w.show().ok();
        w.set_focus().ok();
        return Ok(SecondaryWindowInfo {
            open: true,
            label: SECONDARY_LABEL.to_string(),
            title: "副屏面板".to_string(),
        });
    }

    // Get the position of the second monitor
    let second_monitor = find_second_monitor(&app);

    // Create the window
    // `app` must be clone for move into closure
    let builder = WebviewWindowBuilder::new(&app, SECONDARY_LABEL, WebviewUrl::App("secondary.html".into()))
        .title("副屏面板 — 媒体管理中心")
        .inner_size(800.0, 600.0)
        .decorations(false)
        .resizable(true)
        .visible(true)
        .focused(true);

    let builder = if let Some((x, y)) = second_monitor {
        builder.position(x as f64, y as f64)
    } else {
        builder
    };

    let window = builder.build().map_err(|e| format!("创建窗口失败: {}", e))?;

    // Maximize on second monitor
    window.maximize().ok();

    Ok(SecondaryWindowInfo {
        open: true,
        label: SECONDARY_LABEL.to_string(),
        title: "副屏面板".to_string(),
    })
}

/// Close the secondary display window
#[tauri::command]
pub fn close_secondary_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(SECONDARY_LABEL) {
        w.close().ok();
    }
    Ok(())
}

/// Check if the secondary window is currently open
#[tauri::command]
pub fn is_secondary_window_open(app: AppHandle) -> Result<SecondaryWindowInfo, String> {
    let open = app.get_webview_window(SECONDARY_LABEL).is_some();
    Ok(SecondaryWindowInfo {
        open,
        label: SECONDARY_LABEL.to_string(),
        title: "副屏面板".to_string(),
    })
}

/// Find the position of the second monitor (returns top-left x, y).
/// Returns None if only one monitor is detected.
fn find_second_monitor(app: &AppHandle) -> Option<(i32, i32)> {
    let primary = match app.primary_monitor() {
        Ok(Some(m)) => m,
        _ => return None,
    };
    let primary_pos = primary.position();
    let primary_size = primary.size();
    let _ = (primary_pos, primary_size); // suppress unused warning

    let monitors = match app.available_monitors() {
        Ok(m) => m,
        Err(_) => return None,
    };
    for mon in monitors {
        let pos = mon.position();
        let size = mon.size();
        let cx = pos.x + (size.width as i32) / 2;
        let cy = pos.y + (size.height as i32) / 2;

        let in_primary_x = cx >= primary_pos.x
            && cx <= primary_pos.x + primary_size.width as i32;
        let in_primary_y = cy >= primary_pos.y
            && cy <= primary_pos.y + primary_size.height as i32;

        if !(in_primary_x && in_primary_y) {
            return Some((pos.x + 50, pos.y + 50));
        }
    }

    None
}

/// Emit an event to the secondary window (e.g., now-playing info)
pub fn _emit_to_secondary<T: Serialize + Clone>(app: &AppHandle, event: &str, payload: T) {
    if let Some(w) = app.get_webview_window(SECONDARY_LABEL) {
        let _ = w.emit(event, payload);
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub name: String,
    pub size: (u32, u32),
    pub position: (i32, i32),
    pub scale_factor: f64,
    pub is_primary: bool,
}

/// List all available monitors for the settings dropdown
#[tauri::command]
pub fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let primary = app.primary_monitor().ok().flatten();
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for m in monitors {
        let pos = m.position();
        let sz = m.size();
        let is_primary = primary.as_ref().map_or(false, |p| {
            p.position().x == pos.x && p.position().y == pos.y
        });
        list.push(MonitorInfo {
            name: m.name().map_or(String::new(), |v| v.clone()),
            size: (sz.width, sz.height),
            position: (pos.x, pos.y),
            scale_factor: m.scale_factor(),
            is_primary,
        });
    }
    Ok(list)
}
