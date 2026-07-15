use std::process::Command;
use std::sync::{Mutex, atomic::{AtomicBool, Ordering}};
use std::thread;
use std::time::Duration;
use tauri::Manager;

fn spawn(cmd: &str, args: &[&str]) -> Result<(), String> {
    Command::new(cmd).args(args).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

// ── Volume — Win32 keybd_event ──

#[link(name = "user32")]
extern "system" {
    fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
}

const VK_VOLUME_MUTE: u8 = 0xAD;
const VK_VOLUME_UP: u8 = 0xAF;
const VK_VOLUME_DOWN: u8 = 0xAE;
const KEYEVENTF_KEYUP: u32 = 0x0002;
const VOLUME_STEP: f32 = 0.02;

static VOLUME_TRACKER: Mutex<f32> = Mutex::new(0.5);
static VOLUME_LOCK: Mutex<()> = Mutex::new(());
static OS_MUTED: AtomicBool = AtomicBool::new(false);

fn send_key(vk: u8) {
    unsafe {
        keybd_event(vk, 0, 0, 0);
        thread::sleep(Duration::from_millis(35));
        keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
    }
}

#[tauri::command]
pub fn get_system_volume() -> Result<f32, String> {
    Ok(*VOLUME_TRACKER.lock().unwrap())
}

/// Set system volume. If OS is muted, unmute first.
#[tauri::command]
pub fn set_system_volume(level: f32) -> Result<(), String> {
    let target = level.clamp(0.0, 1.0);
    let _lock = VOLUME_LOCK.lock().unwrap();
    let current = *VOLUME_TRACKER.lock().unwrap();

    // If muted, unmute first so volume changes are audible
    if OS_MUTED.load(Ordering::Relaxed) && target > 0.0 {
        send_key(VK_VOLUME_MUTE);
        OS_MUTED.store(false, Ordering::Relaxed);
        thread::sleep(Duration::from_millis(50));
    }

    let diff = target - current;
    if diff.abs() < VOLUME_STEP / 2.0 {
        *VOLUME_TRACKER.lock().unwrap() = target;
        return Ok(());
    }

    let steps = (diff.abs() / VOLUME_STEP).round() as u32;
    let vk = if diff > 0.0 { VK_VOLUME_UP } else { VK_VOLUME_DOWN };

    for _ in 0..steps.min(50) {
        send_key(vk);
        if steps > 15 { thread::sleep(Duration::from_millis(10)); }
    }

    let new_val = if diff > 0.0 {
        (current + steps as f32 * VOLUME_STEP).min(1.0)
    } else {
        (current - steps as f32 * VOLUME_STEP).max(0.0)
    };
    *VOLUME_TRACKER.lock().unwrap() = new_val;
    Ok(())
}

/// Set mute state. Only toggles if the desired state differs from current.
#[tauri::command]
pub fn set_system_mute(muted: bool) -> Result<(), String> {
    let _lock = VOLUME_LOCK.lock().unwrap();
    let current = OS_MUTED.load(Ordering::Relaxed);
    if muted == current {
        return Ok(()); // Already in the desired state — no-op
    }
    send_key(VK_VOLUME_MUTE);
    OS_MUTED.store(muted, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn get_system_mute() -> Result<bool, String> {
    Ok(OS_MUTED.load(Ordering::Relaxed))
}

// ── Folders ──

macro_rules! folder_cmd {
    ($name:ident, $dir_fn:ident) => {
        #[tauri::command] pub fn $name() -> Result<(), String> {
            let dir = dirs::$dir_fn().ok_or("folder not found")?;
            Command::new("explorer").arg(&dir).spawn().map_err(|e| e.to_string())?; Ok(())
        }
    };
}
folder_cmd!(open_downloads,    download_dir);
folder_cmd!(open_desktop,      desktop_dir);
folder_cmd!(open_documents,    document_dir);
folder_cmd!(open_pictures,     picture_dir);
folder_cmd!(open_music_folder, audio_dir);
folder_cmd!(open_videos,       video_dir);

#[tauri::command]
pub fn open_app_data(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    spawn("explorer", &[&dir.to_string_lossy()])?;
    Ok(())
}

// ── Power / Session ──

#[tauri::command] pub fn lock_screen() -> Result<(), String> { spawn("rundll32.exe", &["user32.dll,LockWorkStation"]) }
#[tauri::command] pub fn sleep() -> Result<(), String> {
    Command::new("powershell").args(["-NoProfile", "-Command", "Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)"]).spawn().map_err(|e| e.to_string())?; Ok(())
}
#[tauri::command] pub fn restart() -> Result<(), String> { spawn("shutdown", &["/r", "/t", "5"]) }
#[tauri::command] pub fn shutdown() -> Result<(), String> { spawn("shutdown", &["/s", "/t", "5"]) }
#[tauri::command] pub fn cancel_restart_shutdown() -> Result<(), String> { spawn("shutdown", &["/a"]) }

// ── Windows system tools ──

#[tauri::command] pub fn open_taskmgr() -> Result<(), String> { spawn("taskmgr.exe", &[]) }
#[tauri::command] pub fn open_snipping_tool() -> Result<(), String> { spawn("explorer", &["ms-screenclip:"]) }
#[tauri::command] pub fn open_calculator() -> Result<(), String> { spawn("calc.exe", &[]) }
#[tauri::command] pub fn open_device_manager() -> Result<(), String> { spawn("mmc", &["devmgmt.msc"]) }
#[tauri::command] pub fn open_disk_cleanup() -> Result<(), String> { spawn("cleanmgr.exe", &[]) }
#[tauri::command] pub fn open_registry_editor() -> Result<(), String> { spawn("regedit.exe", &[]) }
#[tauri::command] pub fn open_system_info() -> Result<(), String> { spawn("msinfo32.exe", &[]) }
#[tauri::command] pub fn open_control_panel() -> Result<(), String> { spawn("control.exe", &[]) }
#[tauri::command] pub fn open_cmd_admin() -> Result<(), String> { spawn("powershell", &["-Command", "Start-Process cmd -Verb RunAs"]) }
#[tauri::command] pub fn open_notepad() -> Result<(), String> { spawn("notepad.exe", &[]) }
#[tauri::command] pub fn empty_recycle_bin() -> Result<(), String> {
    Command::new("powershell").args(["-NoProfile", "-Command", "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"]).spawn().map_err(|e| e.to_string())?;
    Ok(())
}
/// Opens Windows Game Bar for screen recording (Win+G)
#[tauri::command] pub fn open_game_bar() -> Result<(), String> { spawn("explorer", &["xbox-gamebar://"]) }
/// Opens Bluetooth quick settings
#[tauri::command] pub fn open_bluetooth_settings() -> Result<(), String> { spawn("explorer", &["ms-settings:bluetooth"]) }
/// Opens Wi-Fi network flyout
#[tauri::command] pub fn open_network_settings() -> Result<(), String> { spawn("explorer", &["ms-availablenetworks:"]) }
