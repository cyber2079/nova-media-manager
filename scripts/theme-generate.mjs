#!/usr/bin/env node
/**
 * 主题素材批量生成
 *
 * 用法:
 *   node scripts/theme-generate.mjs <theme-id> [--scene <key>] [--dry-run]
 *
 * 示例:
 *   node scripts/theme-generate.mjs cyber-girl                           # 生成所有 pending 场景
 *   node scripts/theme-generate.mjs cyber-girl --scene scene6           # 只生成指定场景
 *   node scripts/theme-generate.mjs cyber-girl --dry-run                # 预览但不执行
 *
 * 先决条件:
 *   环境变量 ARK_API_KEY 或 JIMENG_SESSION_ID
 *   素材输出目录 D:\nova-themes-assets\<theme-id>\ 需存在
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join, dirname } from "path";
import { execSync } from "child_process";

const THEMES_DIR = "D:\\nova-proprietary\\themes";
const ASSETS_DIR = "D:\\nova-themes-assets";

// ── 命令行参数 ──

const [,, themeId, ...args] = process.argv;
if (!themeId) { console.error("用法: node scripts/theme-generate.mjs <theme-id> [--scene <key>] [--dry-run]"); process.exit(1); }

const dryRun = args.includes("--dry-run");
const sceneIdx = args.indexOf("--scene");
const targetScene = sceneIdx >= 0 ? args[sceneIdx + 1] : null;

// ── 读取 manifest ──

const projDir = join(THEMES_DIR, themeId);
const manifestPath = join(projDir, "manifest.json");
if (!existsSync(manifestPath)) { console.error(`主题项目不存在: ${manifestPath}`); process.exit(1); }

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const promptsPath = join(projDir, "prompts.json");
const prompts = existsSync(promptsPath) ? JSON.parse(readFileSync(promptsPath, "utf-8")) : null;
if (!prompts) { console.error(`prompts.json 不存在: ${promptsPath}`); process.exit(1); }

// ── 筛选待生成场景 ──

const scenes = manifest.scenes || [];
const pending = targetScene
  ? scenes.filter(s => s.promptKey === targetScene)
  : scenes.filter(s => s.status !== "done" && s.status !== "skip");

if (pending.length === 0) {
  console.log("没有待生成的场景。");
  process.exit(0);
}

console.log(`\n📦 主题: ${manifest.name} (${manifest.id})`);
console.log(`🎯 待生成: ${pending.length} 个场景`);
if (dryRun) console.log("🧪 DRY RUN — 不会实际调用 API\n");

// ── 输出目录 ──

const assetDir = join(ASSETS_DIR, themeId);
if (!dryRun && !existsSync(assetDir)) mkdirSync(assetDir, { recursive: true });

// ── 生成 ──

for (const scene of pending) {
  const pk = scene.promptKey || scene.id;
  const cfg = prompts.scenes?.[pk];
  if (!cfg) { console.log(`  ⚠️  场景 "${pk}" 在 prompts.json 中无配置，跳过`); continue; }

  const model = cfg.model || prompts.model;
  const global = prompts.global || {};
  const prompt = cfg.prompt;

  console.log(`\n──────────────────────────────────`);
  console.log(`  🎬 ${pk}: ${scene.description || cfg.prompt?.slice(0, 60) + "..."}`);
  console.log(`  📐 ${model} · ${cfg.type} · ${global.ratio}`);

  if (dryRun) {
    console.log(`  📝 prompt: ${prompt.slice(0, 100)}...`);
    continue;
  }

  // 确定输出路径
  const ext = cfg.type === "video" ? "mp4" : "webp";
  const outPath = join(assetDir, `${pk}.${ext}`);

  try {
    if (cfg.type === "video") {
      generateVideo(model, prompt, outPath, cfg.duration || 5, global.ratio);
    } else {
      generateImage(model, prompt, outPath, global.ratio, global.negativePrompt);
    }

    // 更新 manifest
    scene.status = "done";
    scene.assetPath = outPath;
    console.log(`  ✅ 完成 → ${outPath}`);
  } catch (err) {
    console.error(`  ❌ 失败: ${err.message}`);
    scene.status = "generating";
  }
}

// ── 保存 manifest ──

if (!dryRun) {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`\n📄 manifest.json 已更新\n`);
}

// ═══════════════════ 生成函数 ═══════════════════

function generateImage(model, prompt, outPath, ratio, negativePrompt) {
  // 优先用 doubao-ai-toolkit CLI
  const apiKey = process.env.ARK_API_KEY;
  if (apiKey) {
    const cmd = `npx coze-coding-ai image -p ${JSON.stringify(prompt)} -m ${model} -o "${outPath}"`;
    execSync(cmd, { stdio: "inherit", env: { ...process.env, ARK_API_KEY: apiKey } });
    return;
  }

  // 回退: jimeng-free-api (本地 Docker)
  const sessionId = process.env.JIMENG_SESSION_ID;
  if (sessionId) {
    const body = { model, prompt, ratio: ratio || "16:9", resolution: "2k" };
    if (negativePrompt) body.negative_prompt = negativePrompt;
    const cmd = `curl -s -X POST http://localhost:8000/v1/images/generations -H "Content-Type: application/json" -H "Authorization: Bearer ${sessionId}" -d ${JSON.stringify(JSON.stringify(body))}`;
    execSync(cmd, { stdio: "inherit" });
    return;
  }

  throw new Error("需要 ARK_API_KEY 或 JIMENG_SESSION_ID 环境变量");
}

function generateVideo(model, prompt, outPath, duration, ratio) {
  const apiKey = process.env.ARK_API_KEY;
  if (apiKey) {
    const durFlag = duration ? ` -d ${duration}` : "";
    const cmd = `npx coze-coding-ai video -p ${JSON.stringify(prompt)} -m ${model} -o "${outPath}"${durFlag}`;
    execSync(cmd, { stdio: "inherit", env: { ...process.env, ARK_API_KEY: apiKey } });
    return;
  }

  throw new Error("视频生成需要 ARK_API_KEY");
}
