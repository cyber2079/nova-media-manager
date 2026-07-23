#!/usr/bin/env node
/**
 * 主题打包: 本地构建 .nvtp → 上传 ECS CDN
 *
 * 用法: node scripts/theme-pack.mjs <theme-id>
 *
 * 流程:
 *   1. 读取 D:\nova-proprietary\themes\<id>\manifest.json
 *   2. 本地构建 .nvtp (ZIP + XOR 加密)
 *   3. 输出 .nvtp 到本地 dist/
 *   4. scp 到 ECS /var/www/themes/nvtp/
 *   5. 更新 manifest.status = "packaged"
 */

import { readFileSync, existsSync, writeFileSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const API = "https://scm-think.cn";
const ECS = "root@39.104.55.38";
const HOME = process.env.USERPROFILE || "C:\\Users\\melody";
const SSH_KEY = `${HOME}/.ssh/ecs_nova`; // Escape for Windows paths
const PROJ = "D:\\nova-proprietary\\themes";
const ASSETS = "D:\\nova-media-manager\\public\\themes";
const OUT = join(process.cwd(), "dist");
const MASTER_SEED = Buffer.from("NVTP_2026_KX9mP2vL7qR4wN8");

const args = process.argv.slice(2);
const themeId = args[0];
if (!themeId) { console.error("用法: node scripts/theme-pack.mjs <theme-id>"); process.exit(1); }

// ── ID → 素材目录 ──
const DIR_MAP = { "ice-girl": "ice girl", "cyber-girl": "cyber girl" };
const assetsDir = join(ASSETS, DIR_MAP[themeId] || themeId);
if (!existsSync(assetsDir)) { console.error(`❌ 素材目录不存在: ${assetsDir}`); process.exit(1); }

// ── 读取 manifest ──
const manifestPath = join(PROJ, themeId, "manifest.json");
if (!existsSync(manifestPath)) { console.error(`❌ ${manifestPath} 不存在`); process.exit(1); }
const m = JSON.parse(readFileSync(manifestPath, "utf-8"));
console.log(`\n📦 ${m.name} v${m.version}`);

// ── 校验/生成 theme.json ──
const themeJsonPath = join(PROJ, themeId, "theme.json");
let themeTokens = null;
if (existsSync(themeJsonPath)) {
  themeTokens = JSON.parse(readFileSync(themeJsonPath, "utf-8"));
  console.log(`🎨 theme.json 已就绪 (${Object.keys(themeTokens).length} 个分类)`);
} else {
  // 自动生成最小 theme.json — 只覆盖颜色 + 字体
  themeTokens = {
    global: { fontFamily: m.config?.fontDisplay ? `"${m.config.fontDisplay}", system-ui, sans-serif` : undefined },
    colors: m.config?.accent ? { primary: m.config.accent } : {},
  };
  // 清理 undefined 值
  const clean = (obj) => { for (const k of Object.keys(obj)) { if (obj[k] === undefined || (typeof obj[k] === 'object' && Object.keys(obj[k]).length === 0)) delete obj[k]; else if (typeof obj[k] === 'object') clean(obj[k]); } };
  clean(themeTokens);
  writeFileSync(themeJsonPath, JSON.stringify(themeTokens, null, 2) + "\n", "utf-8");
  console.log(`⚠️ 自动生成 theme.json (请手动完善!)`);
}

// ── 收集文件 ──
function collect(dir, files, prefix = "") {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) collect(join(dir, e.name), files, prefix ? `${prefix}/${e.name}` : e.name);
    else files.push({ path: prefix ? `${prefix}/${e.name}` : e.name, abs: join(dir, e.name), size: statSync(join(dir, e.name)).size });
  }
}
const files = [];
collect(join(PROJ, themeId), files);
collect(assetsDir, files);

// 确保 theme.json 在文件列表中 (可能刚生成)
if (!files.find(f => f.path === "theme.json")) {
  files.push({ path: "theme.json", abs: themeJsonPath, size: statSync(themeJsonPath).size });
}
console.log(`📁 ${files.length} 个文件`);

// ── 构建 .nvtp ──
console.log("🔧 构建 .nvtp ...");

// 1. ZIP
const AdmZip = require("adm-zip");
const zip = new AdmZip();
for (const f of files) zip.addLocalFile(f.abs, "", f.path);
const zipBuf = zip.toBuffer();

// 2. XOR 加密
const baseKey = createHash("sha256").update(MASTER_SEED).update(themeId).digest();
const hash = createHash("sha256").update(zipBuf).digest();
const blocks = Math.ceil(zipBuf.length / 32);
const keystream = Buffer.alloc(blocks * 32);
for (let i = 0; i < blocks; i++) {
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64LE(BigInt(i));
  createHash("sha256").update(baseKey).update(ctr).digest().copy(keystream, i * 32);
}
const enc = Buffer.alloc(zipBuf.length);
for (let i = 0; i < zipBuf.length; i++) enc[i] = zipBuf[i] ^ keystream[i];
const body = Buffer.concat([hash, enc]);

// 3. .nvtp binary layout
const mid = Buffer.from(themeId, "utf-8");
const mj = Buffer.from(JSON.stringify({
  name: m.name, author: m.author || "Nova", version: m.version || "1.0.0",
  requiresLicense: m.requiresLicense || "pro", preview: m.preview || "preview.webp",
  cssFile: m.cssFile || "theme.css", files: files.map(f => ({ path: f.path, size: f.size })),
  config: m.config || {},
}), "utf-8");

const buf = Buffer.alloc(10 + 2 + mid.length + 4 + mj.length + 8 + body.length);
let off = 0;
buf.write("NVTP", off, 4); off += 4;
buf.writeUInt16LE(1, off); off += 2;
buf.writeUInt16LE(0, off); off += 2;
buf.writeUInt16LE(mid.length, off); off += 2;
mid.copy(buf, off); off += mid.length;
buf.writeUInt32LE(mj.length, off); off += 4;
mj.copy(buf, off); off += mj.length;
buf.writeBigUInt64LE(BigInt(body.length), off); off += 8;
body.copy(buf, off);

// 4. 输出
mkdirSync(OUT, { recursive: true });
const outPath = join(OUT, `${themeId}.nvtp`);
writeFileSync(outPath, buf);
const sizeMB = (buf.length / 1024 / 1024).toFixed(1);
console.log(`✅ ${outPath} (${sizeMB} MB)`);

// ── 上传到 ECS ──
console.log("\n📤 上传到 ECS ...");
execSync(`scp -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${outPath}" ${ECS}:"/var/www/themes/nvtp/${themeId}.nvtp"`, {
  encoding: "utf-8", timeout: 120000, stdio: "inherit",
});

// ── 更新 manifest ──
m.status = "packaged";
m.lastPackaged = new Date().toISOString();
writeFileSync(manifestPath, JSON.stringify(m, null, 2) + "\n", "utf-8");

// ── 验证 ──
try {
  const list = JSON.parse(execSync(`curl -s "${API}/api/themes/list"`, { encoding: "utf-8", timeout: 10000 }));
  const e = list.find(t => t.id === themeId);
  if (e?.file_size > 0) console.log(`✅ 主题列表已更新: ${(e.file_size / 1024 / 1024).toFixed(1)} MB`);
  else console.log("⚠️ file_size 未更新");
} catch { console.log("⚠️ 无法验证"); }

console.log("✨ 完成!\n");
