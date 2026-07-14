//! .nvtp packer — creates and reads Nova Theme Pack files.
//!
//! File layout:
//! ┌────────────┬─────────────────────────────────────┐
//! │  Offset    │  Content                            │
//! ├────────────┼─────────────────────────────────────┤
//! │  0         │  Magic bytes: b"NVTP"               │
//! │  4         │  Version: u16 (little-endian)        │
//! │  6         │  Flags: u16                          │
//! │  8         │  Theme ID len: u16                    │
//! │  10        │  Theme ID (UTF-8, ≤65535 bytes)      │
//! │  10+id_len │  Manifest len: u32 (LE)              │
//! │            │  Manifest JSON: NOT encrypted         │
//! │            │  Zip len: u64 (LE)                    │
//! │            │  Zip (assets): XOR-encrypted with     │
//! │            │    per-theme key derived from seed    │
//! └────────────┴─────────────────────────────────────┘

// pack_theme/extract_theme used externally (theme-pack.mjs, CLI)
#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::io::{Write, Cursor};
use std::path::Path;

use super::crypto;

const MAGIC: &[u8; 4] = b"NVTP";
const CURRENT_VERSION: u16 = 1;

// ═══════════════ TYPES ═══════════════

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeManifest {
    pub name: String,
    pub author: String,
    pub version: String,
    /// "free" | "pro" | "ultra"
    pub requires_license: String,
    /// Preview image filename within the zip
    pub preview: String,
    /// Main CSS file within the zip
    pub css_file: String,
    /// All files in the theme pack
    pub files: Vec<ThemeFile>,
    /// Arbitrary theme config (accent colors, bg video, bgm, etc.)
    pub config: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThemeFile {
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NvtpHeader {
    pub version: u16,
    pub flags: u16,
    pub theme_id: String,
}

// ═══════════════ PACK ═══════════════

/// Pack a directory into a .nvtp byte vector.
/// Theme assets → ZIP → XOR encrypt with per-theme key → wrap in .nvtp header.
pub fn pack_theme(
    theme_id: &str,
    src_dir: &Path,
    manifest: &ThemeManifest,
) -> Result<Vec<u8>, String> {
    // 1. Build ZIP of the theme directory
    let zip_bytes = zip_directory(src_dir)?;

    // 2. Serialize manifest to JSON
    let manifest_json = serde_json::to_vec(manifest)
        .map_err(|e| format!("Manifest JSON error: {e}"))?;

    // 3. Encrypt the ZIP with per-theme key
    let encrypted_zip = crypto::encrypt_theme(theme_id, &zip_bytes);

    // 4. Build .nvtp binary
    let theme_id_bytes = theme_id.as_bytes();
    if theme_id_bytes.len() > u16::MAX as usize {
        return Err("theme_id too long (max 65535 bytes)".to_string());
    }

    let mut buf = Vec::new();

    // Magic
    buf.write_all(MAGIC).unwrap();
    // Version
    buf.write_all(&CURRENT_VERSION.to_le_bytes()).unwrap();
    // Flags
    buf.write_all(&0u16.to_le_bytes()).unwrap();
    // Theme ID
    let id_len = theme_id_bytes.len() as u16;
    buf.write_all(&id_len.to_le_bytes()).unwrap();
    buf.write_all(theme_id_bytes).unwrap();
    // Manifest length + manifest
    let mlen = manifest_json.len() as u32;
    buf.write_all(&mlen.to_le_bytes()).unwrap();
    buf.write_all(&manifest_json).unwrap();
    // Encrypted zip length + data
    let zlen = encrypted_zip.len() as u64;
    buf.write_all(&zlen.to_le_bytes()).unwrap();
    buf.write_all(&encrypted_zip).unwrap();

    Ok(buf)
}

// ═══════════════ UNPACK ═══════════════

/// Parse a .nvtp file and extract the header, manifest, and decrypted ZIP bytes.
pub fn unpack_theme(data: &[u8]) -> Result<(NvtpHeader, ThemeManifest, Vec<u8>), String> {
    if data.len() < 10 {
        return Err("File too small".to_string());
    }

    let mut offset = 0;

    // Magic
    if &data[offset..offset + 4] != MAGIC {
        return Err("Not a .nvtp file (bad magic)".to_string());
    }
    offset += 4;

    // Version
    let version = u16::from_le_bytes([data[offset], data[offset + 1]]);
    if version != CURRENT_VERSION {
        return Err(format!("Unsupported version: {version}"));
    }
    offset += 2;

    // Flags
    let flags = u16::from_le_bytes([data[offset], data[offset + 1]]);
    offset += 2;

    // Theme ID
    if offset + 2 > data.len() { return Err("Truncated".into()); }
    let id_len = u16::from_le_bytes([data[offset], data[offset + 1]]) as usize;
    offset += 2;
    if offset + id_len > data.len() { return Err("Truncated at ID".into()); }
    let theme_id = String::from_utf8(data[offset..offset + id_len].to_vec())
        .map_err(|e| format!("Bad UTF-8 in theme ID: {e}"))?;
    offset += id_len;

    // Manifest length + data
    if offset + 4 > data.len() { return Err("Truncated at manifest len".into()); }
    let mlen = u32::from_le_bytes([
        data[offset], data[offset+1], data[offset+2], data[offset+3]
    ]) as usize;
    offset += 4;
    if offset + mlen > data.len() { return Err("Truncated at manifest".into()); }
    let manifest_json = &data[offset..offset + mlen];
    offset += mlen;

    // ZIP length + data
    if offset + 8 > data.len() { return Err("Truncated at zip len".into()); }
    let zlen = u64::from_le_bytes([
        data[offset], data[offset+1], data[offset+2], data[offset+3],
        data[offset+4], data[offset+5], data[offset+6], data[offset+7],
    ]) as usize;
    offset += 8;
    if offset + zlen != data.len() {
        return Err(format!("Size mismatch: expected {} zip bytes, got {} remaining", zlen, data.len() - offset));
    }
    let encrypted_zip = &data[offset..offset + zlen];

    // Decrypt
    let zip_bytes = crypto::decrypt_theme(&theme_id, encrypted_zip)?;

    // Parse manifest
    let manifest: ThemeManifest = serde_json::from_slice(manifest_json)
        .map_err(|e| format!("Manifest parse error: {e}"))?;

    let header = NvtpHeader { version, flags, theme_id };

    Ok((header, manifest, zip_bytes))
}

// ═══════════════ HELPERS ═══════════════

fn zip_directory(dir: &Path) -> Result<Vec<u8>, String> {
    let mut buf = Cursor::new(Vec::new());
    {
        let mut zw = zip::ZipWriter::new(&mut buf);
        let opts = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        add_dir_to_zip(&mut zw, opts, dir, "")?;

        zw.finish().map_err(|e| format!("ZIP finish error: {e}"))?;
    }
    Ok(buf.into_inner())
}

fn add_dir_to_zip<W: Write + std::io::Seek>(
    zw: &mut zip::ZipWriter<W>,
    opts: zip::write::SimpleFileOptions,
    dir: &Path,
    prefix: &str,
) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|e| format!("Read dir error: {e}"))? {
        let entry = entry.map_err(|e| format!("Entry error: {e}"))?;
        let path = entry.path();
        let name = if prefix.is_empty() {
            entry.file_name().to_string_lossy().to_string()
        } else {
            format!("{}/{}", prefix, entry.file_name().to_string_lossy())
        };

        if path.is_dir() {
            zw.add_directory(&name, opts).map_err(|e| format!("ZIP add dir error: {e}"))?;
            add_dir_to_zip(zw, opts, &path, &name)?;
        } else {
            zw.start_file(&name, opts).map_err(|e| format!("ZIP start file error: {e}"))?;
            let data = std::fs::read(&path).map_err(|e| format!("Read file error: {e}"))?;
            zw.write_all(&data).map_err(|e| format!("ZIP write error: {e}"))?;
        }
    }
    Ok(())
}

/// Extract ZIP bytes to a filesystem directory.
pub fn extract_theme(zip_bytes: &[u8], dest_dir: &Path) -> Result<(), String> {
    let cursor = Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("ZIP open error: {e}"))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("ZIP entry error: {e}"))?;
        let out_path = match file.enclosed_name() {
            Some(p) => dest_dir.join(p),
            None => continue,
        };

        if file.is_dir() {
            std::fs::create_dir_all(&out_path).ok();
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            let mut out = std::fs::File::create(&out_path)
                .map_err(|e| format!("Create file error: {e}"))?;
            std::io::copy(&mut file, &mut out)
                .map_err(|e| format!("Extract file error: {e}"))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_pack_unpack_roundtrip() {
        let tmp = std::env::temp_dir().join("nvtp-test-pack");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        fs::write(tmp.join("theme.css"), "body{color:red}").unwrap();
        fs::create_dir_all(tmp.join("icons")).unwrap();
        fs::write(tmp.join("icons").join("logo.webp"), b"fake-webp-data").unwrap();

        let manifest = ThemeManifest {
            name: "Test Theme".into(),
            author: "Nova".into(),
            version: "1.0.0".into(),
            requires_license: "free".into(),
            preview: "preview.webp".into(),
            css_file: "theme.css".into(),
            files: vec![
                ThemeFile { path: "theme.css".into(), size: 14 },
                ThemeFile { path: "icons/logo.webp".into(), size: 14 },
            ],
            config: serde_json::json!({"accent": "#4788f0"}),
        };

        let nvtp = pack_theme("com.nova.test", &tmp, &manifest).unwrap();
        let (header, m, zip) = unpack_theme(&nvtp).unwrap();

        assert_eq!(header.theme_id, "com.nova.test");
        assert_eq!(m.name, "Test Theme");
        assert!(!zip.is_empty());

        // Extract and verify
        let out = std::env::temp_dir().join("nvtp-test-out");
        let _ = fs::remove_dir_all(&out);
        extract_theme(&zip, &out).unwrap();
        assert!(out.join("theme.css").exists());
        assert!(out.join("icons/logo.webp").exists());

        let _ = fs::remove_dir_all(&tmp);
        let _ = fs::remove_dir_all(&out);
    }
}
