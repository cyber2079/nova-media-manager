use rusqlite::{Connection, Result as SqlResult};
use std::path::PathBuf;
use std::sync::Mutex;

/// App identifier — shared with lib.rs for path construction before Tauri setup runs.
pub const APP_ID: &str = "com.media-manager.app";

pub struct Database { pub conn: Mutex<Connection>, data_dir: PathBuf, #[allow(dead_code)] app_data_dir: PathBuf }

impl Database {
    /// Database + covers + themes live in `app_data_dir/data/` to separate
    /// persistent user data from cache/logs/config in the parent directory.
    /// Old DB is auto-migrated on first start.
    pub fn new(app_data_dir: PathBuf) -> SqlResult<Self> {
        let data_dir = app_data_dir.join("data");
        std::fs::create_dir_all(&data_dir).ok();
        // Migrate old DB if it exists in the parent directory
        let old_path = app_data_dir.join("media_library.db");
        let db_path = data_dir.join("media_library.db");
        if old_path.exists() && !db_path.exists() {
            std::fs::rename(&old_path, &db_path).ok();
        }
        // Migrate old covers too
        let old_covers = app_data_dir.join("covers");
        let new_covers = data_dir.join("covers");
        if old_covers.exists() && !new_covers.exists() {
            std::fs::rename(&old_covers, &new_covers).ok();
        }
        // Migrate old themes
        let old_themes = app_data_dir.join("themes");
        let new_themes = data_dir.join("themes");
        if old_themes.exists() && !new_themes.exists() {
            std::fs::rename(&old_themes, &new_themes).ok();
        }
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS movies (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, file_path TEXT NOT NULL UNIQUE,
                cover_path TEXT DEFAULT '', duration TEXT DEFAULT '',
                duration_seconds INTEGER DEFAULT 0, resolution TEXT DEFAULT '',
                file_size INTEGER DEFAULT 0, format TEXT DEFAULT '',
                tags TEXT DEFAULT '[]', add_time TEXT NOT NULL,
                status TEXT DEFAULT 'processing', error_msg TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS images (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, file_path TEXT NOT NULL UNIQUE,
                cover_path TEXT DEFAULT '', resolution TEXT DEFAULT '',
                file_size INTEGER DEFAULT 0, width INTEGER DEFAULT 0,
                height INTEGER DEFAULT 0, tags TEXT DEFAULT '[]', add_time TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, executable_path TEXT NOT NULL UNIQUE,
                cover_path TEXT DEFAULT '', platform TEXT DEFAULT 'Windows',
                tags TEXT DEFAULT '[]', add_time TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS quick_launch (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, program_path TEXT NOT NULL UNIQUE,
                icon_path TEXT DEFAULT '', sort_order INTEGER DEFAULT 0
            );

            -- ── User data tables (replaces localStorage) ──

            CREATE TABLE IF NOT EXISTS kv_store (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                music_ids TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS favorites (
                item_id TEXT NOT NULL,
                item_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (item_id, item_type)
            );

            CREATE TABLE IF NOT EXISTS play_history (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                item_type TEXT NOT NULL,
                played_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS music_cache (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, file_path TEXT NOT NULL UNIQUE,
                cover_path TEXT DEFAULT '', artist TEXT DEFAULT '', album TEXT DEFAULT '',
                duration TEXT DEFAULT '', file_size INTEGER DEFAULT 0,
                tags TEXT DEFAULT '[]', add_time TEXT NOT NULL
            );"
        )?;
        // ── Incremental migrations — duplicate-column errors are expected and ignored ──
        for sql in [
            "ALTER TABLE movies ADD COLUMN watch_position INTEGER DEFAULT 0",
            "ALTER TABLE movies ADD COLUMN watch_updated_at TEXT DEFAULT ''",
            "ALTER TABLE movies ADD COLUMN watched INTEGER DEFAULT 0",
            // ── Game landscape cover ──
            "ALTER TABLE games ADD COLUMN landscape_path TEXT DEFAULT ''",
        ] {
            let _ = conn.execute(sql, []);
        }
        // ── play_events：逐次播放事件（play_history 是 REPLACE 去重的"最近使用"，无法统计次数）──
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS play_events (
                event_id TEXT PRIMARY KEY,
                item_id TEXT NOT NULL,
                name TEXT NOT NULL,
                item_type TEXT NOT NULL,
                played_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_play_events_time ON play_events(played_at);
            CREATE INDEX IF NOT EXISTS idx_play_events_item ON play_events(item_type, item_id);"
        );
        // 一次性 seed：把旧 play_history 的存量灌入事件表（每条目至少有最后一次播放）
        let _ = conn.execute(
            "INSERT OR IGNORE INTO play_events (event_id, item_id, name, item_type, played_at)
             SELECT id || '@' || played_at, id, name, item_type, played_at FROM play_history
             WHERE NOT EXISTS (SELECT 1 FROM play_events LIMIT 1)",
            [],
        );

        // ── 签到活跃表：每日首次活动自动签入 ──
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS check_in (
                date TEXT PRIMARY KEY,          -- '2026-07-17' (local)
                play_count INTEGER DEFAULT 1,   -- 当天活动次数
                created_at TEXT NOT NULL         -- ISO timestamp
            );"
        );
        Ok(Database { conn: Mutex::new(conn), data_dir, app_data_dir })
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap()
    }

    /// Persistent user data directory (DB, covers, themes) — safe from cache cleanup.
    pub fn data_dir(&self) -> &PathBuf {
        &self.data_dir
    }

    /// App-wide directory (logs, config) — may be cleared by system cleanup.
    #[allow(dead_code)]
    pub fn app_data_dir(&self) -> &PathBuf {
        &self.app_data_dir
    }
}
