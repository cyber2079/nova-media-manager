use std::env;
use std::fs;
use std::path::Path;
use sha2::{Digest, Sha256};

fn main() {
    let dist_dir = Path::new(&env::var("CARGO_MANIFEST_DIR").unwrap()).join("../dist");
    let out_dir = env::var("OUT_DIR").unwrap();
    let dest = Path::new(&out_dir).join("frontend_hashes.rs");

    if dist_dir.exists() {
        let mut entries: Vec<String> = vec![];
        for entry in fs::read_dir(&dist_dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_dir() { continue; }
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if !name.ends_with(".js") && !name.ends_with(".html") && !name.ends_with(".wasm") { continue; }
                if let Ok(data) = fs::read(&path) {
                    let hash = hex::encode(Sha256::digest(&data));
                    let escaped_name = name.replace('\\', "\\\\").replace('"', "\\\"");
                    entries.push(format!("    (\"{}\", \"{}\")", escaped_name, hash));
                }
            }
        }
        let code = format!(
            "// Auto-generated — DO NOT EDIT\npub const FRONTEND_HASHES: &[(&str, &str)] = &[\n{}\n];\n",
            entries.join(",\n")
        );
        fs::write(&dest, code).unwrap();
    } else {
        fs::write(&dest, "pub const FRONTEND_HASHES: &[(&str, &str)] = &[];\n").unwrap();
    }

    tauri_build::build();
}
