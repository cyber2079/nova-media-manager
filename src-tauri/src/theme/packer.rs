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
const FLAG_HAS_SIGNATURE: u16 = 0x0001;

/// Public key for verifying .nvtp Ed25519 signatures.
/// Corresponds to the private key stored in the proprietary repo.
const NVT_PUBKEY: [u8; 32] = [
    0x7c, 0x2a, 0x0e, 0xef, 0x7b, 0x50, 0xf6, 0xc9,
    0xb8, 0xaf, 0xf7, 0x80, 0xec, 0x92, 0xfd, 0xdb,
    0x6b, 0x10, 0xc2, 0x22, 0xb3, 0x9b, 0xaa, 0x79,
    0x57, 0x49, 0x8b, 0x48, 0xad, 0x82, 0x3d, 0x81,
];

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

// ═══════════════ SIGN ═══════════════

/// Append an Ed25519 signature to a .nvtp byte vector.
/// Sets the FLAG_HAS_SIGNATURE bit and signs the entire content.
/// The `seed` is the 32-byte Ed25519 private seed.
pub fn sign_nvtp(data: &[u8], seed: &[u8; 32]) -> Result<Vec<u8>, String> {
    use ed25519_compact::{KeyPair, Seed};

    if data.len() < 10 {
        return Err("Data too short to sign".into());
    }

    let mut signed = data.to_vec();

    // Set HAS_SIGNATURE flag at offset 6-7
    let flags = u16::from_le_bytes([signed[6], signed[7]]);
    let new_flags = (flags | FLAG_HAS_SIGNATURE).to_le_bytes();
    signed[6] = new_flags[0];
    signed[7] = new_flags[1];

    // Sign the entire content
    let seed_obj = Seed::from_slice(seed).map_err(|e| format!("Invalid seed: {e}"))?;
    let keypair = KeyPair::from_seed(seed_obj);
    let signature = keypair.sk.sign(&signed, None);

    // Append 64-byte signature
    signed.extend_from_slice(&signature[..]);

    Ok(signed)
}

// ═══════════════ UNPACK ═══════════════

/// Parse a .nvtp file and extract the header, manifest, and decrypted ZIP bytes.
/// If the FLAG_HAS_SIGNATURE bit is set, verifies the Ed25519 signature before
/// accepting the file. Unsigned files (legacy) are accepted for backward compatibility.
pub fn unpack_theme(data: &[u8]) -> Result<(NvtpHeader, ThemeManifest, Vec<u8>), String> {
    if data.len() < 10 {
        return Err("File too small".to_string());
    }

    // ── Read flags early to detect signature ──
    let flags = u16::from_le_bytes([data[6], data[7]]);
    let has_sig = flags & FLAG_HAS_SIGNATURE != 0;

    // ── Verify signature before parsing (defense in depth) ──
    if has_sig {
        if data.len() < 74 { // 10 header + 64 sig minimum
            return Err("Signed .nvtp too short".into());
        }
        let content_end = data.len() - 64;
        let sig_bytes: &[u8; 64] = &data[content_end..]
            .try_into()
            .map_err(|_| "Bad signature length".to_string())?;
        let content = &data[..content_end];

        use ed25519_compact::{PublicKey, Signature};
        let pk = PublicKey::from_slice(&NVT_PUBKEY)
            .map_err(|_| "Internal: invalid pubkey".to_string())?;
        let sig = Signature::from_slice(sig_bytes)
            .map_err(|_| "Bad signature format".to_string())?;
        pk.verify(content, &sig)
            .map_err(|_| "Signature verification failed — theme may be tampered".to_string())?;
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

    // Flags (already read, skip 2 bytes)
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

    // Allow optional 64-byte signature trailer
    let data_end = if has_sig {
        data.len().checked_sub(64).ok_or("Signed file too short")?
    } else {
        data.len()
    };
    if offset + zlen != data_end {
        return Err(format!("Size mismatch: expected {} zip bytes, got {} remaining", zlen, data_end - offset));
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
    use getrandom::getrandom;

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
        assert_eq!(header.flags, 0); // unsigned by default
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

    #[test]
    fn test_pack_sign_unpack_roundtrip() {
        let tmp = std::env::temp_dir().join("nvtp-test-sign");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        fs::write(tmp.join("theme.css"), "body{color:red}").unwrap();

        let manifest = ThemeManifest {
            name: "Signed Theme".into(),
            author: "Nova".into(),
            version: "1.0.0".into(),
            requires_license: "pro".into(),
            preview: "preview.webp".into(),
            css_file: "theme.css".into(),
            files: vec![ThemeFile { path: "theme.css".into(), size: 14 }],
            config: serde_json::json!({"accent": "#4788f0"}),
        };

        // ── Unsigned file still works (backward compat) ──
        let nvtp = pack_theme("com.nova.sign-test", &tmp, &manifest).unwrap();
        let (header2, _, _) = unpack_theme(&nvtp).unwrap();
        assert_eq!(header2.flags & FLAG_HAS_SIGNATURE, 0);

        // ── Sign with ephemeral keypair ──
        // Production signing key lives in nova-proprietary/theme/crypto.rs ONLY.
        // This test uses a random ephemeral key to verify sign/verify plumbing.
        let test_seed: [u8; 32] = {
            let mut buf = [0u8; 32];
            getrandom(&mut buf).expect("getrandom");
            buf
        };
        let test_pubkey = {
            use ed25519_compact::{KeyPair, Seed};
            let seed_obj = Seed::from_slice(&test_seed).unwrap();
            KeyPair::from_seed(seed_obj).pk
        };

        let signed = sign_nvtp(&nvtp, &test_seed).unwrap();
        assert!(signed.len() > nvtp.len()); // has appended 64-byte signature

        // Verify FLAG_HAS_SIGNATURE is set
        let flags = u16::from_le_bytes([signed[6], signed[7]]);
        assert_eq!(flags & FLAG_HAS_SIGNATURE, FLAG_HAS_SIGNATURE);

        // ── Manually verify signature (bypasses NVT_PUBKEY) ──
        let content_end = signed.len() - 64;
        let sig = ed25519_compact::Signature::from_slice(&signed[content_end..]).unwrap();
        test_pubkey.verify(&signed[..content_end], &sig)
            .expect("Ephemeral signature must verify");

        // ── Tampered signed data is rejected ──
        let mut tampered = signed.clone();
        tampered[20] ^= 0xFF; // flip a byte in the signed content
        let result = test_pubkey.verify(&tampered[..content_end], &sig);
        assert!(result.is_err(), "Tampered data should fail verification");

        let _ = fs::remove_dir_all(&tmp);
    }
}
