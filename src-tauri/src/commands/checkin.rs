// ── 签到活跃系统 ──
// 每日首次活动自动签入（有 >=1 条 play_events 即算活跃）
// 累计活跃天用于解锁续期奖励（仅 Pro+ 用户可领取）
// 奖励兑现走服务端校验，防止本地篡改

use crate::db::Database;
use crate::license::{LicenseInfo, LicenseState};
use serde::{Deserialize, Serialize};
use tauri::State;

const SERVER_URL: &str = "https://scm-think.cn";

// ═══════════════ TYPES ═══════════════

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CheckInStats {
    pub active_days: i64,        // 累计活跃天数（有活动的日历日）
    pub streak_days: i64,        // 最近连续活跃天数
    pub today_checked: bool,     // 今天是否已签到
    pub today_play_count: i64,   // 今天活动次数
    pub tier: String,            // 当前许可证等级
    pub claimed_milestones: Vec<i64>,
    pub milestones: Vec<MilestoneDef>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneDef {
    pub days: i64,
    pub reward_days: i64,
    pub claimed: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct RedeemRequest {
    token: String,
    device_id: String,
    milestone: i64,
    active_days: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct RedeemResponse {
    success: bool,
    token: Option<String>,
    new_expires_at: Option<String>,
    error: Option<String>,
}

const MILESTONES: &[(i64, i64)] = &[
    (7, 1), (30, 3), (60, 5), (90, 7), (180, 14), (365, 30),
];

const LICENSE_TOKEN_KEY: &str = "license_token";
const DEVICE_ID_KEY: &str = "device_id";

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
        .map_err(|e| format!("签到失败: {}", e))?;
    }

    drop(conn);
    get_checkin_stats_inner(&db)
}

#[tauri::command]
pub fn get_checkin_stats(
    db: State<'_, Database>,
    license: State<'_, LicenseState>,
) -> Result<CheckInStats, String> {
    get_checkin_stats_inner_with_license(&db, &license)
}

#[tauri::command]
pub async fn redeem_milestone(
    db: State<'_, Database>,
    license: State<'_, LicenseState>,
    milestone: i64,
) -> Result<LicenseInfo, String> {
    let stats = get_checkin_stats_inner_with_license(&db, &license)?;

    if stats.tier == "free" {
        return Err("免费用户不享受签到奖励，升级会员即可解锁".to_string());
    }
    if stats.active_days < milestone {
        return Err(format!("活跃天数不足：需要 {} 天，当前 {} 天", milestone, stats.active_days));
    }
    if stats.claimed_milestones.contains(&milestone) {
        return Err("该里程碑奖励已领取".to_string());
    }

    let (token, device_id) = {
        let conn = db.conn();
        let t: String = conn
            .query_row("SELECT value FROM kv_store WHERE key = ?1", [LICENSE_TOKEN_KEY], |row| row.get(0))
            .map_err(|_| "未找到许可证 token".to_string())?;
        let d: String = conn
            .query_row("SELECT value FROM kv_store WHERE key = ?1", [DEVICE_ID_KEY], |row| row.get(0))
            .map_err(|_| "未找到设备 ID".to_string())?;
        (t, d)
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/checkin/redeem", SERVER_URL))
        .json(&RedeemRequest { token, device_id, milestone, active_days: stats.active_days })
        .send()
        .await
        .map_err(|e| format!("网络错误: {}", e))?;

    if !resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.unwrap_or_default();
        return Err(body["error"].as_str().unwrap_or("领取失败").to_string());
    }

    let data: RedeemResponse = resp.json().await.map_err(|e| format!("解析错误: {}", e))?;
    if !data.success || data.token.is_none() {
        return Err(data.error.unwrap_or_else(|| "未知错误".to_string()));
    }

    let conn = db.conn();
    conn.execute(
        "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?1, ?2)",
        rusqlite::params![LICENSE_TOKEN_KEY, data.token.as_ref().unwrap()],
    ).ok();

    let mut claimed = stats.claimed_milestones.clone();
    claimed.push(milestone);
    claimed.sort();
    claimed.dedup();
    let claimed_json = serde_json::to_string(&claimed).unwrap_or_default();
    conn.execute(
        "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('checkin_claimed_milestones', ?1)",
        rusqlite::params![claimed_json],
    ).ok();
    drop(conn);

    {
        let mut info_lock = license.info.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut info) = *info_lock {
            info.expires_at = data.new_expires_at.or_else(|| info.expires_at.clone());
        }
    }

    let info_lock = license.info.lock().map_err(|e| e.to_string())?;
    match info_lock.as_ref() {
        Some(i) => Ok(i.clone()),
        None => Err("许可证状态异常".to_string()),
    }
}

// ═══════════════ INNER HELPERS ═══════════════

fn get_checkin_stats_inner(db: &Database) -> Result<CheckInStats, String> {
    let conn = db.conn();
    let active_days: i64 = conn.query_row("SELECT COUNT(*) FROM check_in", [], |row| row.get(0)).unwrap_or(0);
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
    let claimed_milestones = get_claimed_milestones(&conn);
    let milestones: Vec<MilestoneDef> = MILESTONES
        .iter()
        .map(|&(days, reward_days)| MilestoneDef {
            days,
            reward_days,
            claimed: claimed_milestones.contains(&days),
        })
        .collect();

    Ok(CheckInStats {
        active_days,
        streak_days: streak,
        today_checked,
        today_play_count,
        tier: "free".to_string(),
        claimed_milestones,
        milestones,
    })
}

fn get_checkin_stats_inner_with_license(
    db: &Database,
    license: &LicenseState,
) -> Result<CheckInStats, String> {
    let mut stats = get_checkin_stats_inner(db)?;
    let info_lock = license.info.lock().map_err(|e| e.to_string())?;
    stats.tier = info_lock.as_ref().map(|i| i.tier.clone()).unwrap_or_else(|| "free".to_string());
    Ok(stats)
}

fn compute_streak(conn: &std::sync::MutexGuard<'_, rusqlite::Connection>) -> i64 {
    // 从最后一条活跃记录往回数连续天数
    // 拉出所有活跃日期（最多 365 行），Rust 侧 O(n) 计算连续
    let mut stmt = conn
        .prepare("SELECT date FROM check_in WHERE play_count > 0 ORDER BY date DESC")
        .unwrap();
    let dates: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    if dates.is_empty() {
        return 0;
    }

    // 第一项必须恰好是"今天"或"昨天"才算当前 streak
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let yesterday = chrono::Local::now()
        .checked_sub_signed(chrono::Duration::days(1))
        .map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_default();
    if dates[0] != today && dates[0] != yesterday {
        return 0;
    }

    let mut streak = 1i64;
    for i in 1..dates.len() {
        // 当前日期 d 的上一天应该等于 dates[i]
        let expected = chrono::NaiveDate::parse_from_str(&dates[i - 1], "%Y-%m-%d")
            .ok()
            .and_then(|d| d.checked_sub_signed(chrono::Duration::days(1)))
            .map(|d| d.format("%Y-%m-%d").to_string());
        if let Some(exp) = expected {
            if dates[i] == exp {
                streak += 1;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    streak
}

fn get_claimed_milestones(
    conn: &std::sync::MutexGuard<'_, rusqlite::Connection>,
) -> Vec<i64> {
    let json: Option<String> = conn
        .query_row(
            "SELECT value FROM kv_store WHERE key = 'checkin_claimed_milestones'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok();
    json.as_deref()
        .and_then(|s| serde_json::from_str::<Vec<i64>>(s).ok())
        .unwrap_or_default()
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
            );
            CREATE TABLE IF NOT EXISTS kv_store (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );"
        ).unwrap();
        conn
    }

    fn today() -> String { chrono::Local::now().format("%Y-%m-%d").to_string() }
    fn n_days_ago(n: i64) -> String {
        chrono::Local::now()
            .checked_sub_signed(chrono::Duration::days(n))
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_default()
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
        assert_eq!(cnt, 1, "幂等签入仍是 1 行");
        assert_eq!(pc, 7, "play_count 应更新");
    }

    #[test]
    fn test_streak_5_days() {
        let conn = setup();
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        for n in [0, 1, 2, 3, 4] {
            conn.execute("INSERT OR REPLACE INTO check_in VALUES (?1, 1, ?2)", rusqlite::params![n_days_ago(n), now]).unwrap();
        }
        // Rust-side streak: pull all dates, walk backward
        let mut stmt = conn.prepare("SELECT date FROM check_in WHERE play_count > 0 ORDER BY date DESC").unwrap();
        let dates: Vec<String> = stmt.query_map([], |r| r.get::<_, String>(0)).unwrap().filter_map(|r| r.ok()).collect();
        assert_eq!(dates.len(), 5);
        // All 5 should be consecutive (today through 4 days ago)
        for i in 1..dates.len() {
            let prev = chrono::NaiveDate::parse_from_str(&dates[i-1], "%Y-%m-%d").unwrap();
            let cur = chrono::NaiveDate::parse_from_str(&dates[i], "%Y-%m-%d").unwrap();
            assert_eq!(prev.signed_duration_since(cur).num_days(), 1, "dates should be consecutive");
        }
    }

    #[test]
    fn test_streak_broken() {
        let conn = setup();
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        conn.execute("INSERT OR REPLACE INTO check_in VALUES (?1, 1, ?2)", rusqlite::params![today(), now]).unwrap();
        conn.execute("INSERT OR REPLACE INTO check_in VALUES (?1, 1, ?2)", rusqlite::params![n_days_ago(2), now]).unwrap();
        // yesterday is missing → only today counts
        let mut stmt = conn.prepare("SELECT date FROM check_in WHERE play_count > 0 ORDER BY date DESC").unwrap();
        let dates: Vec<String> = stmt.query_map([], |r| r.get::<_, String>(0)).unwrap().filter_map(|r| r.ok()).collect();
        assert_eq!(dates.len(), 2);
        assert_eq!(dates[0], today());
        // day after dates[1] is not dates[0] → gap → streak = 1
        let d1 = chrono::NaiveDate::parse_from_str(&dates[1], "%Y-%m-%d").unwrap();
        let expected_next = d1.checked_add_signed(chrono::Duration::days(1)).unwrap().format("%Y-%m-%d").to_string();
        assert_ne!(expected_next, dates[0], "gap should exist between {} and {}", dates[1], dates[0]);
    }

    #[test]
    fn test_milestones_dedup() {
        let conn = setup();
        // 写入 [7, 7, 30] — 如果有重复也应该能去重
        let claimed = vec![7i64, 7, 30];
        let json = serde_json::to_string(&claimed).unwrap();
        conn.execute("INSERT OR REPLACE INTO kv_store VALUES ('checkin_claimed_milestones', ?1)", rusqlite::params![json]).unwrap();
        let saved: String = conn.query_row("SELECT value FROM kv_store WHERE key='checkin_claimed_milestones'", [], |r| r.get::<_, String>(0)).unwrap();
        let mut parsed: Vec<i64> = serde_json::from_str(&saved).unwrap();
        parsed.sort();
        parsed.dedup();
        assert_eq!(parsed, vec![7, 30], "去重后应为 [7, 30]");
        // 7 去重前出现了两次
        assert_eq!(parsed.iter().filter(|&&x| x == 7).count(), 1, "7 只应出现一次");
    }

    #[test]
    fn test_total_reward_60_days() {
        let milestones: &[(i64, i64)] = &[(7,1),(30,3),(60,5),(90,7),(180,14),(365,30)];
        assert_eq!(milestones.iter().map(|x| x.1).sum::<i64>(), 60);
        assert_eq!(milestones.len(), 6);
    }
}
