use crate::commands::game::Game;
use crate::db::Database;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;
use tauri::State;

// ── Shared reqwest clients for connection pooling ──

static CDN_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
fn cdn_client() -> &'static reqwest::Client {
    CDN_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("reqwest CDN client")
    })
}

static API_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
fn api_client() -> &'static reqwest::Client {
    API_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("reqwest API client")
    })
}

// ── VDF parsing ──

fn vdf_unquote(s: &str) -> String { let s=s.trim(); if s.len()>=2 && s.starts_with('"') && s.ends_with('"') { s[1..s.len()-1].replace("\\\"","\"").replace("\\\\","\\") } else { s.to_string() } }

fn parse_vdf_line(line: &str) -> Option<(String, Option<String>)> {
    let t=line.trim(); if t.is_empty()||t.starts_with("//")||t.starts_with('#') { return None; } if t=="{"||t=="}" { return None; }
    let mut p=Vec::new(); let (mut i,mut e,mut s)=(false,false,0);
    for (j,c) in t.char_indices() { if e{e=false;continue;} match c { '"' if !i=>{i=true;s=j;} '"' if i=>{i=false;p.push(&t[s..=j]);} '\\' if i=>e=true, _=>{} } }
    match p.len() { 0=>None, 1=>Some((vdf_unquote(p[0]),None)), _=>Some((vdf_unquote(p[0]),Some(vdf_unquote(p[1])))) }
}

fn steamid64_to_steamid3(id:u64)->u64{id.saturating_sub(76561197960265728)}

fn get_steam_id64(steam_dir:&Path,notes:&mut Vec<String>)->Option<u64> {
    let p=steam_dir.join("config").join("loginusers.vdf");
    let c=match std::fs::read_to_string(&p){Ok(c)=>c,Err(e)=>{notes.push(format!("loginusers.vdf: {e}"));return None;}};
    let (mut cur,mut mr,mut first)=(None,None,None);
    for l in c.lines(){let t=l.trim();if t=="{"||t=="}"{continue;}
        if t.len()>=19&&t.starts_with('"'){let i=&t[1..t.len()-1];if i.len()==17&&i.chars().all(|c|c.is_ascii_digit()){if let Ok(id)=i.parse::<u64>(){if first.is_none(){first=Some(id);}cur=Some(id);continue;}}}
        if t.starts_with("\"MostRecent\"")&&t.contains('1'){if let Some(id)=cur{mr=Some(id);}}}
    mr.or(first)
}

fn find_game_exe(dir:&Path)->Option<String> {
    if !dir.exists(){return None;} let mut exes=Vec::new();
    if let Ok(e)=std::fs::read_dir(dir){for x in e.flatten(){let p=x.path();if p.extension().map(|x|x=="exe").unwrap_or(false){exes.push(p);}}}
    if exes.is_empty(){return None;}
    let dn=dir.file_name().unwrap_or_default().to_string_lossy().to_lowercase().replace([' ','_','-'],"");
    for exe in &exes{let en=exe.file_stem().unwrap_or_default().to_string_lossy().to_lowercase().replace([' ','_','-'],"");if en.contains(&dn)||dn.contains(&en){return Some(exe.to_string_lossy().to_string());}}
    let fl:Vec<_>=exes.iter().filter(|p|{let n=p.file_name().unwrap_or_default().to_string_lossy().to_lowercase();!n.contains("unins")&&!n.contains("crash")&&!n.contains("redist")&&!n.contains("vcredist")}).collect();
    if fl.is_empty(){return None;} let (mut b,mut bs)=(fl[0],0u64);for f in &fl{if let Ok(m)=std::fs::metadata(f){if m.len()>bs{bs=m.len();b=f;}}} Some(b.to_string_lossy().to_string())
}

fn build_app_name_map(steam_dir:&Path)->HashMap<u32,String> {
    let mut map=HashMap::new();let mut dirs=vec![steam_dir.join("steamapps")];
    if let Ok(c)=std::fs::read_to_string(steam_dir.join("steamapps").join("libraryfolders.vdf")){for l in c.lines(){if let Some((k,Some(v)))=parse_vdf_line(l){if k.eq_ignore_ascii_case("path"){let sa=PathBuf::from(&v).join("steamapps");if sa.exists(){dirs.push(sa);}}}}}
    for d in &dirs{let Ok(e)=std::fs::read_dir(d) else{continue};for x in e.flatten(){let p=x.path();let Some(n)=p.file_name().and_then(|n|n.to_str())else{continue};if !n.starts_with("appmanifest_")||!n.ends_with(".acf"){continue;}
        if let Ok(c)=std::fs::read_to_string(&p){let(mut aid,mut nm)=(None,None);for l in c.lines(){if let Some((k,Some(v)))=parse_vdf_line(l){match k.as_str(){"appid"=>aid=v.parse().ok(),"name"=>nm=Some(v),_=>{}}}if let(Some(id),Some(n2))=(aid,nm.as_ref()){map.insert(id,n2.clone());break;}}}}}
    map
}

/// Fetch owned game IDs + names from Steam Community profile page.
/// The community "all games" tab reflects the user's actual library —
/// refunded games, expired free weekends, and family-share-only titles do NOT appear.
/// This is the single source of truth for ownership.
async fn fetch_owned_from_community(steamid64: u64) -> (HashSet<u32>, HashMap<u32, String>) {
    let mut ids = HashSet::new();
    let mut names = HashMap::new();

    let url = format!("https://steamcommunity.com/profiles/{steamid64}/games/?tab=all");
    let resp = match api_client()
        .get(&url)
        .timeout(Duration::from_secs(15))
        .header("User-Agent", "Mozilla/5.0")
        .send().await
    {
        Ok(r) => r,
        Err(_) => return (ids, names),
    };
    let html = match resp.text().await {
        Ok(h) => h,
        Err(_) => return (ids, names),
    };
    if let Some(start) = html.find("var rgGames = ") {
        let rest = &html[start + "var rgGames = ".len()..];
        if let Some(end) = rest.find(";\n").or_else(|| rest.find(';')) {
            let j = &rest[..end];
            let mut pos = 0;
            while let Some(o) = j[pos..].find("\"appid\"") {
                let chunk = &j[pos + o..];
                let aid_opt = chunk.find(":\"").and_then(|a| {
                    let s = a + 2;
                    chunk[s..].find('"').and_then(|e| chunk[s..s + e].parse::<u32>().ok())
                });
                let name_opt = chunk.find("\"name\":\"").and_then(|n| {
                    let s = n + 8;
                    chunk[s..].find('"').map(|e| chunk[s..s + e].to_string())
                });
                if let Some(aid) = aid_opt {
                    ids.insert(aid);
                    if let Some(ref nm) = name_opt {
                        names.insert(aid, nm.clone());
                    }
                }
                pos += o + 8;
                if pos >= j.len() { break; }
            }
        }
    }
    (ids, names)
}

/// Fallback name lookup via Steam Store API for IDs not resolved by the community page.
async fn fetch_names_from_store(appids: &[u32]) -> HashMap<u32, String> {
    let mut map = HashMap::new();
    for &aid in appids {
        let url = format!("https://store.steampowered.com/api/appdetails?appids={aid}");
        if let Ok(resp) = api_client()
            .get(&url)
            .timeout(Duration::from_secs(10))
            .header("User-Agent", "Mozilla/5.0")
            .send().await
        {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(name) = json.get(aid.to_string()).and_then(|d| d.get("data")).and_then(|d| d.get("name")).and_then(|n| n.as_str()) {
                    map.insert(aid, name.to_string());
                }
            }
        }
    }
    map
}

/// Download a Steam cover image, trying variants in order.
/// Uses a shared reqwest Client for connection pooling.
async fn download_steam_cover(app_id:u32,variants:&[&str],save_path:&std::path::Path)->bool{
    for variant in variants{
        let url=format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/{}",app_id,variant);
        match cdn_client().get(&url).send().await{
            Ok(resp) if resp.status().is_success()=>{
                if let Ok(bytes)=resp.bytes().await{
                    if std::fs::write(save_path,&bytes).is_ok()
                        &&std::fs::metadata(save_path).map(|m|m.len()>0).unwrap_or(false)
                    {return true;}
                }
            }
            _=>continue,
        }
    }
    false
}

#[derive(serde::Serialize)] #[serde(rename_all="camelCase")]
pub struct ScanResult{pub new_games:Vec<Game>,pub diagnostic:Vec<String>}

#[tauri::command]
pub async fn scan_steam_games(db:State<'_,Database>)->Result<ScanResult,String> {
    let mut diag=Vec::new();
    diag.push("=== Step 1: 定位 Steam ===".into());
    let steam=match steamlocate::locate(){Ok(s)=>{let p=s.path().to_path_buf();diag.push(format!("✓ Steam: {}",p.display()));p}Err(e)=>{diag.push(format!("✗ {e}"));return Ok(ScanResult{new_games:vec![],diagnostic:diag});}};

    diag.push("=== Step 2: 账号 ===".into());
    let (mut community_owned_ids,mut found_steamid)=(HashSet::new(),false);
    let mut app_name_map;
    let sid_opt={let mut n=Vec::new();let r=get_steam_id64(&steam,&mut n);diag.extend(n);r};
    if let Some(id64)=sid_opt{
        found_steamid=true;let id3=steamid64_to_steamid3(id64);diag.push(format!("✓ SteamID64={id64} SteamID3={id3}"));

        // Build name map from local appmanifest files (fast, no network)
        app_name_map=build_app_name_map(&steam);diag.push(format!("✓ manifest 名称: {} 个",app_name_map.len()));

        // Ownership source: Steam Community profile (actual library, not localconfig.vdf)
        diag.push("--- 社区页面 (拥有权 + 名称) ---".into());
        let (c_ids, c_names) = fetch_owned_from_community(id64).await;
        community_owned_ids = c_ids;
        for (k, v) in c_names { app_name_map.entry(k).or_insert(v); }
        diag.push(format!("社区页面: {} 个游戏", community_owned_ids.len()));

        // Store API fallback for names not yet resolved
        let unresolved: Vec<u32> = community_owned_ids.iter()
            .filter(|id| !app_name_map.contains_key(id))
            .copied().collect();
        if !unresolved.is_empty() {
            diag.push(format!("--- Store API ({} 个未命名) ---", unresolved.len()));
            let sm = fetch_names_from_store(&unresolved).await;
            let a2 = sm.len();
            for (k, v) in sm { app_name_map.entry(k).or_insert(v); }
            diag.push(format!("Store API: +{a2} 个"));
        }
        diag.push(format!("✓ 名称库总计: {} 个", app_name_map.len()));
    } else {
        diag.push("⚠ 未解析到账号，仅扫描已安装".into());
        app_name_map=build_app_name_map(&steam);
    }

    diag.push("=== Step 3: 已安装 ===".into());
    let libs=match steamlocate::SteamDir::from_dir(&steam){Ok(sd)=>match sd.libraries(){Ok(l)=>l,Err(e)=>{diag.push(format!("✗ {e}"));return Ok(ScanResult{new_games:vec![],diagnostic:diag});}},Err(e)=>{diag.push(format!("✗ {e}"));return Ok(ScanResult{new_games:vec![],diagnostic:diag});}};
    diag.push(format!("✓ {} 个库",libs.len()));
    let at=chrono::Utc::now().to_rfc3339();
    let (mut ng,mut installed_ids,mut updated)=(Vec::new(),HashSet::new(),0u32);

    // Migration phase
    {
    let conn=db.conn();
    let old_covers:i64=conn.query_row("SELECT COUNT(*) FROM games WHERE cover_path LIKE '%/header.jpg' AND platform='Steam'",[],|r|r.get(0)).unwrap_or(0);
    if old_covers>0{conn.execute("UPDATE games SET cover_path=REPLACE(cover_path,'/header.jpg','/library_600x900.jpg') WHERE cover_path LIKE '%/header.jpg' AND platform='Steam'",[]).ok();diag.push(format!("✓ 封面迁移: {old_covers} 个 header→library_600x900"));}

    let cnt:i64=conn.query_row("SELECT COUNT(*) FROM games WHERE name LIKE 'Steam App %' AND platform='Steam'",[],|r|r.get(0)).unwrap_or(0);
    if cnt>0{diag.push(format!("{cnt} 个占位符名称，更新中..."));let mut st=conn.prepare("SELECT id FROM games WHERE name LIKE 'Steam App %' AND platform='Steam'").map_err(|e|e.to_string())?;let tf:Vec<(String,u32)>=st.query_map([],|r|{let s:String=r.get(0)?;Ok(s)}).map_err(|e|e.to_string())?.filter_map(|r|r.ok()).filter_map(|s|s.strip_prefix("steam_").and_then(|n|n.parse::<u32>().ok()).map(|a|(s,a))).collect();for(sid,aid)in &tf{if let Some(nm)=app_name_map.get(aid){conn.execute("UPDATE games SET name=?1 WHERE id=?2",rusqlite::params![nm,sid]).ok();updated+=1;}}diag.push(format!("✓ 更新 {updated} 个"));}
    } // end migration block

    for lib in libs{let lib=match lib{Ok(l)=>l,Err(e)=>{diag.push(format!("✗ {e}"));continue;}};
        for app in lib.apps(){let app=match app{Ok(a)=>a,Err(e)=>{diag.push(format!("  跳过: {e}"));continue;}};installed_ids.insert(app.app_id);
            let name=app.name.clone().or_else(||app_name_map.get(&app.app_id).cloned()).unwrap_or_else(||format!("Steam App {}",app.app_id));
            let id=format!("steam_{}",app.app_id);app_name_map.entry(app.app_id).or_insert_with(||name.clone());
            let ip=lib.path().join("steamapps").join("common").join(&app.install_dir);if !ip.exists(){diag.push(format!("  ✗ {}",ip.display()));continue;}
            let exe=find_game_exe(&ip).unwrap_or_default();diag.push(format!("  ✓ [{0}] {name}",app.app_id));
            {let conn=db.conn();
            if conn.query_row("SELECT COUNT(*)>0 FROM games WHERE id=?1",rusqlite::params![id],|r|r.get(0)).unwrap_or(false){diag.push(format!("  · {name}"));continue;}
            } // conn dropped here — safe to .await below
            // ── Download covers ──
            let covers_dir=db.data_dir().join("covers");std::fs::create_dir_all(&covers_dir).ok();
            let portrait_path=covers_dir.join(format!("game_steam_{}_portrait.jpg",app.app_id));
            let landscape_path=covers_dir.join(format!("game_steam_{}_landscape.jpg",app.app_id));
            let portrait_done=download_steam_cover(app.app_id,&["library_600x900.jpg","library_hero.jpg","capsule_616x353.jpg","header.jpg"],&portrait_path).await;
            let landscape_done=download_steam_cover(app.app_id,&["library_hero.jpg","capsule_616x353.jpg","header.jpg"],&landscape_path).await;
            let cover_path=if portrait_done{portrait_path.to_string_lossy().to_string()}else{format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_600x900.jpg",app.app_id)};
            let landscape_path_str=if landscape_done{landscape_path.to_string_lossy().to_string()}else{String::new()};
            let g=Game{id:id.clone(),name,executable_path:exe,cover_path,landscape_path:landscape_path_str,platform:"Steam".into(),tags:vec![],add_time:at.clone(),installed:true};
            let conn=db.conn();
            conn.execute("INSERT OR IGNORE INTO games (id,name,executable_path,cover_path,landscape_path,platform,tags,add_time) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",rusqlite::params![g.id,g.name,g.executable_path,g.cover_path,g.landscape_path,g.platform,serde_json::to_string(&g.tags).unwrap_or_default(),g.add_time]).map_err(|e|e.to_string())?;ng.push(g);}}

    // ── Step 4: Not installed (community-owned but not on disk) ──
    diag.push("=== Step 4: 未安装 ===".into());
    if found_steamid && !community_owned_ids.is_empty(){
        let ui:Vec<u32>=community_owned_ids.iter().filter(|id|!installed_ids.contains(id)).copied().collect();
        diag.push(format!("{} 个未安装",ui.len()));
        let mut uc=0u32;
        for aid in &ui{
            let id=format!("steam_{aid}");
            {let conn=db.conn();if conn.query_row("SELECT COUNT(*)>0 FROM games WHERE id=?1",rusqlite::params![id],|r|r.get(0)).unwrap_or(false){continue;}}
            let name=match app_name_map.get(aid){Some(n)=>n.clone(),None=>continue};
            // ── Download covers ──
            let covers_dir=db.data_dir().join("covers");std::fs::create_dir_all(&covers_dir).ok();
            let portrait_path=covers_dir.join(format!("game_steam_{}_portrait.jpg",aid));
            let landscape_path=covers_dir.join(format!("game_steam_{}_landscape.jpg",aid));
            let portrait_done=download_steam_cover(*aid,&["library_600x900.jpg","library_hero.jpg","capsule_616x353.jpg","header.jpg"],&portrait_path).await;
            let landscape_done=download_steam_cover(*aid,&["library_hero.jpg","capsule_616x353.jpg","header.jpg"],&landscape_path).await;
            let cover_path=if portrait_done{portrait_path.to_string_lossy().to_string()}else{format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{aid}/library_600x900.jpg")};
            let landscape_path_str=if landscape_done{landscape_path.to_string_lossy().to_string()}else{String::new()};
            let g=Game{id:id.clone(),name,executable_path:format!("steam://run/{aid}"),cover_path,landscape_path:landscape_path_str,platform:"Steam".into(),tags:vec![],add_time:at.clone(),installed:false};
            let conn=db.conn();
            conn.execute("INSERT OR IGNORE INTO games (id,name,executable_path,cover_path,landscape_path,platform,tags,add_time) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",rusqlite::params![g.id,g.name,g.executable_path,g.cover_path,g.landscape_path,g.platform,serde_json::to_string(&g.tags).unwrap_or_default(),g.add_time]).map_err(|e|e.to_string())?;ng.push(g);uc+=1;
        }
        diag.push(format!("=== 总计: 已装 {} | 未装 {uc} | 新 {} ===",installed_ids.len(),ng.len()));
    } else { diag.push(format!("=== 总计: 已装 {} | 新 {} ===",installed_ids.len(),ng.len())); }

    // ── Step 5: Cleanup — delete games no longer in Steam library ──
    diag.push("=== Step 5: 清理 ===".into());
    if found_steamid && !community_owned_ids.is_empty() {
        let conn = db.conn();
        // Collect all valid IDs: currently installed + community-owned
        let valid: HashSet<u32> = installed_ids.union(&community_owned_ids).copied().collect();
        // Find stale steam_* games
        let mut stale_stmt = conn.prepare("SELECT id FROM games WHERE id LIKE 'steam_%'")
            .map_err(|e| e.to_string())?;
        let stale: Vec<(String, u32)> = stale_stmt.query_map([], |r| {
            let s: String = r.get(0)?;
            Ok(s)
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .filter_map(|s| {
            s.strip_prefix("steam_")
                .and_then(|n| n.parse::<u32>().ok())
                .map(|aid| (s, aid))
        })
        .filter(|(_, aid)| !valid.contains(aid))
        .collect();

        if !stale.is_empty() {
            diag.push(format!("清理 {} 个已移除/退款游戏", stale.len()));
            for (sid, aid) in &stale {
                match conn.execute("DELETE FROM games WHERE id=?1", rusqlite::params![sid]) {
                    Ok(n) if n > 0 => diag.push(format!("  ✕ [{aid}] 已删除")),
                    _ => {}
                }
                // Clean up cover files too
                let covers_dir = db.data_dir().join("covers");
                let _ = std::fs::remove_file(covers_dir.join(format!("game_steam_{aid}_portrait.jpg")));
                let _ = std::fs::remove_file(covers_dir.join(format!("game_steam_{aid}_landscape.jpg")));
            }
        } else {
            diag.push("✓ 无需清理".into());
        }
    } else {
        diag.push("（跳过 — 无社区数据）".into());
    }

    Ok(ScanResult{new_games:ng,diagnostic:diag})
}
