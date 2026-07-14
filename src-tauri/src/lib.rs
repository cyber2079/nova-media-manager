mod commands;
mod db;
mod license;
mod logger;
mod theme;


use db::Database;
use tauri::Manager;

/// Release-only: detect debugger attached → exit immediately
#[cfg(all(target_os = "windows", not(debug_assertions)))]
fn anti_debug_check() {
    unsafe {
        extern "system" { fn IsDebuggerPresent() -> i32; }
        if IsDebuggerPresent() != 0 { std::process::exit(1); }
    }
}
#[cfg(not(all(target_os = "windows", not(debug_assertions))))]
fn anti_debug_check() {}

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
            commands::image::get_all_images,
            commands::image::add_images,
            commands::image::delete_image,
            commands::image::update_image_tags,
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
