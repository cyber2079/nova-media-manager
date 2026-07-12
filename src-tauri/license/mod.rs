use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use tauri::State;

// ═══════════════════ CONFIG ═══════════════════
const SERVER_URL: &str = "https://your-domain.com";
const LICENSE_TOKEN_KEY: &str = "license_token";
const DEVICE_ID_KEY: &str = "device_id";

// ═══════════════════ TYPES ═══════════════════

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LicenseInfo {
    pub tier: String,
    pub duration: String,
    pub expires_at: Option<String>,
    pub max_devices: i32,
    pub device_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ActivateRequest {
    code: String,
    device_fingerprint: String,
    device_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ActivateResponse {
    token: String,
    license: Option<LicenseInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CheckRequest {
    token: String,
    device_fingerprint: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CheckResponse {
    valid: Option<bool>,
    license: Option<LicenseInfo>,
    error: Option<String>,
}

// ═══════════════════ DEVICE FINGERPRINT ═══════════════════

#[cfg(target_os = "windows")]
fn generate_device_fingerprint() -> String {
    use std::process::Command;

    let mut parts = Vec::new();

    if let Ok(output) = Command::new("wmic")
        .args(["csproduct", "get", "uuid"])
        .output()
    {
        let text = String::from_utf8_lossy(&output.stdout);
        if let Some(line) = text.lines().nth(1) {
            let uuid = line.trim().to_string();
            if !uuid.is_empty() {
                parts.push(uuid);
            }
        }
    }

    if let Ok(output) = Command::new("wmic")
        .args(["diskdrive", "get", "serialnumber"])
        .output()
    {
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines().skip(1) {
            let s = line.trim().to_string();
            if !s.is_empty() && s != "SerialNumber" {
                parts.push(s);
                break;
            }
        }
    }

    if parts.is_empty() {
        if let Ok(name) = std::env::var("COMPUTERNAME") {
            parts.push(name);
        }
    }

    let combined = parts.join("|");
    if combined.is_empty() {
        return "unknown-device".to_string();
    }

    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    hex::encode(&hasher.finalize()[..8])
}

#[cfg(not(target_os = "windows"))]
fn generate_device_fingerprint() -> String {
    let mut parts = Vec::new();
    if let Ok(host) = std::env::var("HOSTNAME").or_else(|_| std::env::var("HOST")) {
        parts.push(host);
    }
    if let Ok(id) = std::fs::read_to_string("/etc/machine-id") {
        parts.push(id.trim().to_string());
    }

    let combined = parts.join("|");
    if combined.is_empty() {
        return "unknown-device".to_string();
    }

    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    hex::encode(&hasher.finalize()[..8])
}

// ═══════════════════ LOCAL STORAGE ═══════════════════

pub struct LicenseState {
    pub info: Mutex<Option<LicenseInfo>>,
    pub token: Mutex<Option<String>>,
}

fn get_or_create_device_id(db: &crate::db::Database) -> String {
    let conn = db.conn();
    let existing: Option<String> = conn
        .query_row(
            "SELECT value FROM kv_store WHERE key = ?1",
            [DEVICE_ID_KEY],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing {
        return id;
    }

    let id = generate_device_fingerprint();
    drop(conn); // release lock before re-acquiring
    let conn = db.conn();
    conn.execute(
        "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?1, ?2)",
        rusqlite::params![DEVICE_ID_KEY, id],
    )
    .ok();
    id
}

fn save_license_locally(db: &crate::db::Database, token: &str, info: &LicenseInfo) {
    let conn = db.conn();
    conn.execute(
        "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?1, ?2)",
        rusqlite::params![LICENSE_TOKEN_KEY, token],
    )
    .ok();
    let info_json = serde_json::to_string(info).unwrap_or_default();
    conn.execute(
        "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?1, ?2)",
        rusqlite::params!["license_info", info_json],
    )
    .ok();
}

fn load_license_locally(db: &crate::db::Database) -> (Option<String>, Option<LicenseInfo>) {
    let conn = db.conn();
    let token: Option<String> = conn
        .query_row(
            "SELECT value FROM kv_store WHERE key = ?1",
            [LICENSE_TOKEN_KEY],
            |row| row.get(0),
        )
        .ok();

    let info_json: Option<String> = conn
        .query_row(
            "SELECT value FROM kv_store WHERE key = ?1",
            ["license_info"],
            |row| row.get(0),
        )
        .ok();

    let info: Option<LicenseInfo> = info_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok());

    (token, info)
}

// ═══════════════════ TAURI COMMANDS ═══════════════════

#[tauri::command]
pub fn get_license(license: State<'_, LicenseState>) -> Result<LicenseInfo, String> {
    let info = license.info.lock().map_err(|e| e.to_string())?;
    match info.as_ref() {
        Some(i) => Ok(i.clone()),
        None => Ok(LicenseInfo {
            tier: "free".to_string(),
            duration: "permanent".to_string(),
            expires_at: None,
            max_devices: 1,
            device_name: None,
        }),
    }
}

#[tauri::command]
pub async fn activate_license(
    db: State<'_, crate::db::Database>,
    license: State<'_, LicenseState>,
    code: String,
    device_name: Option<String>,
) -> Result<LicenseInfo, String> {
    let device_id = get_or_create_device_id(&db);

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/activate", SERVER_URL))
        .json(&ActivateRequest {
            code: code.clone(),
            device_fingerprint: device_id.clone(),
            device_name: device_name.clone(),
        })
        .send()
        .await
        .map_err(|e| format!("网络错误: {}", e))?;

    if !resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.unwrap_or_default();
        let err_msg = body["error"].as_str().unwrap_or("激活失败");
        return Err(err_msg.to_string());
    }

    let data: ActivateResponse = resp.json().await.map_err(|e| format!("解析错误: {}", e))?;

    if let Some(ref info) = data.license {
        save_license_locally(&db, &data.token, info);
        if let Ok(mut li) = license.info.lock() {
            *li = Some(info.clone());
        }
        if let Ok(mut t) = license.token.lock() {
            *t = Some(data.token.clone());
        }
        Ok(info.clone())
    } else {
        Err("服务器返回异常".to_string())
    }
}

#[tauri::command]
pub async fn check_license(
    db: State<'_, crate::db::Database>,
    license: State<'_, LicenseState>,
) -> Result<LicenseInfo, String> {
    let device_id = get_or_create_device_id(&db);
    let token = {
        let t = license.token.lock().map_err(|e| e.to_string())?;
        t.clone()
    };

    let token = match token {
        Some(t) => t,
        None => {
            return Ok(LicenseInfo {
                tier: "free".to_string(),
                duration: "permanent".to_string(),
                expires_at: None,
                max_devices: 1,
                device_name: None,
            });
        }
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/check-license", SERVER_URL))
        .json(&CheckRequest {
            token: token.clone(),
            device_fingerprint: device_id,
        })
        .send()
        .await
        .map_err(|e| format!("网络错误: {}", e))?;

    if !resp.status().is_success() {
        let info = license.info.lock().map_err(|e| e.to_string())?;
        if let Some(i) = info.as_ref() {
            return Ok(i.clone());
        }
        return Err("无法连接服务器，且本地无许可证缓存".to_string());
    }

    let data: CheckResponse = resp.json().await.map_err(|e| format!("解析错误: {}", e))?;

    match data.valid {
        Some(true) => {
            if let Some(ref info) = data.license {
                save_license_locally(&db, &token, info);
                if let Ok(mut li) = license.info.lock() {
                    *li = Some(info.clone());
                }
                Ok(info.clone())
            } else {
                Err("服务器返回异常".to_string())
            }
        }
        Some(false) => {
            if let Ok(mut li) = license.info.lock() {
                *li = Some(LicenseInfo {
                    tier: "free".to_string(),
                    duration: "permanent".to_string(),
                    expires_at: None,
                    max_devices: 1,
                    device_name: None,
                });
            }
            Err(data.error.unwrap_or_else(|| "许可证已失效".to_string()))
        }
        None => Err("服务器返回异常".to_string()),
    }
}

pub fn init_license(db: &crate::db::Database) -> LicenseState {
    let (token, info) = load_license_locally(db);
    LicenseState {
        info: Mutex::new(info),
        token: Mutex::new(token),
    }
}
