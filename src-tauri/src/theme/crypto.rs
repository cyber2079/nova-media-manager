//! Crypto layer for Nova Theme Pack (.nvtp)
//!
//! Uses only sha2 + hex (already in Cargo.toml — no extra deps).
//!
//! Protection:
//!   1. XOR encryption with keystream = SHA256(MASTER_SEED || theme_id) iteratively expanded
//!   2. Integrity hash = SHA256(plaintext) prepended to ciphertext
//!   3. Same theme_id always produces same key → deterministic verify

use sha2::{Sha256, Digest};

/// Compiled-in master seed — NEVER change this once themes are deployed.
const MASTER_SEED: &[u8] = b"NVTP_2026_KX9mP2vL7qR4wN8";

// ═══════════════ KEY DERIVATION ═══════════════

/// Generate a 32-byte base key from theme_id.
fn derive_base_key(theme_id: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(MASTER_SEED);
    hasher.update(theme_id.as_bytes());
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

/// Expand the base key into a keystream of `len` bytes using iterative SHA256.
fn expand_keystream(base_key: &[u8; 32], len: usize) -> Vec<u8> {
    let blocks = (len + 31) / 32;
    let mut stream = Vec::with_capacity(blocks * 32);

    let mut counter = 0u64;
    for _ in 0..blocks {
        let mut hasher = Sha256::new();
        hasher.update(base_key);
        hasher.update(counter.to_le_bytes());
        stream.extend_from_slice(&hasher.finalize());
        counter += 1;
    }

    stream.truncate(len);
    stream
}

// ═══════════════ XOR ENCRYPT / DECRYPT ═══════════════

/// Encrypt plaintext with XOR keystream derived from theme_id.
/// Prepends 32-byte SHA256 hash of plaintext for integrity verification.
pub fn encrypt_theme(theme_id: &str, plaintext: &[u8]) -> Vec<u8> {
    let base_key = derive_base_key(theme_id);

    // Integrity hash
    let hash = Sha256::digest(plaintext);

    // Keystream
    let keystream = expand_keystream(&base_key, plaintext.len());

    // XOR
    let mut ciphertext = Vec::with_capacity(32 + plaintext.len());
    ciphertext.extend_from_slice(&hash);
    for (p, k) in plaintext.iter().zip(keystream.iter()) {
        ciphertext.push(p ^ k);
    }

    ciphertext
}

/// Decrypt ciphertext.
/// Verifies the integrity hash and returns plaintext.
pub fn decrypt_theme(theme_id: &str, ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    if ciphertext.len() < 32 {
        return Err("Ciphertext too short (missing integrity hash)".to_string());
    }

    let base_key = derive_base_key(theme_id);
    let stored_hash = &ciphertext[..32];
    let encrypted = &ciphertext[32..];

    // Keystream
    let keystream = expand_keystream(&base_key, encrypted.len());

    // XOR decrypt
    let mut plaintext = Vec::with_capacity(encrypted.len());
    for (e, k) in encrypted.iter().zip(keystream.iter()) {
        plaintext.push(e ^ k);
    }

    // Verify hash
    let computed_hash = Sha256::digest(&plaintext);
    if computed_hash.as_slice() != stored_hash {
        return Err("Integrity check failed — wrong key or corrupted data".to_string());
    }

    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let data = b"Hello, Nova Theme Pack! This is test data for the theme system.";
        let ct = encrypt_theme("test-theme-001", data);
        let pt = decrypt_theme("test-theme-001", &ct).unwrap();
        assert_eq!(data.to_vec(), pt);
    }

    #[test]
    fn wrong_theme_id_fails() {
        let data = b"secret theme data";
        let ct = encrypt_theme("cyber-girl", data);
        let result = decrypt_theme("other-theme", &ct);
        assert!(result.is_err());
    }

    #[test]
    fn tampered_ciphertext_fails() {
        let data = b"original data";
        let mut ct = encrypt_theme("t", data);
        ct[40] ^= 0xFF; // flip some bits
        let result = decrypt_theme("t", &ct);
        assert!(result.is_err());
    }
}
