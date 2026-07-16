// ── 外接播放器：检测 / 调起 / 续播定位 / mpv IPC 进度回传 ──
// WebView2 解不了的格式（HEVC/MKV/AVI/字幕/原盘）交给用户机器上的专业播放器。

use crate::db::Database;
use serde::Serialize;
use std::io::{BufRead, BufReader, Write};
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetectedPlayer {
    pub kind: String, // potplayer | vlc | mpv | mpc-hc
    pub name: String,
    pub path: String,
}

/// 常见安装路径探测（不走注册表，避免子进程控制台闪窗）
fn candidate_paths(kind: &str) -> Vec<String> {
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".into());
    let pf86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".into());
    let home = std::env::var("USERPROFILE").unwrap_or_default();
    match kind {
        "potplayer" => vec![
            format!(r"{pf}\DAUM\PotPlayer\PotPlayerMini64.exe"),
            format!(r"{pf86}\DAUM\PotPlayer\PotPlayerMini.exe"),
        ],
        "vlc" => vec![
            format!(r"{pf}\VideoLAN\VLC\vlc.exe"),
            format!(r"{pf86}\VideoLAN\VLC\vlc.exe"),
        ],
        "mpv" => vec![
            format!(r"{pf}\mpv\mpv.exe"),
            format!(r"{home}\scoop\shims\mpv.exe"),
            format!(r"{home}\scoop\apps\mpv\current\mpv.exe"),
        ],
        "mpc-hc" => vec![
            format!(r"{pf}\MPC-HC\mpc-hc64.exe"),
            format!(r"{pf86}\MPC-HC\mpc-hc.exe"),
            format!(r"{pf86}\K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe"),
        ],
        _ => vec![],
    }
}

fn display_name(kind: &str) -> &'static str {
    match kind {
        "potplayer" => "PotPlayer",
        "vlc" => "VLC",
        "mpv" => "mpv",
        "mpc-hc" => "MPC-HC",
        _ => "自定义",
    }
}

#[tauri::command]
pub fn detect_external_players() -> Vec<DetectedPlayer> {
    let mut found = Vec::new();
    for kind in ["potplayer", "vlc", "mpv", "mpc-hc"] {
        for path in candidate_paths(kind) {
            if std::path::Path::new(&path).exists() {
                found.push(DetectedPlayer {
                    kind: kind.to_string(),
                    name: display_name(kind).to_string(),
                    path,
                });
                break;
            }
        }
    }
    found
}

/// 按播放器拼续播参数。start_secs=0 时不带定位参数（从头播）。
fn build_args(kind: &str, file: &str, start_secs: i64, ipc_pipe: &str) -> Vec<String> {
    let mut args = Vec::new();
    match kind {
        "potplayer" => {
            args.push(file.to_string());
            if start_secs > 0 {
                let (h, m, s) = (start_secs / 3600, (start_secs % 3600) / 60, start_secs % 60);
                args.push(format!("/seek={:02}:{:02}:{:02}", h, m, s));
            }
        }
        "vlc" => {
            if start_secs > 0 { args.push(format!("--start-time={}", start_secs)); }
            args.push(file.to_string());
        }
        "mpv" => {
            if start_secs > 0 { args.push(format!("--start={}", start_secs)); }
            args.push(format!("--input-ipc-server={}", ipc_pipe));
            args.push(file.to_string());
        }
        "mpc-hc" => {
            args.push(file.to_string());
            if start_secs > 0 {
                args.push("/start".to_string());
                args.push(format!("{}", start_secs * 1000)); // 毫秒
            }
        }
        _ => { args.push(file.to_string()); } // custom：只传文件
    }
    args
}

/// 单次查询 mpv time-pos（JSON IPC over 命名管道）。
/// mpv 会异步推事件行，读多行直到出现带 data 的响应。
fn query_mpv_pos(reader: &mut BufReader<std::fs::File>, writer: &mut std::fs::File) -> Option<f64> {
    writer.write_all(b"{\"command\":[\"get_property\",\"time-pos\"]}\n").ok()?;
    writer.flush().ok()?;
    for _ in 0..20 {
        let mut line = String::new();
        if reader.read_line(&mut line).ok()? == 0 { return None; } // 管道关闭
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
            if let Some(data) = v.get("data").and_then(|d| d.as_f64()) {
                return Some(data);
            }
            // error 响应（如片头 time-pos 尚不可用）也算本轮结束
            if v.get("error").is_some() && v.get("event").is_none() {
                return None;
            }
        }
    }
    None
}

fn write_progress_and_emit(app: &AppHandle, movie_id: &str, position: i64, duration: i64) {
    let watched = duration > 0 && (position as f64) / (duration as f64) >= 0.95;
    {
        let db = app.state::<Database>();
        let conn = db.conn();
        let _ = conn.execute(
            "UPDATE movies SET watch_position=?1, watch_updated_at=?2, watched=?3 WHERE id=?4",
            rusqlite::params![position, chrono::Utc::now().to_rfc3339(), watched as i64, movie_id],
        );
        if let Ok(movie) = conn.query_row(
            "SELECT id, name, file_path, cover_path, duration, duration_seconds, \
             resolution, file_size, format, tags, add_time, status, error_msg, \
             watch_position, watch_updated_at, watched \
             FROM movies WHERE id=?1",
            rusqlite::params![movie_id],
            |r: &rusqlite::Row| crate::commands::movie::Movie::from_row(r),
        ) {
            let _ = app.emit("movie-updated", &movie);
        }
    }
}

/// 调起外接播放器。mpv 附带 IPC 管道监控线程做进度回传；
/// 其余播放器只做续播定位，无法回传（协议不支持）。
#[tauri::command]
pub fn launch_external_player(
    app: AppHandle,
    db: State<Database>,
    movie_id: String,
    kind: String,
    player_path: String,
) -> Result<(), String> {
    if !std::path::Path::new(&player_path).exists() {
        return Err("播放器路径不存在，请到设置中重新选择".to_string());
    }

    let (file_path, watch_position, watched, duration): (String, i64, bool, i64) = {
        let conn = db.conn();
        conn.query_row(
            "SELECT file_path, watch_position, watched, duration_seconds FROM movies WHERE id=?1",
            rusqlite::params![movie_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get::<_, i64>(2)? != 0, r.get(3)?)),
        ).map_err(|e| e.to_string())?
    };

    if !std::path::Path::new(&file_path).exists() {
        return Err("源视频文件不存在".to_string());
    }

    // 续播起点：未看完且 >5s 才定位
    let start_secs = if !watched && watch_position > 5
        && (duration == 0 || (watch_position as f64) < (duration as f64) * 0.95)
    { watch_position } else { 0 };

    let ipc_pipe = format!(r"\\.\pipe\nova-mpv-{}", movie_id);
    let args = build_args(&kind, &file_path, start_secs, &ipc_pipe);

    let mut child = Command::new(&player_path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("启动播放器失败: {}", e))?;

    if kind == "mpv" {
        // ── mpv 进度回传：轮询 IPC time-pos，退出时落盘 + 推送 ──
        let app_c = app.clone();
        let mid = movie_id.clone();
        std::thread::spawn(move || {
            let mut last_pos: f64 = start_secs as f64;
            std::thread::sleep(Duration::from_secs(2)); // 等 mpv 建好管道

            let pipe = std::fs::OpenOptions::new().read(true).write(true).open(&ipc_pipe).ok();
            let mut io = pipe.and_then(|f| {
                let w = f.try_clone().ok()?;
                Some((BufReader::new(f), w))
            });

            loop {
                match child.try_wait() {
                    Ok(Some(_)) | Err(_) => break, // 播放器已退出
                    Ok(None) => {}
                }
                if let Some((ref mut reader, ref mut writer)) = io {
                    if let Some(pos) = query_mpv_pos(reader, writer) {
                        last_pos = pos;
                        write_progress_and_emit(&app_c, &mid, pos as i64, duration);
                    }
                }
                std::thread::sleep(Duration::from_secs(5));
            }
            // 最终落盘
            if last_pos > 0.0 {
                write_progress_and_emit(&app_c, &mid, last_pos as i64, duration);
            }
        });
    }

    Ok(())
}
