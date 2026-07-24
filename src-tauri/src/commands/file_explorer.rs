use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command as StdCommand;
use std::sync::Mutex;

static CLIPBOARD: Mutex<Vec<String>> = Mutex::new(vec![]);
static CLIPBOARD_CUT: Mutex<bool> = Mutex::new(false);

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: String,
}

#[tauri::command]
pub fn list_drives() -> Vec<DriveInfo> {
    let mut drives = Vec::new();
    if cfg!(target_os = "windows") {
        for letter in b'A'..=b'Z' {
            let p = format!("{}:\\", letter as char);
            if Path::new(&p).exists() {
                drives.push(DriveInfo { name: p.clone(), path: p });
            }
        }
    } else {
        // Unix: list /, /home etc
        if Path::new("/").exists() {
            drives.push(DriveInfo { name: "/ (root)".into(), path: "/".into() });
        }
        let home = dirs_next_home();
        if Path::new(&home).exists() {
            drives.push(DriveInfo { name: "Home".into(), path: home });
        }
    }
    drives
}

fn dirs_next_home() -> String {
    if cfg!(target_os = "windows") {
        std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".into())
    } else {
        std::env::var("HOME").unwrap_or_else(|_| "/root".into())
    }
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut entries = Vec::new();
    let read = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read {
        if let Ok(entry) = entry {
            let meta = entry.metadata().ok();
            let name = entry.file_name().to_string_lossy().to_string();
            let full = entry.path().to_string_lossy().to_string();
            let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
            let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified = meta
                .and_then(|m| m.modified().ok())
                .and_then(|t| {
                    chrono::DateTime::from_timestamp(
                        t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64,
                        0,
                    )
                })
                .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                .unwrap_or_default();

            entries.push(DirEntry { name, path: full, is_dir, size, modified });
        }
    }

    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PinnedFolder {
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub fn list_pinned_folders() -> Vec<PinnedFolder> {
    let mut folders = Vec::new();

    // Desktop
    if let Some(d) = dirs::desktop_dir() {
        folders.push(PinnedFolder { name: "桌面".into(), path: d.to_string_lossy().to_string() });
    }
    // Downloads
    if let Some(d) = dirs::download_dir() {
        folders.push(PinnedFolder { name: "下载".into(), path: d.to_string_lossy().to_string() });
    }
    // Documents
    if let Some(d) = dirs::document_dir() {
        folders.push(PinnedFolder { name: "文档".into(), path: d.to_string_lossy().to_string() });
    }
    // Pictures
    if let Some(d) = dirs::picture_dir() {
        folders.push(PinnedFolder { name: "图片".into(), path: d.to_string_lossy().to_string() });
    }

    folders
}

/// Resolve a known-folder key to its filesystem path (for themed FileExplorer).
/// Keys: desktop, downloads, documents, pictures, music, videos
#[tauri::command]
pub fn get_known_folder_path(kind: String) -> Result<String, String> {
    let path = match kind.as_str() {
        "desktop"   => dirs::desktop_dir(),
        "downloads" => dirs::download_dir(),
        "documents" => dirs::document_dir(),
        "pictures"  => dirs::picture_dir(),
        "music"     => dirs::audio_dir(),
        "videos"    => dirs::video_dir(),
        _ => None,
    };
    path.map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| format!("unknown folder: {}", kind))
}

/// Open a file or folder with the OS default handler.
/// Folders open in File Explorer; files open with their registered application.
#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        StdCommand::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    } else if cfg!(target_os = "macos") {
        StdCommand::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    } else {
        StdCommand::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_my_computer() -> Result<(), String> {
    if cfg!(target_os = "windows") {
        StdCommand::new("explorer").arg("shell:MyComputerFolder").spawn().map_err(|e| e.to_string())?;
    } else if cfg!(target_os = "macos") {
        StdCommand::new("open").arg("/").spawn().map_err(|e| e.to_string())?;
    } else {
        StdCommand::new("xdg-open").arg("/").spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_items(paths: Vec<String>) -> Result<String, String> {
    let mut deleted = 0;
    let mut errors = Vec::new();
    for p in &paths {
        if !Path::new(p).exists() { errors.push(format!("不存在: {}", p)); continue; }
        match trash::delete(p) {
            Ok(_) => deleted += 1,
            Err(e) => errors.push(format!("{}: {}", p, e)),
        }
    }
    Ok(format!("已删除 {} 项到回收站{}", deleted, if errors.is_empty() { "".into() } else { format!("，{} 项失败", errors.len()) }))
}

#[tauri::command]
pub fn copy_items(paths: Vec<String>) -> Result<String, String> {
    let mut clip = CLIPBOARD.lock().unwrap();
    *clip = paths.clone();
    let mut cut = CLIPBOARD_CUT.lock().unwrap();
    *cut = false;
    Ok(format!("已复制 {} 项", paths.len()))
}

#[tauri::command]
pub fn cut_items(paths: Vec<String>) -> Result<String, String> {
    let mut clip = CLIPBOARD.lock().unwrap();
    *clip = paths.clone();
    let mut cut = CLIPBOARD_CUT.lock().unwrap();
    *cut = true;
    Ok(format!("已剪切 {} 项", paths.len()))
}

#[tauri::command]
pub fn paste_items(dest_dir: String) -> Result<String, String> {
    // Take ownership from clipboard so we don't hold the lock during copy ops
    let (clip_paths, is_cut) = {
        let mut clip = CLIPBOARD.lock().unwrap();
        let is_cut = *CLIPBOARD_CUT.lock().unwrap();
        let paths = clip.clone();
        // If this is a cut, clear the clipboard now (before we do the move)
        if is_cut { clip.clear(); }
        (paths, is_cut)
    };
    // Lock is released here — no deadlock below

    let dest = PathBuf::from(&dest_dir);
    if !dest.is_dir() { return Err("目标不是目录".into()); }
    let mut done = 0u32;
    let mut errors = Vec::new();
    for src_path in &clip_paths {
        let src = Path::new(src_path);
        if !src.exists() { errors.push(format!("源文件不存在: {}", src_path)); continue; }
        let name = src.file_name().and_then(|n| n.to_str()).unwrap_or("unnamed");
        let target = dest.join(name);
        // Handle overwrite with unique name
        let target = if target.exists() {
            let stem = target.file_stem().and_then(|n| n.to_str()).unwrap_or("file");
            let ext = target.extension().and_then(|n| n.to_str()).unwrap_or("");
            let mut i = 1;
            let mut alt;
            loop {
                alt = if ext.is_empty() {
                    dest.join(format!("{} - 副本", stem))
                } else {
                    dest.join(format!("{} - 副本.{}", stem, ext))
                };
                if i > 1 {
                    alt = if ext.is_empty() {
                        dest.join(format!("{} - 副本 ({})", stem, i))
                    } else {
                        dest.join(format!("{} - 副本 ({}).{}", stem, i, ext))
                    };
                }
                if !alt.exists() { break; }
                i += 1;
            }
            alt
        } else { target };

        let op = || -> Result<(), String> {
            if src.is_dir() {
                copy_dir_recursive(src, &target).map_err(|e| e.to_string())?;
                if is_cut { let _ = fs::remove_dir_all(src); }
            } else {
                fs::copy(src, &target).map_err(|e| e.to_string())?;
                if is_cut { let _ = fs::remove_file(src); }
            }
            Ok(())
        };
        match op() {
            Ok(_) => done += 1,
            Err(e) => errors.push(format!("{}: {}", name, e)),
        }
    }
    // Clear cut flag after all operations complete
    if is_cut && done > 0 {
        *CLIPBOARD_CUT.lock().unwrap() = false;
    }
    Ok(format!("{}{} {} 项{}", if is_cut { "移动" } else { "粘贴" }, "", done, if errors.is_empty() { "".into() } else { format!("，{} 项失败", errors.len()) }))
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let target = dest.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn rename_item(path: String, new_name: String) -> Result<String, String> {
    let src = Path::new(&path);
    if !src.exists() { return Err("文件不存在".into()); }
    let parent = src.parent().unwrap_or(Path::new("."));
    let new_path = parent.join(&new_name);
    if new_path.exists() { return Err("目标名称已存在".into()); }
    fs::rename(src, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn show_properties(path: String) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        StdCommand::new("explorer").arg("/select,").arg(&path).spawn().map_err(|e| e.to_string())?;
    } else if cfg!(target_os = "macos") {
        StdCommand::new("open").arg("-R").arg(&path).spawn().map_err(|e| e.to_string())?;
    } else {
        let parent = Path::new(&path).parent().unwrap_or(Path::new("/"));
        StdCommand::new("xdg-open").arg(parent).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn create_folder(parent: String, name: String) -> Result<String, String> {
    let p = PathBuf::from(&parent).join(&name);
    fs::create_dir(&p).map_err(|e| e.to_string())?;
    Ok(p.to_string_lossy().to_string())
}
