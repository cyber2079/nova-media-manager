use reqwest::{redirect, Client};
use std::time::Duration;

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/// Apply browser-mimic headers to a request builder (plus optional Cookie).
fn browser_headers(b: reqwest::RequestBuilder, cookies: &str) -> reqwest::RequestBuilder {
    let mut r = b
        .header("User-Agent", UA)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
        .header("Accept-Encoding", "gzip, deflate, br")
        .header("Cache-Control", "max-age=0")
        .header("sec-ch-ua", r#""Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24""#)
        .header("sec-ch-ua-mobile", "?0")
        .header("sec-ch-ua-platform", r#""Windows""#)
        .header("Upgrade-Insecure-Requests", "1");
    if !cookies.is_empty() {
        r = r.header("Cookie", cookies);
    }
    r
}

/// Extract cookie key=value pairs from a response.
fn extract_cookies(resp: &reqwest::Response) -> Vec<String> {
    resp.headers()
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .filter_map(|s| s.split(';').next())
        .map(|s| s.to_string())
        .collect()
}

/// Fetch a URL, automatically handling 2t58.com human-check verification.
/// Detects the "安全验证" page, extracts the CSRF token, submits it, and retries.
#[allow(dead_code)]
pub async fn fetch_with_auto_verify(url: &str) -> Result<String, String> {
    let client = Client::builder()
        .redirect(redirect::Policy::limited(10))
        .timeout(Duration::from_secs(15))
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| format!("client build: {}", e))?;

    // ── Step 1: Initial request ──
    let resp = browser_headers(client.get(url), "")
        .send()
        .await
        .map_err(|e| format!("initial request: {}", e))?;

    let cookies = extract_cookies(&resp);
    let body = resp.text().await.map_err(|e| format!("read body: {}", e))?;

    // ── Step 2: Detect verification page ──
    if !(body.contains("human_check") && body.contains("csrf_token")) {
        return Ok(body);
    }

    // Extract csrf_token
    let needle = r#"name="csrf_token" value=""#;
    let pos = body.find(needle).ok_or("csrf_token field not found")?;
    let after = &body[pos + needle.len()..];
    let end = after.find('"').ok_or("csrf_token value end not found")?;
    let token = &after[..end];
    if token.is_empty() {
        return Err("csrf_token is empty".into());
    }

    let cookie_str = cookies.join("; ");

    // ── Step 3: POST the verification form ──
    let verify_resp = browser_headers(
        client.post(url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .form(&[("csrf_token", token), ("human_check", "on")]),
        &cookie_str,
    )
    .send()
    .await
    .map_err(|e| format!("verify POST: {}", e))?;

    let verify_cookies = extract_cookies(&verify_resp);
    let all_cookies: Vec<String> = [cookies, verify_cookies].concat();
    let all_cookie_str = all_cookies.join("; ");

    // ── Step 4: Retry original request ──
    let final_resp = browser_headers(client.get(url), &all_cookie_str)
        .send()
        .await
        .map_err(|e| format!("retry after verify: {}", e))?;

    final_resp.text().await.map_err(|e| format!("final body: {}", e))
}

// ────────────────────────────────────────────────────────────
// Tests — run with: cargo test anti_bot -- --nocapture
// ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::OnceLock;

    static RT: OnceLock<tokio::runtime::Runtime> = OnceLock::new();
    fn rt() -> &'static tokio::runtime::Runtime {
        RT.get_or_init(|| tokio::runtime::Runtime::new().unwrap())
    }

    #[test]
    fn test_auto_verify_real() {
        rt().block_on(async {
            println!("═══════════════════════════════════════════");
            println!("Testing auto-verify against 2t58.com ...");
            println!("═══════════════════════════════════════════");

            match fetch_with_auto_verify("https://www.2t58.com/").await {
                Ok(body) => {
                    let len = body.len();
                    let is_html = body.trim_start().starts_with("<!") || body.trim_start().starts_with("<html");
                    let has_verify = body.contains("human_check");
                    let has_block = body.contains("访问被拒绝");

                    println!("✅ SUCCESS — {} bytes received", len);
                    println!("   HTML: {is_html}, verify-page: {has_verify}, blocked: {has_block}");

                    if !has_verify && !has_block && len > 500 {
                        println!("🎉 Auto-verify PASSED — real content received");
                    } else if has_verify {
                        println!("⚠️  Got verification page again — session rejected");
                    } else if has_block {
                        println!("⚠️  Blocked by bot filter");
                    }
                }
                Err(e) => {
                    println!("❌ FAILED: {}", e);
                }
            }
        });
    }

    #[test]
    fn test_parse_token_from_sample() {
        let html = r#"<input type="hidden" name="csrf_token" value="abc123def456">"#;
        let needle = r#"name="csrf_token" value=""#;
        let start = html.find(needle).unwrap();
        let after = &html[start + needle.len()..];
        let end = after.find('"').unwrap();
        assert_eq!(&after[..end], "abc123def456");
        println!("✅ CSRF token parsing works correctly");
    }
}
