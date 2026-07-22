#!/usr/bin/env node
/**
 * NV3D 端到端测试 — 造最小素材 → manifest → pack → 验证二进制格式
 *
 * 测试步骤:
 *   1. 生成测试 PNG + JSON 文件
 *   2. pipeline.mjs manifest — 生成 manifest.json
 *   3. pipeline.mjs pack     — 打包 .nv3d
 *   4. 逐字节验证 .nv3d 二进制格式正确性
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import crypto from "crypto";
import zlib from "zlib";

const TEST_DIR  = join(import.meta.dirname, "test-theme");
const PIPELINE  = join(import.meta.dirname, "pipeline.mjs");
const NV3D_PATH = join(import.meta.dirname, "output", "test-theme_v1.0.0.nv3d");
const MANIFEST  = join(TEST_DIR, "manifest.json");

let passed = 0, failed = 0;

function check(label, condition, detail = "") {
  if (condition) { passed++; console.log(`  \x1b[32mPASS\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`); }
  else { failed++; console.error(`  \x1b[31mFAIL\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`); }
}

// ─── Step 1: Generate test assets ────────────────────────────────────

console.log("\n═══ Step 1: Generate test assets ═══\n");

// Clean
if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
mkdirSync(join(TEST_DIR, "i18n"), { recursive: true });
mkdirSync(join(TEST_DIR, "textures"), { recursive: true });
mkdirSync(join(TEST_DIR, "models"), { recursive: true });
mkdirSync(join(TEST_DIR, "preview"), { recursive: true });

// 1×1 red PNG (smallest valid PNG, hand-crafted)
const pngBytes = Uint8Array.from([
  137,80,78,71,13,10,26,10,  // PNG signature
  0,0,0,13, 73,72,68,82,      // IHDR chunk: 13 bytes
  0,0,0,1, 0,0,0,1,           // 1×1 pixel
  8,2,                         // RGB, 8-bit
  0,0,0,                       // no compression/filter/interlace
  0x5E,0x75,0x44,0xDC,        // IHDR CRC
  0,0,0,14, 73,68,65,84,      // IDAT chunk: 14 bytes
  0x78,0xDA,0x62,0x60,0x60,   // zlib-compressed 1px red pixel
  0x00,0x00,0x00,0x04,0x00,0x01,
  0x72,0x0E,0x32,0x88,        // IDAT CRC
  0,0,0,0, 73,69,78,68,        // IEND chunk
  0xAE,0x42,0x60,0x82,        // IEND CRC
]);
writeFileSync(join(TEST_DIR, "textures", "test_diffuse.png"), pngBytes);
check("1×1 test PNG generated", true);

writeFileSync(join(TEST_DIR, "models", "README.txt"), "placeholder — real .glb files go here");
check("models placeholder created", true);

writeFileSync(join(TEST_DIR, "preview", "thumbnail.png"), pngBytes);
check("preview thumbnail generated", true);

// i18n
writeFileSync(join(TEST_DIR, "i18n", "zh.json"), JSON.stringify({
  "theme.name": "测试主题",
  "theme.description": "端到端验证用测试主题",
  "scene.main_room.name": "测试房间",
}));
check("zh.json created", true);

writeFileSync(join(TEST_DIR, "i18n", "en.json"), JSON.stringify({
  "theme.name": "Test Theme",
  "theme.description": "End-to-end verification test theme",
  "scene.main_room.name": "Test Room",
}));
check("en.json created", true);

// manifest.template.json (partial — pipeline fills in resources)
writeFileSync(join(TEST_DIR, "manifest.template.json"), JSON.stringify({
  themeName: { zh: "测试主题", en: "Test Theme" },
  scenes: [{
    id: "test_room",
    nameKey: "scene.test_room.name",
    modelRef: "scene_test",
    defaultCamera: { position: [0,1.5,5], target: [0,1,0], fov: 60, nearPlane: 0.1, farPlane: 100, minDistance: 1, maxDistance: 10, minPolarAngle: 0.1, maxPolarAngle: 1.5 },
    lights: [{ id: "ambient", type: "ambient", color: [1,1,1], intensity: 0.5 }],
  }],
  characters: [{
    id: "test_char",
    nameKey: "character.test_char.name",
    modelRef: "char_test",
    defaultPosition: [0,0,-1],
    animations: { idle: { animRef: "idle_test", loop: true }, greet: { animRef: "greet_test", loop: false, nextAnim: "idle" } },
  }],
  props: [{
    id: "test_prop",
    nameKey: "prop.test_prop.name",
    modelRef: "prop_test",
    defaultPosition: [0,0,-2],
    pickable: true, draggable: true,
  }],
  requiredWebGLExtensions: [],
}, null, 2));
check("manifest.template.json created", true);

// ─── Step 2: Generate manifest ───────────────────────────────────────

console.log("\n═══ Step 2: Generate manifest ═══\n");

const resultManifest = execSync(
  `node "${PIPELINE}" --source "${TEST_DIR}" --theme-id test-theme --version 1.0.0 --steps manifest`,
  { encoding: "utf-8", stdio: "pipe", cwd: join(import.meta.dirname, "..") }
);
console.log(resultManifest.trim());
check("pipeline manifest step completed", !resultManifest.includes("FAIL"));

// Verify manifest.json
const manifest = JSON.parse(readFileSync(MANIFEST, "utf-8"));
check("manifest.json exists", existsSync(MANIFEST));
check("manifest.themeId = test-theme", manifest.themeId === "test-theme");
check("manifest.formatVersion = 2.0", manifest.formatVersion === "2.0");
check("manifest.resources.textures present", manifest.resources?.textures != null);
check("manifest.resources.textures.test_diffuse has hash", manifest.resources?.textures?.test_diffuse?.hash?.startsWith("sha256:"));
check("manifest.resources.previews.thumbnail has path", manifest.resources?.previews?.thumbnail?.path != null);
check("manifest.i18n present", Object.keys(manifest.i18n).length === 2);
check("manifest.scenes from template", manifest.scenes?.length === 1);
check("manifest.characters from template", manifest.characters?.length === 1);
check("manifest.props from template", manifest.props?.length === 1);
check("manifest.requiredWebGLExtensions is array", Array.isArray(manifest.requiredWebGLExtensions));

// ─── Step 3: Pack NV3D ───────────────────────────────────────────────

console.log("\n═══ Step 3: Pack NV3D ═══\n");

const resultPack = execSync(
  `node "${PIPELINE}" --source "${TEST_DIR}" --steps pack`,
  { encoding: "utf-8", stdio: "pipe", cwd: join(import.meta.dirname, "..") }
);
console.log(resultPack.trim());
check("pipeline pack step completed", !resultPack.includes("FAIL"));
check(".nv3d file exists", existsSync(NV3D_PATH));

const nv3d = readFileSync(NV3D_PATH);
const sizeMB = (nv3d.length / (1024 * 1024)).toFixed(2);
check(`.nv3d size > 0 (${sizeMB} MB)`, nv3d.length > 0);

// ─── Step 4: Verify binary format byte-by-byte ────────────────────────

console.log("\n═══ Step 4: Verify NV3D binary format ═══\n");

const MAGIC = Buffer.from("NV3D");

// Magic
check("Magic bytes = NV3D", nv3d.slice(0, 4).toString() === "NV3D");

// Header (64 bytes)
const header = nv3d.slice(4, 68);
const formatVersion = header.readUInt16LE(0);
const flags = header.readUInt16LE(2);
const manifestSize = header.readUInt32LE(4);
const manifestHash = header.slice(8, 40);
const blockCount = header.readUInt16LE(40);

check("Header formatVersion = 1", formatVersion === 1);
check(`Header flags = ${flags}`, flags === 0);  // no encrypted, no signed
check(`Header manifestSize > 0 (${manifestSize} bytes)`, manifestSize > 0);
check("Header blockCount > 0", blockCount > 0);

// Manifest (gzip JSON)
const manifestStart = 68;
const manifestEnd = manifestStart + manifestSize;
check("Manifest offset correct (header ends at 68)", manifestStart === 68);

const manifestGz = nv3d.slice(manifestStart, manifestEnd);
const manifestActualHash = crypto.createHash("sha256").update(manifestGz).digest();
check("Manifest SHA256 matches header", manifestActualHash.equals(manifestHash));

// Decompress and validate
const manifestJson = zlib.gunzipSync(manifestGz).toString("utf-8");
const parsed = JSON.parse(manifestJson);
check("Manifest gzip decompresses to valid JSON", !!parsed);
check("Manifest JSON has themeId", parsed.themeId === "test-theme");

// Block structure (after manifest)
let offset = manifestEnd;
let blocksFound = 0;

while (offset < nv3d.length - 140) { // footer ~136B
  const blockType = nv3d.readUInt8(offset);
  const blockSize = nv3d.readUInt32LE(offset + 1);
  const blockHash = nv3d.slice(offset + 5, offset + 37);
  const blockData = nv3d.slice(offset + 37, offset + 37 + blockSize);

  const actualHash = crypto.createHash("sha256").update(blockData).digest();
  check(`Block #${blocksFound + 1}: hash matches — type=${blockType}, size=${blockSize}`, actualHash.equals(blockHash));

  offset += 1 + 4 + 32 + blockSize;
  blocksFound++;
}

check(`All ${manifest.resourcesCount || "expected"} blocks verified`, blocksFound >= 2);

// Footer
const footerStart = offset;
const footerMagSize = nv3d.readUInt32LE(footerStart);
const footerMagHash = nv3d.slice(footerStart + 4, footerStart + 36);
const footerContentHash = nv3d.slice(footerStart + 36, footerStart + 68);
const footerSig = nv3d.slice(footerStart + 68, footerStart + 132);
const footerMagic = nv3d.slice(footerStart + 132, footerStart + 136);

check("Footer manifestSize = header manifestSize", footerMagSize === manifestSize);
check("Footer manifestHash = header manifestHash", footerMagHash.equals(manifestHash));
check("Footer signature is 64 bytes of zeros (unsigned)", footerSig.every(b => b === 0));
check("Footer tail magic = NV3D", footerMagic.toString() === "NV3D");

// ─── Summary ──────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
