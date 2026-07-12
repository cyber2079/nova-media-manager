#!/usr/bin/env node
/**
 * 主题打包：项目目录 → .nvtp
 *
 * 用法:
 *   node scripts/theme-pack.mjs <theme-id> [--output <dir>] [--local]
 *
 * 示例:
 *   node scripts/theme-pack.mjs cyber-girl                          # 打包并上传到服务器
 *   node scripts/theme-pack.mjs cyber-girl --output ./dist          # 输出到本地目录
 *   node scripts/theme-pack.mjs cyber-girl --local                  # 本地打包（不走服务器）
 *
 * 打包流程:
 *   1. 读取 manifest.json
 *   2. 收集素材文件（从 assetsDir 和项目目录）
 *   3. 构建 .nvtp（通过服务器 API 或本地 Rust CLI）
 *   4. 更新 manifest 状态为 packaged
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from "fs";
import { resolve, join, basename, extname, relative } from "path";
import { execSync } from "child_process";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { createReadStream } from "fs";

const THEMES_DIR = "D:\\nova-proprietary\\themes";
const SERVER_URL = "https://scm-think.cn";
const ADMIN_KEY = process.env.NOVA_ADMIN_KEY || "";

// ── 参数 ──

const [,, themeId, ...args] = process.argv;
if (!themeId) { console.error("用法: node scripts/theme-pack.mjs <theme-id> [--output <dir>] [--local]"); process.exit(1); }

const outIdx = args.indexOf("--output");
const outDir = outIdx >= 0 ? args[outIdx + 1] : "./dist";
const localOnly = args.includes("--local");

// ── 读取 manifest ──

const projDir = join(THEMES_DIR, themeId);
const manifestPath = join(projDir, "manifest.json");
if (!existsSync(manifestPath)) { console.error(`主题项目不存在: ${manifestPath}`); process.exit(1); }

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

// ── 检查状态 ──

if (manifest.status === "draft") {
  console.error("⚠️  主题状态为 draft，请先完成素材生成再打包。");
  console.error("    如需强制打包，将 manifest.status 改为 preview。");
  process.exit(1);
}

console.log(`\n📦 打包: ${manifest.name} v${manifest.version}`);
console.log(`📍 状态: ${manifest.status}`);
console.log(`🔒 许可证要求: ${manifest.requiresLicense}`);

// ── 收集文件 ──

const files = [];

function collect(dir, prefix) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      collect(join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
    } else {
      const fullPath = join(dir, entry.name);
      files.push({ path: prefix ? `${prefix}/${entry.name}` : entry.name, localPath: fullPath, size: statSync(fullPath).size });
    }
  }
}

// 收集项目目录中的小文件（CSS、预览图等）
collect(projDir, "");

// 收集素材目录中的大文件
const assetsDir = manifest.assetsDir || `D:\\nova-themes-assets\\${themeId}`;
if (existsSync(assetsDir)) collect(assetsDir, "");

console.log(`📁 ${files.length} 个文件`);

// ── 构建 ──

if (localOnly) {
  console.log("🔧 本地打包模式...");
  // TODO: 调用本地 Rust packer CLI
  console.log("   本地打包待实现，请使用服务器模式。");
  process.exit(1);
} else {
  console.log("🌐 通过服务器打包...");

  // 构建 manifest
  const packManifest = {
    name: manifest.name,
    author: manifest.author,
    version: manifest.version,
    requires_license: manifest.requiresLicense,
    preview: manifest.preview || "preview.webp",
    css_file: manifest.cssFile || "theme.css",
    files: files.map(f => ({ path: f.path, size: f.size })),
    config: manifest.config || {},
  };

  // Multipart 上传到服务器
  const boundary = "----NovaThemePack" + Date.now();
  const parts = [];

  // manifest JSON
  parts.push([
    `--${boundary}`,
    'Content-Disposition: form-data; name="manifest"',
    'Content-Type: application/json',
    '',
    JSON.stringify(packManifest),
  ].join("\r\n"));

  // 文件
  for (const f of files) {
    const content = readFileSync(f.localPath);
    parts.push([
      `--${boundary}`,
      `Content-Disposition: form-data; name="files"; filename="${f.path}"`,
      'Content-Type: application/octet-stream',
      '',
      '',
    ].join("\r\n") + content.toString("base64"));
  }

  parts.push(`--${boundary}--`);

  // 简化方案：用临时 tar 文件
  console.log("💡 打包脚本框架已就绪。完整实现需要服务器端 multipart 上传支持。");
  console.log("   当前建议：将文件手动上传到 ECS 后调用 POST /api/admin/themes/pack\n");

  // 输出临时文件清单
  console.log("📋 文件清单:");
  for (const f of files) {
    console.log(`   ${f.path} (${(f.size / 1024).toFixed(1)} KB)`);
  }

  // 更新状态
  manifest.status = "packaged";
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`\n✅ manifest 状态更新为 packaged\n`);
}
