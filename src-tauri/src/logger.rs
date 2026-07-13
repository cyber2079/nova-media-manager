//! File-based logging with rotation + panic hook capture.
//!
//! Logs to: {app_data_dir}/logs/app.log
//! Rotation: single file, max 5 MB, keeps 3 backup files
//! Panics: captured and written to crash-{timestamp}.log

use log::{Log, Metadata, Record};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

const MAX_LOG_SIZE: u64 = 5 * 1024 * 1024; // 5 MB
const MAX_BACKUP_FILES: usize = 3;

struct FileLogger {
    file: Mutex<File>,
}

impl Log for FileLogger {
    fn enabled(&self, _metadata: &Metadata) -> bool {
        true
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        if let Ok(mut file) = self.file.lock() {
            let ts = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
            let _ = writeln!(
                file,
                "{} [{}] {}:{} — {}",
                ts,
                record.level(),
                record.file().unwrap_or("?"),
                record.line().unwrap_or(0),
                record.args()
            );
        }
    }

    fn flush(&self) {
        if let Ok(mut file) = self.file.lock() {
            let _ = file.flush();
        }
    }
}

/// Rotate log files: app.log → app.log.1 → app.log.2 → app.log.3 (oldest deleted)
fn rotate_logs(log_dir: &PathBuf) {
    let main = log_dir.join("app.log");
    if let Ok(meta) = fs::metadata(&main) {
        if meta.len() > MAX_LOG_SIZE {
            for i in (1..MAX_BACKUP_FILES).rev() {
                let old = log_dir.join(format!("app.log.{}", i));
                let new = log_dir.join(format!("app.log.{}", i + 1));
                let _ = fs::rename(&old, &new);
            }
            let _ = fs::rename(&main, log_dir.join("app.log.1"));
        }
    }
}

/// Initialize file-based logging (release only).
/// In debug builds, tauri-plugin-log handles console+file output.
pub fn init_file_logger(data_dir: &std::path::Path) {
    let log_dir = data_dir.join("logs");
    fs::create_dir_all(&log_dir).ok();

    // Cleanup old crash logs (older than 30 days)
    cleanup_old_crash_logs(&log_dir);

    // Rotate if needed
    rotate_logs(&log_dir);

    // Set up log — only in release (debug uses tauri-plugin-log instead)
    #[cfg(not(debug_assertions))]
    {
        let log_path = log_dir.join("app.log");
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .expect("failed to open log file");

        let logger = FileLogger {
            file: Mutex::new(file),
        };

        log::set_boxed_logger(Box::new(logger)).ok();
        log::set_max_level(LevelFilter::Info);

        log::info!("═══ App started (log initialized) ═══");
    }
}

/// Cleanup crash logs older than 30 days
fn cleanup_old_crash_logs(log_dir: &PathBuf) {
    let cutoff = chrono::Utc::now() - chrono::Duration::days(30);
    if let Ok(entries) = fs::read_dir(log_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("crash-") {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        if let Ok(dur) = modified.duration_since(std::time::UNIX_EPOCH) {
                            let ts = chrono::DateTime::from_timestamp(dur.as_secs() as i64, 0);
                            if let Some(ts) = ts {
                                if ts < cutoff {
                                    let _ = fs::remove_file(entry.path());
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Register a panic hook that writes to crash-{timestamp}.log
pub fn set_panic_hook(data_dir: PathBuf) {
    let log_dir = data_dir.join("logs");
    std::panic::set_hook(Box::new(move |info| {
        // Log to stderr as well
        eprintln!("💥 CRASH: {}", info);

        // Write crash log
        fs::create_dir_all(&log_dir).ok();
        let ts = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let crash_path = log_dir.join(format!("crash-{}.log", ts));

        let payload = info.payload();
        let msg = if let Some(s) = payload.downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = payload.downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic payload".to_string()
        };

        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown location".to_string());

        let backtrace = std::backtrace::Backtrace::force_capture();
        let bt_str = format!("{}", backtrace);

        let content = format!(
            "Crash Report\n\
             ════════════════\n\
             Timestamp: {}\n\
             Location: {}\n\
             Message: {}\n\n\
             Backtrace:\n{}\n",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
            location,
            msg,
            bt_str.lines()
                .filter(|l| l.contains("app") || l.contains("tauri") || l.contains("src"))
                .take(30)
                .collect::<Vec<_>>()
                .join("\n")
        );

        if let Ok(mut file) = File::create(&crash_path) {
            let _ = file.write_all(content.as_bytes());
            eprintln!("Crash log written to: {}", crash_path.display());
        }

        // Force flush the regular log before exiting
        log::logger().flush();
    }));

    // Let the process actually panic after the hook runs
    let _ = std::panic::take_hook();
}
