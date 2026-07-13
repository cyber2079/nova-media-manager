#!/usr/bin/env node
/**
 * 主题素材批量生成 — 火山引擎 Ark API
 *
 * 用法:
 *   node scripts/theme-generate.mjs <theme-id>              # 生成所有 pending 场景
 *   node scripts/theme-generate.mjs <theme-id> --dry-run    # 预览不执行
 *   node scripts/theme-generate.mjs <theme-id> --faces      # 只生成表情 (dynamic 型)
 *   node scripts/theme-generate.mjs <theme-id> --scene <key> # 只生成指定场景
 *
 * 先决条件:
 *   ARK_API_KEY        火山引擎 Ark API Key (必填)
 *   素材输出目录 D:\nova-themes-assets\<theme-id>\ 自动创建
 *
 * 定价参考:
 *   即梦 5.0 Lite 图片: ~¥0.02/张 (2K)
 *   Seedance 1.0 Pro 视频: ~¥1/秒
 *   每月 500 张图 ≈ ¥10，日常开发开销可控
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, createWriteStream } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { createReadStream } from "fs";

const ARK = "https://ark.cn-beijing.volces.com/api/v3";
const THEMES_DIR = "D:\\nova-proprietary\\themes";
const ASSETS_DIR = "D:\\nova-themes-assets";
const API_KEY = process.env.ARK_API_KEY;
const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 3000;

if (!API_KEY) {
  console.error("❌ 缺少 ARK_API_KEY 环境变量");
  console.error("   获取方式: https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey");
  process.exit(1);
}

// ═══════════════ CLI ═══════════════

const [,, themeId, ...args] = process.argv;
if (!themeId) { console.error("用法: node scripts/theme-generate.mjs <theme-id> [--dry-run] [--scene <key>] [--faces]"); process.exit(1); }

const dryRun = args.includes("--dry-run");
const sceneIdx = args.indexOf("--scene");
const targetScene = sceneIdx >= 0 ? args[sceneIdx + 1] : null;
const facesOnly = args.includes("--faces");

// ═══════════════ 读取 manifest ──

const projDir = join(THEMES_DIR, themeId);
const manifestPath = join(projDir, "manifest.json");
if (!existsSync(manifestPath)) { console.error(`❌ 主题项目不存在: ${manifestPath}`); process.exit(1); }
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

const promptsPath = join(projDir, "prompts.json");
if (!existsSync(promptsPath)) { console.error(`❌ prompts.json 不存在: ${promptsPath}`); process.exit(1); }
const prompts = JSON.parse(readFileSync(promptsPath, "utf-8"));

const themeType = manifest.type || prompts.type || "static";
const assetDir = join(ASSETS_DIR, themeId);
if (!dryRun) mkdirSync(assetDir, { recursive: true });

console.log(`\n📦 ${manifest.name} v${manifest.version}  (type: ${themeType})`);
console.log(`🔑 ARK_API_KEY: ${API_KEY.slice(0, 8)}...`);

// ═══════════════ 构建任务列表 ──

/** @type {{ key: string; type: string; model: string; prompt: string; ratio: string; duration?: number; description?: string }[]} */
const tasks = [];

if (themeType === "story") {
  const scenes = manifest.scenes || [];
  const candidates = targetScene
    ? scenes.filter(s => s.promptKey === targetScene)
    : scenes.filter(s => s.status !== "done" && s.status !== "skip");

  for (const s of candidates) {
    const pk = s.promptKey || s.id;
    const cfg = prompts.scenes?.[pk];
    if (!cfg) { console.log(`  ⚠️  场景 "${pk}" 无 prompts 配置，跳过`); continue; }
    tasks.push({
      key: pk,
      type: cfg.type || "image",
      model: cfg.model || prompts.model,
      prompt: `${prompts.global?.style ?? ""}, ${cfg.prompt}`,
      ratio: cfg.ratio || prompts.global?.ratio || "16:9",
      duration: cfg.duration,
      description: s.description,
    });
  }
} else if (themeType === "dynamic") {
  if (!facesOnly) {
    // Background video
    const bg = prompts.background;
    if (bg) {
      tasks.push({
        key: "bg-loop",
        type: "video",
        model: bg.model || "doubao-seedance-1-0-pro-fast-251015",
        prompt: `${prompts.global?.style ?? ""}, ${bg.prompt}`,
        ratio: "16:9",
        duration: bg.duration || 10,
        description: "背景视频循环",
      });
    }
  }

  // Faces
  const faces = prompts.faces || {};
  for (const [faceKey, cfg] of Object.entries(faces)) {
    const faceStatus = (manifest.scenes || []).find(s => s.promptKey === `face-${faceKey}`);
    if (faceStatus?.status === "done" || faceStatus?.status === "skip") continue;
    tasks.push({
      key: `face-${faceKey}`,
      type: "image",
      model: cfg.model || "doubao-seedream-4-5-251128",
      prompt: `${prompts.global?.style ?? ""}, ${cfg.prompt}`,
      ratio: cfg.ratio || "1:1",
      description: `表情: ${faceKey}`,
    });
  }
} else {
  console.log(`  type: ${themeType} — 无需 AI 生成素材`);
  process.exit(0);
}

if (tasks.length === 0) {
  console.log("✅ 没有待生成的场景。");
  process.exit(0);
}

console.log(`🎯 待生成: ${tasks.length} 项`);
if (dryRun) { console.log("🧪 DRY RUN — 不会实际调用 API\n"); }

// ═══════════════ 执行 ──

let ok = 0, fail = 0;

for (const task of tasks) {
  console.log(`\n──────────────────────────────────`);
  console.log(`  🎬 ${task.key}  ${task.description ?? ""}`);
  console.log(`  📐 ${task.type === "video" ? "🎥" : "🖼️"}  ${task.model}  ${task.ratio}`);

  if (dryRun) {
    console.log(`  📝 ${task.prompt.slice(0, 120)}...`);
    ok++;
    continue;
  }

  const ext = task.type === "video" ? "mp4" : "webp";
  const outPath = join(assetDir, `${task.key}.${ext}`);

  try {
    // Write prompt file alongside asset for future reference
    const promptTxtPath = join(assetDir, `${task.key}.prompt.txt`);
    writeFileSync(promptTxtPath, task.prompt, "utf-8");

    if (task.type === "video") {
      await generateVideo(task.model, task.prompt, outPath, task.duration || 5, task.ratio);
    } else {
      await generateImage(task.model, task.prompt, outPath, task.ratio);
    }

    // Update manifest
    if (manifest.scenes) {
      const scene = manifest.scenes.find(s => s.promptKey === task.key);
      if (scene) { scene.status = "done"; scene.assetPath = outPath; }
    }
    console.log(`  ✅ → ${outPath}`);
    ok++;
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    fail++;
  }
}

// 保存 manifest
if (!dryRun && ok > 0) {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`\n📄 manifest.json 已更新`);
}
console.log(`\n✨ 完成: ${ok} 成功, ${fail} 失败\n`);

// ═══════════════════ Volcengine Ark API ═══════════════════

/**
 * 图片生成 — 火山引擎 Ark 即梦 API
 * POST https://ark.cn-beijing.volces.com/api/v3/images/generations
 */
async function generateImage(model, prompt, outPath, ratio) {
  const negativePrompt = prompts.global?.negativePrompt || "模糊、低画质、水印、文字、logo";
  const resolution = prompts.global?.resolution || "2k";

  const body = {
    model,
    prompt,
    negative_prompt: negativePrompt,
    size: mapRatio(ratio),
    n: 1,
    response_format: "url",
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(`${ARK}/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${err.slice(0, 200)}`);
      }

      const json = await resp.json();
      const url = json.data?.[0]?.url;
      if (!url) throw new Error("API 未返回图片 URL");

      await downloadFile(url, outPath);
      return;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      console.log(`  ⚠️  重试 ${attempt}/${MAX_RETRIES}: ${err.message}`);
      await sleep(2000 * attempt);
    }
  }
}

/**
 * 视频生成 — 火山引擎 Ark Seedance API (异步)
 * POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
 */
async function generateVideo(model, prompt, outPath, duration, ratio) {
  const body = {
    model,
    content: [{ type: "text", text: prompt }],
    parameters: {
      duration: Math.min(duration, 15),
      size: mapRatio(ratio),
      watermark: false,
    },
  };

  // Step 1: Submit task
  let taskId;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = await fetch(`${ARK}/contents/generations/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (json.id) { taskId = json.id; break; }
    if (attempt === 3) throw new Error(`提交任务失败: ${JSON.stringify(json).slice(0, 200)}`);
    await sleep(2000);
  }

  console.log(`  📨 任务ID: ${taskId}`);

  // Step 2: Poll for result
  const maxAttempts = 60; // 3s * 60 = 3min max
  for (let poll = 1; poll <= maxAttempts; poll++) {
    await sleep(POLL_INTERVAL_MS);

    const resp = await fetch(`${ARK}/contents/generations/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const json = await resp.json();

    if (json.status === "succeeded") {
      const url = json.content?.video_url;
      if (!url) throw new Error("任务完成但无视频 URL");
      console.log(`  📥 下载视频...`);
      await downloadFile(url, outPath);
      return;
    }
    if (json.status === "failed") {
      throw new Error(`视频生成失败: ${json.error?.message || "未知错误"}`);
    }
    // Still running — continue polling
    if (poll % 5 === 0) console.log(`  ⏳ 等待中... (${poll * POLL_INTERVAL_MS / 1000}s)`);
  }

  throw new Error(`视频生成超时 (${maxAttempts * POLL_INTERVAL_MS / 1000}s)`);
}

// ═══════════════ Helpers ═══════════════

async function downloadFile(url, outPath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`下载失败 HTTP ${resp.status}`);
  const dest = createWriteStream(outPath);
  await pipeline(resp.body, dest);
}

function mapRatio(r) {
  // "16:9" → width/height that maps to the closest supported resolution
  const map = { "1:1": "1024x1024", "4:3": "1280x960", "3:4": "960x1280", "16:9": "1920x1080", "9:16": "1080x1920", "3:2": "1440x960", "2:3": "960x1440", "21:9": "2560x1080" };
  return map[r] || r || "1920x1080";
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
