# Nova Media Manager — 功能分层与商业化规划

> 2026-07-13 · 基于完整代码审计 + 主题架构重构

## 一、当前状态

### 1.1 已实现的功能

| 类别 | 功能 | 完成度 |
|------|------|--------|
| 影音管理 | 电影/音乐/图片/游戏 增删改查、批量、拖放导入、搜索、标签过滤 | 95% |
| 元数据 | ffprobe 封面提取、视频转 WebP、元数据探测 | 90% |
| 音频播放器 | 播放/暂停/搜索/音量、播放列表、LRC 歌词、可视化频谱、后台播放、迷你播放器 | 90% |
| 文件浏览器 | 驱动器枚举、目录列表、复制/剪切/粘贴/删除/重命名、固定文件夹 | 85% |
| Steam 集成 | 扫描已安装游戏、自动检测 EXE、去重 | 90% |
| 桌面小部件 | 我的电脑、系统监控、时钟、日历、倒计时 | 80% |
| 全局搜索 | Ctrl+K、跨库搜索、键盘导航 | 85% |
| 设置 | 语言(7种)、字体/图标大小、调色板、背景视频模式、导出/导入 | 85% |
| 主题系统 | CSS 变量、data-theme 驱动、入场动画 | 80% |
| 主题包 .nvtp | 加密/ZIP/打包/解包/安装/卸载 | 80% |
| 许可证系统 | 激活码验证、JWT Token、设备指纹、服务器校验 | 75% |
| 更新系统 | Tauri updater 端点、版本检查、进度下载 | 90% |
| 数据导出/导入 | SQLite + 封面 ZIP 打包/恢复 | 80% |
| 错误处理 | 崩溃日志、React ErrorBoundary、文件日志 | 85% |
| 分析 | 匿名事件追踪、sendBeacon 刷新 | 80% |

### 1.2 已移除/未实现

| 功能 | 状态 |
|------|------|
| 8 个废弃主题 (FF7/OW/原神/CS2/PG/BW/rose/light) | 已从代码中移除 |
| 云端数据同步 | 未实现 |
| 副屏多显示器 | 有框架，未完工 |
| 内置视频播放器 | 存在但简陋 |
| 许可证激活全链路 | SERVER_URL 刚修复，未端到端测试 |

---

## 二、主题架构设计

### 2.1 核心原则

```
┌─────────────────────────────────────────────────────┐
│  用户 git clone / 下载 MSI                            │
│  └→ 只有 1 个内置主题：default                        │
│     - 简约深蓝风格                                    │
│     - 基础仪表盘（媒体统计 + 最近项目 + 标签云）       │
│     - 无角色图标、无剧情、无背景视频                  │
│     - 永久免费、无需联网                              │
└─────────────────────────────────────────────────────┘
                           │
                           ▼ 用户激活 Pro/Ultra 许可证
┌─────────────────────────────────────────────────────┐
│  自动从服务器获取可用 .nvtp 主题包列表               │
│  └→ 下载 ice-girl、cyber-girl 等 premium 主题        │
│     - 展开到 {app_data}/themes/{theme_id}/            │
│     - 注册到 registry.json                           │
│     - 出现在设置 → 外观 主题列表中                    │
│     - CSS + 素材全部从本地加载                        │
└─────────────────────────────────────────────────────┘
                           │
                           ▼ 订阅到期
┌─────────────────────────────────────────────────────┐
│  已下载主题文件保留（不删），但切换被禁用              │
│  - 默认切回 default                                  │
│  - 重新订阅后自动恢复                                 │
│  - 新版本主题静默更新                                │
└─────────────────────────────────────────────────────┘
```

### 2.2 什么是"插件形式"

主题不是代码的一部分，而是**数据**：

```
.nvtp 包 = 加密 ZIP 包含：
  ├── manifest.json     ← 名称、版本、许可证要求
  ├── theme.css         ← CSS 变量 + 样式
  ├── preview.webp      ← 设置页缩略图
  ├── pic/*.webp        ← 图片素材
  ├── video/*.mp4       ← 视频素材（可选）
  └── icons/*.webp      ← 角色图标
```

- **不存在导入/导出按钮**：用户不碰文件
- **不存在手动安装路径**：不提供 `install_theme_file` UI 入口
- **自动下载**：App 启动时检查许可证 → 拉取主题列表 → 下载未安装的主题
- **自动更新**：主题作者发新版 → 客户端下次启动自动拉取

### 2.3 主题生命周期

```
创作者                         服务器                    用户
────────────────────────────────────────────────────────────
写 manifest.json
+ prompts.json
│
├─ theme-generate.mjs ──→  AI 生成素材
│
├─ theme-pack.mjs     ──→  POST /api/admin/themes/pack
│                           └→ .nvtp 写入 /var/www/themes/
│                           └→ 更新主题列表
│                                                  ┌─ 许可证有效？
│                                                  │  YES → 下载 + 安装
│  POST /api/admin/themes/publish                   │  NO  → 仅列表可见(带🔒)
│                           └→ 标记 published        │
│                                                  └─ 主题出现在设置页
│
│  新版 manifest → 再发布     └→ 版本号递增          └→ 静默更新
```

---

## 三、功能分层矩阵

### 3.1 三档定价

| | 社区版 Free | 标准版 Pro | 旗舰版 Ultra |
|---|---|---|---|
| 价格 | 免费 | ¥22/月 ¥168/年 ¥899/永久 | ¥39/月 ¥328/年 ¥1599/永久 |
| 定位 | 基础影音管理 | 全套沉浸体验 | 多设备 + 定制 |

### 3.2 完整功能对照表

#### 🎨 主题

| 功能 | Free | Pro | Ultra |
|------|:---:|:---:|:----:|
| default 主题 | ✅ | ✅ | ✅ |
| 自定义调色板 | ✅ | ✅ | ✅ |
| premium 主题下载 | ❌ | ✅ | ✅ |
| 已安装 premium 主题数 | 0 | 无限 | 无限 |
| 主题自动更新 | ❌ | ✅ | ✅ |
| 订阅到期后 premium 主题 | 🔒 | 🔒 | 🔒 |

#### 🎬 影音管理

| 功能 | Free | Pro | Ultra |
|------|:---:|:---:|:----:|
| 电影/音乐/图片/游戏基本管理 | ✅ | ✅ | ✅ |
| ffprobe 元数据 | ✅ | ✅ | ✅ |
| 批量操作 | ✅ | ✅ | ✅ |
| 标签过滤 | ✅ | ✅ | ✅ |
| 全局搜索 | ✅ | ✅ | ✅ |
| Steam 扫描 | ✅ | ✅ | ✅ |
| 文件资源管理器 | ✅ | ✅ | ✅ |

#### 🎧 音频播放器

| 功能 | Free | Pro | Ultra |
|------|:---:|:---:|:----:|
| 基本播放（播放/暂停/上下曲/音量）| ✅ | ✅ | ✅ |
| 播放列表 | ✅ | ✅ | ✅ |
| 后台播放 | ✅ | ✅ | ✅ |
| LRC 歌词显示 | ❌ | ✅ | ✅ |
| 可视化频谱 | ❌ | ✅ | ✅ |
| 自定义歌词颜色 | ❌ | ✅ | ✅ |

#### 🧩 桌面小部件

| 功能 | Free | Pro | Ultra |
|------|:---:|:---:|:----:|
| 时钟 | ✅ | ✅ | ✅ |
| 日历 | ✅ | ✅ | ✅ |
| 我的电脑 | ❌ | ✅ | ✅ |
| 系统监控 | ❌ | ✅ | ✅ |
| 倒计时 | ❌ | ✅ | ✅ |

#### ⚙️ 系统

| 功能 | Free | Pro | Ultra |
|------|:---:|:---:|:----:|
| 自定义调色板/字体/图标大小 | ✅ | ✅ | ✅ |
| 数据导出/导入 | ✅ | ✅ | ✅ |
| 自动更新通道 | ❌ | ✅ | ✅ |
| 隐私分析（可选）| ✅ | ✅ | ✅ |
| 多显示器副屏 | ❌ | ❌ | ✅ |
| 云端数据同步 | ❌ | ❌ | ✅ |
| 设备绑定数 | 1 台 | 1 台 | 3 台 |

### 3.3 实施优先级

| P0 - 立刻 | P1 - 本阶段 | P2 - 下一阶段 |
|-----------|-------------|---------------|
| 🎨 主题门控（default only for free）| 🎧 可视化器门控 | ☁️ 云端同步 |
| 🔒 许可证检查 hook | 🧩 小部件门控 | 🖥️ 副屏完善 |
| 📦 .nvtp 自动下载流程 | 🎵 歌词门控 | 📊 使用数据看板 |
| 📋 主题列表 API 完善 | 🔄 自动更新分级推送 | 💬 主题剧情补完 |

---

## 四、主题门控实现方案

### 4.1 前端许可证 hook

```ts
// src/lib/useLicense.ts (新增)
import { useLicenseStore } from "@/stores/licenseStore";

export type FeatureFlag = 
  | "premium-theme"   // 非 default 主题
  | "lyrics"          // LRC 歌词
  | "visualizer"      // 可视化频谱
  | "widget-advanced" // 系统监控/我的电脑/倒计时
  | "secondary-screen"
  | "cloud-sync";

export function useGate(feature: FeatureFlag): boolean {
  const tier = useLicenseStore((s) => s.tier); // "free" | "pro" | "ultra" | "custom"
  switch (feature) {
    case "premium-theme":
    case "lyrics":
    case "visualizer":
    case "widget-advanced":
      return tier !== "free";
    case "secondary-screen":
    case "cloud-sync":
      return tier === "ultra" || tier === "custom";
    default:
      return false;
  }
}
```

### 4.2 主题商店集成

```ts
// themeStore.ts 改造
export function useAvailableThemes(): ThemeName[] {
  const { tier } = useLicenseStore();
  const installed = useThemePackStore((s) => s.installed); // from .nvtp registry
  if (tier === "free") return ["default"];
  // Pro+: default + all installed premium themes
  const ids = installed.map(t => t.id as ThemeName);
  return ["default", ...ids.filter(id => id !== "default")];
}
```

### 4.3 自动下载流程

```
App 启动
  └→ LicenseStore.init()
     └→ 许可证有效 (Pro/Ultra)?
        YES → ThemePackStore.sync()
           ├→ GET /api/themes/list
           ├→ 比较本地 registry
           ├→ 下载未安装的主题 (.nvtp)
           ├→ 安装到 {app_data}/themes/
           └→ 新版本覆盖旧版本
        NO → 跳过，仅 default 可用
```

---

## 五、主题创作自动化方案

### 5.1 AI 工具链

```
火山引擎 API（官方、商用合规）
├── 即梦 5.0 Lite → 图片生成，¥0.02-0.05/张，2K/4K
├── Seedance 2.0 Pro → 视频生成，¥1/秒，最长 15s
└── ARK_API_KEY 全局鉴权

备选：doubao-ai-toolkit CLI → 一行命令调 API
备选：jimeng-free-api-all → 自部署，每日免费 66 积分
```

### 5.2 主题创作工作流

```
1. 写 prompts.json（固定风格模板 + 可变场景描述）
2. node scripts/theme-generate.mjs cyber-girl
   → 批量调用 API → 输出到 D:\nova-themes-assets\cyber-girl\
3. （可选）手动筛选/替换不满意的素材
4. node scripts/theme-pack.mjs cyber-girl
   → 收集素材 + manifest → 调服务器 API 打包 .nvtp
5. node scripts/theme-pack.mjs cyber-girl --publish
   → 上传 CDN + 更新主题列表
```

### 5.3 素材管理

```
D:\nova-themes-assets\   ← Syncthing 自动双机同步（局域网）
├── ice-girl\
│   ├── pic\*.webp
│   └── video\*.mp4
└── cyber-girl\
    ├── pic\*.webp
    └── video\*.mp4

D:\nova-proprietary\themes\  ← Git 私库（元数据 + 提示词）
├── ice-girl\
│   ├── manifest.json
│   └── prompts.json
└── cyber-girl\
    ├── manifest.json
    └── prompts.json
```

---

## 六、后续主题思路

| 主题 | 方向 | 需要素材量 |
|------|------|-----------|
| **ice-girl (冰霜女皇)** | 傲慢女法师，冰雪法术，嘴臭可爱 | 6 角色图标 + 16 句语音 + 3-5 视频 |
| **cyber-girl (代码幽灵)** | 绫，赛博巡卫，战术战斗 | 6 角色图标 + 16 场景图 + 5-8 视频 |
| **future: dark-soul** | 暗黑风格，灰烬与火焰 | 待定 |
| **future: wuxia** | 古风武侠，水墨意境 | 待定 |
| **future: mecha** | 机甲格纳库，钢铁浪漫 | 待定 |

每个新主题开发周期：写提示词(1-2天) + AI 生成素材(几小时) + 筛选调优(1-2天) + CSS 样式(1天)

---

## 七、下一步行动

### 本周
- [ ] 实现 `useGate()` hook
- [ ] 主题切换器门控：free 不可选 premium
- [ ] .nvtp 自动下载流程（ThemePackStore.sync）
- [ ] 补全 ice-girl 的 zh.json 台词

### 下次
- [ ] 可视化频谱门控
- [ ] 小部件门控
- [ ] 自动更新 Pro+ 专属推送

### 以后
- [ ] 云同步
- [ ] 副屏完善
- [ ] ice-girl + cyber-girl 素材用 AI 批量补全
