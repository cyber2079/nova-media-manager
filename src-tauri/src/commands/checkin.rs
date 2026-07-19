// ── 签到系统（纯统计）──
// 每日首次活动自动签入（有 >=1 条 play_events 即算活跃）

use crate::db::Database;
use crate::license::LicenseState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CheckInStats {
    pub active_days: i64,
    pub total_active_days: i64,
    pub streak_days: i64,
    pub today_checked: bool,
    pub today_play_count: i64,
    pub tier: String,
}

// ═══════════════ COMMANDS ═══════════════

#[tauri::command]
pub fn auto_checkin(db: State<'_, Database>) -> Result<CheckInStats, String> {
    let conn = db.conn();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();

    let today_plays: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM play_events WHERE date(played_at, 'localtime') = ?1",
            [&today],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if today_plays > 0 {
        conn.execute(
            "INSERT OR REPLACE INTO check_in (date, play_count, created_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![today, today_plays, now],
        )
        .map_err(|e| format!("err: {}", e))?;
    }

    drop(conn);
    get_checkin_stats_inner(&db)
}

#[tauri::command]
pub fn get_checkin_stats(
    db: State<'_, Database>,
    license: State<'_, LicenseState>,
) -> Result<CheckInStats, String> {
    let mut stats = get_checkin_stats_inner(&db)?;
    let info_lock = license.info.lock().map_err(|e| e.to_string())?;
    stats.tier = info_lock.as_ref().map(|i| i.tier.clone()).unwrap_or_else(|| "free".to_string());
    Ok(stats)
}

// ═══════════════ HELPERS ═══════════════

fn get_checkin_stats_inner(db: &Database) -> Result<CheckInStats, String> {
    let conn = db.conn();

    let total_active_days: i64 = conn.query_row("SELECT COUNT(*) FROM check_in", [], |row| row.get(0)).unwrap_or(0);

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let (today_checked, today_play_count): (bool, i64) = conn
        .query_row(
            "SELECT COUNT(*), COALESCE(MAX(play_count), 0) FROM check_in WHERE date = ?1",
            [&today],
            |row| Ok((true, row.get(1)?)),
        )
        .unwrap_or((false, 0));
    let today_checked = today_checked && today_play_count > 0;
    let streak = compute_streak(&conn);

    Ok(CheckInStats {
        active_days: total_active_days,
        total_active_days,
        streak_days: streak,
        today_checked,
        today_play_count,
        tier: "free".to_string(),
    })
}

fn compute_streak(conn: &std::sync::MutexGuard<'_, rusqlite::Connection>) -> i64 {
    let mut stmt = conn
        .prepare("SELECT date FROM check_in WHERE play_count > 0 ORDER BY date DESC")
        .unwrap();
    let dates: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    if dates.is_empty() { return 0; }

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let yesterday = chrono::Local::now()
        .checked_sub_signed(chrono::Duration::days(1))
        .map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_default();
    if dates[0] != today && dates[0] != yesterday { return 0; }

    let mut streak = 1i64;
    for i in 1..dates.len() {
        let expected = chrono::NaiveDate::parse_from_str(&dates[i - 1], "%Y-%m-%d")
            .ok()
            .and_then(|d| d.checked_sub_signed(chrono::Duration::days(1)))
            .map(|d| d.format("%Y-%m-%d").to_string());
        if let Some(exp) = expected {
            if dates[i] == exp { streak += 1; } else { break; }
        } else { break; }
    }
    streak
}

// ═══════════════ TESTS ═══════════════

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS check_in (
                date TEXT PRIMARY KEY,
                play_count INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            );"
        ).unwrap();
        conn
    }

    fn today() -> String { chrono::Local::now().format("%Y-%m-%d").to_string() }
    fn n_days_ago(n: i64) -> String {
        chrono::Local::now().checked_sub_signed(chrono::Duration::days(n)).map(|d| d.format("%Y-%m-%d").to_string()).unwrap_or_default()
    }

    #[test]
    fn test_empty_table() {
        let conn = setup();
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM check_in", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_insert_and_idempotent() {
        let conn = setup();
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        conn.execute("INSERT OR REPLACE INTO check_in VALUES (?1, 3, ?2)", rusqlite::params![today(), now]).unwrap();
        conn.execute("INSERT OR REPLACE INTO check_in VALUES (?1, 7, ?2)", rusqlite::params![today(), now]).unwrap();
        let cnt: i64 = conn.query_row("SELECT COUNT(*) FROM check_in", [], |r| r.get(0)).unwrap();
        let pc: i64 = conn.query_row("SELECT play_count FROM check_in WHERE date = ?1", [today()], |r| r.get(0)).unwrap();
        assert_eq!(cnt, 1);
        assert_eq!(pc, 7);
    }

    #[test]
    fn test_streak_5_days() {
        let conn = setup();
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        for n in [0, 1, 2, 3, 4] {
            conn.execute("INSERT OR REPLACE INTO check_in VALUES (?1, 1, ?2)", rusqlite::params![n_days_ago(n), now]).unwrap();
        }
        let mut stmt = conn.prepare("SELECT date FROM check_in WHERE play_count > 0 ORDER BY date DESC").unwrap();
        let dates: Vec<String> = stmt.query_map([], |r| r.get::<_, String>(0)).unwrap().filter_map(|r| r.ok()).collect();
        assert_eq!(dates.len(), 5);
        for i in 1..dates.len() {
            let prev = chrono::NaiveDate::parse_from_str(&dates[i-1], "%Y-%m-%d").unwrap();
            let cur = chrono::NaiveDate::parse_from_str(&dates[i], "%Y-%m-%d").unwrap();
            assert_eq!(prev.signed_duration_since(cur).num_days(), 1);
        }
    }

    #[test]
    fn test_streak_broken() {
        let conn = setup();
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        conn.execute("INSERT OR REPLACE INTO check_in VALUES (?1, 1, ?2)", rusqlite::params![today(), now]).unwrap();
        conn.execute("INSERT OR REPLACE INTO check_in VALUES (?1, 1, ?2)", rusqlite::params![n_days_ago(2), now]).unwrap();
        let mut stmt = conn.prepare("SELECT date FROM check_in WHERE play_count > 0 ORDER BY date DESC").unwrap();
        let dates: Vec<String> = stmt.query_map([], |r| r.get::<_, String>(0)).unwrap().filter_map(|r| r.ok()).collect();
        assert_eq!(dates.len(), 2);
        assert_eq!(dates[0], today());
        let d1 = chrono::NaiveDate::parse_from_str(&dates[1], "%Y-%m-%d").unwrap();
        let expected_next = d1.checked_add_signed(chrono::Duration::days(1)).unwrap().format("%Y-%m-%d").to_string();
        assert_ne!(expected_next, dates[0]);
    }
}
