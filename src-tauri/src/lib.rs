mod commands;
mod db;
mod license;
mod logger;
mod theme;


use db::Database;
use db::APP_ID;
use tauri::Manager;

/// Release-only: show a user-visible error dialog before exiting.
/// Avoids silent crashes that look like app bugs on integrity/anti-debug failure.
#[cfg(all(target_os = "windows", not(debug_assertions)))]
fn fatal_error_msg(title: &str, body: &str) {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    let wide_title: Vec<u16> = OsStr::new(title).encode_wide().chain(std::iter::once(0)).collect();
    let wide_body: Vec<u16> = OsStr::new(body).encode_wide().chain(std::iter::once(0)).collect();
    unsafe {
        extern "system" { fn MessageBoxW(h: isize, t: *const u16, c: *const u16, u: u32) -> i32; }
        MessageBoxW(0, wide_body.as_ptr(), wide_title.as_ptr(), 0x10); // MB_ICONERROR
    }
}
#[cfg(not(all(target_os = "windows", not(debug_assertions))))]
#[allow(dead_code)]
fn fatal_error_msg(_title: &str, _body: &str) { eprintln!("FATAL: {} — {}", _title, _body); }

/// Release-only: detect debugger attached → exit immediately
#[cfg(all(target_os = "windows", not(debug_assertions)))]
fn anti_debug_check() {
    unsafe {
        extern "system" {
            fn IsDebuggerPresent() -> i32;
            fn CheckRemoteDebuggerPresent(hProcess: isize, pbDebuggerPresent: *mut i32) -> i32;
        }

        // 1. IsDebuggerPresent — catches basic user-mode debuggers
        if IsDebuggerPresent() != 0 {
            fatal_error_msg("Nova Media Manager", "检测到调试器，应用无法在此环境下运行。\n\nDebugger detected — application cannot run in this environment.");
            std::process::exit(1);
        }

        // 2. CheckRemoteDebuggerPresent — catches debuggers that hide
        //    from IsDebuggerPresent (e.g. x64dbg "hide debugger" plugin)
        let mut debugger_present: i32 = 0;
        CheckRemoteDebuggerPresent(-1, &mut debugger_present); // -1 = GetCurrentProcess()
        if debugger_present != 0 {
            fatal_error_msg("Nova Media Manager", "检测到远程调试器，应用无法在此环境下运行。\n\nRemote debugger detected — application cannot run in this environment.");
            std::process::exit(1);
        }

        // 3. Hardware breakpoint detection (Dr0-Dr3)
        //    Debuggers set these registers for breakpoints; clean process has all zeros.
        detect_hw_breakpoints();
    }
}

#[cfg(not(all(target_os = "windows", not(debug_assertions))))]
fn anti_debug_check() {}

/// Detect hardware breakpoints via debug registers (x86_64 only).
/// Dr0–Dr3 hold linear addresses of hardware breakpoints.
/// If any is non-zero, a debugger has set a hardware breakpoint → exit.
#[cfg(all(target_arch = "x86_64", not(debug_assertions)))]
unsafe fn detect_hw_breakpoints() {
    let dr0: usize;
    let dr1: usize;
    let dr2: usize;
    let dr3: usize;
    core::arch::asm!(
        "mov {}, dr0",
        "mov {}, dr1",
        "mov {}, dr2",
        "mov {}, dr3",
        out(reg) dr0, out(reg) dr1, out(reg) dr2, out(reg) dr3,
        options(nomem, nostack, preserves_flags),
    );
    if dr0 != 0 || dr1 != 0 || dr2 != 0 || dr3 != 0 {
        fatal_error_msg("Nova Media Manager", "检测到硬件断点，应用无法在此环境下运行。\n\nHardware breakpoint detected — application cannot run in this environment.");
        std::process::exit(1);
    }
}

#[cfg(not(all(target_arch = "x86_64", not(debug_assertions))))]
#[allow(dead_code)]
unsafe fn detect_hw_breakpoints() {}

/// Release-only: verify frontend JS/HTML files haven't been tampered with
#[cfg(not(debug_assertions))]
fn verify_frontend_integrity() {
    include!(concat!(env!("OUT_DIR"), "/frontend_hashes.rs"));
    use sha2::{Digest, Sha256};
    use std::path::Path;
    let dist = std::env::current_exe().ok().and_then(|e| {
        e.parent().map(|p| p.join("_up_").join("dist"))
    });
    if let Some(ref d) = dist {
        if !d.exists() { return; }
        for &(name, expected) in FRONTEND_HASHES {
            let data = match std::fs::read(d.join(name)) {
                Ok(d) => d, Err(_) => { eprintln!("[integrity] missing: {}", name); std::process::exit(1); }
            };
            let actual = hex::encode(Sha256::digest(&data));
            if actual != expected {
                eprintln!("[integrity] tampered: {}", name);
                fatal_error_msg("Nova Media Manager — 完整性校验失败",
                    &format!("文件 {} 已被篡改，应用无法安全启动。\n\nFile {} has been tampered with.", name, name));
                std::process::exit(1);
            }
        }
    }
}
#[cfg(debug_assertions)]
fn verify_frontend_integrity() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    anti_debug_check();
    verify_frontend_integrity();

    // ── WebView2 GPU 硬件加速（可开关，需重启生效）──
    #[cfg(target_os = "windows")]
    {
        let hw_accel_enabled = read_hw_accel_setting().unwrap_or(true);
        if hw_accel_enabled {
            std::env::set_var(
                "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
                "--enable-gpu-rasterization \
                 --enable-zero-copy \
                 --ignore-gpu-blocklist \
                 --disable-software-rasterizer \
                 --enable-features=AcceleratedVideoDecode,D3D11VideoDecoder,ZeroCopyVideoCapture",
            );
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::default(), None::<Vec<&'static str>>))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Release: disable DevTools
            #[cfg(not(debug_assertions))]
            if let Some(w) = app.get_webview_window("main") {
                w.set_devtools(false);
            }

            // Database
            let app_data_dir = app.path().app_data_dir()
                .expect("failed to get app data dir");
            let database = Database::new(app_data_dir.clone())
                .expect("failed to initialize database");

            let license_state = license::init_license(&database);

            // Theme protocol state — nvtp blobs stored in {app_data}/themes/nvtp/
            let nvtp_dir = app_data_dir.join("themes").join("nvtp");
            theme::protocol::init_protocol(nvtp_dir);

            // Preload installed themes into memory on startup
            let installed = theme::loader::list_themes(&app_data_dir);
            let proto = theme::protocol::global();
            for t in &installed {
                let _ = proto.lock().map(|s| s.ensure_loaded(&t.id));
            }

            app.manage(database);
            app.manage(license_state);

            // Logging: tauri-plugin-log in debug, file logger in release
            #[cfg(debug_assertions)]
            {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }
            #[cfg(not(debug_assertions))]
            {
                logger::init_file_logger(&app_data_dir);
            }

            // Panic hook always on
            logger::set_panic_hook(app_data_dir.clone());
            Ok(())
        })
        .register_uri_scheme_protocol("nova", |_ctx, request| {
            // Access managed state through the app handle attached to context
            // Tauri 2.x: UriSchemeContext doesn't expose state() directly,
            // so we use a module-level static to hold the protocol state.
            theme::protocol::handle_request(&request)
        })
        .invoke_handler(tauri::generate_handler![
            commands::movie::get_all_movies,
            commands::movie::add_movies,
            commands::movie::delete_movie,
            commands::movie::update_movie_tags,
            commands::movie::regenerate_movie_cover,
            commands::movie::update_watch_progress,
            commands::external_player::detect_external_players,
            commands::external_player::launch_external_player,
            commands::folder_scan::expand_media_paths,
            commands::dashboard_stats::dashboard_stats,
            commands::checkin::auto_checkin,
            commands::checkin::get_checkin_stats,
            commands::image::get_all_images,
            commands::image::add_images,
            commands::image::delete_image,
            commands::image::update_image_tags,
            commands::image::backfill_image_thumbnails,
            commands::game::get_all_games,
            commands::game::add_game,
            commands::game::delete_game,
            commands::game::update_game_tags,
            commands::game::launch_game,
            commands::steam_scanner::scan_steam_games,
            commands::quick_launch::get_quick_launch,
            commands::quick_launch::add_quick_launch,
            commands::quick_launch::remove_quick_launch,
            commands::quick_launch::launch_quick_item,
            commands::quick_launch::check_programs_running,
            commands::unblock::unblock_file,
            commands::extract_icon::extract_exe_icon,
            commands::music::get_all_music,
            commands::music::add_music,
            commands::music::delete_music,
            commands::music::update_music_tags,
            commands::shell::open_file_properties,
            commands::shell::set_wallpaper,
            commands::convert::convert_video_to_webp,
            commands::system::get_system_info,
            commands::system::wallpaper_list_images,
            commands::system_tools::get_system_volume,
            commands::system_tools::set_system_volume,
            commands::system_tools::get_system_mute,
            commands::system_tools::set_system_mute,
            commands::system_tools::open_control_panel,
            commands::system_tools::open_cmd_admin,
            commands::system_tools::open_notepad,
            commands::system_tools::empty_recycle_bin,
            commands::system_tools::open_downloads,
            commands::system_tools::open_desktop,
            commands::system_tools::open_documents,
            commands::system_tools::open_pictures,
            commands::system_tools::open_music_folder,
            commands::system_tools::open_videos,
            commands::system_tools::open_app_data,
            commands::system_tools::lock_screen,
            commands::system_tools::sleep,
            commands::system_tools::restart,
            commands::system_tools::shutdown,
            commands::system_tools::cancel_restart_shutdown,
            commands::system_tools::open_taskmgr,
            commands::system_tools::open_snipping_tool,
            commands::system_tools::open_calculator,
            commands::system_tools::open_device_manager,
            commands::system_tools::open_disk_cleanup,
            commands::system_tools::open_registry_editor,
            commands::system_tools::open_system_info,
            commands::system_tools::open_game_bar,
            commands::system_tools::open_bluetooth_settings,
            commands::system_tools::open_network_settings,
            commands::file_explorer::list_drives,
            commands::file_explorer::list_dir,
            commands::file_explorer::open_my_computer,
            commands::file_explorer::delete_items,
            commands::file_explorer::copy_items,
            commands::file_explorer::cut_items,
            commands::file_explorer::paste_items,
            commands::file_explorer::rename_item,
            commands::file_explorer::show_properties,
            commands::file_explorer::create_folder,
            commands::file_explorer::list_pinned_folders,
            commands::user_data::kv_get,
            commands::user_data::kv_set,
            commands::user_data::kv_delete,
            commands::user_data::kv_get_all,
            commands::user_data::pl_get_all,
            commands::user_data::pl_save,
            commands::user_data::pl_delete,
            commands::user_data::pl_save_all,
            commands::user_data::fav_get_all,
            commands::user_data::fav_toggle,
            commands::user_data::hist_get_recent,
            commands::user_data::hist_add,
            commands::user_data::hist_clear,
            commands::user_data::mc_get_all,
            commands::user_data::mc_save,
            commands::user_data::mc_delete,
            commands::user_data::export_data,
            commands::user_data::import_data,
            commands::performance::get_performance_info,
            commands::performance::set_process_priority,
            commands::performance::cleanup_invalid_covers,
            commands::screenshot::save_screenshot,
            commands::hevc::install_hevc_if_needed,
            commands::webgl3d::nv3d_open,
            commands::webgl3d::nv3d_verify,
            commands::webgl3d::nv3d_read_block,
            commands::webgl3d::webgl3d_save_data,
            commands::webgl3d::webgl3d_load_data,
            commands::webgl3d::webgl3d_delete_data,
            commands::webgl3d::webgl3d_cache_size,
            commands::webgl3d::webgl3d_clear_cache,
            license::get_license,
            license::activate_license,
            license::check_license,
            license::unbind_license,
            license::get_last_check_times,
            theme::install_theme_file,
            theme::install_theme_bytes,
            theme::list_installed_themes,
            theme::remove_installed_theme,
            commands::theme_studio::theme_studio_list_projects,
            commands::theme_studio::theme_studio_get_project,
            commands::theme_studio::theme_studio_update_manifest,
            commands::theme_studio::theme_studio_create_project,
            commands::theme_studio::theme_studio_delete_asset,
            commands::theme_studio::theme_studio_validate,
            commands::theme_studio::theme_studio_generate,
            commands::theme_studio::theme_get_script,
            commands::theme_studio::theme_studio_update_script,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(target_os = "windows")]
fn read_hw_accel_setting() -> Option<bool> {
    use rusqlite::Connection;
    use std::path::PathBuf;
    // Use shared APP_ID constant (same as db.rs::Database::new) to prevent drift.
    let app_data = std::env::var("APPDATA").ok().map(PathBuf::from)
        .unwrap_or_else(|| dirs::data_dir().unwrap_or_default())
        .join(APP_ID);
    let db_path = app_data.join("data").join("media_library.db");
    if !db_path.exists() { return Some(true); } // DB not yet created → default enabled
    let conn = Connection::open(db_path).ok()?;
    // Enable WAL mode so concurrent access with main Database connection is safe.
    conn.execute_batch("PRAGMA journal_mode=WAL;").ok()?;
    let json: String = conn
        .query_row("SELECT value FROM kv_store WHERE key='app-settings'", [], |r| r.get(0))
        .ok()?;
    let v: serde_json::Value = serde_json::from_str(&json).ok()?;
    v.get("hardwareAcceleration")
        .and_then(|h| h.as_bool())
        .or(Some(true)) // default: enabled
}
#[cfg(not(target_os = "windows"))]
fn read_hw_accel_setting() -> Option<bool> { None }
