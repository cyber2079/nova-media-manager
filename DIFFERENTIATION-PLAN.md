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

### 3.1 定价

两档。没有月付，没有年付。一次性。

| | 社区版 Free | 永久会员 Member |
|---|---|---|
| 价格 | 免费 | ¥199 |
| 定位 | 全功能影音管理 | + 全部精美主题 + 自动更新 |
| 时长 | 永久 | 永久 |
| 设备 | 1 | 1（一码一机） |

### 3.2 功能对照

#### 🎨 主题

| 功能 | Free | Member |
|------|:------:|
| default 主题 | ✅ | ✅ |
| 自定义调色板 | ✅ | ✅ |
| premium 主题下载 | ❌ | ✅ |
| 已安装 premium 主题数 | 0 | 无限 |
| 主题自动更新 | ❌ | ✅ |
| 订阅到期后 premium 主题 | 🔒 | 🔒 |

#### 🎬 影音管理

| 功能 | Free | Member |
|------|:------:|
| 电影/音乐/图片/游戏基本管理 | ✅ | ✅ |
| ffprobe 元数据 | ✅ | ✅ |
| 批量操作 | ✅ | ✅ |
| 标签过滤 | ✅ | ✅ |
| 全局搜索 | ✅ | ✅ |
| Steam 扫描 | ✅ | ✅ |
| 文件资源管理器 | ✅ | ✅ |

#### 🎧 音频播放器

| 功能 | Free | Member |
|------|:------:|
| 基本播放（播放/暂停/上下曲/音量）| ✅ | ✅ |
| 播放列表 | ✅ | ✅ |
| 后台播放 | ✅ | ✅ |
| LRC 歌词显示 | ✅ | ✅ |
| 可视化频谱 | ✅ | ✅ |
| 自定义歌词颜色 | ✅ | ✅ |

#### 🧩 桌面小部件

| 功能 | Free | Member |
|------|:------:|
| 时钟 | ✅ | ✅ |
| 日历 | ✅ | ✅ |
| 我的电脑 | ✅ | ✅ |
| 系统监控 | ✅ | ✅ |
| 倒计时 | ✅ | ✅ |

#### ⚙️ 系统

| 功能 | Free | Member |
|------|:------:|
| 自定义调色板/字体/图标大小 | ✅ | ✅ |
| 数据导出/导入 | ✅ | ✅ |
| 自动更新通道 | ❌ | ✅ |
| 隐私分析（可选）| ✅ | ✅ |
| 多显示器副屏 | ❌ | ❌ |
| 云端数据同步 | ❌ | ❌ |
| 设备绑定 | 一码一机 | 一码一机 |

### 3.3 实施优先级

#### ✅ P0 · 许可证 + 主题安全 — 全部完成

| 任务 | 说明 |
|---|---|
| `useGate()` hook | `src/lib/useGate.ts` — 4 个 FeatureFlag |
| OnboardingDialog 首次引导框 | 免费使用 / 激活码 → 下载进度条 |
| `useAvailableThemes()` 主题门控 | loaded 检查防竞态 |
| .nvtp 自动下载 + 中断恢复 | 进度条 + 启动时版本号对比自动补 |
| Tauri custom protocol | `nova://` → 内存解密，明文不落地 |
| 一机一码 + 解绑规则 | 30天锁定期 / 365天3次上限 |
| 30d/365d 精确倒计时 | 设置页实时显示，最后24h HH:MM:SS |
| 7天联网校验 + 30天宽限 | 双时间戳防改时钟 |
| 爱发电卡密系统 | 🔴 阻塞 — 爱发电认证待通过 |

#### ✅ S1 · 安全加固 — 全部完成

| 任务 | 说明 |
|---|---|
| 禁用 F12 | `tauri.conf.json` — `devtools: false` |
| CSP 清理 | `nova:` 协议加入 img-src/media-src |
| 右键/拖拽/F12 拦截 | `useSecurity.ts` — production only |

#### ✅ P1 · 完成项

| 任务 | 说明 |
|---|---|
| 主题列表 API | `GET /api/themes/list` → ice-girl + cyber-girl |
| 主题打包脚本 | `theme-pack.mjs` — 本地ZIP+XOR → scp 到 ECS CDN |
| 素材规范化 | ice-girl 174→25 / cyber-girl 86→35 |
| Scene 脚本系统 | Theme Studio + `manifest.script[]` 驱动打字机 |
| 自动更新分级 | Free→GitHub / Pro+→自动下载+进度条 |
| media_library.db 迁移 | DB 移至 `data/` 子目录，与缓存隔离 |
| Landing Page `/recover.html` | 强制解绑 + 订单号验证 |

#### ⬜ P1 · 剩余

| 任务 |
|---|
| AI 素材批量补全 (ice-girl + cyber-girl) |
| 剧情补完 (台词 + en 翻译) |
| 新主题开发 (可爱风 / 治愈 / 像素 — 见 theme-strategy.md) |

#### ⬜ P2

| 任务 |
|---|
| ☁️ 云端数据同步 |
| 🖥️ 副屏完善 |
| 📊 使用数据看板 |
| 🛡️ 异常检测 |
| 🎨 Theme Studio 打磨 (AI 一键生成全链路) |

---

## 四、主题门控实现方案

### 4.1 前端许可证 hook

```ts
// src/lib/useGate.ts (新增)
// Gating philosophy: Free = complete media manager.
// Pro/Ultra = premium content + infrastructure. Never gate basic tools.
import { useLicenseStore } from "@/stores/licenseStore";

export type FeatureFlag = 
  | "premium-theme"    // 非 default 主题
  | "auto-update"      // 自动更新分级推送
  | "secondary-screen" // 多显示器副屏
  | "cloud-sync";      // 云端数据同步

export function useGate(feature: FeatureFlag): boolean {
  const tier = useLicenseStore((s) => s.license.tier);

  switch (feature) {
    case "premium-theme":
    case "auto-update":
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

### 4.4 一机一码 + 解绑规则

**核心规则**：一个激活码同一时刻只绑定一台设备。

| 规则 | 值 |
|---|---|
| 绑定上限 | 1 台设备 |
| 激活后锁定期 | 30 天内不可解绑 |
| 滚动解绑上限 | 每 365 天最多 3 次 |
| 月付时长 | 激活时刻 + **30 天**（精确到秒） |
| 年付时长 | 激活时刻 + **365 天**（精确到秒） |
| 最后 24h | 前端实时倒计时 HH:MM:SS |
| 强制解绑 | Landing Page `/recover` — 需激活码 + 爱发电订单号 |

**解绑流程**：

```
App 内解绑（正常换设备）：
  设置 → 许可证 → 解除绑定 → 确认 → 码立即释放 → 30 天锁定期 → 新设备立即可激活

Landing Page 强制解绑（旧设备丢失）：
  /recover → 激活码 + 订单号 → 验证 → 立即释放 → 无冷却
  限制：每 90 天最多 1 次
```

### 4.5 主题安全架构

**设计目标**：Premium 主题图片/视频防提取，反破解。

```
.nvtp 包 = 加密 ZIP（AES-256-GCM）
  ├── manifest.json
  ├── theme.css
  ├── icons/*.webp       ← 加密存储，绝不落地明文
  ├── pic/*.webp
  └── video/*.mp4

渲染链路：
  <img src="nova://theme/ice-girl/icons/home.webp">
    → Tauri custom protocol 拦截
    → 从本地加密缓存读取 Vec<u8>
    → AES-256-GCM 内存解密
    → 返回给 WebView
    → 明文文件从不落地
```

| 层 | 措施 |
|---|---|
| 传输 | HTTPS + .nvtp 二进制格式 |
| 存储 | AES-256-GCM，密钥由 Rust 端持有 |
| 渲染 | `nova://` custom protocol，内存解密 |
| 反篡改 | CSS 中 url() 必须走 `nova://`，本地替换文件无效 |

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
- [ ] 自动更新 Pro+ 专属推送
- [ ] 主题列表 API 完善
- [ ] ice-girl + cyber-girl 素材用 AI 批量补全

### 以后
- [ ] 云同步
- [ ] 副屏完善
- [ ] 使用数据看板
