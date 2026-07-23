# Nova Media Manager — 项目开发指南

> 开发流程详见 [DEVELOPMENT.md](DEVELOPMENT.md)

## 项目定位

桌面娱乐主机 — 定位语「**让桌面配得上你的热爱**」。面向中文用户的本地影音 + 游戏 + 桌面美化一体应用，以精美主题和沉浸式剧情体验为差异化竞争力。对标心智是"PC 上的娱乐主机界面"，不是媒体管理器。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Tailwind CSS 4 + Zustand + Vite 8 |
| 后端 | Tauri 2.11 + Rust (rusqlite, serde, chrono, zip, sha2) |
| 服务端 | Node.js 22 + Express + sql.js |
| 部署 | Alibaba Cloud ECS + Nginx + Docker Compose |

## 仓库

| 仓库 | 类型 | 分支 | 说明 |
|---|---|---|---|
| `nova-media-manager` | 公开 (AGPL v3) | `master` | 主代码 |
| `nova-proprietary` | 私有 (闭源) | `main` | license 模块 + 主题元数据 |

## 项目路径

```
D:\nova-media-manager\      ← GitHub 公库
├── src/                    # React 前端
├── src-tauri/src/          # Rust 后端
│   ├── license/            # → D:\nova-proprietary\license\ (软链接)
│   └── theme/              # .nvtp 加密/打包/解包
├── public/themes/          # 主题资源（Syncthing，不在 Git）
├── server/                 # ECS 服务端（不在 Git）
└── scripts/                # 构建/生成/打包脚本

D:\nova-proprietary\        ← GitHub 私有仓库
├── license/mod.rs          # 许可证验证（闭源）
├── theme/crypto.rs         # 主题加密密钥
└── themes/                 # 主题元数据 + 提示词（Git 版本控制）
    ├── manifest.schema.json
    ├── prompts.schema.json
    ├── ice-girl/
    └── cyber-girl/

D:\nova-themes-assets\      ← Syncthing 同步 — AI 生成的素材
├── ice-girl/               # 图片/视频/图标
└── cyber-girl/
```

## 主题架构

### 基本概念

- **default** — 内置根主题（编译时嵌入 `default/theme.json`），所有主题的 fallback 基线
- **Premium 主题** — `.nvtp` 单文件安装（ZIP + XOR 加密），通过 `nova://` protocol 服务素材
- **ThemeName** — `string` 类型，不能用字面量联合类型。主题列表从 `themePackStore.installedThemes` 动态生成
- **Token 引擎** — Rust 侧合并 default + 主题 theme.json + inherits → 前端 `html.style.setProperty(key, val, "important")` 行内注入
- **设计文档**：[docs/theme-system-design.md](docs/theme-system-design.md) — 完整 Token 定义 + .nvtp 格式 + AI Prompt

### 必须遵守的铁律（每条都踩过坑）

1. **CSS 用行内样式注入，不用 stylesheet** — `document.documentElement.style.setProperty(k, v, "important")`，否则被 Tailwind v4 `@theme` 编译覆盖
2. **`useThemeEffects` 跳过非 default 主题** — `applySurface()/applyPalette()` 只对 default 生效。非 default 的 CSS 由 `useThemeTokens` 全权接管
3. **userOverrides 不发 colors 字段** — `theme.json` 定义主题色，用户色板不得覆盖。切非 default 主题时重置 `paletteCustomized = false`
4. **protocol 和 loader 用同一路径** — 都走 `database.data_dir().join("themes").join("nvtp")`
5. **读 protocol 缓存前必须 `ensure_loaded`** — 重启后缓存为空
6. **Manifest JSON 用 camelCase** — `requiresLicense`、`cssFile`（Rust `#[serde(rename_all = "camelCase")]`）
7. **构建 .nvtp 用 `Buffer.concat([header, body])`** — 不要 `Buffer.alloc` 预分配（会多零填充字节）
8. **Dev 模式素材必须复制到 `public/`** — `nova://` 协议 dev 下不支持 `<img>`，Vite 静态服务替代
9. **转 WebP 前烧入 hex 色 + SVG 内嵌 feGaussianBlur 发光** — WebP 是位图，不支持 `currentColor` 和 CSS filter
10. **不要用 `isDefault` 门控功能** — 改用 `!(isIce || isCG)`。ice-girl/cyber-girl 是老主题，新 .nvtp 主题和 default 一样需要壁纸引擎
11. **`setTheme` 带 `themeVersion` 自增计数器** — 同主题重复选择时确保 `useThemeTokens` 重新注入
12. **主题 CSS 文件用 `fetch()`+`<style>.textContent` 注入** — 不用 `<link>` 标签，不用 `@import`

### 主题文件开发流程

1. 写 `theme.json` — 只写与 default 不同的 Token（inherits 自动补齐其余）
2. 素材放 `D:\nova-themes-assets\{theme-id}\` — icons/ + audio/ + fonts/
3. 写 `theme.css` — 视觉效果（霓虹发光/动画/卡片/按钮等组件样式）
4. 打包：`node scripts/build-cyberpunk.mjs`（或新主题的对应脚本）
5. 测试：应用 → 主题管理 → 安装本地 .nvtp

### 主题相关文件

| 文件 | 用途 |
|------|------|
| `src-tauri/src/theme/tokens.rs` | Token 合并 + 扁平化引擎 |
| `src-tauri/src/theme/default_theme.json` | 内置全量 Token 基线 |
| `src/hooks/useThemeTokens.ts` | 前端 Token 注入 + CSS 桥接 |
| `src/hooks/useThemeEffects.ts` | Legacy palette（仅 default 主题） |
| `src/hooks/useThemeSfx.ts` | UI 音效播放引擎 |
| `src/stores/themeStore.ts` | 主题选择状态 + themeVersion |
| `src/stores/themePackStore.ts` | .nvtp 安装/管理 |
| `src/lib/themeBase.ts` | 素材 URL 构建（dev→public/, prod→nova://） |
| `scripts/build-cyberpunk.mjs` | cyberpunk 主题打包脚本 |
| `D:\nova-proprietary\themes\{id}\theme.json` | 主题 Token 定义 |
| `D:\nova-proprietary\themes\{id}\theme.css` | 主题视觉效果 CSS |

## 许可证系统

- 一码一机（一个激活码 = 一台设备）
- 随时可解绑；换绑后 15 天冷却期内不可再绑新设备；365 天内最多解绑 3 次
- 月付 = 30 天，年付 = 365 天，永久 = 终身，精确到秒
- 每 7 天联网校验 JWT，30 天离线宽限期后降级 Free
- FeatureFlag：`premium-theme` | `auto-update`
- Hook：`src/lib/useGate.ts` — `useGate(flag)` → boolean
- 会员过期后自动降级 Free，已下载主题锁定（不删除），续费后恢复

## 定价

| | Free | Member |
|---|---|---|
| 价格 | 免费 | ¥19.9/月 · ¥199/年 · ¥899 永久 |
| 设备 | — | 1（一码一机） |

**功能分层**：

| 功能 | Free | Member |
|------|:---:|:---:|
| 全部影音管理基础功能 | ✅ | ✅ |
| 全功能桌面小部件 | ✅ | ✅ |
| default 主题 + 自定义调色板 | ✅ | ✅ |
| Premium 主题 + 角色剧情 + BGM | ❌ | ✅ |
| 主题自动更新 | ❌ | ✅ |
| 字体/图标大小额外档位 | ❌ | ✅ |
| 歌词/播放器颜色自定义 | ❌ | ✅ |
| 自定义壁纸（单张/文件夹/幻灯片） | ❌ | ✅ |
| 电影设为壁纸 | ❌ | ✅ |
| 背景视频调参 | ❌ | ✅ |
| 倒计时语音+光晕 | ❌ | ✅ |
| 我的电脑主题定制 | ❌ | ❌ | ✅ |
| 系统主题（壁纸包+图标集+全局皮肤） | ❌ | ✅ | ✅ |
| 在线备份/恢复 | ❌ | ❌ | ✅ |

爱发电：https://ifdian.net/a/cyber2079

## ECS 服务器

| 项目 | 值 |
|---|---|
| 域名 | scm-think.cn |
| SSH | `ssh -i ~/.ssh/ecs_nova root@39.104.55.38` |
| 服务 | systemd `nova-server`，端口 3000 |
| 代码 | `/var/www/server/` |
| CDN | `/var/www/themes/` → https://scm-think.cn/themes/ |

### 服务管理
```bash
systemctl status nova-server
systemctl restart nova-server
journalctl -u nova-server -f
```

### 部署
```bash
# Landing page
scp -i ~/.ssh/ecs_nova server/static/index.html root@39.104.55.38:/var/www/server/static/

# 服务端
scp -i ~/.ssh/ecs_nova -r server/src/* root@39.104.55.38:/var/www/server/src/
ssh -i ~/.ssh/ecs_nova root@39.104.55.38 "systemctl restart nova-server"

# MSI 安装包
npm run tauri:build
scp -i ~/.ssh/ecs_nova src-tauri/target/release/bundle/msi/*.msi root@39.104.55.38:/var/www/releases/
```

## 日常开发

```bash
npm run tauri:dev          # 启动
npm run pull               # 拉取公库+私库
npm run push "描述"         # add + commit + push
npm run typecheck          # 编译检查（commit 前必须过）— 即 tsc --noEmit -p tsconfig.app.json
```

> ⚠️ 不要用裸 `npx tsc --noEmit`：根 tsconfig.json 是 `files: []` + references，裸命令检查 0 个文件、永远退出 0。

## 已知 Bug

- `media_library.db` 和 localStorage 在同一 AppData 目录，清缓存会误删用户媒体数据

## 记忆系统

`~/.claude/projects/d--nova-media-manager/memory/` — 跨会话持久记忆，包含主题架构、安全分离、数据同步、分层规划、已知 Bug 等。详见 MEMORY.md。

### 多机同步约定

- **仓库内知识**（开发规则、教训、门禁命令）→ 写进 CLAUDE.md / DEVELOPMENT.md，随 `npm run push` / `npm run pull` 在台式机与笔记本间同步，两边的 Claude 自动读取。
- **Claude 记忆目录**是本机文件，另一台机器读不到 → 用 Syncthing 把 memory 文件夹加为同步共享（和主题素材同一套方案）。前提：两台机器仓库路径都必须是 `D:\nova-media-manager`，记忆目录名 `d--nova-media-manager` 由该路径推导，路径不同则记忆不会被加载。
- **⚠️ 红线**：memory 里的 secrets.md / ecs-ssh.md / afdian.md 含密钥（JWT_SECRET、ADMIN_KEY、GitHub PAT 等），**绝不能进公库**（本仓库是公开 AGPL）。含密钥的记忆只走 Syncthing 点对点或私库 nova-proprietary；能进公库的只有纯方法论。
