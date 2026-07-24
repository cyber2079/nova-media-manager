#!/usr/bin/env node
/**
 * Cyber Grid theme builder — assembles blueprint theme .nvtp
 * Usage: node scripts/build-cyber-grid.mjs
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, cpSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const PROJ = "D:\\nova-proprietary\\themes\\cyber-grid";
const OUT = join(process.cwd(), "dist");
const MASTER_SEED = Buffer.from("NVTP_2026_KX9mP2vL7qR4wN8");
const themeId = "cyber-grid";

// ── Validate prerequisites ──
const manifestPath = join(PROJ, "manifest.json");
const themeJsonPath = join(PROJ, "theme.json");
if (!existsSync(manifestPath)) { console.error(`❌ ${manifestPath} not found`); process.exit(1); }
if (!existsSync(themeJsonPath)) { console.error(`❌ ${themeJsonPath} not found`); process.exit(1); }

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const themeTokens = JSON.parse(readFileSync(themeJsonPath, "utf-8"));
console.log(`\n📦 ${manifest.name} v${manifest.version}`);
console.log(`🎨 theme.json: ${Object.keys(themeTokens).length} categories`);

// ── Build file list ──
const files = [];

// 1. manifest + theme.json + theme.css from PROJ
files.push({ path: "manifest.json", abs: manifestPath, size: readFileSync(manifestPath).length });
files.push({ path: "theme.json", abs: themeJsonPath, size: readFileSync(themeJsonPath).length });
const themeCssPath = join(PROJ, "theme.css");
if (existsSync(themeCssPath)) {
  files.push({ path: "theme.css", abs: themeCssPath, size: readFileSync(themeCssPath).length });
  const publicThemeDir = join(process.cwd(), "public", "themes", "cyber-grid");
  mkdirSync(publicThemeDir, { recursive: true });
  cpSync(themeCssPath, join(publicThemeDir, "theme.css"));
  console.log("🎨 theme.css");
}

// 2. Copy theme.json to public/ for dev (needed by Rust fallback)
const publicThemeDir = join(process.cwd(), "public", "themes", "cyber-grid");
mkdirSync(publicThemeDir, { recursive: true });
cpSync(themeJsonPath, join(publicThemeDir, "theme.json"));
console.log("📋 theme.json → public/");

// 3. Preview — generate placeholder with blueprint colors
const previewPath = join(OUT, "preview.webp");
try {
  const sharp = require("sharp");
  const primaryColor = themeTokens.colors?.primary || "#00e5ff";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
<defs>
  <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:#060d18"/>
    <stop offset="100%" style="stop-color:#030810"/>
  </linearGradient>
  <filter id="glow">
    <feGaussianBlur stdDeviation="4" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<rect width="960" height="540" fill="url(#bg)"/>
<!-- Grid lines -->
<line x1="0" y1="180" x2="960" y2="180" stroke="${primaryColor}" stroke-width="0.5" opacity="0.15"/>
<line x1="0" y1="360" x2="960" y2="360" stroke="${primaryColor}" stroke-width="0.5" opacity="0.15"/>
<line x1="320" y1="0" x2="320" y2="540" stroke="${primaryColor}" stroke-width="0.5" opacity="0.15"/>
<line x1="640" y1="0" x2="640" y2="540" stroke="${primaryColor}" stroke-width="0.5" opacity="0.15"/>
<!-- Bento cards -->
<rect x="40" y="200" width="400" height="160" rx="2" fill="${primaryColor}" opacity="0.06" stroke="${primaryColor}" stroke-width="1"/>
<rect x="460" y="200" width="220" height="160" rx="2" fill="${primaryColor}" opacity="0.04" stroke="${primaryColor}" stroke-width="0.8"/>
<rect x="700" y="200" width="220" height="160" rx="2" fill="${primaryColor}" opacity="0.04" stroke="${primaryColor}" stroke-width="0.8"/>
<rect x="40" y="380" width="880" height="120" rx="2" fill="${primaryColor}" opacity="0.03" stroke="${primaryColor}" stroke-width="0.8"/>
<!-- Corner brackets -->
<path d="M40 220 L40 200 L60 200" stroke="${primaryColor}" stroke-width="2" fill="none" opacity="0.8"/>
<path d="M440 220 L440 200 L420 200" stroke="${primaryColor}" stroke-width="2" fill="none" opacity="0.8"/>
<!-- Title -->
<text x="480" y="80" text-anchor="middle" font-family="monospace, sans-serif" font-size="42" font-weight="700" fill="${primaryColor}" filter="url(#glow)">CYBER GRID</text>
<text x="480" y="120" text-anchor="middle" font-family="monospace, sans-serif" font-size="16" fill="${primaryColor}" opacity="0.6" letter-spacing="0.2em">SYSTEM SCHEMATICS</text>
</svg>`;
  const previewBuf = await sharp(Buffer.from(svg)).resize(960, 540).webp({ quality: 90 }).toBuffer();
  writeFileSync(previewPath, previewBuf);
  files.push({ path: "preview.webp", abs: previewPath, size: previewBuf.length });
  // Also copy to public
  cpSync(previewPath, join(publicThemeDir, "preview.webp"));
  console.log("🖼️  preview.webp");
} catch (e) {
  console.warn("⚠️  sharp not available, skipping preview:", e.message);
}

// ── Build .nvtp ──
console.log(`\n📁 ${files.length} files → packaging .nvtp ...`);

// 1. ZIP
const AdmZip = require("adm-zip");
const zip = new AdmZip();
for (const f of files) {
  if (!existsSync(f.abs)) { console.warn(`⚠️  skipping missing: ${f.abs}`); continue; }
  zip.addLocalFile(f.abs, "", f.path);
}
const zipBuf = zip.toBuffer();
console.log(`  ZIP: ${(zipBuf.length / 1024).toFixed(1)} KB`);

// 2. XOR encrypt
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
  requiresLicense: manifest.requiresLicense || "member",
  preview: "preview.webp",
  cssFile: "theme.css",
  files: files.map(f => ({ path: f.path, size: f.size })),
  config: { accent: themeTokens.colors?.primary },
}), "utf-8");

const headerLen = 4 + 2 + 2 + 2 + mid.length + 4 + mj.length + 8;
const header = Buffer.alloc(headerLen);
let hp = 0;
header.write("NVTP", hp, 4); hp += 4;
header.writeUInt16LE(1, hp); hp += 2;
header.writeUInt16LE(0, hp); hp += 2;
header.writeUInt16LE(mid.length, hp); hp += 2;
mid.copy(header, hp); hp += mid.length;
header.writeUInt32LE(mj.length, hp); hp += 4;
mj.copy(header, hp); hp += mj.length;
header.writeBigUInt64LE(BigInt(body.length), hp);

const buf = Buffer.concat([header, body]);

// 4. Output
mkdirSync(OUT, { recursive: true });
const outPath = join(OUT, `${themeId}.nvtp`);
writeFileSync(outPath, buf);
const sizeMB = (buf.length / 1024 / 1024).toFixed(1);
console.log(`\n✅ ${outPath} (${sizeMB} MB)`);

// 5. Content listing
console.log("\n📋 .nvtp contents:");
for (const f of files) {
  console.log(`  ${f.path}  (${(f.size / 1024).toFixed(1)} KB)`);
}
console.log("✨ Done!\n");
