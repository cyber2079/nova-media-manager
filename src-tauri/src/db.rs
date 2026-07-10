use rusqlite::{Connection, Result as SqlResult};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database { pub conn: Mutex<Connection>, data_dir: PathBuf }

impl Database {
    pub fn new(app_data_dir: PathBuf) -> SqlResult<Self> {
        std::fs::create_dir_all(&app_data_dir).ok();
        let db_path = app_data_dir.join("media_library.db");
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
        Ok(Database { conn: Mutex::new(conn), data_dir: app_data_dir })
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap()
    }

    pub fn data_dir(&self) -> &PathBuf {
        &self.data_dir
    }
}
