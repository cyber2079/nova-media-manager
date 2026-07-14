//! Multi-window management for dual-display support.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const SECONDARY_LABEL: &str = "secondary-display";

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryWindowInfo {
    pub open: bool,
    pub label: String,
    pub title: String,
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

#[tauri::command]
pub fn open_secondary_window(app: AppHandle) -> Result<SecondaryWindowInfo, String> {
    if let Some(w) = app.get_webview_window(SECONDARY_LABEL) {
        w.show().ok(); w.set_focus().ok();
        return Ok(SecondaryWindowInfo { open: true, label: SECONDARY_LABEL.into(), title: "副屏面板".into() });
    }

    let pos = find_second_monitor(&app).unwrap_or((50, 50));

    let window = WebviewWindowBuilder::new(
        &app,
        SECONDARY_LABEL,
        WebviewUrl::App("index.html?secondary=1".into()),
    )
    .title("副屏面板")
    .position(pos.0 as f64, pos.1 as f64)
    .decorations(false)
    .maximized(true)
    .visible(true)
    .build()
    .map_err(|e| format!("创建窗口失败: {e}"))?;

    Ok(SecondaryWindowInfo { open: true, label: SECONDARY_LABEL.into(), title: "副屏面板".into() })
}

#[tauri::command]
pub fn close_secondary_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(SECONDARY_LABEL) { w.close().ok(); }
    Ok(())
}

#[tauri::command]
pub fn is_secondary_window_open(app: AppHandle) -> Result<SecondaryWindowInfo, String> {
    let open = app.get_webview_window(SECONDARY_LABEL).is_some();
    Ok(SecondaryWindowInfo { open, label: SECONDARY_LABEL.into(), title: "副屏面板".into() })
}

#[tauri::command]
pub fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let primary = app.primary_monitor().ok().flatten();
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for m in monitors {
        let pos = m.position(); let sz = m.size();
        let is_primary = primary.as_ref().map_or(false, |p| p.position().x == pos.x && p.position().y == pos.y);
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

fn find_second_monitor(app: &AppHandle) -> Option<(i32, i32)> {
    let primary = app.primary_monitor().ok().flatten()?;
    for m in app.available_monitors().ok()? {
        if m.position().x != primary.position().x || m.position().y != primary.position().y {
            return Some((m.position().x + 50, m.position().y + 50));
        }
    }
    None
}

pub fn _emit_to_secondary<T: Serialize + Clone>(app: &AppHandle, event: &str, payload: T) {
    if let Some(w) = app.get_webview_window(SECONDARY_LABEL) {
        let _ = w.emit(event, payload);
    }
}
