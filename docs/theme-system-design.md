# Nova Media Manager — 主题系统设计方案 v2

> **目标**：将主题从硬编码 CSS 升级为**声明式主题引擎**，所有主题使用统一的 `.nvtp` 格式，主题与代码彻底解耦。

---

## 目录

1. [设计原则](#1-设计原则)
2. [主题范围全景图](#2-主题范围全景图)
3. [主题 Token 体系](#3-主题-token-体系)
4. [新版 .nvtp 文件格式](#4-新版-nvtp-文件格式)
5. [UI 素材与 AI 生成 Prompt](#5-ui-素材与-ai-生成-prompt)
6. [主题引擎架构](#6-主题引擎架构)
7. [实现路线图](#7-实现路线图)

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **声明式** | 主题 = 一份 `theme.json` + 一套 UI 素材，零代码 |
| **层级覆盖** | 主题 Token → 用户自定义 → CSS 变量 → 组件渲染 |
| **统一格式** | default 主题也用 `.nvtp` 格式，内置在安装包中 |
| **渐进增强** | 只定义差异 Token，未定义的 fallback 到 default |
| **背景外置** | 壁纸图片和视频由用户提供，`theme.json` 不内嵌 |
| **暗色优先** | 所有主题默认暗色模式，token 体系预留亮色扩展 |

---

## 2. 主题范围全景图

### 2.1 UI 区域层级

```
┌─────────────────────────────────────────────────────────┐
│  Header Bar (header)  z-50                              │
│  ┌──────┬──────────────────────────────┬──────────────┐ │
│  │ Logo │  Nav ×5 (Home/Movies/        │  Actions ×4  │ │
│  │      │   Images/Music/Games)        │              │ │
│  └──────┴──────────────────────────────┴──────────────┘ │
├─────────────────────────────────────────────────────────┤
│  Main Content Area (main)  z-48                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Home Page / Media Library Pages                    ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            ││
│  │  │  Cards   │ │  Grid    │ │  Detail  │            ││
│  │  └──────────┘ └──────────┘ └──────────┘            ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  Widgets (floating overlay)                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐       │
│  │ Clock  │  │Calendar│  │My PC   │  │Monitor │       │
│  └────────┘  └────────┘  └────────┘  └────────┘       │
├─────────────────────────────────────────────────────────┤
│  QuickHub Popover (z-45)                                │
├─────────────────────────────────────────────────────────┤
│  Footer Bar (footer)  z-50                              │
│  ┌──────┬──────┬──────┬──────┬────────────────────────┐│
│  │ Hub  │Page  │Video │Screen│  QuickLaunch Apps...   ││
│  │ btn  │Toggle│Pause │shot  │                        ││
│  └──────┴──────┴──────┴──────┴────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 2.2 主题可控元素清单

> 壁纸图片和背景视频由用户提供，主题系统只控制显示模式和样式，不内嵌素材。

#### A. 全局层 (Global)

| Token | 类型 | 说明 |
|-------|------|------|
| `global.fontFamily` | string | 全局字体 CSS font-family 值 |
| `global.fontSizeScale` | number | 全局字号缩放因子 (默认 1.0) |
| `global.iconSizeScale` | number | 全局图标缩放因子 (默认 1.0) |
| `global.bgMode` | enum | 背景类型默认值：`video` / `image` / `slideshow` / `none` |
| `global.bgVideoFill` | enum | 视频填充模式：`cover` / `contain` / `fill` / `none` |
| `global.bgOverlayOpacity` | number | 背景上方暗色遮罩不透明度 (0-1) |

#### B. 颜色系统 (Colors) — 18 个 Token

| Token | 用途 |
|-------|------|
| `color.primary` | 主色调 — 按钮、强调、选中态 |
| `color.primaryLight` | 主色调亮 — hover、渐变亮端 |
| `color.primaryDark` | 主色调暗 — active、渐变暗端 |
| `color.accent` | 辅助强调色 — 标签、徽章、特殊高亮 |
| `color.success` | 绿色系 — 成功/完成 |
| `color.warning` | 橙黄色系 — 警告 |
| `color.danger` | 红色系 — 危险/删除 |
| `color.info` | 蓝色系 — 信息 |
| `color.text` | 主文字色 — 标题、正文 |
| `color.textSecondary` | 次文字色 — 描述、元信息 |
| `color.textMuted` | 禁用/占位文字 |
| `color.surface` | 基础表面 — 页面/卡片底层 |
| `color.surfaceLight` | 亮表面 — 卡片、弹窗背景 |
| `color.surfaceLighter` | 更亮表面 — hover 态、悬浮层 |
| `color.surfaceDark` | 暗表面 — 深层嵌套区域 |
| `color.border` | 边框色 — 分割线、卡片边框 |
| `color.borderFocus` | 聚焦边框 — 输入框聚焦 |
| `color.shadow` | 阴影色 — box-shadow 颜色 |

#### C. 玻璃效果 (Glassmorphism) — 7 个区域 × 3 参数

| 区域 | Token 前缀 | 参数 |
|------|-----------|------|
| Header | `glass.header` | opacity (0-100) / blur (px) / saturation (%) |
| Footer | `glass.footer` | 同上 |
| 主内容区 | `glass.main` | 同上 |
| 对话框 | `glass.dialog` | 同上 |
| 卡片 | `glass.card` | 同上 |
| 小组件 | `glass.widget` | 同上 |
| QuickHub | `glass.quickhub` | 同上 |

用户可通过"全局玻璃总控"开关一键覆盖所有区域，也可逐个微调。

#### D. Header 区域

| Token | 类型 | 说明 |
|-------|------|------|
| `header.height` | px | Header 高度 |
| `header.logo` | asset | Logo 图标文件路径 |
| `header.logoSize` | px | Logo 尺寸 |
| `header.titleGradient` | string | 标题文字渐变色 + 发光效果 |
| `header.navButtonRadius` | px | 导航按钮圆角 |
| `header.navButtonGap` | px | 导航按钮间距 |
| `header.navIconSize` | px | 导航图标尺寸 |
| `header.navIconStyle` | enum | `lucide`（默认图标）/ `theme`（主题自定义图标） |
| `header.navActiveBg` | color | 导航选中态背景 |
| `header.navInactiveColor` | color | 导航未选中文字色 |
| `header.navHoverBg` | color | 导航悬停背景 |
| `header.actionButtonSize` | px | 右侧操作按钮尺寸 |
| `header.actionButtonColor` | color | 右侧操作按钮默认色 |

#### E. 导航按钮 (5 页各可独立定制)

| Token | 类型 | 说明 |
|-------|------|------|
| `nav.home.icon` | asset | 首页图标 |
| `nav.home.iconActive` | asset | 首页激活态图标 |
| `nav.home.color` | color | 首页专属强调色 |
| `nav.movies.*` / `nav.images.*` / `nav.music.*` / `nav.games.*` | | 同上 |

#### F. Footer 底栏

| Token | 类型 | 说明 |
|-------|------|------|
| `footer.height` | px | Footer 高度 |
| `footer.buttonSize` | px | 按钮尺寸 |
| `footer.buttonRadius` | px | 按钮圆角 |
| `footer.buttonGap` | px | 按钮间距 |
| `footer.buttonDefaultColor` | color | 按钮默认色 |
| `footer.buttonHoverColor` | color | 按钮悬停色 |
| `footer.buttonActiveColor` | color | 按钮激活色 |
| `footer.dividerColor` | color | 分隔线颜色 |

#### G. 卡片系统 (Cards)

| Token | 类型 | 说明 |
|-------|------|------|
| `card.radius` | px | 圆角 |
| `card.borderWidth` | px | 边框宽度 |
| `card.borderStyle` | enum | `solid` / `glow` / `none` |
| `card.hoverElevation` | px | hover 浮起高度 |
| `card.hoverGlowColor` | color | hover 发光颜色 |
| `card.hoverGlowIntensity` | number | hover 发光强度 (0-1) |
| `card.padding` | px | 内边距 |
| `card.gap` | px | 卡片间距 |

#### H. 按钮系统 (Buttons)

| Token | 类型 | 说明 |
|-------|------|------|
| `button.primaryBg` | color | 主按钮背景 |
| `button.primaryText` | color | 主按钮文字 |
| `button.primaryHoverBg` | color | 主按钮悬停 |
| `button.primaryActiveBg` | color | 主按钮按下 |
| `button.ghostHoverBg` | color | 幽灵按钮悬停背景 |
| `button.radius` | px | 统一圆角 |
| `button.fontWeight` | number | 字重 (400-700) |
| `button.transitionSpeed` | ms | 过渡动画时长 |

#### I. 输入控件 (Inputs)

| Token | 类型 | 说明 |
|-------|------|------|
| `input.bg` | color | 输入框背景 |
| `input.border` | color | 输入框边框 |
| `input.focusBorder` | color | 聚焦边框色 |
| `input.focusGlow` | string | 聚焦发光 (box-shadow) |
| `input.text` | color | 输入文字色 |
| `input.placeholder` | color | placeholder 色 |
| `input.radius` | px | 圆角 |

#### J. 滚动条 (Scrollbar)

| Token | 类型 | 说明 |
|-------|------|------|
| `scrollbar.thumbBg` | gradient | 滑块背景 |
| `scrollbar.thumbHoverBg` | gradient | 滑块悬停背景 |
| `scrollbar.width` | px | 宽度 |
| `scrollbar.trackBg` | color | 轨道背景 |

#### K. 对话框 (Dialogs)

| Token | 类型 | 说明 |
|-------|------|------|
| `dialog.overlayOpacity` | number | 遮罩不透明度 (0-1) |
| `dialog.overlayBlur` | px | 遮罩模糊 |
| `dialog.radius` | px | 弹窗圆角 |
| `dialog.borderStyle` | enum | 边框风格：`solid` / `glow` / `none` |
| `dialog.glowColor` | color | 边框发光色 |

#### L. 首页 (Home Page)

| Token | 类型 | 说明 |
|-------|------|------|
| `home.heroTitleColor` | color | 欢迎标题颜色 |
| `home.heroSubtitleColor` | color | 欢迎副标题颜色 |
| `home.heroGlow` | string | 标题 text-shadow 发光 |
| `home.entranceAnimation` | enum | 入场动画：`fade` / `frost` / `glitch` / `slide` |
| `home.entranceSpeed` | ms | 入场动画时长 |
| `home.cardLayout` | enum | 卡片布局：`grid` / `list` / `carousel` |

#### M. 小组件 (Widgets)

| Token | 类型 | 说明 |
|-------|------|------|
| `widget.bg` | color | 组件背景 |
| `widget.text` | color | 文字色 |
| `widget.iconColor` | color | 图标色 |
| `widget.radius` | px | 圆角 |
| `widget.shadow` | string | box-shadow |
| `widget.borderColor` | color | 边框色 |

#### N. UI 音效 (SFX)

覆盖所有界面交互的听觉反馈：

| Token | 触发场景 | 时长 |
|-------|---------|------|
| `sfx.enabled` | — 是否默认启用主题音效 (boolean) | — |
| `sfx.hover` | 按钮 hover、卡片 hover、列表项 hover | ~80ms |
| `sfx.click` | 按钮点击、链接点击、开关切换 | ~120ms |
| `sfx.menuOpen` | 展开菜单、弹出 QuickHub、打开下拉 | ~150ms |
| `sfx.menuClose` | 收起菜单、关闭弹窗、返回上一级 | ~150ms |
| `sfx.dialogOpen` | 打开设置面板、确认对话框、模态窗口 | ~200ms |
| `sfx.dialogClose` | 关闭设置面板、取消对话框、关闭模态窗口 | ~180ms |
| `sfx.notification` | Toast 通知弹出、系统提示、消息提醒 | ~200ms |
| `sfx.pageTransition` | 页面切换（首页↔电影↔图片↔音乐↔游戏） | ~300ms |
| `sfx.startup` | 应用冷启动 | ~800ms |
| `sfx.countdownAlert` | 倒计时结束提醒 | ~400ms |
| `sfx.countdownTick` | 倒计时最后 5 秒每秒滴答 | ~50ms |

#### O. 骨架屏 (Skeleton)

| Token | 类型 | 说明 |
|-------|------|------|
| `skeleton.base` | color | 骨架底色 |
| `skeleton.shine` | color | 闪光色 |
| `skeleton.speed` | number | 动画周期 (秒) |

---

## 3. 主题 Token 体系

### 3.1 CSS 变量命名规范

```
--nv-{category}-{element}[-{variant}][-{state}]

示例:
  --nv-color-primary
  --nv-glass-header-opacity
  --nv-nav-movies-icon
  --nv-button-primaryBg-hover      (camelCase 子节点)
```

### 3.2 Token → CSS 变量

`theme.json` 中的每个 Token 在运行时注入为 CSS custom property：

```css
:root {
  --nv-color-primary: #4788f0;
  --nv-color-primaryLight: #7aafff;
  --nv-glass-header-opacity: 92;
  --nv-glass-header-blur: 16px;
  --nv-nav-movies-color: #b0e0e6;
  --nv-button-radius: 8px;
}
```

### 3.3 继承链

```
default/theme.json (内置，全量 Token)
  └─→ 用户主题/theme.json (只定义差异)
       └─→ 用户手动覆盖 (SettingsStore)
            └─→ CSS 变量注入 (document.documentElement)
                 └─→ 组件通过 var(--nv-xxx) 读取
```

### 3.4 Token 解析优先级

1. 用户手动覆盖 (最高)
2. 当前主题 theme.json
3. default/theme.json (兜底)

Rust 侧完成合并后再注入 WebView，保证 CSS 变量始终完整。

---

## 4. 新版 .nvtp 文件格式

### 4.1 二进制格式 (外层，与现有兼容)

```
┌──────────┬──────────────────────────────────────┐
│ Offset   │ Content                              │
├──────────┼──────────────────────────────────────┤
│ 0        │ Magic: b"NVTP"                       │
│ 4        │ Version: u16 LE = 2                  │
│ 6        │ Flags: u16                           │
│ 8        │ Theme ID len: u16                    │
│ 10       │ Theme ID (UTF-8)                     │
│ ...      │ Manifest len: u32 LE                 │
│ ...      │ Manifest JSON (明文)                  │
│ ...      │ Zip len: u64 LE                      │
│ ...      │ Zip (XOR 加密)                        │
│ ...      │ [Ed25519 Signature, 64 bytes, 可选]  │
└──────────┴──────────────────────────────────────┘
```

### 4.2 Manifest JSON (明文，轻量)

```jsonc
{
  "$schema": "https://scm-think.cn/schemas/theme-manifest-v2.json",
  "id": "com.nova.my-theme",
  "name": "我的主题",
  "author": "作者名",
  "version": "1.0.0",
  "requiresLicense": "free",
  "preview": "preview.webp",
  "inherits": "default",
  "createdAt": "2026-07-23T00:00:00Z"
}
```

| 字段 | 必需 | 说明 |
|------|:---:|------|
| `id` | ✓ | 唯一标识 |
| `name` | ✓ | 显示名称 |
| `author` | ✓ | 作者 |
| `version` | ✓ | 语义化版本 |
| `requiresLicense` | ✓ | `free` / `member` / `pro` |
| `preview` | ✓ | 预览图文件名 (zip 内路径) |
| `inherits` | | 继承哪个主题的 token 默认值，默认 `default` |
| `createdAt` | | ISO 时间戳 |

### 4.3 ZIP 内部结构

```
my-theme.nvtp
├── manifest.json               # 明文元信息
└── [ZIP — XOR 加密]
    ├── theme.json               # ★ 主题 Token 配置（核心）
    ├── preview.webp             # 预览图 960×540
    ├── theme.css                # 可选自定义 CSS
    ├── icons/
    │   ├── logo.webp
    │   ├── home.webp
    │   ├── home-active.webp
    │   ├── movie.webp
    │   ├── movie-active.webp
    │   ├── pic.webp
    │   ├── pic-active.webp
    │   ├── music.webp
    │   ├── music-active.webp
    │   ├── game.webp
    │   └── game-active.webp
    ├── audio/
    │   ├── sfx-hover.mp3
    │   ├── sfx-click.mp3
    │   ├── sfx-menu-open.mp3
    │   ├── sfx-menu-close.mp3
    │   ├── sfx-dialog-open.mp3
    │   ├── sfx-dialog-close.mp3
    │   ├── sfx-notification.mp3
    │   ├── sfx-transition.mp3
    │   ├── sfx-startup.mp3
    │   ├── sfx-countdown-alert.mp3
    │   └── sfx-countdown-tick.mp3
    └── fonts/                   # 可选主题专属字体
        └── display.woff2
```

> **不在 .nvtp 中的内容**：壁纸图片、背景视频 — 这些由用户在应用中自行指定路径。

### 4.4 theme.json 完整 Schema

```jsonc
{
  "$schema": "https://scm-think.cn/schemas/theme-v2.json",

  // ═══ 全局 ═══
  "global": {
    "fontFamily": "\"Inter\", system-ui, sans-serif",
    "fontSizeScale": 1.0,
    "iconSizeScale": 1.0,
    "bgMode": "video",             // video | image | slideshow | none
    "bgVideoFill": "cover",        // cover | contain | fill | none
    "bgOverlayOpacity": 0.3
  },

  // ═══ 颜色 (18 项) ═══
  "colors": {
    "primary":            "#4788f0",
    "primaryLight":       "#7aafff",
    "primaryDark":        "#3366cc",
    "accent":             "#6366f1",
    "success":            "#10b981",
    "warning":            "#f59e0b",
    "danger":             "#ef4444",
    "info":               "#0ea5e9",
    "text":               "#ffffff",
    "textSecondary":      "#8899aa",
    "textMuted":          "#556677",
    "surface":            "color-mix(in srgb, var(--nv-color-primary) 4%, #080c14)",
    "surfaceLight":       "color-mix(in srgb, var(--nv-color-primary) 6%, #101520)",
    "surfaceLighter":     "color-mix(in srgb, var(--nv-color-primary) 8%, #1a1f2a)",
    "surfaceDark":        "#060810",
    "border":             "rgba(255,255,255,0.06)",
    "borderFocus":        "rgba(71,136,240,0.50)",
    "shadow":             "rgba(0,0,0,0.4)"
  },

  // ═══ 玻璃效果 (7 区域 × 3 参数) ═══
  "glass": {
    "header":   { "opacity": 92, "blur": 16, "saturation": 140 },
    "footer":   { "opacity": 92, "blur": 16, "saturation": 140 },
    "main":     { "opacity": 92, "blur": 16, "saturation": 140 },
    "dialog":   { "opacity": 92, "blur": 16, "saturation": 140 },
    "card":     { "opacity": 88, "blur": 12, "saturation": 130 },
    "widget":   { "opacity": 85, "blur": 10, "saturation": 120 },
    "quickhub": { "opacity": 90, "blur": 14, "saturation": 135 }
  },

  // ═══ Header ═══
  "header": {
    "height": 64,
    "logo": "icons/logo.webp",
    "logoSize": 32,
    "titleGradient": "linear-gradient(135deg, var(--nv-color-primaryLight), var(--nv-color-primary))",
    "navButtonRadius": 9999,
    "navButtonGap": 4,
    "navIconSize": 32,
    "navIconStyle": "theme",       // lucide | theme
    "navActiveBg": "color-mix(in srgb, var(--nv-color-primary) 15%, transparent)",
    "navInactiveColor": "#8899aa",
    "navHoverBg": "color-mix(in srgb, var(--nv-color-primary) 10%, transparent)",
    "actionButtonSize": 36,
    "actionButtonColor": "#808890"
  },

  // ═══ 导航按钮 (5 页面各独立) ═══
  "nav": {
    "home":   { "icon": "icons/home.webp",   "iconActive": "icons/home-active.webp",   "color": "#4788f0" },
    "movies": { "icon": "icons/movie.webp",  "iconActive": "icons/movie-active.webp",  "color": "#6366f1" },
    "images": { "icon": "icons/pic.webp",    "iconActive": "icons/pic-active.webp",    "color": "#0ea5e9" },
    "music":  { "icon": "icons/music.webp",  "iconActive": "icons/music-active.webp",  "color": "#f59e0b" },
    "games":  { "icon": "icons/game.webp",   "iconActive": "icons/game-active.webp",   "color": "#10b981" }
  },

  // ═══ Footer ═══
  "footer": {
    "height": 48,
    "buttonSize": 32,
    "buttonRadius": 8,
    "buttonGap": 10,
    "buttonDefaultColor": "#808890",
    "buttonHoverColor": "#ffffff",
    "buttonActiveColor": "var(--nv-color-primaryLight)",
    "dividerColor": "rgba(255,255,255,0.08)"
  },

  // ═══ 卡片 ═══
  "card": {
    "radius": 12,
    "borderWidth": 1,
    "borderStyle": "solid",         // solid | glow | none
    "hoverElevation": 2,
    "hoverGlowColor": "var(--nv-color-primary)",
    "hoverGlowIntensity": 0.15,
    "padding": 16,
    "gap": 16
  },

  // ═══ 按钮 ═══
  "button": {
    "primaryBg": "var(--nv-color-primary)",
    "primaryText": "#ffffff",
    "primaryHoverBg": "color-mix(in srgb, var(--nv-color-primary) 90%, transparent)",
    "primaryActiveBg": "color-mix(in srgb, var(--nv-color-primary) 80%, transparent)",
    "ghostHoverBg": "rgba(255,255,255,0.05)",
    "radius": 8,
    "fontWeight": 500,
    "transitionSpeed": 200
  },

  // ═══ 输入控件 ═══
  "input": {
    "bg": "var(--nv-color-surfaceLight)",
    "border": "rgba(255,255,255,0.05)",
    "focusBorder": "color-mix(in srgb, var(--nv-color-primary) 50%, transparent)",
    "focusGlow": "0 0 0 2px color-mix(in srgb, var(--nv-color-primary) 30%, transparent)",
    "text": "var(--nv-color-textSecondary)",
    "placeholder": "var(--nv-color-textMuted)",
    "radius": 8
  },

  // ═══ 滚动条 ═══
  "scrollbar": {
    "thumbBg": "linear-gradient(180deg, var(--nv-color-primary), var(--nv-color-accent))",
    "thumbHoverBg": "linear-gradient(180deg, var(--nv-color-primaryLight), var(--nv-color-primary))",
    "width": 6,
    "trackBg": "transparent"
  },

  // ═══ 对话框 ═══
  "dialog": {
    "overlayOpacity": 0.6,
    "overlayBlur": 12,
    "radius": 16,
    "borderStyle": "solid",         // solid | glow | none
    "glowColor": "color-mix(in srgb, var(--nv-color-primary) 30%, transparent)"
  },

  // ═══ 首页 ═══
  "home": {
    "heroTitleColor": "#ffffff",
    "heroSubtitleColor": "#8899aa",
    "heroGlow": "none",
    "entranceAnimation": "fade",    // fade | frost | glitch | slide
    "entranceSpeed": 400,
    "cardLayout": "grid"            // grid | list | carousel
  },

  // ═══ 小组件 ═══
  "widget": {
    "bg": "color-mix(in srgb, var(--nv-color-primary) 8%, rgba(8,12,20,0.85))",
    "text": "#e8f4ff",
    "iconColor": "var(--nv-color-primaryLight)",
    "radius": 12,
    "shadow": "0 4px 20px rgba(0,0,0,0.3)",
    "borderColor": "rgba(255,255,255,0.06)"
  },

  // ═══ UI 音效 ═══
  "sfx": {
    "enabled": true,
    "hover":           "audio/sfx-hover.mp3",
    "click":           "audio/sfx-click.mp3",
    "menuOpen":        "audio/sfx-menu-open.mp3",
    "menuClose":       "audio/sfx-menu-close.mp3",
    "dialogOpen":      "audio/sfx-dialog-open.mp3",
    "dialogClose":     "audio/sfx-dialog-close.mp3",
    "notification":    "audio/sfx-notification.mp3",
    "pageTransition":  "audio/sfx-transition.mp3",
    "startup":         "audio/sfx-startup.mp3",
    "countdownAlert":  "audio/sfx-countdown-alert.mp3",
    "countdownTick":   "audio/sfx-countdown-tick.mp3"
  },

  // ═══ 骨架屏 ═══
  "skeleton": {
    "base": "#1a2030",
    "shine": "#2a3040",
    "speed": 1.5
  }
}
```

### 4.5 default 主题与用户主题的关系

| 主题 | `inherits` | 说明 |
|------|-----------|------|
| `default` | — (根主题) | 全量 Token 完整定义，内置在安装包 |
| 用户主题 | `default` | 只需 60-80 项差异覆盖，其余 fallback |

`inherits` 机制使得新建一个主题只需写 `theme.json` 中与 default 不同的部分，大幅减少重复。

---

## 5. UI 素材与 AI 生成 Prompt

> 壁纸和背景视频不在此列，由用户提供已有素材。

### 5.1 通用规范

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  通用规范
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【输出格式】
- 图片: WebP 无损, sRGB, 无嵌入 ICC profile
- 音频: MP3 320kbps / WAV 48kHz 24bit

【分辨率标准】
| 素材类型    | 分辨率     | 说明         |
|-------------|-----------|-------------|
| 导航图标     | 256×256   | 1:1, 透明底  |
| 预览图       | 960×540   | 16:9        |
| Logo 图标   | 256×256   | 1:1, 透明底  |

【通用负面约束】
- 不出现低质量、模糊、像素化
- 不出现文字/水印/签名
- 不出现真人照片/写实风格 (统一数字艺术/游戏美术风格)
- 不出现过度曝光或纯黑不可见区域
```

### 5.2 导航图标

**设计规范**：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  导航图标设计规范
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 尺寸: 256×256 px
- 透明底, 主体占中央 192×192, 32px 安全边距
- 每个图标 2 个变体:
  - default: 柔和/半透明, 未选中态
  - active: 发光/饱和, 选中态
- 线条粗细: 2-3px 等效
- 风格须与主题整体视觉方向一致
```

**Prompt 模板** (5 个图标 × 2 变体)：

```
UI navigation icon — [功能名], [主题风格描述]

【图标】[具体形态描述, 如 "房屋轮廓" / "播放三角形" / "音符+声波"]
【风格】[主题视觉风格关键词]
【规格】256×256, 透明底, 32px 安全边距, WebP
【负面】不要复杂细节、不要多色混乱、不要3D立体感、不要文字
```

**5 个功能图标清单**：

| 功能 | 图标方向 | 文件 |
|------|---------|------|
| 首页 (home) | 房屋/主页形状 | `home.webp` / `home-active.webp` |
| 电影 (movies) | 播放按钮+胶片元素 | `movie.webp` / `movie-active.webp` |
| 图片 (images) | 山/太阳/相框 | `pic.webp` / `pic-active.webp` |
| 音乐 (music) | 音符/声波/均衡器 | `music.webp` / `music-active.webp` |
| 游戏 (games) | 手柄/十字键/菱形 | `game.webp` / `game-active.webp` |

### 5.3 Logo 图标

**Prompt 模板**：

```
App logo icon — [主题名]

【设计】[Logo形态描述]
【风格】[主题视觉风格]
- 简洁, 高辨识度, 小尺寸(32×32px)仍可辨识
- 256×256, 透明底, WebP
【负面】不要文字、不要复杂细节
```

### 5.4 预览图

**Prompt 模板**：

```
Theme preview mockup — [主题名]

【画面】展示主题应用到应用界面的效果:
- [主题风格] 的 Header 导航栏 + 图标
- 玻璃拟态卡片悬浮于[背景描述]之上
- 主题强调色醒目可见
- 类似应用商店截图, 干净展示

【规格】960×540, 16:9, WebP
【负面】不出现真实文字内容、不出现具体数据、不出现真人照片
```

### 5.5 UI 音效

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  UI 音效设计规范
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 格式: MP3 320kbps 或 WAV 48kHz
- 峰值: -6dBFS
- 风格须与主题整体氛围一致

| 文件 | 触发场景 | 时长 |
|------|---------|------|
| `sfx-hover.mp3` | 按钮/卡片/列表项 hover | ~80ms |
| `sfx-click.mp3` | 按钮点击、链接、开关切换 | ~120ms |
| `sfx-menu-open.mp3` | 展开菜单、QuickHub、下拉面板 | ~150ms |
| `sfx-menu-close.mp3` | 收起菜单、关闭面板、返回 | ~150ms |
| `sfx-dialog-open.mp3` | 打开设置面板、确认框、模态窗口 | ~200ms |
| `sfx-dialog-close.mp3` | 关闭设置面板、取消对话框 | ~180ms |
| `sfx-notification.mp3` | Toast 弹出、系统提示 | ~200ms |
| `sfx-transition.mp3` | 页面切换 | ~300ms |
| `sfx-startup.mp3` | 应用启动 | ~800ms |
| `sfx-countdown-alert.mp3` | 倒计时结束提醒 | ~400ms |
| `sfx-countdown-tick.mp3` | 倒计时最后 5 秒每秒滴答 | ~50ms |
```

**Prompt 模板**：

```
UI sound effect set — [主题名]

【音色方向】[一句话概括, 如 "柔和圆润" / "清脆水晶感" / "数字电子感"]

【每个音效的具体方向】:
- hover:            [短促柔和反馈音, 如 "sine wave 2000Hz, 10ms attack, 50ms decay"]
- click:            [确认点击感, 如 "800Hz + 1200Hz 双音叠加, 15ms attack, 80ms decay"]
- menuOpen:         [展开/弹出感, 如 "音高上升 sweep + 轻微空间感, 150ms"]
- menuClose:        [收起/回落感, 如 "音高下降 sweep, 150ms"]
- dialogOpen:       [面板出现感, 如 "柔和上升和弦 + 短混响, 200ms"]
- dialogClose:      [面板消失感, 如 "反向播放 dialogOpen 或音高下降, 180ms"]
- notification:     [轻提醒感, 如 "3000Hz bell, 100ms, 谐波丰富"]
- pageTransition:   [场景切换感, 如 "多音高上行琶音, 300ms"]
- startup:          [启动仪式感, 如 "温暖合成器 pad + 和弦, slow attack 800ms"]
- countdownAlert:   [紧急提醒感, 如 "快速脉冲音 + 升高音调, 400ms"]
- countdownTick:    [秒针滴答感, 如 "短促 click, 1000Hz, 20ms, 每秒一次"]

【通用要求】
- 录音棚品质, 无背景噪音
- 所有音效峰值统一 -6dBFS
- 单声道, WAV 48kHz 24bit 或 MP3 320kbps
- 匹配主题世界观, 不违和
- 同一主题内所有音效音色统一、有家族感
```

---

## 6. 主题引擎架构

### 6.1 数据流

```
┌───────────┐   Rust unpacker    ┌──────────────┐   CSS vars    ┌──────────────┐
│ .nvtp     │──────────────────→│ Theme Engine  │─────────────→│ WebView DOM  │
│           │  decrypt + parse  │ (Rust side)   │  inject via  │              │
└───────────┘                   │               │  Tauri IPC   │              │
                                │ - 加载 theme.json            │              │
                                │ - inherit 合并 default       │              │
                                │ - 用户覆盖合并               │              │
                                │ - 注入 CSS 变量到 <html>     │              │
                                └──────────────┘               │              │
                                                               │              │
  nova:// protocol ←── asset on-demand (icons/audio)           │              │
                                                               │              │
  ┌──────────────────────────────────────────────────────────┐ │              │
  │  组件渲染 (不再有任何 theme=== 条件分支)                    │ │              │
  │  className="bg-[var(--nv-button-primaryBg)]"             │ │              │
  │  style={{borderRadius: 'var(--nv-button-radius)'}}       │ │              │
  └──────────────────────────────────────────────────────────┘ │
```

### 6.2 Rust 侧职责

- 解析 `theme.json` → `ThemeTokens` 结构体
- `inherits` 合并逻辑：先加载 default → 再逐层覆盖
- 用户覆盖合并（从 SettingsStore 读取）
- 生成完整 CSS 变量字符串，通过 Tauri IPC 注入 `<html>` 的 `<style>` 标签
- 主题切换时重新计算 + 重新注入

### 6.3 前端改造原则

**靶子**：消除所有 `[data-theme="xxx"]` CSS 选择器和 `theme === "xxx"` JS 条件分支。

| 当前模式 | 改造后 |
|---------|--------|
| `[data-theme="xxx"] .my-class { color: #abc }` | `.my-class { color: var(--nv-xxx) }` |
| `const isX = theme === "xxx"` | 删除，组件只读 CSS 变量 |
| `className={isX ? "x-class" : ""}` | `className="generic-class"` |
| hardcoded 颜色数组中取值 | `var(--nv-nav-{page}-color)` |
| 硬编码 glass 参数 | `var(--nv-glass-{area}-opacity)` |

---

## 7. 实现路线图

### Phase 1 — 基础设施 (前端不感知)

1. **Rust**: `ThemeTokens` 结构体 + `theme.json` 反序列化
2. **Rust**: `inherits` 合并引擎
3. **Rust**: CSS 变量注入管道 (Rust → IPC → WebView `<style>`)
4. **default/theme.json**: 内置在 binary 中 (编译时 `include_str!`)
5. **JSON Schema**: `theme-v2.schema.json` (校验用)

### Phase 2 — 前端迁移

1. 删除 `[data-theme="xxx"]` CSS 选择器 → CSS 变量引用
2. 删除 `theme === "xxx"` JS 条件分支
3. 改造 `Layout.tsx` — 删除硬编码主题映射
4. 改造 `index.css` — 精简为通用样式
5. 改造 `SettingsDialog.tsx` — 玻璃/颜色面板读 token 默认值
6. 改造 `useThemeEffects.ts` — 废弃或简化

### Phase 3 — 素材生成与打包 (并行)

1. AI 批量生成 default 主题 UI 素材 (icons ×11, preview ×1, sfx ×7)
2. 素材 QA：分辨率、透明底、色彩检查
3. 新版打包脚本 (`theme-pack.mjs`) — 按新结构打包 .nvtp
4. default 主题产出完整 .nvtp 作为参考实现

### Phase 4 — 高级特性 (远期)

- 主题在线更新
- 社区主题上传/分享
- 音效引擎 (全局 hover/click 事件监听)
- 亮色模式支持

---

## 8. 实现踩坑记录 (Lessons Learned)

> **以下每个坑都真实踩过，每个修复方案都经过验证。开发新主题时必须逐条核对。**

### 8.1 CSS 注入优先级

**问题**：`get_theme_css_vars` 返回 `:root { --nv-xxx: ... }` CSS 块，注入到 `<style>` 标签后，被 Tailwind v4 的 `@theme` 编译规则和后续样式表覆盖。`!important` 在 stylesheet 中也不能保证优先级。

**修复**：用 `document.documentElement.style.setProperty(key, value, "important")` **行内样式**注入。行内样式优先级高于任何 stylesheet。

**规则**：**主题 Token 的前端注入必须用 JavaScript 行内样式，不能依赖 CSS 样式表。**

### 8.2 Tailwind v4 `@theme` 编译覆盖

**问题**：`index.css` 中的 `@theme { --color-primary: var(--color-primary); }` 被 Tailwind v4 编译为 `:root, :host { --color-primary: #4788f0; }`，把 CSS 变量解析为编译时的字面值，绕过了 `var()` 间接引用。

**修复**：行内样式 + `"important"` 优先级。不做 `@theme` 桥接，直接在 `<html>` 行长写入最终值。

**规则**：**不要在 `@theme` 块中做 `var()` 桥接。Tailwind v4 会编译时展开变量。**

### 8.3 `useThemeEffects` 覆盖 Token 引擎

**问题**：`useThemeEffects` → `applySurface()` → `applyPalette()` 每次渲染时把 `--color-primary` 写成 default 蓝色行内样式，覆盖了 Token 引擎的注入。

**修复**：`useThemeEffects` 中判断 `if (!isDefault) return`，跳过所有 `applySurface()` 调用。

**规则**：**useThemeEffects 的 applySurface/applyPalette 只对 default 主题生效。非 default 主题的 CSS 变量由 useThemeTokens 全权接管。**

### 8.4 用户色板覆盖主题色

**问题**：`buildUserOverrides()` 发送 `{colors: {primary: "#4788f0"}}` 作为 userOverrides，Rust 合并时直接覆盖了主题定义的颜色。

**根因**：`paletteCustomized` 默认为 `true`（老版本遗留），`paletteAccent` 默认 `#4788f0`。

**修复**：
1. `useThemeTokens` 的 `buildUserOverrides()` 不再发送 `colors` 字段 — 主题色由 `theme.json` 定义
2. `setTheme` 切换到非 default 主题时，重置 `paletteCustomized = false`

**规则**：**非 default 主题不使用用户色板。theme.json 中的 colors 是主题的权威色值。**

### 8.5 `.nvtp` 文件存储路径不一致

**问题**：`loader::install_theme` 写入 `{app_data_dir}/data/themes/nvtp/`（`Database.data_dir()`），`protocol::init_protocol` 读取 `{app_data_dir}/themes/nvtp/`（`app.path().app_data_dir()`）。重启后 protocol 找不到已安装的 `.nvtp`。

**修复**：`lib.rs` 中 protocol 路径改为 `database.data_dir().join("themes").join("nvtp")`，与 loader 保持一致。

**规则**：**protocol 和 loader 必须使用同一个 nvtp 目录。都走 `Database.data_dir()`。**

### 8.6 Protocol 缓存为空

**问题**：`get_theme_css_vars` 调用 `proto.read_file()` 读 theme.json，但 protocol 缓存只在安装时或 `nova://` URL 请求时加载。重启后缓存为空，`read_file` 返回 `None` → fallback 到 default token。

**修复**：`get_theme_css_vars` / `get_theme_css_json` 中先调 `proto.ensure_loaded(&theme_id)` 再读文件。

**规则**：**读 protocol 缓存前必须先 ensure_loaded。不要假设缓存已经存在。**

### 8.7 Manifest 字段命名

**问题**：Rust `ThemeManifest` 标注 `#[serde(rename_all = "camelCase")]`，要求 `requiresLicense`、`cssFile`。构建脚本（`theme-pack.mjs`/`build-cyberpunk.mjs`）写的是 `requires_license`、`css_file`，导致 parse error。

**修复**：构建脚本改为 camelCase。

**规则**：**Manifest JSON 与 Rust ThemeManifest 的字段命名必须一致（camelCase）。构建脚本必须输出 camelCase。**

### 8.8 `.nvtp` 二进制偏移量

**问题**：用 `Buffer.alloc(10 + 2 + idLen + 4 + mjLen + 8 + bodyLen)` 预分配，`1*0 + 2` ≠ `1*2`，多出来的零填充字节被写入文件，导致 Rust unpacker 校验 `zlen ≠ remaining`。

**修复**：Header 和 Body 分别用 `Buffer.concat([header, body])` 拼接，精确控制字节数。

**规则**：**构建 .nvtp 二进制时使用 Buffer.concat，不要 Buffer.alloc 预分配。写完后验证 zlen = 文件剩余字节。**

### 8.9 `nova://` 协议在 Dev 模式不支持 `<img>` 标签

**问题**：Vite 开发服务器不识别 `nova://` 协议，`<img src="nova://localhost/cyberpunk/icons/home.webp">` 加载失败（`ERR_UNKNOWN_URL_SCHEME`）。

**修复**：构建时把图标、theme.css、SFX 复制到 `public/themes/{id}/`，Vite 开发服务器直接提供静态文件。`themeUrl()` 对已知主题返回 `/themes/...` 路径。

**规则**：**Dev 模式下的主题素材必须复制到 public/ 目录。themeUrl 对 VITE_LICENSE_TIER 环境返回 Vite 路径。**

### 8.10 导航图标容器裁剪

**问题**：`Layout.tsx` 中导航图标用 `rounded-full overflow-hidden` 包裹，非圆形的 WebP 图标被裁剪成不规则的圆形。

**修复**：非 default 主题改用 `rounded-lg`，不裁剪 `overflow-hidden`。

**规则**：**导航图标容器不要用 rounded-full。用 rounded-lg，让图标保持原始形状。**

### 8.11 WebP 图标颜色 vs CSS 发光

**问题**：IconsNeon 图标转 WebP 后，SVG 的 `currentColor` 和 CSS `drop-shadow` 发光特效全部丢失。WebP 是静态位图，不支持 CSS 滤镜叠加。

**修复**：渲染 WebP 时把 hex 颜色**烧进 SVG stroke 属性**，并**在 SVG 内部嵌入 feGaussianBlur 发光滤镜**，然后再 rasterize。CSS glow 作为额外的 drop-shadow 增强。

**规则**：**转 WebP 前必须把 hex 色烧进 stroke，并在 SVG 内嵌 feGaussianBlur 发光滤镜。WebP 是位图，不支持 currentColor。**

### 8.12 `isDefault` 条件导致非 default 主题功能缺失

**问题**：多处代码硬编码了 `theme === "default"` 门控：
- `WallpaperEngine` 只在 `isDefault` 渲染 → 非 default 主题无法显示壁纸
- Settings 壁纸面板 `{theme === "default" && ...}` → 非 default 主题无法配置壁纸
- MovieLibrary/ImageLibrary 设壁纸后 `setTheme("default")` → 强制切回默认主题

**修复**：改为 `!(isIce || isCG)` — 只有 ice-girl 和 cyber-girl 两个老主题用自定义视频背景，其他所有主题（包括新 .nvtp 主题）都走 WallpaperEngine。

**规则**：**不要用 `isDefault` 门控功能。用 `!(isIce || isCG)`，确保 .nvtp 主题能正常使用壁纸。**

### 8.13 `ThemeName` 类型不能写死

**问题**：`ThemeName = "default" | "ice-girl" | "cyber-girl"` 字面量联合类型，无法表示新安装的 .nvtp 主题 ID。

**修复**：`ThemeName = string`。`useAvailableThemes()` 从 `themePackStore.installedThemes` 动态读取已安装主题 ID。

**规则**：**ThemeName 必须是 string，不能是字面量联合类型。主题列表从 themePackStore 动态生成。**

### 8.14 同一主题再次选择不触发渲染

**问题**：用户点击 cyberpunk 时 `setTheme("cyberpunk")`，但 `prev === t`，state 不变，`useThemeTokens` 的 `useEffect` 不重新执行。

**修复**：`themeStore` 增加 `themeVersion` 计数器，每次 `setTheme` 自增。`useThemeTokens` 监听 `themeVersion`。

**规则**：**非 default 主题的 CSS 注入逻辑必须监听 themeVersion，确保同主题重复选择时也能刷新。**

### 8.15 主题 CSS 文件加载方式

**问题**：用 `<link rel="stylesheet">` 动态加载 theme.css，链接 URL 在 dev 和 prod 间不一致，且 `<style>` 标签更可靠。`@import` 在 fetch 注入的 `<style>` 中不会解析相对路径。

**修复**：
1. neon-icons.css 和 theme.css 分别 `fetch()` → `<style>.textContent` 注入
2. theme.css 中的 `@import` 移除，改为两个独立 `<style>` 标签

**规则**：**主题 CSS 用 fetch() + textContent 注入 <style>，不用 <link>。多个 CSS 文件各自独立注入，不用 @import。**

---

## 附录 A：现有代码改造映射

| 当前实现 | 位置 | 改造方向 |
|---------|------|---------|
| `iceIcons` / `cgIcons` 硬编码 | `Layout.tsx:60-66` | → 删除，读 `var(--nv-nav-*-icon)` |
| `iceColors` / `cgColors` 硬编码 | `Layout.tsx:62,67` | → 删除，读 `var(--nv-nav-*-color)` |
| `iceNames` / `cgNames` i18n 映射 | `Layout.tsx:61,66` | → 删除 |
| `themeMeta` 对象 | `Layout.tsx:70-74` | → 删除 |
| `layoutBandHue()` | `Layout.tsx:76-81` | → 删除 |
| `isIce` / `isCG` / `isDefault` | `Layout.tsx` 多处 | → 删除，通用样式 |
| `[data-theme="ice-girl"]` 块 | `index.css:158-200` | → 删除，改为 CSS 变量 |
| `[data-theme="cyber-girl"]` 块 | `index.css:201-254` | → 删除，改为 CSS 变量 |
| `isCG ? "cg-text-glow" : ""` | `SettingsDialog.tsx` 多处 | → 通用 `theme-text-glow` + `var()` |
| `isCG ? border + boxShadow : ...` | `SettingsDialog.tsx:184-185` | → `var(--nv-dialog-*)` |
| 玻璃效果公式硬编码 | `Layout.tsx:503-506` | → `var(--nv-glass-header-*)` |
| `useThemeEffects.ts` 全文件 | `src/hooks/` | → 废弃或简化为 IPC 调用 |
