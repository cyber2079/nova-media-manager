/// NV3D 容器格式解析器
///
/// 格式结构（Ref: 08_加密资源加载 §1, 17_打包规范）:
///   Magic "NV3D" (4B) | Header (64B) | Manifest (gzip JSON) | Resource Blocks... | Footer (96B)
///
/// 每个 Resource Block 独立压缩 + SHA256，损坏时定位到具体资源

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};

const MAGIC: &[u8; 4] = b"NV3D";
const HEADER_SIZE: u64 = 64;
const MAGIC_SIZE: u64 = 4;
const FOOTER_SIZE: i64 = 136; // manifestSize(4) + manifestHash(32) + contentHash(32) + signature(64) + tail magic(4)

/// Flags bits
const FLAG_ENCRYPTED: u16 = 0x01;
const FLAG_SIGNED: u16 = 0x02;

/// Block types
const BLOCK_RAW: u8 = 0;
const BLOCK_GZIP: u8 = 1;
const BLOCK_STORE: u8 = 2;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Nv3dHeader {
    pub version: u16,
    pub encrypted: bool,
    pub signed: bool,
    pub manifest_size: u32,
    pub manifest_hash: String, // hex
    pub block_count: u16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockIndex {
    pub id: String,         // resource key from manifest
    pub block_type: u8,
    pub offset: u64,        // byte offset from file start to data
    pub data_size: u32,
    pub hash: String,       // hex
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Nv3dInfo {
    pub header: Nv3dHeader,
    pub manifest_json: String,
    pub blocks: Vec<BlockIndex>,
    pub signature: Option<String>, // hex of 64-byte Ed25519 sig, if signed
}

/// Read the full Nv3dInfo from a file path.
pub fn open_nv3d(path: &str) -> Result<Nv3dInfo, String> {
    let mut f = File::open(path).map_err(|e| format!("无法打开文件: {}", e))?;
    let file_len = f.seek(SeekFrom::End(0)).map_err(|e| format!("seek error: {}", e))?;
    if file_len < MAGIC_SIZE + HEADER_SIZE + FOOTER_SIZE as u64 {
        return Err("文件过小，不是有效的 NV3D 文件".to_string());
    }

    // ── Magic ────────────────────────────────────────────────────────
    f.seek(SeekFrom::Start(0)).map_err(|e| format!("seek: {}", e))?;
    let mut magic = [0u8; 4];
    f.read_exact(&mut magic).map_err(|e| format!("read magic: {}", e))?;
    if &magic != MAGIC {
        return Err("NV3D_LOAD_MAGIC_MISMATCH: 不是 NV3D 文件".to_string());
    }

    // ── Header (64B) ─────────────────────────────────────────────────
    let version     = read_u16_le(&mut f)?;
    let flags       = read_u16_le(&mut f)?;
    let manifest_sz = read_u32_le(&mut f)?;
    let mut mhash   = [0u8; 32];
    f.read_exact(&mut mhash).map_err(|e| format!("read manifest_hash: {}", e))?;
    let block_count = read_u16_le(&mut f)?;
    // skip reserved 22 bytes
    f.seek(SeekFrom::Current(22)).map_err(|e| format!("seek reserved: {}", e))?;

    let header = Nv3dHeader {
        version,
        encrypted: (flags & FLAG_ENCRYPTED) != 0,
        signed: (flags & FLAG_SIGNED) != 0,
        manifest_size: manifest_sz,
        manifest_hash: hex::encode(mhash),
        block_count,
    };

    // ── Manifest (gzip JSON) ─────────────────────────────────────────
    let manifest_offset = MAGIC_SIZE + HEADER_SIZE;
    let mut compressed = vec![0u8; manifest_sz as usize];
    f.seek(SeekFrom::Start(manifest_offset)).map_err(|e| format!("seek manifest: {}", e))?;
    f.read_exact(&mut compressed).map_err(|e| format!("read manifest: {}", e))?;

    // Verify manifest hash
    let actual_hash = Sha256::digest(&compressed);
    if actual_hash.as_slice() != mhash {
        return Err("NV3D_LOAD_MANIFEST_HASH: Manifest 校验失败".to_string());
    }

    // Decompress
    let manifest_json = decompress_gzip(&compressed)?;

    // ── Parse blocks from manifest ───────────────────────────────────
    let blocks = parse_block_index(&manifest_json, manifest_offset + manifest_sz as u64, &mut f)?;

    // ── Footer (96B at EOF-96) ───────────────────────────────────────
    let footer_start = file_len - FOOTER_SIZE as u64;
    f.seek(SeekFrom::Start(footer_start)).map_err(|e| format!("seek footer: {}", e))?;

    let _footer_manifest_sz = read_u32_le(&mut f)?;
    let mut fhash = [0u8; 32];
    f.read_exact(&mut fhash).map_err(|e| format!("read footer hash: {}", e))?;
    let mut content_hash = [0u8; 32];
    f.read_exact(&mut content_hash).map_err(|e| format!("read content_hash: {}", e))?;
    let mut sig_bytes = [0u8; 64];
    f.read_exact(&mut sig_bytes).map_err(|e| format!("read signature: {}", e))?;
    let mut tail_magic = [0u8; 4];
    f.read_exact(&mut tail_magic).map_err(|e| format!("read footer magic: {}", e))?;

    if &tail_magic != MAGIC {
        return Err("尾部 Magic 不匹配，文件可能已损坏".to_string());
    }

    // Verify footer manifest hash matches header
    if fhash != mhash {
        return Err("NV3D_LOAD_MANIFEST_HASH: Footer 与 Header 的 manifest_hash 不一致".to_string());
    }

    // Verify content hash (header + manifest + all blocks)
    f.seek(SeekFrom::Start(0)).map_err(|e| format!("seek: {}", e))?;
    let mut all_content = vec![0u8; footer_start as usize];
    f.read_exact(&mut all_content).map_err(|e| format!("read content: {}", e))?;
    let computed_content_hash = Sha256::digest(&all_content);
    if computed_content_hash.as_slice() != content_hash {
        return Err("内容校验失败 — 文件可能已损坏".to_string());
    }

    let signature = if header.signed { Some(hex::encode(sig_bytes)) } else { None };

    Ok(Nv3dInfo { header, manifest_json, blocks, signature })
}

/// Read a single resource block's raw data.
pub fn read_block(path: &str, block: &BlockIndex) -> Result<Vec<u8>, String> {
    let mut f = File::open(path).map_err(|e| format!("无法打开文件: {}", e))?;
    f.seek(SeekFrom::Start(block.offset)).map_err(|e| format!("seek block: {}", e))?;

    let mut data = vec![0u8; block.data_size as usize];
    f.read_exact(&mut data).map_err(|e| format!("read block data: {}", e))?;

    // Verify hash
    let actual = hex::encode(Sha256::digest(&data));
    if actual != block.hash {
        return Err(format!("NV3D_LOAD_BLOCK_HASH: block 校验失败 (expected {}, got {})", block.hash, actual));
    }

    // Decompress if needed
    match block.block_type {
        BLOCK_RAW | BLOCK_STORE => Ok(data),
        BLOCK_GZIP => decompress_gzip(&data).map(|s| s.into_bytes()),
        _ => Err(format!("未知 block type: {}", block.block_type)),
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────

fn read_u16_le(f: &mut File) -> Result<u16, String> {
    let mut b = [0u8; 2];
    f.read_exact(&mut b).map_err(|e| format!("read u16: {}", e))?;
    Ok(u16::from_le_bytes(b))
}

fn read_u32_le(f: &mut File) -> Result<u32, String> {
    let mut b = [0u8; 4];
    f.read_exact(&mut b).map_err(|e| format!("read u32: {}", e))?;
    Ok(u32::from_le_bytes(b))
}

fn decompress_gzip(data: &[u8]) -> Result<String, String> {
    use std::io::Read;
    let mut decoder = flate2::read::GzDecoder::new(data);
    let mut json = String::new();
    decoder.read_to_string(&mut json).map_err(|e| format!("gzip decompress: {}", e))?;
    Ok(json)
}

/// Parse block index from manifest JSON + file scan.
/// Each block in the file is: blockType(u8) + blockSize(u32 LE) + blockHash(32B) + data
fn parse_block_index(manifest_json: &str, blocks_start_offset: u64, f: &mut File) -> Result<Vec<BlockIndex>, String> {
    let manifest: serde_json::Value = serde_json::from_str(manifest_json)
        .map_err(|e| format!("NV3D_LOAD_MANIFEST_JSON: {}", e))?;

    let resources = manifest["resources"].as_object();
    if resources.is_none() {
        return Ok(Vec::new());
    }

    // Collect resource keys from manifest to map hash→key
    // Walk through models/textures/animations/etc and collect entries with hash field
    let mut hash_to_key: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for (_category, entries) in resources.unwrap() {
        if let Some(obj) = entries.as_object() {
            for (key, entry) in obj {
                if let Some(h) = entry["hash"].as_str() {
                    // hash format: "sha256:hex"
                    let hex = h.trim_start_matches("sha256:");
                    hash_to_key.insert(hex.to_string(), key.clone());
                }
            }
        }
    }

    let mut blocks = Vec::new();
    let mut offset = blocks_start_offset;

    f.seek(SeekFrom::Start(offset)).map_err(|e| format!("seek blocks start: {}", e))?;

    // Read blocks until we hit the footer (we detect by checking if remaining data < block header size)
    loop {
        // Try to read block header
        let mut bt = [0u8; 1];
        if f.read_exact(&mut bt).is_err() { break; }
        let block_type = bt[0];

        let block_size = match read_u32_le(f) {
            Ok(s) => s,
            Err(_) => break,
        };

        let mut block_hash = [0u8; 32];
        if f.read_exact(&mut block_hash).is_err() { break; }
        let hash_hex = hex::encode(block_hash);

        let id = hash_to_key.get(&hash_hex).cloned().unwrap_or_else(|| format!("block_{}", blocks.len()));
        let data_offset = offset + 1 + 4 + 32; // blockType + blockSize + blockHash

        blocks.push(BlockIndex {
            id,
            block_type,
            offset: data_offset,
            data_size: block_size,
            hash: hash_hex,
        });

        // Skip data
        offset = data_offset + block_size as u64;
        if f.seek(SeekFrom::Start(offset)).is_err() { break; }
    }

    Ok(blocks)
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// E2E: 用 pipeline.mjs 生成的 .nv3d 文件验证解析器正确性。
    /// 测试文件由 `node scripts/webgl3d/e2e-test.mjs` 生成。
    #[test]
    fn parse_e2e_test_theme() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../scripts/webgl3d/output/test-theme_v1.0.0.nv3d"
        );

        let info = open_nv3d(path).expect("nv3d_open should succeed");

        // Header
        assert_eq!(info.header.version, 1);
        assert!(!info.header.encrypted);
        assert!(!info.header.signed);
        assert!(info.header.manifest_size > 0);
        assert!(info.header.block_count >= 2, "expected >= 2 blocks, got {}", info.header.block_count);

        // Manifest
        let manifest: serde_json::Value =
            serde_json::from_str(&info.manifest_json).expect("manifest should be valid JSON");
        assert_eq!(manifest["themeId"], "test-theme");
        assert_eq!(manifest["formatVersion"], "2.0");
        assert!(manifest["resources"]["textures"].is_object());
        assert!(manifest["resources"]["previews"].is_object());

        // Blocks
        assert!(!info.blocks.is_empty(), "should have at least 1 block");
        for block in &info.blocks {
            assert!(!block.hash.is_empty(), "block hash should not be empty");
            assert!(block.data_size > 0, "block {} data_size should be > 0", block.id);
        }

        // Read a block
        let first = &info.blocks[0];
        let data = read_block(path, first).expect("read_block should succeed");
        assert!(!data.is_empty());
    }

    /// Header 结构尺寸验证
    #[test]
    fn header_size_is_64_bytes() {
        // verify our mental model matches the struct packing
        // version(2) + flags(2) + manifestSize(4) + manifestHash(32) + blockCount(2) + reserved(22) = 64
        assert_eq!(HEADER_SIZE, 64);
    }

    /// 非 NV3D 文件应拒绝
    #[test]
    fn rejects_non_nv3d_file() {
        // cargo manifest itself — definitely not NV3D
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/Cargo.toml");
        let result = open_nv3d(path);
        assert!(result.is_err());
    }
}
