#!/usr/bin/env node
/**
 * 主题完整性检查脚本
 *
 * 检查 i18n 和 CSS 是否覆盖了所有 ThemeName 值。
 * 补充 TypeScript 类型检查管不到的两类问题。
 *
 * 用法: node scripts/check-themes.mjs
 * CI:   npm run typecheck && node scripts/check-themes.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ═══════════════════════════════════════════
// 从 themeStore.ts 自动提取所有 ThemeName 值
// ═══════════════════════════════════════════

const storeSrc = fs.readFileSync(path.join(root, "src/stores/themeStore.ts"), "utf8");
const match = storeSrc.match(/export type ThemeName\s*=\s*"([^"]+)"(?:\s*\|\s*"([^"]+)")*/);
if (!match) {
  console.error("❌ 无法从 themeStore.ts 解析 ThemeName 类型");
  process.exit(1);
}
// 从联合类型中提取所有值
const typeLine = storeSrc.match(/ThemeName\s*=\s*([^;]+)/)?.[1] ?? "";
const ALL_THEMES = [...typeLine.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

console.log(`📋 ThemeName 共 ${ALL_THEMES.length} 个值: ${ALL_THEMES.join(", ")}`);

let errors = 0;

// ═══════════════════════════════════════════
// 1. CSS 变量块检查
// ═══════════════════════════════════════════

const css = fs.readFileSync(path.join(root, "src/index.css"), "utf8");
for (const theme of ALL_THEMES) {
  if (!css.includes(`[data-theme="${theme}"]`)) {
    console.error(`❌ CSS: 缺少 [data-theme="${theme}"] 变量块 → src/index.css`);
    errors++;
  }
}

// ═══════════════════════════════════════════
// 2. i18n 检查
// ═══════════════════════════════════════════

// ThemeName → SettingsDialog labelKey 映射
const themeLabelMap = {
  "default": "theme_default",
  "final-fantasy": "theme_ff7",
  "overwatch": "theme_ow",
  "genshin": "theme_gi",
  "path-of-exile": "theme_poe",
  "counter-strike": "theme_cs2",
  "rose": "theme_rose",
  "light": "theme_light",
  "pretty-girl": "theme_pg",
  "cyber-girl": "theme_cg",
};

// ThemeName → Home.tsx title key 映射
const homeKeyMap = {
  "default": "default", "rose": "default", "light": "default",
  "final-fantasy": "ff7", "overwatch": "ow", "genshin": "gi",
  "path-of-exile": "poe", "counter-strike": "cs2", "pretty-girl": "pg", "cyber-girl": "cg",
};

// 需要技能翻译的主题
const THEMES_WITH_CHARS = ["final-fantasy", "overwatch", "genshin", "path-of-exile", "counter-strike", "pretty-girl", "cyber-girl"];

// 从 themeShortcutStore 读取每个主题的技能 key（name 字段 = i18n key）
const tsSource = fs.readFileSync(path.join(root, "src/stores/themeShortcutStore.ts"), "utf8");
const charKeyMap = {}; // { "pretty-girl": ["home.pg_dance_name", ...] }
for (const theme of THEMES_WITH_CHARS) {
  // 在 DEFAULT_CHARACTERS 对象中找到对应主题的数组
  const blockRegex = new RegExp(`"${theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}":\\s*\\[([\\s\\S]*?)\\];?\\s*$`, 'm');
  // 换个策略 — 更简单的匹配
  charKeyMap[theme] = [];
}
// 直接匹配所有以 "home." 开头的 i18n key
const allHomeKeys = [...tsSource.matchAll(/"home\.(pg_|poe_)\w+"/g)].map((m) => `home.${m[1]}`);
// 更直接：从 DEFAULT_CHARACTERS 对象中提取 name 字段
const charsSrc = tsSource.match(/DEFAULT_CHARACTERS[\s\S]*?\n\};/)?.[0] ?? "";
const nameKeys = [...charsSrc.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.startsWith("home."));
const subtitleKeys = [...charsSrc.matchAll(/subtitle:\s*"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.startsWith("home."));
const allCharKeys = [...new Set([...nameKeys, ...subtitleKeys])];

const localeDir = path.join(root, "src/i18n/locales");
const localeFiles = fs.readdirSync(localeDir).filter((f) => f.endsWith(".json"));

for (const file of localeFiles) {
  const raw = fs.readFileSync(path.join(localeDir, file), "utf8");
  // Strip BOM if present
  const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  const json = JSON.parse(clean);
  const lang = file.replace(".json", "");

  // 只检查当前 SettingsDialog 中实际使用的主题 key
  const settingsDialogSrc = fs.readFileSync(path.join(root, "src/components/SettingsDialog.tsx"), "utf8");
  const usedThemeKeys = [...settingsDialogSrc.matchAll(/labelKey:\s*"([^"]+)"/g)].map((m) => m[1]);

  for (const labelKey of usedThemeKeys) {
    if (!json.settings?.[labelKey.split(".")[1]]) {
      console.error(`❌ i18n: ${file} 缺少 settings.${labelKey.split(".")[1]}`);
      errors++;
    }
  }

  // 检查 title/subtitle（所有 9 个主题都需要）
  for (const [theme, homeKey] of Object.entries(homeKeyMap)) {
    const titleKey = `${homeKey}_title`;
    const subtitleKey = `${homeKey}_subtitle`;
    if (json.home?.[titleKey] === undefined) {
      console.error(`❌ i18n: ${file} 缺少 home.${titleKey} (主题: ${theme})`);
      errors++;
    }
    if (json.home?.[subtitleKey] === undefined) {
      console.error(`❌ i18n: ${file} 缺少 home.${subtitleKey} (主题: ${theme})`);
      errors++;
    }
  }

  // 检查角色技能翻译（name 字段如 "home.poe_icestorm_name"，JSON 中 key 为 "poe_icestorm_name"）
  for (const fullKey of allCharKeys) {
    const key = fullKey.startsWith("home.") ? fullKey.slice(5) : fullKey;
    if (json.home?.[key] === undefined) {
      console.error(`❌ i18n: ${file} 缺少 home.${key}`);
      errors++;
    }
  }
}

// ═══════════════════════════════════════════
// 结果
// ═══════════════════════════════════════════

if (errors > 0) {
  console.error(`\n🔴 发现 ${errors} 个问题，请修复后再提交。`);
  process.exit(1);
} else {
  console.log("\n✅ 所有主题配置完整，通过检查。");
}
