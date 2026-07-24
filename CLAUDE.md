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
├── public/
│   ├── themes/             # 主题资源（Syncthing，不在 Git）
│   │   ├── ice girl/       # ice-girl 素材
│   │   ├── cyber girl/     # cyber-girl 素材
│   │   ├── cyberpunk/      # cyberpunk 素材（dev 模式下构建脚本复制到此处）
│   │   └── cyber-grid/     # cyber-grid 素材（dev 模式下构建脚本复制到此处）
│   └── fonts/              # 字体：小字体进 Git，大字体 .gitignore + Syncthing
├── server/                 # ECS 服务端（不在 Git）
└── scripts/                # 构建/生成/打包脚本
    ├── build-cyberpunk.mjs
    ├── build-cyber-grid.mjs
    └── ...

D:\nova-proprietary\        ← GitHub 私有仓库
├── license/mod.rs          # 许可证验证（闭源）
├── theme/crypto.rs         # 主题加密密钥
└── themes/                 # 主题元数据 + 提示词（Git 版本控制）
    ├── manifest.schema.json
    ├── prompts.schema.json
    ├── cyberpunk/           # 静态主题：theme.json + theme.css + manifest.json
    ├── cyber-grid/          # 静态主题：蓝图 bento 风格
    ├── ice-girl/            # dynamic 主题：manifest.json + prompts.json
    └── cyber-girl/          # story 主题：manifest.json + prompts.json

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
13. **`.neon-icon` base 样式必须在 `index.css` 全局定义** — 不能只放在 per-theme neon-icons.css 里，否则无 neon-icons.css 的主题 NeonIcon 尺寸异常
14. **字体源仓库不要整包复制到 `public/fonts/`** — 只取编译好的 .ttf/.otf；Rust 源码/Cargo.toml/glyph 源文件一律不进公库
15. **Layout `<main>` 不要 `overflow-hidden`** — 改成 `overflow-visible`，否则最左/最右按钮 hover 光晕被裁剪

### 主题文件开发流程

1. 写 `theme.json` — 只写与 default 不同的 Token（inherits 自动补齐其余）
2. 素材放 `D:\nova-themes-assets\{theme-id}\` — icons/ + audio/ + fonts/
3. 写 `theme.css` — 视觉效果（霓虹发光/动画/卡片/按钮等组件样式）
4. 打包：`node scripts/build-cyberpunk.mjs`（或新主题的对应脚本）
5. 测试：应用 → 主题管理 → 安装本地 .nvtp

### 新建静态主题完整流程（2026-07-24 沉淀，cyber-grid 为范例）

> 本节涵盖从零创建 premium 静态主题的全过程，每一步都有踩坑记录。

**Step 1: 创建主题源文件**（`D:\nova-proprietary\themes\{id}\`）

| 文件 | 作用 | 注意事项 |
|------|------|----------|
| `manifest.json` | 元数据：id、name、`inherits: "default"`、`requiresLicense: "member"` | id 就是主题名，别用 com.nova 前缀（那是 legacy） |
| `theme.json` | Token 覆盖：colors、glass、header、nav、card、button... | 只写与 default 不同的 Token；copy cyberpunk 的改配色最快 |
| `theme.css` | 视觉效果：背景、动画、卡片、按钮覆盖 | 核心约束见下方 |

**Step 2: 前端注册**

| 文件 | 改什么 |
|------|--------|
| `src/pages/Home.tsx` | `THEME_META` 添加 `"cyber-grid": { type: "static" }` |
| `src/lib/themeBase.ts` | `KNOWN_THEMES` 添加 `"cyber-grid": "/themes/cyber-grid"` |
| `src/pages/Home.tsx` | static 分支用条件渲染体换主题专用首页组件（如 `BlueprintBentoGrid`） |

**Step 3: 打包脚本**

copy `scripts/build-cyberpunk.mjs` → 改名 → 改 `themeId` 和 `PROJ`/`ASSETS` 路径。若不需要 SFX/导航图标，删掉对应段落即可。

**Step 4: 验证链路**

```bash
node scripts/build-cyber-grid.mjs   # → dist/cyber-grid.nvtp
npm run typecheck                   # 门禁
npm run tauri:dev                   # 启动 → 主题管理 → 安装本地 .nvtp
```

---

### 主题 CSS 编写铁律（新补）

1. **`html[data-theme="xxx"]` 选择器限定作用域**，参考 cyberpunk/theme.css 模式
2. **`.neon-icon` / `.neon-icon svg` 基础样式必须在 `src/index.css` 全局定义**，不能只放在 per-theme neon-icons.css 里。否则没 neon-icons.css 的主题（ice-girl、cyber-girl、cyber-grid 等）NeonIcon SVG 会按 viewBox 原生大小（24px）而非 `size` prop 渲染
3. **主题首页组件按 `themeType` 分流**：static 走 `HomeDashboard`（或专用组件），dynamic 走 typewriter+face，story 走 scene progression
4. **首页组件必须功能对等** — 自建 BlueprintBentoGrid 时不能丢失 HomeDashboard 的任何数据源（dashboard_stats + Steam trending + Netease/TMDB recs + play history + 签到）
5. **Bento grid 不用 `row-span-2`** — CSS Grid 自动放置在有跨行项时不可预测，改为每行严格 5 列填满
6. **扫描线等 CSS 伪元素效果应写成 `var()` 驱动**，方便后续做每主题可配置特效

### 每主题可配置特效

- **适用场景**：扫描线、噪点、色差等纯 CSS 伪元素效果
- **架构**：`settingsStore.themeEffects[themeId]` → `useThemeTokens` 注入 `<style id="nv-fx-overrides">` CSS 覆盖
- **默认值**：`DEFAULT_SCANLINE`（settingsStore.ts）
- **UI**：Appearance 选项卡 `isNonDefault` 时显示"主题特效"SectionGroup
- **重置**：`resetThemeEffects(themeId)` 删除该主题配置 → 回退到 theme.css 硬编码默认值
- **关键**：不碰 Rust/pipeline/tokens，纯前端注入。关闭扫描线用 `display:none !important`，开启用配置值重写 `repeating-linear-gradient`

### 字体集成

- 小字体（&lt; 200KB）：直接放 `public/fonts/`，Git 跟踪，`src/index.css` 加 `@font-face`，`settingsStore.ts` 的 `FONT_LIST` 注册
- 大字体（MB 级）：`public/fonts/` + `.gitignore` + Syncthing 同步
- 字体源仓库（如 cyberpunkfonts-main、warpnine-fonts-main）**不要整包放到 public/fonts/** — 只取编译好的 .ttf/.otf 文件

### NeonIcon 适配

- 新图标名先在 `src/components/neon-icon-data.json` 查是否存在，不存在则添加 SVG path 数据
- 格式：`"Name": ["neon-color-name", "<path .../>..."]`
- `neon-icon-data.json` 是单行 JSON，手写时注意不要引入换行
- NeonIcon 在 default 主题下走 lucide-react children fallback，非 default 走内联 SVG
- **2026-07-26 重要修正**：default 主题下 NeonIcon 也会用 `<span>` 包裹 children 并应用 `size` prop，不再裸返回 children 导致图标撑满容器。所有主题图标大小行为统一。

### 外部组件接入（21st.dev）

- 注册表 URL：`https://21st.dev/r/{user}/{component}` → Bearer token 认证
- 注册表返回 JSON：`files[].content` + `css` 对象。**css 字段常不完整**（只含 @keyframes），核心样式需根据视觉描述手写
- BentoItem 组件结构：四角 `<div className="corner top-left" />` × 4 + `<div className="content-wrapper">`

### Layout overflow 裁剪问题

- `src/components/Layout.tsx` 的 `<main>` 有 `overflow-hidden` 和内部 `overflow-y-auto`，会裁剪最左/最右图标 hover 光晕
- **修复**：`<main>` 改 `overflow-visible`；滚动 div 加 `px-1`（4px 呼吸空间给光晕边缘）
- 症状：SortBar 最左按钮、LayoutSwitch 最右按钮 hover 时 `box-shadow` / `drop-shadow` 被切 1-2px


### 主题相关文件

| 文件 | 用途 |
|------|------|
| `src-tauri/src/theme/tokens.rs` | Token 合并 + 扁平化引擎 |
| `src-tauri/src/theme/default_theme.json` | 内置全量 Token 基线 |
| `src/hooks/useThemeTokens.ts` | 前端 Token 注入 + CSS 桥接 + 每主题特效 CSS 覆盖 |
| `src/hooks/useThemeEffects.ts` | Legacy palette（仅 default 主题） |
| `src/hooks/useThemeSfx.ts` | UI 音效播放引擎 |
| `src/stores/themeStore.ts` | 主题选择 + themeVersion + `useAvailableThemes()` 会员门控 |
| `src/stores/themePackStore.ts` | .nvtp 安装/管理 |
| `src/stores/settingsStore.ts` | Per 主题特效配置（`themeEffects`）+ 字体列表 |
| `src/lib/themeBase.ts` | 素材 URL 构建（dev→public/, prod→nova://）；`KNOWN_THEMES` 注册新主题 |
| `src/components/SettingsDialog.tsx` | 外观选项卡：调色板 + 主题特效（扫描线开关/颜色/粗细） |
| `src/pages/Home.tsx` | `THEME_META` 映射主题类型；static 分支渲染专用首页组件 |
| `scripts/build-cyberpunk.mjs` | cyberpunk 主题打包脚本 |
| `scripts/build-cyber-grid.mjs` | cyber-grid 蓝图主题打包脚本 |
| `D:\nova-proprietary\themes\{id}\theme.json` | 主题 Token 定义 |
| `D:\nova-proprietary\themes\{id}\theme.css` | 主题视觉效果 CSS |
| `D:\nova-proprietary\themes\{id}\manifest.json` | 主题元数据（id/name/inherits/requiresLicense） |

## 音乐播放器架构（2026-07-26 沉淀）

### 双层播放器模型

| 层 | 位置 | 触发条件 |
|----|------|---------|
| **全屏播放器** | 音乐页底部（portaled 到 `document.body`，`fixed bottom-16`）| track 存在 + 在音乐页 + 未最小化 |
| **底栏迷你播放器** | [Layout.tsx](src/components/Layout.tsx) Footer，左侧 | track 存在 + fullPlayer 不可见 |

全屏播放器用 `createPortal` 渲染到 body，绕开 CSS `transform: translateZ(0)` 导致的 fixed 定位失效。

### 交互流程

- 音乐页点 `—` 最小化 → `setBackground(true)`，全屏消失，底栏迷你出现
- 底栏迷你：封面缩略图 + 歌名 + ⏮ + ▶/⏸ + ⏭ + ⛶
- 点 ⛶ → `setBackground(false)` + navigate("/music")，全屏恢复
- 关闭按钮（✕）→ `stop()`，彻底关闭播放器
- 点迷你播放器歌名/封面 → navigate("/music")

### 铁律

- **播放器按钮用 `onMouseDown` 不用 `onClick`** — 三个按钮（🎨/—/✕）必须等高等宽 `w-7 h-7`，用 `onMouseDown` + `e.stopPropagation()` 避免进度条/其他元素拦截
- **歌词字体图标**：`ALargeSmall`（lucide Aa 图标），`NeonIcon` 不支持时自动 fallback children
- **播放器示波器**：`marginLeft: -11`

---

## 桌面小组件系统（2026-07-26 沉淀）

### DesktopWidget 接口

```typescript
<DesktopWidget id="myComputer" position={config.position}>
  {/* 小组件内容 */}
</DesktopWidget>
```

`id` 用作 store key，`position` 是预设位置字符串。

### 定位模型

- **预设**：CSS class（`bottom-20 right-5` 等 6 个位置）
- **自定义**：用户拖拽后存 `widgetCustomPos[id]: {x, y}`，用 inline `left/top` px 定位
- 切换显示模式或调用 `setPosition` 时自动清除自定义坐标

### 锁定/解锁/拖拽

| 状态 | 行为 |
|------|------|
| 锁定（默认）| Hover 显示 🔒 按钮，点在图标上方 20px |
| 解锁 | 显示拖拽手柄（⋮⋮，在图标上方 22px）+ 🔓 锁定按钮 |
| 拖拽 | 手柄上 `onPointerDown`，走 pointer capture，`onMove` 中直接操作 DOM style |
| 松开 | `Math.round` + `clamp` 取整存盘 |

### 拖拽约束（铁律）

```
HANDLE_H = 22  // 控制条悬出高度
top ≥ HEADER_H(64) + HANDLE_H = 86px  // 保证手柄不进 header
bottom ≤ windowH - FOOTER_H(48)
left: 0 ≤ x ≤ windowW - widgetW
```

- `onMove` 中 `clientY ≤ 86` 直接 return
- `onUp` 中鼠标在 header 区域松手：取 el 当前 `left/top` clamp 后存盘

### 层级（铁律）

| 层 | z-index |
|----|---------|
| 小组件根 div | 47 |
| 控制条（absolute, top -22px）| content z-10 |
| 内容包裹区 | content z-1 |
| Header/Footer | 50 |
| QuickHub | 55 |

### 指针事件隔离（铁律）

| 项目 | 规则 |
|------|------|
| 小组件外层容器 | `pointer-events-none`（允许隔空穿透） |
| 小组件内按钮 | `pointer-events-auto`（仅按钮可点） |
| 装饰 SVG | `pointer-events-none` |
| NeonIcon (all) | `pointer-events-none` — 图标本身不拦截点击，穿透到父按钮 |
| 锁定/解锁按钮 | `absolute top: -20px left-1/2`，不受内容尺寸影响 |
| 控制条 | content z-10，高于内容区 z-1，stopPropagation 防止冒泡 |

### 视觉铁律

| 规则 | 原因 |
|------|------|
| **禁止 SVG `drop-shadow-lg`** | GPU 层边界变化导致小组件 hover 时偏移 1px |
| 颜色仅用 CSS 变量 | `var(--font-primary)` 等，不硬编码 |
| 迷你模式 40×40px | 纯图标 + 进度环 |
| 展开面板用 `absolute top-0 left-full/right-full` | 弹到组件外侧，不挤空间 |

### 倒计时小组件（专属规则）

- 完整模式下按钮最小 32×32px，间距 `gap-1.5`
- 所有按钮用 `onClick`，NeonIcon 已全局 `pointer-events-none`
- 进度条 `pointer-events-none`
- 设置面板：从组件侧边弹出（`panelAlign === "right" ? "left-full" : "right-full"`），检测屏幕中心自动选方向
- 切换 mini↔full 自动清除自定义坐标

### 倒计时警报警报音效（2026-07-26）

三个主题各有专属循环音效，Web Audio API 合成，来源文件：[CountdownAlert.tsx](src/components/CountdownAlert.tsx)。

| 主题 | 音色 | 旋律 |
|------|------|------|
| default | 正弦波柔和风铃 | C5→E5→G5→C6，渐强，3 秒循环 |
| cyberpunk | 三角波轻快琶音 | C-E-G-C-G-E 上下行，1.7 秒循环 |
| cyber-grid | 方波科技阶进 | B5→A5→G5→E5→C5 上下行扫描线质感，1.4 秒循环 |

**铁律**：倒计时结束时循环播放，点"我知道了"停止。音量 0.05-0.08，比系统通知低。用户可控制开关和间隔。

---

## 自定义封面系统（2026-07-26 沉淀）

### Rust 命令

| 命令 | 用途 |
|------|------|
| `set_music_cover(id, sourcePath)` | 复制图片到 `music_covers/{id}.jpg`，更新 DB |
| `set_movie_cover(id, sourcePath)` | 复制图片到 `covers/custom/{id}.jpg`，更新 DB |
| `regenerate_music_cover(id)` | 重新提取嵌入封面 |
| `clear_music_cover(id)` | 清空 cover_path → 回退默认图标 |
| `clear_movie_cover(id)` | 同上 |
| `get_known_folder_path(kind)` | 返回桌面/下载等系统文件夹实际路径 |

### 前端

- MovieCard/MusicCard 操作行有 🖼（设置封面）+ 🔄（重新生成）+ 🗘（恢复默认）三个按钮
- 设置后直接调 `useMusicStore.getState().loadMusic()` 刷新
- **关键**：`music.coverPath` 是本地绝对路径，前端显示必须经 `musicCoverSrc()` 转为 Tauri asset protocol URL。MusicCard 之前漏了这个导致卡片视图永远不显示封面。

---

## 其他新增子系统

### 系统弹窗样式

- 设置 → 外观 → 系统弹窗样式：`windows`（原生 explorer）/ `theme`（应用内 FileExplorer + 主题玻璃面板）
- 全局 store 字段：`systemDialogStyle: "windows" | "theme"`
- 影响：QuickHub 文件夹快捷方式、我的电脑、主题安装弹窗

### 字体系统拆分

- `FONT_LIST` 拆为 `COMBINED_FONT_LIST`（中英一体）、`CJK_FONT_LIST`（纯中文）、`EN_FONT_LIST`（纯英文）
- `fontFamily`（组合）/ `fontFamilyCJK` + `fontFamilyEN`（分离）互斥
- CJK 字体必须在 `system-ui` 前面，否则中文字形被 system-ui 吃掉

### Steam 热榜多语言

- 客户端传 `i18n.language === "zh" ? "zh" : "en"` 给服务端
- 服务端按语言分缓存（`tag:lang`），每日定时同时刷中英两份
- 服务端 Steam API 请求 `l=schinese` vs `l=english`

### 搜索栏

- 全局搜索弹窗 `[&>button]:hidden` 隐藏 Dialog 自带关闭按钮
- 输入框 `py-1.5 pl-3 text-base`，左侧 12px 内边距
- 弹窗宽度 `max-w-2xl`

### 设置面板

- 标签页顺序：通用 → 主题 → 外观 → 媒体 → 小组件 → 性能
- 开发者工具标签页仅 `import.meta.env.DEV` 可见
- 3D 预览 + 3D 开发工具已从 Header 移到设置 → 开发者工具

### 开始菜单宽度

- QuickHub 容器宽度从 `maxWidth: min(576px, ...)` 改为 `maxWidth: min(45vw, calc(100vw - 2rem))`


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
