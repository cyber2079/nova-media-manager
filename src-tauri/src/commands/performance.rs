// ── 性能调优命令 ──
// Windows 进程优先级 + 电源节流控制
// 使用 Win32 FFI，无需额外 crate

use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceInfo {
    pub priority_level: String,
}

/// 获取当前性能信息
#[command]
pub fn get_performance_info() -> Result<PerformanceInfo, String> {
    let level = get_current_priority();
    Ok(PerformanceInfo {
        priority_level: level,
    })
}

/// 设置进程优先级
#[command]
pub fn set_process_priority(level: String) -> Result<(), String> {
    set_priority(&level)
}

/// 设置电源节流 — disable = true 禁止降频
#[command]
pub fn set_power_throttling(disable: bool) -> Result<(), String> {
    set_throttling(disable)
}

// ═══════════════ Windows 实现 ═══════════════

#[cfg(target_os = "windows")]
fn get_current_priority() -> String {
    // Use PowerShell to read current priority class
    match std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command",
            "(Get-Process -Id $pid).PriorityClass"
        ])
        .output()
    {
        Ok(o) => {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_lowercase();
            if s.contains("abovenormal") { "above_normal".into() }
            else if s.contains("high") { "high".into() }
            else { "normal".into() }
        }
        Err(_) => "normal".into(),
    }
}

#[cfg(not(target_os = "windows"))]
fn get_current_priority() -> String { "normal".into() }

#[cfg(target_os = "windows")]
fn set_priority(level: &str) -> Result<(), String> {
    // PowerShell 设置当前进程优先级
    let class = match level {
        "above_normal" => "AboveNormal",
        "high" => "High",
        _ => "Normal",
    };
    let cmd = format!("(Get-Process -Id $pid).PriorityClass = '{}'", class);
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &cmd])
        .output()
        .map_err(|e| format!("Failed to set priority: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Set priority failed: {}", err));
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_priority(_level: &str) -> Result<(), String> { Ok(()) }

#[cfg(target_os = "windows")]
fn set_throttling(disable: bool) -> Result<(), String> {
    // PowerCfg 设置电源方案 — 禁止或恢复 CPU 降频节流
    // 使用 GUID 直接设置 ProcessPowerThrottling 不可靠（需要管理员权限），
    // 这里改为设置当前电源方案为"高性能"来替代。
    if disable {
        // 切换到高性能方案
        let output = std::process::Command::new("powercfg")
            .args(["/setactive", "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"])
            .output()
            .map_err(|e| format!("Failed to set power scheme: {}", e))?;
        if !output.status.success() {
            // GUID may not exist on this system — try alternative approach
            // Just use /list to find the High Performance GUID
            let list = std::process::Command::new("powercfg")
                .args(["/list"])
                .output()
                .map_err(|e| format!("Failed to list power schemes: {}", e))?;
            let text = String::from_utf8_lossy(&list.stdout).to_string();
            // Find "高性能" scheme
            if let Some(line) = text.lines().find(|l| l.contains("高性能") || l.contains("High performance")) {
                if let Some(guid_start) = line.find('{') {
                    let guid = &line[guid_start..];
                    if let Some(guid_end) = guid.find('}') {
                        let guid = &guid[..=guid_end];
                        std::process::Command::new("powercfg")
                            .args(["/setactive", guid])
                            .output()
                            .map_err(|e| format!("Failed to set power scheme: {}", e))?;
                    }
                }
            }
        }
    }
    // Restore balanced: we don't auto-restore — user toggles this in settings
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_throttling(_disable: bool) -> Result<(), String> { Ok(()) }
