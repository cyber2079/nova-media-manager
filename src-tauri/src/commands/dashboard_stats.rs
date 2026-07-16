// ── 首页仪表盘统计聚合 ──
// 一次调用返回全部图表数据，SQL 聚合在 Rust 侧完成，避免把全量历史搬到前端。
// 数据源：play_events（逐次播放事件表）+ movies/music/images（标签、收藏、进度）。

use crate::db::Database;
use serde::Serialize;
use std::collections::HashMap;
use tauri::State;

#[derive(Debug, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DailyCount {
    pub date: String, // "2026-07-16"（本地时区）
    pub movies: i64,
    pub music: i64,
    pub games: i64,
    pub total: i64,
}

#[derive(Debug, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TypeCounts {
    pub movies: i64,
    pub music: i64,
    pub games: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TopItem {
    pub id: String,
    pub name: String,
    pub count: i64,
    pub cover_path: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TagCount {
    pub tag: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RevisitItem {
    pub id: String,
    pub name: String,
    pub item_type: String, // movie | music
    pub days_since: i64,   // 距上次播放天数（-1 = 从未播放过）
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub daily: Vec<DailyCount>,     // 近 84 天（12 周热力图 + 趋势）
    pub hourly: Vec<i64>,           // 24 桶，全部历史按本地小时分布
    pub week_now: TypeCounts,       // 近 7 天
    pub week_prev: TypeCounts,      // 前 7-14 天
    pub top_music: Vec<TopItem>,    // 播放次数 Top 10
    pub top_tags: Vec<TagCount>,    // 三库标签聚合 Top 8
    pub revisit: Vec<RevisitItem>,  // 重温推荐：收藏但 60 天未播
    pub library: TypeCounts,        // 库存量（构成条用）
    pub images_count: i64,
}

fn bucket(counts: &mut TypeCounts, item_type: &str, n: i64) {
    match item_type {
        "movie" => counts.movies += n,
        "music" => counts.music += n,
        "game" => counts.games += n,
        _ => {}
    }
}

#[tauri::command]
pub fn dashboard_stats(db: State<Database>) -> Result<DashboardStats, String> {
    let conn = db.conn();
    let mut stats = DashboardStats::default();
    stats.hourly = vec![0; 24];

    // ── 近 84 天逐日分类型计数（本地时区）──
    {
        let mut by_date: HashMap<String, DailyCount> = HashMap::new();
        if let Ok(mut stmt) = conn.prepare(
            "SELECT date(played_at, 'localtime') d, item_type, COUNT(*) c FROM play_events
             WHERE played_at >= datetime('now', '-84 days') GROUP BY d, item_type",
        ) {
            if let Ok(rows) = stmt.query_map([], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)?))
            }) {
                for (d, t, c) in rows.flatten() {
                    let e = by_date.entry(d.clone()).or_insert_with(|| DailyCount { date: d, ..Default::default() });
                    match t.as_str() {
                        "movie" => e.movies += c,
                        "music" => e.music += c,
                        "game" => e.games += c,
                        _ => {}
                    }
                    e.total += c;
                }
            }
        }
        let mut daily: Vec<DailyCount> = by_date.into_values().collect();
        daily.sort_by(|a, b| a.date.cmp(&b.date));
        stats.daily = daily;
    }

    // ── 24h 时段分布 ──
    if let Ok(mut stmt) = conn.prepare(
        "SELECT CAST(strftime('%H', played_at, 'localtime') AS INTEGER) h, COUNT(*) FROM play_events GROUP BY h",
    ) {
        if let Ok(rows) = stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?))) {
            for (h, c) in rows.flatten() {
                if (0..24).contains(&h) { stats.hourly[h as usize] = c; }
            }
        }
    }

    // ── 本周 vs 上周 ──
    for (range, target) in [
        ("-7 days", 0usize),
        ("-14 days", 1usize),
    ] {
        let sql = if target == 0 {
            "SELECT item_type, COUNT(*) FROM play_events WHERE played_at >= datetime('now', '-7 days') GROUP BY item_type".to_string()
        } else {
            format!(
                "SELECT item_type, COUNT(*) FROM play_events WHERE played_at >= datetime('now', '{}') AND played_at < datetime('now', '-7 days') GROUP BY item_type",
                range
            )
        };
        if let Ok(mut stmt) = conn.prepare(&sql) {
            if let Ok(rows) = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))) {
                for (t, c) in rows.flatten() {
                    let dst = if target == 0 { &mut stats.week_now } else { &mut stats.week_prev };
                    bucket(dst, &t, c);
                }
            }
        }
    }

    // ── 音乐播放次数 Top 10（带封面）──
    // 按歌名聚合：同一首歌重新导入/多路径导入会产生不同 item_id，按 id 分组会重复出现
    if let Ok(mut stmt) = conn.prepare(
        "SELECT MAX(e.item_id), e.name, COUNT(*) c, COALESCE(MAX(m.cover_path), '')
         FROM play_events e LEFT JOIN music m ON m.id = e.item_id
         WHERE e.item_type = 'music' GROUP BY e.name ORDER BY c DESC LIMIT 10",
    ) {
        if let Ok(rows) = stmt.query_map([], |r| {
            Ok(TopItem { id: r.get(0)?, name: r.get(1)?, count: r.get(2)?, cover_path: r.get(3)? })
        }) {
            stats.top_music = rows.flatten().collect();
        }
    }

    // ── 标签偏好 Top 8（三库 tags JSON 数组在 Rust 侧解析聚合）──
    {
        let mut tag_counts: HashMap<String, i64> = HashMap::new();
        for table in ["movies", "music", "images"] {
            if let Ok(mut stmt) = conn.prepare(&format!("SELECT tags FROM {} WHERE tags != '[]'", table)) {
                if let Ok(rows) = stmt.query_map([], |r| r.get::<_, String>(0)) {
                    for tags_json in rows.flatten() {
                        if let Ok(tags) = serde_json::from_str::<Vec<String>>(&tags_json) {
                            for t in tags { *tag_counts.entry(t).or_insert(0) += 1; }
                        }
                    }
                }
            }
        }
        let mut tags: Vec<TagCount> = tag_counts.into_iter().map(|(tag, count)| TagCount { tag, count }).collect();
        tags.sort_by(|a, b| b.count.cmp(&a.count));
        tags.truncate(8);
        stats.top_tags = tags;
    }

    // ── 重温推荐：收藏但 60 天未播（电影/音乐），最多 6 条 ──
    for (item_type, table) in [("movie", "movies"), ("music", "music")] {
        if stats.revisit.len() >= 6 { break; }
        let sql = format!(
            "SELECT f.item_id, t.name,
                    CAST(julianday('now') - julianday(COALESCE(MAX(e.played_at), '2000-01-01')) AS INTEGER)
             FROM favorites f
             JOIN {table} t ON t.id = f.item_id
             LEFT JOIN play_events e ON e.item_id = f.item_id
             WHERE f.item_type = '{item_type}'
             GROUP BY f.item_id
             HAVING MAX(e.played_at) IS NULL OR MAX(e.played_at) < datetime('now', '-60 days')
             ORDER BY RANDOM() LIMIT 3"
        );
        if let Ok(mut stmt) = conn.prepare(&sql) {
            if let Ok(rows) = stmt.query_map([], |r| {
                Ok(RevisitItem {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    item_type: item_type.to_string(),
                    days_since: r.get::<_, i64>(2).map(|d| if d > 9000 { -1 } else { d }).unwrap_or(-1),
                })
            }) {
                stats.revisit.extend(rows.flatten());
            }
        }
    }

    // ── 库存构成 ──
    let count = |table: &str| -> i64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |r| r.get(0)).unwrap_or(0)
    };
    stats.library = TypeCounts { movies: count("movies"), music: count("music"), games: count("games") };
    stats.images_count = count("images");

    Ok(stats)
}
