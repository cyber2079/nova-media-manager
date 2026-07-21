use crate::commands::game::Game;
use crate::db::Database;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use tauri::State;

fn vdf_unquote(s: &str) -> String { let s=s.trim(); if s.len()>=2 && s.starts_with('"') && s.ends_with('"') { s[1..s.len()-1].replace("\\\"","\"").replace("\\\\","\\") } else { s.to_string() } }

fn parse_vdf_line(line: &str) -> Option<(String, Option<String>)> {
    let t=line.trim(); if t.is_empty()||t.starts_with("//")||t.starts_with('#') { return None; } if t=="{"||t=="}" { return None; }
    let mut p=Vec::new(); let (mut i,mut e,mut s)=(false,false,0);
    for (j,c) in t.char_indices() { if e{e=false;continue;} match c { '"' if !i=>{i=true;s=j;} '"' if i=>{i=false;p.push(&t[s..=j]);} '\\' if i=>e=true, _=>{} } }
    match p.len() { 0=>None, 1=>Some((vdf_unquote(p[0]),None)), _=>Some((vdf_unquote(p[0]),Some(vdf_unquote(p[1])))) }
}

fn collect_keys(content:&str, path:&[&str])->HashSet<u32> {
    let (mut ids,mut d,mut s,mut inside)=(HashSet::new(),0u32,Vec::new(),false); let td=path.len() as u32;
    for l in content.lines() { let t=l.trim(); if t.is_empty()||t.starts_with("//") { continue; }
        if t=="{"{d+=1;continue;} if t=="}"{d-=1;if inside&&d<td{inside=false;} if d<(s.len() as u32){s.truncate(d as usize);} continue;}
        if let Some((k,v))=parse_vdf_line(l) { if d<(s.len() as u32){s.truncate(d as usize);} s.push(k.clone());
            if !inside&&s.len()==path.len()&&s.iter().zip(path).all(|(a,b)|a.eq_ignore_ascii_case(b))&&v.is_none(){inside=true;continue;}
            if inside&&d==td&&v.is_none(){if let Ok(id)=k.parse::<u32>(){ids.insert(id);}} }
    } ids
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

fn get_owned_app_ids(steam_dir:&Path, steamid3:u64)->HashSet<u32> {
    let p=steam_dir.join("userdata").join(steamid3.to_string()).join("config").join("localconfig.vdf");
    let c=match std::fs::read_to_string(&p){Ok(c)=>c,Err(_)=>return HashSet::new()};
    collect_keys(&c,&["UserLocalConfigStore","Software","Valve","Steam","Apps"])
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

async fn fetch_names_from_community(steamid64: u64) -> HashMap<u32, String> {
    let mut map = HashMap::new();
    let client = match reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build() {
        Ok(c) => c,
        Err(_) => return map,
    };
    let resp = match client
        .get(&format!("https://steamcommunity.com/profiles/{steamid64}/games/?tab=all"))
        .header("User-Agent", "Mozilla/5.0")
        .send().await
    {
        Ok(r) => r,
        Err(_) => return map,
    };
    let html = match resp.text().await {
        Ok(h) => h,
        Err(_) => return map,
    };
    if let Some(start) = html.find("var rgGames = ") {
        let rest = &html[start + "var rgGames = ".len()..];
        if let Some(end) = rest.find(";\n").or_else(|| rest.find(';')) {
            let j = &rest[..end];
            let mut pos = 0;
            while let Some(o) = j[pos..].find("\"appid\"") {
                let chunk = &j[pos + o..];
                if let Some(aid) = chunk.find(":\"").and_then(|a| {
                    let s = a + 2;
                    chunk[s..].find('"').and_then(|e| chunk[s..s + e].parse::<u32>().ok())
                }) {
                    if let Some(name) = chunk.find("\"name\":\"").and_then(|n| {
                        let s = n + 8;
                        chunk[s..].find('"').map(|e| &chunk[s..s + e])
                    }) {
                        map.insert(aid, name.to_string());
                    }
                }
                pos += o + 8;
                if pos >= j.len() { break; }
            }
        }
    }
    map
}

async fn fetch_names_from_store(appids: &[u32]) -> HashMap<u32, String> {
    let mut map = HashMap::new();
    let client = match reqwest::Client::builder().timeout(std::time::Duration::from_secs(10)).build() {
        Ok(c) => c,
        Err(_) => return map,
    };
    for &aid in appids {
        let url = format!("https://store.steampowered.com/api/appdetails?appids={aid}");
        if let Ok(resp) = client.get(&url).header("User-Agent", "Mozilla/5.0").send().await {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(name) = json.get(aid.to_string()).and_then(|d| d.get("data")).and_then(|d| d.get("name")).and_then(|n| n.as_str()) {
                    map.insert(aid, name.to_string());
                }
            }
        }
    }
    map
}

#[derive(serde::Serialize)] #[serde(rename_all="camelCase")]
pub struct ScanResult{pub new_games:Vec<Game>,pub diagnostic:Vec<String>}

#[tauri::command]
pub async fn scan_steam_games(db:State<'_,Database>)->Result<ScanResult,String> {
    let mut diag=Vec::new();
    diag.push("=== Step 1: 定位 Steam ===".into());
    let steam=match steamlocate::locate(){Ok(s)=>{let p=s.path().to_path_buf();diag.push(format!("✓ Steam: {}",p.display()));p}Err(e)=>{diag.push(format!("✗ {e}"));return Ok(ScanResult{new_games:vec![],diagnostic:diag});}};

    diag.push("=== Step 2: 账号 ===".into());
    let (mut owned_ids,mut app_name_map,mut found_steamid)=(HashSet::new(),HashMap::new(),false);
    let sid_opt={let mut n=Vec::new();let r=get_steam_id64(&steam,&mut n);diag.extend(n);r};
    if let Some(id64)=sid_opt{
        found_steamid=true;let id3=steamid64_to_steamid3(id64);diag.push(format!("✓ SteamID64={id64} SteamID3={id3}"));
        app_name_map=build_app_name_map(&steam);diag.push(format!("✓ manifest 名称: {} 个",app_name_map.len()));
        owned_ids=get_owned_app_ids(&steam,id3);
        diag.push(format!("✓ localconfig.vdf Apps: {} 个游戏 ID",owned_ids.len()));

        // HTTP name fallbacks (only when needed)
        if app_name_map.len()<owned_ids.len() {
            diag.push("--- 社区页面 ---".into());
            let cm=fetch_names_from_community(id64).await;let a1=cm.len();for(k,v)in cm{app_name_map.entry(k).or_insert(v);}diag.push(format!("社区页面: +{a1} 个"));
            if app_name_map.len()<owned_ids.len(){
                let ids:Vec<u32>=owned_ids.iter().copied().collect();
                diag.push(format!("--- Store API ({} 个) ---",ids.len()));
                let sm=fetch_names_from_store(&ids).await;let a2=sm.len();for(k,v)in sm{app_name_map.entry(k).or_insert(v);}diag.push(format!("Store API: +{a2} 个"));
            }
        }
        diag.push(format!("✓ 名称库总计: {} 个",app_name_map.len()));
    } else { diag.push("⚠ 未解析到账号，仅扫描已安装".into());app_name_map=build_app_name_map(&steam); }

    diag.push("=== Step 3: 已安装 ===".into());
    let libs=match steamlocate::SteamDir::from_dir(&steam){Ok(sd)=>match sd.libraries(){Ok(l)=>l,Err(e)=>{diag.push(format!("✗ {e}"));return Ok(ScanResult{new_games:vec![],diagnostic:diag});}},Err(e)=>{diag.push(format!("✗ {e}"));return Ok(ScanResult{new_games:vec![],diagnostic:diag});}};
    diag.push(format!("✓ {} 个库",libs.len()));
    let (at,conn)=(chrono::Utc::now().to_rfc3339(),db.conn());
    let (mut ng,mut installed_ids,mut updated)=(Vec::new(),HashSet::new(),0u32);

    // Fix placeholder names
    let cnt:i64=conn.query_row("SELECT COUNT(*) FROM games WHERE name LIKE 'Steam App %' AND platform='Steam'",[],|r|r.get(0)).unwrap_or(0);
    if cnt>0{diag.push(format!("{cnt} 个占位符名称，更新中..."));let mut st=conn.prepare("SELECT id FROM games WHERE name LIKE 'Steam App %' AND platform='Steam'").map_err(|e|e.to_string())?;let tf:Vec<(String,u32)>=st.query_map([],|r|{let s:String=r.get(0)?;Ok(s)}).map_err(|e|e.to_string())?.filter_map(|r|r.ok()).filter_map(|s|s.strip_prefix("steam_").and_then(|n|n.parse::<u32>().ok()).map(|a|(s,a))).collect();for(sid,aid)in &tf{if let Some(nm)=app_name_map.get(aid){conn.execute("UPDATE games SET name=?1 WHERE id=?2",rusqlite::params![nm,sid]).ok();updated+=1;}}diag.push(format!("✓ 更新 {updated} 个"));}

    for lib in libs{let lib=match lib{Ok(l)=>l,Err(e)=>{diag.push(format!("✗ {e}"));continue;}};
        for app in lib.apps(){let app=match app{Ok(a)=>a,Err(e)=>{diag.push(format!("  跳过: {e}"));continue;}};installed_ids.insert(app.app_id);
            let name=app.name.clone().or_else(||app_name_map.get(&app.app_id).cloned()).unwrap_or_else(||format!("Steam App {}",app.app_id));
            let id=format!("steam_{}",app.app_id);app_name_map.entry(app.app_id).or_insert_with(||name.clone());
            if conn.query_row("SELECT COUNT(*)>0 FROM games WHERE id=?1",rusqlite::params![id],|r|r.get(0)).unwrap_or(false){diag.push(format!("  · {name}"));continue;}
            let ip=lib.path().join("steamapps").join("common").join(&app.install_dir);if !ip.exists(){diag.push(format!("  ✗ {}",ip.display()));continue;}
            let exe=find_game_exe(&ip).unwrap_or_default();diag.push(format!("  ✓ [{0}] {name}",app.app_id));
            let g=Game{id:id.clone(),name,executable_path:exe,cover_path:format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg",app.app_id),platform:"Steam".into(),tags:vec![],add_time:at.clone(),installed:true};
            conn.execute("INSERT OR IGNORE INTO games (id,name,executable_path,cover_path,platform,tags,add_time) VALUES (?1,?2,?3,?4,?5,?6,?7)",rusqlite::params![g.id,g.name,g.executable_path,g.cover_path,g.platform,serde_json::to_string(&g.tags).unwrap_or_default(),g.add_time]).map_err(|e|e.to_string())?;ng.push(g);}}

    diag.push("=== Step 4: 未安装 ===".into());
    if found_steamid && !owned_ids.is_empty(){
        let ui:Vec<u32>=owned_ids.iter().filter(|id|!installed_ids.contains(id)).copied().collect();diag.push(format!("{} 个未安装",ui.len()));let mut uc=0u32;
        for aid in &ui{let id=format!("steam_{aid}");if conn.query_row("SELECT COUNT(*)>0 FROM games WHERE id=?1",rusqlite::params![id],|r|r.get(0)).unwrap_or(false){continue;}
            let name=match app_name_map.get(aid){Some(n)=>n.clone(),None=>continue}; // skip garbage IDs without a proper name
            let g=Game{id:id.clone(),name,executable_path:format!("steam://run/{aid}"),cover_path:format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{aid}/header.jpg"),platform:"Steam".into(),tags:vec![],add_time:at.clone(),installed:false};
            conn.execute("INSERT OR IGNORE INTO games (id,name,executable_path,cover_path,platform,tags,add_time) VALUES (?1,?2,?3,?4,?5,?6,?7)",rusqlite::params![g.id,g.name,g.executable_path,g.cover_path,g.platform,serde_json::to_string(&g.tags).unwrap_or_default(),g.add_time]).map_err(|e|e.to_string())?;ng.push(g);uc+=1;}
        diag.push(format!("=== 总计: 已装 {} | 未装 {uc} | 新 {} ===",installed_ids.len(),ng.len()));
    } else { diag.push(format!("=== 总计: 已装 {} | 新 {} ===",installed_ids.len(),ng.len())); }
    Ok(ScanResult{new_games:ng,diagnostic:diag})
}
