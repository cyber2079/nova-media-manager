use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QuickLaunchItem {
    pub id: String,
    pub name: String,
    pub program_path: String,
    pub icon_path: String,
    pub sort_order: i32,
}

#[tauri::command]
pub fn get_quick_launch(db: State<Database>) -> Result<Vec<QuickLaunchItem>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare("SELECT id, name, program_path, icon_path, sort_order FROM quick_launch ORDER BY sort_order")
        .map_err(|e| e.to_string())?;
    let items = stmt.query_map([], |row| {
        Ok(QuickLaunchItem { id: row.get(0)?, name: row.get(1)?, program_path: row.get(2)?, icon_path: row.get(3)?, sort_order: row.get(4)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(items)
}

#[tauri::command]
pub fn add_quick_launch(db: State<Database>, program_path: String) -> Result<QuickLaunchItem, String> {
    let fp = Path::new(&program_path);
    let name = fp.file_stem().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
    let id = uuid::Uuid::new_v4().to_string();
    let conn = db.conn();
    let max_order: i32 = conn.query_row("SELECT COALESCE(MAX(sort_order), -1) FROM quick_launch", [], |row| row.get(0)).unwrap_or(-1);
    let item = QuickLaunchItem { id: id.clone(), name, program_path: program_path.clone(), icon_path: String::new(), sort_order: max_order + 1 };
    conn.execute("INSERT OR IGNORE INTO quick_launch (id, name, program_path, icon_path, sort_order) VALUES (?1,?2,?3,?4,?5)",
        rusqlite::params![item.id, item.name, item.program_path, item.icon_path, item.sort_order]).map_err(|e| e.to_string())?;
    Ok(item)
}

#[tauri::command]
pub fn remove_quick_launch(db: State<Database>, id: String) -> Result<bool, String> {
    let conn = db.conn();
    conn.execute("DELETE FROM quick_launch WHERE id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn launch_quick_item(program_path: String) -> Result<bool, String> {
    // Strip Zone.Identifier ADS (Mark of the Web) to prevent SmartScreen prompt
    let _ = std::fs::remove_file(format!("{}:Zone.Identifier", &program_path));

    // If the program is already running, bring its window to foreground instead of launching again
    if try_bring_running_to_foreground(&program_path) {
        return Ok(true);
    }

    // open crate uses ShellExecuteW on Windows, xdg-open/macOS open elsewhere
    open::that(&program_path).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Find the main window of a process matching `exe_path` and bring it to the foreground.
/// Returns true if the window was found and activated.
#[cfg(target_os = "windows")]
fn try_bring_running_to_foreground(exe_path: &str) -> bool {
    let exe_name = std::path::Path::new(exe_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if exe_name.is_empty() { return false; }

    unsafe {
        extern "system" {
            fn EnumWindows(callback: extern "system" fn(hwnd: isize, lparam: isize) -> i32, lparam: isize) -> i32;
            fn IsWindowVisible(hwnd: isize) -> i32;
            fn GetWindowThreadProcessId(hwnd: isize, pid: *mut u32) -> u32;
            fn SetForegroundWindow(hwnd: isize) -> i32;
            fn ShowWindow(hwnd: isize, nCmdShow: i32) -> i32;
            fn IsIconic(hwnd: isize) -> i32;
            fn BringWindowToTop(hwnd: isize) -> i32;
            fn AttachThreadInput(idAttach: u32, idAttachTo: u32, fAttach: i32) -> i32;
            fn GetForegroundWindow() -> isize;
        }

        struct SearchCtx {
            target_name: String,
            found_hwnd: isize,
        }

        extern "system" fn enum_proc(hwnd: isize, lparam: isize) -> i32 {
            let ctx = unsafe { &mut *(lparam as *mut SearchCtx) };
            if unsafe { IsWindowVisible(hwnd) } == 0 { return 1; }

            let mut pid: u32 = 0;
            unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
            if pid == 0 { return 1; }

            let proc_name = get_process_name_for_window(pid);
            if proc_name == ctx.target_name {
                ctx.found_hwnd = hwnd;
                return 0; // stop enumeration
            }
            1 // continue
        }

        let mut ctx = SearchCtx { target_name: exe_name, found_hwnd: 0 };
        EnumWindows(enum_proc, &mut ctx as *mut _ as isize);

        if ctx.found_hwnd != 0 {
            let target_hwnd = ctx.found_hwnd;

            // If minimized, restore first
            if IsIconic(target_hwnd) != 0 {
                ShowWindow(target_hwnd, 9); // SW_RESTORE
            }

            // Windows blocks background processes from calling SetForegroundWindow.
            // Workaround: temporarily attach our input queue to the foreground thread.
            let fg_hwnd = GetForegroundWindow();
            if fg_hwnd != 0 {
                let fg_thread_id = GetWindowThreadProcessId(fg_hwnd, std::ptr::null_mut());
                let target_thread_id = GetWindowThreadProcessId(target_hwnd, std::ptr::null_mut());
                if fg_thread_id != target_thread_id {
                    AttachThreadInput(target_thread_id, fg_thread_id, 1);
                    BringWindowToTop(target_hwnd);
                    SetForegroundWindow(target_hwnd);
                    AttachThreadInput(target_thread_id, fg_thread_id, 0);
                } else {
                    SetForegroundWindow(target_hwnd);
                }
            } else {
                // No foreground window (unlikely) — try direct
                BringWindowToTop(target_hwnd);
                SetForegroundWindow(target_hwnd);
            }
            return true;
        }
    }
    false
}

#[cfg(target_os = "windows")]
fn get_process_name_for_window(pid: u32) -> String {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    unsafe {
        extern "system" {
            fn OpenProcess(desired_access: u32, inherit_handle: i32, pid: u32) -> isize;
            fn CloseHandle(handle: isize) -> i32;
            fn QueryFullProcessImageNameW(handle: isize, flags: u32, buffer: *mut u16, size: *mut u32) -> i32;
        }

        const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle == 0 || handle == -1 { return String::new(); }

        let mut buf = vec![0u16; 260];
        let mut size: u32 = 260;
        let result = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size);
        CloseHandle(handle);

        if result != 0 {
            let path = OsString::from_wide(&buf[..size as usize]);
            let path_str = path.to_string_lossy();
            if let Some(name) = std::path::Path::new(path_str.as_ref()).file_name() {
                return name.to_string_lossy().to_lowercase();
            }
        }
        String::new()
    }
}

#[cfg(not(target_os = "windows"))]
fn try_bring_running_to_foreground(_exe_path: &str) -> bool { false }

/// Batch check: given a list of program paths, return which ones are currently running.
/// Uses a single sysinfo enumeration — no per-item overhead.
#[tauri::command]
pub fn check_programs_running(program_paths: Vec<String>) -> Result<Vec<bool>, String> {
    use sysinfo::System;
    use std::collections::HashSet;

    let sys = System::new_all();
    let mut running_exe_names: HashSet<String> = HashSet::new();
    let mut running_full_paths: HashSet<String> = HashSet::new();

    for proc in sys.processes().values() {
        if let Some(exe) = proc.exe() {
            let full = exe.to_string_lossy().to_lowercase();
            // Collect the exe filename only (last component) for fast matching
            if let Some(name) = exe.file_name() {
                running_exe_names.insert(name.to_string_lossy().to_lowercase());
            }
            running_full_paths.insert(full);
        }
    }

    let results: Vec<bool> = program_paths.iter().map(|p| {
        let p_lower = p.to_lowercase();
        let p_name = std::path::Path::new(p)
            .file_name()
            .map(|n| n.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        // Exact full-path match
        if running_full_paths.contains(&p_lower) {
            return true;
        }
        // Executable name match (e.g. "notepad.exe" found in process list)
        if !p_name.is_empty() && running_exe_names.contains(&p_name) {
            return true;
        }
        false
    }).collect();

    Ok(results)
}
