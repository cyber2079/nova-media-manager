#!/usr/bin/env node
/**
 * Cyberpunk theme builder — assembles assets and builds .nvtp
 * Usage: node scripts/build-cyberpunk.mjs
 */

import { readFileSync, existsSync, writeFileSync, readdirSync, statSync, mkdirSync, cpSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const PROJ = "D:\\nova-proprietary\\themes\\cyberpunk";
const ASSETS = "D:\\nova-themes-assets\\cyberpunk";
const SOUNDS = "D:\\nova-themes-assets\\cyberpunk\\react-sounds-master\\sounds";
const OUT = join(process.cwd(), "dist");
const MASTER_SEED = Buffer.from("NVTP_2026_KX9mP2vL7qR4wN8");
const themeId = "cyberpunk";

// ── SFX mapping ──
const SFX_MAP = {
  "sfx-hover":              "ui/button_soft.mp3",
  "sfx-click":              "ui/button_medium.mp3",
  "sfx-menu-open":          "ui/panel_expand.mp3",
  "sfx-menu-close":         "ui/panel_collapse.mp3",
  "sfx-dialog-open":        "ui/window_open.mp3",
  "sfx-dialog-close":       "ui/window_close.mp3",
  "sfx-notification":       "notification/notification.mp3",
  "sfx-transition":         "ui/success_chime.mp3",
  "sfx-startup":            "system/boot_up.mp3",
  "sfx-countdown-alert":    "notification/warning.mp3",
  "sfx-countdown-tick":     "ui/toggle_on.mp3",
};

// ── Validate prerequisites ──
const manifestPath = join(PROJ, "manifest.json");
const themeJsonPath = join(PROJ, "theme.json");
if (!existsSync(manifestPath)) { console.error(`❌ ${manifestPath} 不存在`); process.exit(1); }
if (!existsSync(themeJsonPath)) { console.error(`❌ ${themeJsonPath} 不存在`); process.exit(1); }

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const themeTokens = JSON.parse(readFileSync(themeJsonPath, "utf-8"));
console.log(`\n📦 ${manifest.name} v${manifest.version}`);
console.log(`🎨 theme.json: ${Object.keys(themeTokens).length} 个分类`);

// ── Build file list ──
const files = [];

// 1. manifest + theme.json from PROJ
files.push({ path: "manifest.json", abs: manifestPath, size: statSync(manifestPath).size });
files.push({ path: "theme.json", abs: themeJsonPath, size: statSync(themeJsonPath).size });

// 2. Nav icons
const iconsDir = join(ASSETS, "nav-icons");
if (existsSync(iconsDir)) {
  for (const f of readdirSync(iconsDir, { withFileTypes: true })) {
    if (f.isFile() && f.name.endsWith(".webp")) {
      const abs = join(iconsDir, f.name);
      files.push({ path: `icons/${f.name}`, abs, size: statSync(abs).size });
    }
  }
}
console.log(`🔷 导航图标: ${files.filter(f => f.path.startsWith("icons/")).length} 个`);

// 3. SFX
const tempAudioDir = join(ASSETS, "temp-audio");
mkdirSync(tempAudioDir, { recursive: true });

let sfxCount = 0;
for (const [sfxName, srcPath] of Object.entries(SFX_MAP)) {
  const src = join(SOUNDS, srcPath);
  const dest = join(tempAudioDir, sfxName + ".mp3");
  if (existsSync(src)) {
    cpSync(src, dest);
    files.push({ path: `audio/${sfxName}.mp3`, abs: dest, size: statSync(dest).size });
    sfxCount++;
  } else {
    console.warn(`⚠️ SFX 缺失: ${srcPath}`);
  }
}
console.log(`🔊 音效: ${sfxCount}/11 个`);

// 4. Preview — generate a simple placeholder using the theme's neon colors
const previewPath = join(tempAudioDir, "..", "preview.webp");
if (!existsSync(previewPath)) {
  // Generate preview using sharp
  try {
    const sharp = require("sharp");
    const primaryColor = themeTokens.colors?.primary || "#ff005d";
    const accentColor = themeTokens.colors?.accent || "#00fff9";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#0d0d1a"/>
    </linearGradient>
    <linearGradient id="title" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${accentColor}"/>
      <stop offset="100%" style="stop-color:${primaryColor}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="960" height="540" fill="url(#bg)"/>
  <rect x="40" y="280" width="200" height="60" rx="8" fill="${primaryColor}" opacity="0.15" stroke="${primaryColor}" stroke-width="1"/>
  <rect x="260" y="280" width="200" height="60" rx="8" fill="${accentColor}" opacity="0.08" stroke="${accentColor}" stroke-width="0.5"/>
  <rect x="480" y="280" width="200" height="60" rx="8" fill="${accentColor}" opacity="0.08" stroke="${accentColor}" stroke-width="0.5"/>
  <rect x="40" y="360" width="880" height="140" rx="8" fill="${primaryColor}" opacity="0.05" stroke="${primaryColor}" stroke-width="0.5"/>
  <text x="480" y="100" text-anchor="middle" font-family="Rajdhani, sans-serif" font-size="48" font-weight="700" fill="url(#title)" filter="url(#glow)">${manifest.name}</text>
  <text x="480" y="140" text-anchor="middle" font-family="Rajdhani, sans-serif" font-size="18" fill="#8888aa">Nova Media Manager Theme</text>
</svg>`;
    const previewBuf = await sharp(Buffer.from(svg)).resize(960, 540).webp({ quality: 90 }).toBuffer();
    writeFileSync(previewPath, previewBuf);
    files.push({ path: "preview.webp", abs: previewPath, size: previewBuf.length });
    console.log("🖼️ 生成预览图");
  } catch (e) {
    console.warn("⚠️ sharp 不可用，跳过预览图生成:", e.message);
  }
}

// ── Build .nvtp ──
console.log(`\n📁 ${files.length} 个文件 → 打包 .nvtp ...`);

// 1. ZIP
const AdmZip = require("adm-zip");
const zip = new AdmZip();
for (const f of files) {
  if (!existsSync(f.abs)) { console.warn(`⚠️ 跳过缺失: ${f.abs}`); continue; }
  zip.addLocalFile(f.abs, "", f.path);
}
const zipBuf = zip.toBuffer();
console.log(`  ZIP: ${(zipBuf.length / 1024).toFixed(1)} KB`);

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
  name: manifest.name, author: manifest.author || "Nova", version: manifest.version,
  requires_license: manifest.requiresLicense || "member",
  preview: "preview.webp",
  css_file: "theme.css",
  files: files.map(f => ({ path: f.path, size: f.size })),
  config: { accent: themeTokens.colors?.primary },
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
console.log(`\n✅ ${outPath} (${sizeMB} MB)`);

// 5. 内容清单
console.log("\n📋 .nvtp 内容:");
for (const f of files) {
  console.log(`  ${f.path}  (${(f.size / 1024).toFixed(1)} KB)`);
}
console.log("✨ 完成!\n");
