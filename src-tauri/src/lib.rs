mod commands;
mod db;
mod license;
mod logger;
mod theme;
mod windows;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::default(), None::<Vec<&'static str>>))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Database
            let app_data_dir = app.path().app_data_dir()
                .expect("failed to get app data dir");
            let database = Database::new(app_data_dir.clone())
                .expect("failed to initialize database");

            let license_state = license::init_license(&database);
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
            windows::open_secondary_window,
            windows::close_secondary_window,
            windows::is_secondary_window_open,
            theme::install_theme_file,
            theme::install_theme_bytes,
            theme::list_installed_themes,
            theme::remove_installed_theme,
            theme::get_theme_asset_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
