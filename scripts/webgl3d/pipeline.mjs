#!/usr/bin/env node
/**
 * NV3D 主题打包全管线 — 单文件 Node.js 实现。
 *
 * 步骤（通过 --steps 控制）:
 *   env       离线工具版本校验
 *   validate  素材合规校验（命名/分辨率/JSON）
 *   manifest  扫描源目录 → SHA256 → 生成 manifest.json
 *   pack      读取 manifest + 源文件 → 构建 .nv3d 二进制
 *   sign      Ed25519 签名（需要 --sign-key）
 *
 * 零外部依赖：只用了 Node.js 内置的 fs / crypto / zlib / child_process，
 * 以及已安装的 sharp（贴图分辨率检测，可选——没有 sharp 时跳过分辨率校验）。
 *
 * Ref: [10_贴图管线](docs/webgl3d-spec/10_离线贴图自动化管线规范.md)
 * Ref: [17_打包规范](docs/webgl3d-spec/17_专属资源包打包加密通用规范.md)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, openSync, readSync, writeSync, closeSync } from "fs";
import { join, relative, extname, basename, dirname } from "path";
import { createHash } from "crypto";
import { gzipSync } from "zlib";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

// ─── CLI ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name) { return args.includes(`--${name}`); }
function val(name, fallback = "") {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}

const SOURCE = val("source");
const THEME_ID = val("theme-id", basename(SOURCE || "unknown"));
const VERSION = val("version", "1.0.0");
const STEPS = val("steps", "env,validate,manifest,pack");
const SIGN_KEY = val("sign-key", "");
const OUTPUT = val("output", join(OUTPUT_DIR, `${THEME_ID}_v${VERSION}.nv3d`));
const DRY_RUN = flag("dry-run");
const CI = flag("ci");
const VERBOSE = flag("verbose");

const stepNames = STEPS.split(",").map(s => s.trim());

// ─── Logging ────────────────────────────────────────────────────────────

let errors = 0, warnings = 0, stepFailed = false;
function ok(msg)  { console.log(`  \x1b[32mOK\x1b[0m  ${msg}`); }
function warn(msg){ console.warn(`  \x1b[33mWARN\x1b[0m ${msg}`); warnings++; }
function fail(msg){ console.error(`  \x1b[31mFAIL\x1b[0m ${msg}`); errors++; }
function info(msg) { console.log(`  ${msg}`); }

function step(label) {
  console.log(`\n${"─".repeat(60)}\n  [${label}]\n${"─".repeat(60)}`);
}

// ─── Helpers ────────────────────────────────────────────────────────────

function sha256File(p) {
  const h = createHash("sha256");
  h.update(readFileSync(p));
  return h.digest("hex");
}
function sha256Buf(buf) {
  return createHash("sha256").update(buf).digest("hex");
}
function sha256BufRaw(buf) {
  return createHash("sha256").update(buf).digest();
}
function gzip(buf) {
  return gzipSync(buf, { level: 9 });
}
function walkDir(dir, exts = null) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(p, exts));
    else if (!exts || exts.includes(extname(entry.name).toLowerCase())) results.push(p);
  }
  return results.sort();
}
function dirSize(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) total += dirSize(p);
    else total += statSync(p).size;
  }
  return total;
}
function NAMING_OK(name) {
  return /^[a-z0-9][a-z0-9_.-]*$/.test(name);
}

// ─── Step: env ──────────────────────────────────────────────────────────
// 检查 basisu / gltf-transform / draco_encoder 是否在 PATH

async function stepEnv() {
  step("env — 离线工具版本校验");

  const isWin = process.platform === "win32";

  const tools = [
    { name: "Node.js", check: "node --version", needle: "v", hint: "" },
    { name: "basisu (KTX2)", check: isWin ? "basisu.cmd -version" : "basisu -version", needle: "basis", hint: "npm install -g @gpu-tex-enc/basis" },
    { name: "gltf-transform (Draco)", check: "npx @gltf-transform/cli --version", needle: "4.", hint: "npm install -g @gltf-transform/cli" },
    { name: "sharp (贴图检测)", check: "node -e \"require('sharp')\"", needle: "", hint: "npm install sharp (已在项目依赖中)" },
  ];

  for (const t of tools) {
    try {
      const out = execSync(t.check, { encoding: "utf-8", stdio: "pipe", timeout: 15000 }).toString();
      const line = out.split("\n").find(l => l.toLowerCase().includes(t.needle.toLowerCase())) || out.slice(0, 80);
      ok(`${t.name} — ${line.trim()}`);
    } catch {
      fail(`${t.name} 缺失 — ${t.hint}`);
    }
  }

}

// ─── Step: validate ─────────────────────────────────────────────────────

async function stepValidate() {
  step("validate — 素材合规校验");
  if (!SOURCE || !existsSync(SOURCE)) { fail(`source 目录不存在: ${SOURCE}`); return; }

  const REQUIRED_DIRS = ["models", "textures", "preview", "i18n"];
  const RES_LIMIT = 4096;

  for (const d of REQUIRED_DIRS) {
    if (!existsSync(join(SOURCE, d))) fail(`NV3D_ASST_MISSING_FILE: 必需目录缺失 — ${d}`);
    else ok(`目录存在: ${d}/`);
  }

  // 文件命名
  for (const f of walkDir(SOURCE)) {
    const name = basename(f);
    if (!NAMING_OK(name)) fail(`NV3D_ASST_NAMING: ${relative(SOURCE, f)}`);
  }

  // 贴图分辨率 (sharp)
  let sharp;
  try { sharp = (await import("sharp")).default; } catch { sharp = null; }

  if (sharp) {
    const texExts = [".png", ".webp", ".jpg", ".jpeg"];
    for (const f of walkDir(SOURCE, texExts)) {
      try {
        const meta = await sharp(f).metadata();
        if (meta.width > RES_LIMIT || meta.height > RES_LIMIT) {
          fail(`NV3D_ASST_RESOLUTION: ${relative(SOURCE, f)} — ${meta.width}×${meta.height} 超过 ${RES_LIMIT}`);
        }
      } catch { fail(`NV3D_ASST_MISSING_FILE: ${relative(SOURCE, f)} — 无法读取`); }
    }
    info(`sharp 检测贴图完成`);
  } else {
    warn("贴图分辨率校验跳过（sharp 不可用）");
  }

  // manifest.json 校验
  const mf = join(SOURCE, "manifest.json");
  if (existsSync(mf)) {
    try {
      const d = JSON.parse(readFileSync(mf, "utf-8"));
      for (const f of ["themeId", "formatVersion", "version", "resources", "scenes", "i18n", "renderConfig"]) {
        if (!d[f]) fail(`NV3D_LOAD_MANIFEST_JSON: manifest 缺少必填字段 — ${f}`);
      }
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.themeId || "")) fail(`NV3D_ASST_NAMING: themeId 格式不正确 — ${d.themeId}`);
      ok(`manifest.json 结构校验通过`);
    } catch (e) { fail(`NV3D_LOAD_MANIFEST_JSON: ${e.message}`); }
  } else {
    warn("manifest.json 不存在，跳过 JSON 校验");
  }

  // i18n
  const i18nDir = join(SOURCE, "i18n");
  if (existsSync(i18nDir)) {
    for (const lang of ["zh", "en"]) {
      if (!existsSync(join(i18nDir, `${lang}.json`))) warn(`i18n/${lang}.json 缺失`);
    }
  }

  // .glb 文件大小告警
  for (const f of walkDir(SOURCE, [".glb"])) {
    const mb = statSync(f).size / (1024 * 1024);
    if (mb > 50) warn(`NV3D_ASST_FACE_COUNT: ${relative(SOURCE, f)} 文件过大 (${mb.toFixed(0)}MB)，可能面数超限`);
  }

  if (errors === 0) info(`校验通过 (${warnings > 0 ? warnings + " warnings" : "0 warnings"})`);
  else { info(`${errors} errors, ${warnings} warnings`); stepFailed = true; }
}

// ─── Step: manifest ─────────────────────────────────────────────────────

function stepManifest() {
  step("manifest — 生成 manifest.json");
  if (!SOURCE || !existsSync(SOURCE)) { fail("source 目录不存在"); return; }

  const CATEGORIES = ["models", "textures", "animations", "shaders", "audio", "previews"];
  // manifest key → filesystem directory (previews uses preview/ per spec §17)
  const CATEGORY_DIR = { models: "models", textures: "textures", animations: "animations", shaders: "shaders", audio: "audio", previews: "preview" };
  const resources = {};

  for (const cat of CATEGORIES) {
    const dirName = CATEGORY_DIR[cat] || cat;
    const catDir = join(SOURCE, dirName);
    if (!existsSync(catDir)) continue;
    const entries = {};
    for (const f of walkDir(catDir)) {
      const rel = relative(SOURCE, f).replace(/\\/g, "/");
      const h = sha256File(f);
      const size = statSync(f).size;
      const ext = extname(f).toLowerCase();
      // key = directory_name/basename_no_ext.format to prevent .gltf/.bin collisions
      const parentDir = relative(catDir, dirname(f)).replace(/\\/g, "/");
      const baseNoExt = basename(f).replace(ext, "");
      const suffix = `.${ext.slice(1)}`;
      const key = parentDir ? `${parentDir}/${baseNoExt}${suffix}` : `${baseNoExt}${suffix}`;
      entries[key] = { path: rel, hash: `sha256:${h}`, size, format: ext.slice(1) };
    }
    if (Object.keys(entries).length > 0) resources[cat] = entries;
  }

  // Load template if present
  const tmplPath = join(SOURCE, "manifest.template.json");
  let manifest = {};
  if (existsSync(tmplPath)) {
    manifest = JSON.parse(readFileSync(tmplPath, "utf-8"));
    info(`从 manifest.template.json 加载模板`);
  }

  // i18n
  let i18n = {};
  const i18nDir = join(SOURCE, "i18n");
  if (existsSync(i18nDir)) {
    for (const f of readdirSync(i18nDir)) {
      if (f.endsWith(".json")) {
        const lang = f.replace(".json", "");
        i18n[lang] = JSON.parse(readFileSync(join(i18nDir, f), "utf-8"));
      }
    }
  }

  manifest = {
    "$schema": manifest["$schema"] || "https://scm-think.cn/schemas/nv3d-manifest.json",
    formatVersion: "2.0",
    themeId: manifest.themeId || THEME_ID,
    themeName: manifest.themeName || { zh: THEME_ID, en: THEME_ID },
    themeType: "webgl3d",
    version: VERSION,
    minAppVersion: manifest.minAppVersion || "2.0.0",
    resources,
    scenes: manifest.scenes || [],
    characters: manifest.characters || [],
    props: manifest.props || [],
    interactions: manifest.interactions || [],
    quests: manifest.quests || [],
    i18n,
    renderConfig: manifest.renderConfig || {
      targetFps: 60, adaptiveQuality: true,
      qualityLevels: {
        high: { shadowMapSize: 2048, textureMaxResolution: 4096, antialias: true, postProcessing: true, particleMaxCount: 500 },
        medium: { shadowMapSize: 1024, textureMaxResolution: 2048, antialias: false, postProcessing: true, particleMaxCount: 200 },
        low: { shadowMapSize: 512, textureMaxResolution: 1024, antialias: false, postProcessing: false, particleMaxCount: 50 },
      },
      triangleBudget: 100000, drawCallBudget: 200, textureMemoryBudgetMb: 512,
    },
    requiredWebGLExtensions: manifest.requiredWebGLExtensions || [],
    extensions: manifest.extensions || {},
  };

  const outPath = join(SOURCE, "manifest.json");
  writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf-8");
  const resourceCount = Object.values(resources).reduce((s, v) => s + Object.keys(v).length, 0);
  ok(`${outPath} — ${resourceCount} resources across ${Object.keys(resources).length} categories`);
}

// ─── Step: pack ───────────────────────────────────────────────────────────
// NV3D 二进制格式: MAGIC(4B) + HEADER(64B) + manifest(gzip) + blocks... + FOOTER

const MAGIC = Buffer.from("NV3D");
const BLOCK_RAW = 0, BLOCK_GZIP = 1, BLOCK_STORE = 2;
const BLOCK_TYPE = { ".glb": BLOCK_STORE, ".ktx2": BLOCK_STORE, ".png": BLOCK_STORE,
  ".webp": BLOCK_STORE, ".jpg": BLOCK_STORE, ".jpeg": BLOCK_STORE,
  ".glsl": BLOCK_GZIP, ".json": BLOCK_GZIP, ".ogg": BLOCK_STORE };

function stepPack(sign = false) {
  step("pack — 打包 .nv3d (流式写入)");
  const mfPath = join(SOURCE, "manifest.json");
  if (!existsSync(mfPath)) { fail("manifest.json 不存在"); return; }

  const manifest = JSON.parse(readFileSync(mfPath, "utf-8"));
  const resources = manifest.resources || {};

  // ── Pass 1: scan all files, compute hashes (metadata only) ──────
  const blockMeta = [];
  for (const cat of Object.keys(resources).sort()) {
    const entries = resources[cat];
    if (typeof entries !== "object") continue;
    for (const key of Object.keys(entries).sort()) {
      const entry = entries[key];
      if (!entry.path) continue;
      const fp = join(SOURCE, entry.path);
      if (!existsSync(fp)) { warn(`missing: ${entry.path}`); continue; }
      const ext = extname(fp).toLowerCase();
      const btype = BLOCK_TYPE[ext] ?? BLOCK_RAW;
      const fileSize = statSync(fp).size;
      blockMeta.push({ id: key, path: fp, type: btype, fileSize, ext });
    }
  }

  // Compress manifest
  const manifestJson = JSON.stringify(manifest);
  const manifestGz = gzipSync(Buffer.from(manifestJson, "utf-8"));
  const manifestHash = sha256BufRaw(manifestGz);

  // Flags
  let flags = 0;
  if (manifest.renderConfig?.encrypted || flag("encrypted")) flags |= 0x01;
  if (sign) flags |= 0x02;

  // Header (64 bytes)
  const header = Buffer.alloc(64);
  header.writeUInt16LE(1, 0);
  header.writeUInt16LE(flags, 2);
  header.writeUInt32LE(manifestGz.length, 4);
  manifestHash.copy(header, 8, 0, 32);
  header.writeUInt16LE(blockMeta.length, 40);

  // ── Pass 2: stream-write everything ─────────────────────────
  mkdirSync(dirname(OUTPUT), { recursive: true });
  const outFd = openSync(OUTPUT, "w");

  // Running content hash (MAGIC + header + manifest + all block headers + all block data)
  const contentHash = createHash("sha256");
  contentHash.update(MAGIC);
  contentHash.update(header);
  contentHash.update(manifestGz);

  // Write MAGIC + header + manifest
  writeSync(outFd, MAGIC);
  writeSync(outFd, header);
  writeSync(outFd, manifestGz);

  const CHUNK = 64 * 1024; // 64KB read chunks
  const buf = Buffer.alloc(CHUNK);

  for (const bm of blockMeta) {
    // Read file in chunks, compute hash, write block header + data
    const fFd = openSync(bm.path, "r");
    const blockHash = createHash("sha256");
    let rawSize = 0;

    // First pass: read entire file to compute hash (we need hash before writing block header)
    // Optimisation: for STORE type, we could stream-hash + stream-write if we wrote hash later,
    // but the NV3D format puts hash BEFORE data. So we must compute hash first.
    let rawData;
    try {
      // For files up to ~100MB, it's fine to load into memory.
      // For 1.5GB files, use chunked read + hash, then stream-write.
      if (bm.fileSize > 500 * 1024 * 1024) {
        // Large file: read in chunks, hash data, write to temp
        let bytesRead;
        while ((bytesRead = readSync(fFd, buf, 0, CHUNK, rawSize)) > 0) {
          rawSize += bytesRead;
          blockHash.update(buf.slice(0, bytesRead));
        }
        closeSync(fFd);

        // Write block header
        const bh = blockHash.digest();
        const hdr = Buffer.alloc(37);
        hdr.writeUInt8(bm.type, 0);
        hdr.writeUInt32LE(rawSize, 1);
        bh.copy(hdr, 5, 0, 32);
        writeSync(outFd, hdr);
        contentHash.update(hdr);

        // Stream the file data through
        const rdFd = openSync(bm.path, "r");
        let written = 0, b;
        while ((b = readSync(rdFd, buf, 0, CHUNK, written)) > 0) {
          writeSync(outFd, buf, 0, b);
          contentHash.update(buf.slice(0, b));
          written += b;
        }
        closeSync(rdFd);
        info(`  ${bm.id}: ${(rawSize / (1024*1024)).toFixed(0)}MB (streamed)`);
      } else {
        // Normal file: read into memory
        rawData = readFileSync(bm.path);
        rawSize = rawData.length;
        closeSync(fFd);

        // Compress if needed
        const data = bm.type === BLOCK_GZIP ? gzipSync(rawData) : rawData;
        const hashHex = sha256Buf(data);
        const bh = sha256BufRaw(data);

        // Write block header: type(u8) + size(u32) + hash(32B)
        const hdr = Buffer.alloc(37);
        hdr.writeUInt8(bm.type, 0);
        hdr.writeUInt32LE(data.length, 1);
        Buffer.from(bh).copy(hdr, 5, 0, 32);
        writeSync(outFd, hdr);
        writeSync(outFd, data);
        contentHash.update(hdr);
        contentHash.update(data);
        info(`  ${bm.id}: ${(rawSize / 1024).toFixed(0)}KB → ${(data.length / 1024).toFixed(0)}KB`);
      }
    } catch (e) {
      warn(`无法读取 ${bm.path}: ${e.message}`);
      try { closeSync(fFd); } catch {}
    }
  }

  // ── Footer ──────────────────────────────────────────────────────
  const contentHashHex = contentHash.digest("hex");
  const footer = Buffer.alloc(4 + 32 + 32 + 64 + 4);
  footer.writeUInt32LE(manifestGz.length, 0);
  manifestHash.copy(footer, 4);
  Buffer.from(contentHashHex, "hex").copy(footer, 4 + 32);
  MAGIC.copy(footer, 4 + 32 + 32 + 64);
  writeSync(outFd, footer);
  closeSync(outFd);

  const sizeMb = statSync(OUTPUT).size / (1024 * 1024);
  ok(`${OUTPUT} — ${blockMeta.length} blocks / ${sizeMb.toFixed(1)} MB`);
  info(`content hash: ${contentHashHex}`);
}

// ─── Step: sign ──────────────────────────────────────────────────────────

async function stepSign() {
  step("sign — Ed25519 签名");

  if (!existsSync(OUTPUT)) { fail(`${OUTPUT} 不存在`); return; }
  if (!SIGN_KEY) { fail("需要 --sign-key <私钥路径>"); return; }

  let seed;
  try {
    let raw = readFileSync(SIGN_KEY, "utf-8").trim();
    for (const p of ["0x", "ed25519:", "-----"]) {
      if (raw.toLowerCase().startsWith(p)) raw = raw.split("\n")[0].slice(p.length).trim();
    }
    raw = raw.replace(/[\s-]/g, "");
    if (raw.length !== 64) { fail(`私钥应为 64 hex chars (32 bytes)，实际 ${raw.length} chars`); return; }
    seed = Buffer.from(raw, "hex");
  } catch (e) { fail(`无法读取私钥: ${e.message}`); return; }

  const nv3d = readFileSync(OUTPUT);
  if (!nv3d.slice(0, 4).equals(MAGIC)) { fail("不是有效的 NV3D 文件"); return; }

  // Find footer (last MAGIC occurrence minus 132 bytes of footer fields)
  const lastMagic = nv3d.lastIndexOf(MAGIC);
  if (lastMagic < 0) { fail("footer magic 未找到"); return; }
  const sigOffset = lastMagic - 64;  // signature is 64 bytes before tail MAGIC
  const contentToSign = nv3d.slice(0, sigOffset);

  // Node 22 Web Crypto Ed25519
  const key = await crypto.subtle.importKey("raw", seed, { name: "Ed25519" }, false, ["sign"]);
  const sig = Buffer.from(await crypto.subtle.sign("Ed25519", key, contentToSign));

  // Write signature + set flags
  nv3d.set(sig, sigOffset);
  const flags = nv3d.readUInt16LE(4);
  nv3d.writeUInt16LE(flags | 0x02, 4);
  writeFileSync(OUTPUT, nv3d);

  ok(`已签名: ${OUTPUT}`);
  info(`signature: ${sig.toString("hex")}`);
  info(`flags: 0x${(flags | 0x02).toString(16).padStart(4, "0")} (signed)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  if (!SOURCE) { console.error("Usage: node pipeline.mjs --source <dir> [--theme-id <id>] [--steps env,validate,manifest,pack,sign] [--sign-key <path>]"); process.exit(1); }

  const available = { env: stepEnv, validate: stepValidate, manifest: stepManifest, pack() { stepPack(stepNames.includes("sign")); }, sign: stepSign };

  console.log(`╔${"═".repeat(58)}╗`);
  console.log(`║  NV3D Theme Pipeline (Node.js)${" ".repeat(29)}║`);
  console.log(`║  Source:  ${(SOURCE || "").slice(-42).padStart(42)}  ║`);
  console.log(`║  Theme:   ${THEME_ID.padEnd(42)}  ║`);
  console.log(`║  Version: ${VERSION.padEnd(42)}  ║`);
  console.log(`║  Output:  ${OUTPUT.slice(-42).padStart(42)}  ║`);
  if (DRY_RUN) console.log(`║  DRY RUN${" ".repeat(51)}║`);
  console.log(`╚${"═".repeat(58)}╝`);

  for (const name of stepNames) {
    if (!available[name]) { console.error(`Unknown step: ${name}. Available: ${Object.keys(available).join(", ")}`); process.exit(1); }
    errors = 0;
    await available[name]();
    if (errors > 0 && !CI) { console.error(`\n  Step "${name}" had ${errors} error(s). Stopping.`); process.exit(1); }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  All ${stepNames.length} steps completed.`);
}

main().catch(e => { console.error(e); process.exit(1); });
