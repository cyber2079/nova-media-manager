//! Theme token engine — loads theme.json, merges inherits, emits CSS variables.
//!
//! ## Inheritance
//! 1. Load `default/theme.json` (embedded via `include_str!`)
//! 2. If the theme declares `"inherits": "some-base"`, load that base first
//! 3. Shallow-merge the user theme's top-level sections over the base
//! 4. Flatten all tokens into `--nv-` CSS custom properties
//!
//! ## CSS variable naming
//! JSON path `colors.primaryLight` → `--nv-color-primaryLight`
//! JSON path `glass.header.opacity` → `--nv-glass-header-opacity`
//!
//! Rule: join path segments with `-`, drop trailing `s` from the first segment
//! when it's a plural category name (colors→color, but glass→glass).

use serde_json::Value;

/// Embedded default theme — the root of all inheritance chains.
const DEFAULT_THEME_JSON: &str = include_str!("default_theme.json");

// ═══════════════ CATEGORY NAME MAPPING ═══════════════
// Plural JSON keys that should become singular in CSS var prefix.
const PLURAL_CATEGORIES: &[&str] = &["colors"];

fn css_prefix(category: &str) -> String {
    if PLURAL_CATEGORIES.contains(&category) {
        // "colors" → "color"
        let singular = &category[..category.len() - 1];
        format!("--nv-{}", singular)
    } else {
        format!("--nv-{}", category)
    }
}

// ═══════════════ PUBLIC API ═══════════════

/// Load the default theme tokens (embedded).
pub fn load_default() -> Value {
    serde_json::from_str(DEFAULT_THEME_JSON).unwrap_or_default()
}

/// Merge `override_json` over `base`. Both must be valid theme.json objects.
/// Shallow-merge at the top level (global, colors, glass, etc.),
/// then deep-merge each section.
pub fn merge_tokens(base: &Value, override_json: &str) -> Result<Value, String> {
    let ov: Value =
        serde_json::from_str(override_json).map_err(|e| format!("Invalid theme.json: {e}"))?;

    let mut merged = base.clone();

    if let (Some(base_obj), Some(ov_obj)) = (merged.as_object_mut(), ov.as_object()) {
        for (key, val) in ov_obj {
            match (base_obj.get_mut(key), val) {
                // Both sides are objects → deep merge
                (Some(Value::Object(ref mut b)), Value::Object(ref o)) => {
                    for (k, v) in o {
                        b.insert(k.clone(), v.clone());
                    }
                }
                // Override side is a primitive or array → replace entirely
                _ => {
                    base_obj.insert(key.clone(), val.clone());
                }
            }
        }
    }

    Ok(merged)
}

/// Flatten a theme.json Value tree into CSS `:root { ... }` block text.
pub fn to_css_vars(tokens: &Value) -> String {
    let mut vars = Vec::new();
    flatten_value(&mut vars, tokens, "");
    let decls: String = vars.iter().map(|(k, v)| format!("{}: {};\n", k, v)).collect();
    format!(":root {{\n{}}}", decls)
}

// ═══════════════ TOKEN FLATTENING ═══════════════

fn flatten_value(out: &mut Vec<(String, String)>, val: &Value, prefix: &str) {
    match val {
        Value::Object(map) => {
            for (key, child) in map {
                let seg = css_prefix_for_key(prefix, key);
                flatten_value(out, child, &seg);
            }
        }
        Value::String(s) => {
            if !s.is_empty() && !prefix.is_empty() {
                out.push((prefix.to_string(), s.clone()));
            }
        }
        Value::Number(n) => {
            if !prefix.is_empty() {
                out.push((prefix.to_string(), format_value_with_unit(&prefix, n)));
            }
        }
        Value::Bool(b) => {
            if !prefix.is_empty() {
                out.push((prefix.to_string(), if *b { "1".into() } else { "0".into() }));
            }
        }
        _ => { /* arrays, null — skip */ }
    }
}

/// Build the CSS var prefix segment for one JSON key.
/// Rule:
///   root-level "colors" → "--nv-color"
///   root-level "glass"  → "--nv-glass"
///   nested "header.opacity" → "--nv-glass-header-opacity"
fn css_prefix_for_key(prefix: &str, key: &str) -> String {
    if prefix.is_empty() {
        css_prefix(key)
    } else {
        format!("{}-{}", prefix, key)
    }
}

/// Append unit suffixes for known numeric tokens.
/// Numbers in these token paths get "px"; percentages stay as-is.
fn format_value_with_unit(prefix: &str, n: &serde_json::Number) -> String {
    // PX units for dimension-like tokens
    let px_keys = [
        "height", "size", "width", "radius", "gap", "padding",
        "blur", "elevation", "speed",
    ];
    // % units
    let pct_keys = ["opacity", "intensity", "scale", "saturation", "overlayOpacity"];

    let last_seg = prefix.rsplit('-').next().unwrap_or("");

    if px_keys.iter().any(|k| last_seg.ends_with(k)) {
        format!("{}px", n)
    } else if pct_keys.iter().any(|k| last_seg.ends_with(k)) {
        // opacity/intensity are 0-100 in JSON, emit as unitless for CSS (0-1 style)
        // But font scale / saturation / overlayOpacity are also in the pct set.
        // We use heuristics: if the key is "opacity" or "intensity", divide by 100.
        if last_seg == "opacity" || last_seg == "intensity" {
            if let Some(f) = n.as_f64() {
                return format!("{:.2}", f / 100.0);
            }
        }
        if last_seg == "scale" {
            return n.to_string(); // already a factor
        }
        format!("{}%", n)
    } else if last_seg == "fontWeight" || last_seg == "transitionSpeed" {
        n.to_string()
    } else {
        format!("{}px", n) // safe default
    }
}

// ═══════════════ TESTS ═══════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_default() {
        let t = load_default();
        assert_eq!(t["colors"]["primary"], "#4788f0");
        assert_eq!(t["glass"]["header"]["opacity"], 92);
    }

    #[test]
    fn test_css_prefix() {
        assert_eq!(css_prefix("colors"), "--nv-color");
        assert_eq!(css_prefix("glass"), "--nv-glass");
        assert_eq!(css_prefix("global"), "--nv-global");
    }

    #[test]
    fn test_to_css_vars_contains_key_vars() {
        let t = load_default();
        let css = to_css_vars(&t);
        assert!(css.contains("--nv-color-primary: #4788f0;"));
        assert!(css.contains("--nv-glass-header-opacity: 0.92;"));
        assert!(css.contains("--nv-glass-header-blur: 16px;"));
        assert!(css.contains("--nv-button-radius: 8px;"));
    }

    #[test]
    fn test_merge_override() {
        let base = load_default();
        let ov = r##"{"colors": {"primary": "#ff0000", "primaryLight": "#ff6666"}}"##;
        let merged = merge_tokens(&base, ov).unwrap();
        assert_eq!(merged["colors"]["primary"], "#ff0000");
        assert_eq!(merged["colors"]["primaryLight"], "#ff6666");
        // Unchanged keys remain
        assert_eq!(merged["colors"]["surfaceDark"], "#060810");
        assert_eq!(merged["glass"]["header"]["opacity"], 92);
    }

    #[test]
    fn test_empty_sfx_skipped() {
        let css = to_css_vars(&load_default());
        // sfx asset paths are all empty strings — should NOT appear in CSS
        assert!(!css.contains("--nv-sfx-hover: "));
        assert!(!css.contains("--nv-sfx-click: "));
        // bools ARE emitted regardless
        assert!(css.contains("--nv-sfx-enabled: 1;"));
    }

    #[test]
    fn test_bool_enabled() {
        let css = to_css_vars(&load_default());
        // bool true → "1"
        assert!(css.contains("--nv-sfx-enabled: 1;"));
    }
}
