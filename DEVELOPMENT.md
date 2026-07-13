# Nova Media Manager — 开发标准作业流程

> 2026-07-13 · 面向长期维护的开发规范

---

## 一、核心原则

| 原则 | 说明 |
|---|---|
| **一次只做一个改动** | 每个 commit 对应一个明确的变更 |
| **TypeScript 零错误** | `npx tsc --noEmit` 通过才能 commit |
| **i18n 同步** | 新增的中文字符串，至少同步 en.json |
| **不落死代码** | 删功能时连带删除相关 i18n key、store 字段、import |
| **先计划后实施** | 涉及 >2 个文件的改动，先写入 DIFFERENTIATION-PLAN.md 或直接让 Claude Code 进入计划模式 |

---

## 二、与 Claude Code 协作规范

### 2.1 何时用什么

| 场景 | 方式 | 为什么 |
|---|---|---|
| 单文件小改（改文案、修 typo） | 直接描述，Claude Read + Edit | 最快 |
| 涉及 2-5 个文件的改动 | 直接描述，Claude 自动搜索 + 逐个编辑 | 有 Grep，不需人工找 |
| 涉及 >5 个文件的架构改动 | 让 Claude 进入计划模式 → 确认方案 → 执行 | 避免返工 |
| 代码审查 | `/code-review` | 自动化查遗漏 |
| 启动应用看效果 | `/run` 或手动 `npm run tauri:dev` | 验证改动真的生效了 |
| 部署 landing page | `scp -i ~/.ssh/ecs_nova server/static/index.html root@39.104.55.38:/var/www/server/static/` | 一行命令 |
| 部署服务端 | `scp server/src/*` + `systemctl restart` | 见 CLAUDE.md 命令 |
| 推送代码 | `npm run push "描述"` | add + commit + push 一次完成 |

### 2.2 节省 Token 的技巧

| 技巧 | 效果 |
|---|---|
| **描述需求，不描述路径** | 说"把 header 图标改成 lucide icon"而不是"去 Layout.tsx 第 528 行把 img 改成 component"——Claude 自己搜 |
| **一次描述完整的改动范围** | "改 6 个 locale 文件"而不是逐个说"改日文""改韩文" |
| **用并行 Agent 搜索** | 涉及多个子系统时，让 Claude 同时搜索多个维度 |
| **Review 用专门的 skill** | `/code-review` 比"帮我看看这代码有什么问题"高效 |
| **确认方案再写代码** | 大的改动先讨论 2-3 轮确定方向，避免写了废 |

### 2.3 安全边界

这些操作 Claude Code 会先确认再执行：

- Git 操作（commit/push/rebase）
- 删除文件
- 修改 `src-tauri/` 下的 Rust 代码（涉及编译链路）
- deploy / scp 到服务器
- `rm -rf` 类操作

---

## 三、主题开发 SOP

### 3.1 素材目录结构（强制）

每个主题的素材目录必须按以下结构组织。**打包脚本只收集此结构内的文件，多出的文件不会被打包。**

```
{assets}/                           ← public/themes/{dir}/ 或 nova-themes-assets/
├── preview.webp                    ← 设置页缩略图，16:9
│
├── icons/                          ← 导航 + 技能图标，128×128 WebP
│   ├── home.webp                   ← 首页导航 [必须]
│   ├── movie.webp                  ← 电影导航 [必须]
│   ├── pic.webp                    ← 图片导航 [必须]
│   ├── music.webp                  ← 音乐导航 [必须]
│   ├── game.webp                   ← 游戏导航 [必须]
│   ├── skill-01.webp               ← 技能图标 [必须，≥6个]
│   ├── skill-02.webp
│   ├── skill-03.webp
│   ├── skill-04.webp
│   ├── skill-05.webp
│   └── skill-06.webp
│
├── faces/                          ← 角色表情，512×512 WebP，正方形
│   ├── happy.webp                  ← 开心 [必须]
│   ├── angry.webp                  ← 愤怒 [必须]
│   ├── neutral.webp                ← 无表情 [必须]
│   ├── cry.webp                    ← 哭泣
│   ├── naughty.webp                ← 调皮
│   ├── talk.webp                   ← 说话
│   ├── surprise.webp               ← 惊讶
│   ├── smug.webp                   ← 傲慢（冰霜女皇专属）
│   └── curse.webp                  ← 狂暴
│
├── scenes/                         ← 剧情场景背景，1080p WebP
│   ├── scene-01.webp
│   ├── scene-02.webp
│   └── ...                         ← 按编号递增
│
├── video/                          ← 视频（可选）
│   ├── bg-loop.mp4                 ← 首页背景循环，H.264，≤60MB
│   └── secretary.mp4               ← 秘书问候视频
│
├── bg.webp                         ← 视频未加载时的静态占位图
└── music-cover.webp                ← 音乐库默认封面
```

**不要出现的东西**：
- `.png` 源文件（如果已有同名 `.webp`）
- `- 副本` / `(1)` / `(2)` 等复制标记
- 即梦 AI 生成的原始文件名（如 `jimeng-2026-07-03-1074-...webp`）
- 大于 5MB 的单个文件（WebP 可压缩）
- 任何代码未引用的文件

### 3.2 文件命名规范

| 规则 | 示例 |
|---|---|
| 全小写，连字符分隔 | `scene-01.webp` 不是 `Scene 01.webp` |
| 编号始终两位数字 | `skill-03.webp` 不是 `skill-3.webp` |
| 不含空格 | `angry.webp` 不是 `angry face.webp` |
| 不含中文 | `preview.webp` 不是 `预览图.webp` |
| 单数形式 | `icon` 不是 `icons`，`face` 不是 `faces` |
| `.webp` 后缀（仅 WebP） | 不要同时保留 `.png` 副本 |

### 3.3 现有主题对齐状态

| 主题 | 状态 | 说明 |
|---|---|---|
| **ice-girl** | ⚠️ 部分对齐 | 技能图标 1-6.webp 需重命名 skill-01~06；表情 `xx face.webp` 去空格；目录无 faces/scenes/video 分拆 |
| **cyber-girl** | ⚠️ 部分对齐 | 技能图标 skill1~6 需改成 skill-01~06；表情同理；pic 目录需要分拆 |
| **新主题** | ✅ 从 day 1 按此规范 | AI 生成素材时必须输出到此结构 |

### 3.4 主题类型（type 字段）

每个主题的 `manifest.json` 必须声明 `type` 字段，决定 Home 页渲染模式：

| type | 渲染模式 | Home.tsx 行为 | 必备素材 | 现有示例 |
|---|---|---|---|---|
| `story` | 线性剧情 | scene 编号推进 → 背景图切换 → BGM 分区切换 | scenes/*.webp + video/*.mp4（可选） + faces/*.webp | cyber-girl |
| `dynamic` | 背景视频 + 打字机轮播 | 视频画布渲染（A/B roll）→ 打字机随机轮播 → 表情随机切换 | video/bg-loop.mp4 + faces/*.webp + bg.webp | ice-girl |
| `static` | 纯壁纸/渐变，无剧情 | 显示默认 Dashboard（媒体统计 + 最近 + 标签云） | 无（CSS 渐变即可） | default |
| `hybrid` | story + dynamic 组合 | 剧情线 + 可选交互模式切换 | scenes + video + faces | 预留 |

**prompts.json 按类型适配**：

| type | prompts 结构 |
|---|---|
| `story` | `global` + `scenes.{key}` → AI 生成按 scene 编号推进的场景 |
| `dynamic` | `global` + `faces.{key}` + `background` → AI 生成表情 + 背景视频 |
| `static` | 不需要 prompts（无 AI 素材） |
| `hybrid` | 两者都有 |

**Home.tsx 路由**：见 `THEME_META` 常量 — `getThemeMeta(theme).type` 自动选择 `static` / `dynamic` / `story` 分支，不硬编码主题名。

### 3.5 创建新主题 — 7 步

```
STEP 1  写 prompts.json
        定义角色外貌、表情、场景的 AI 提示词
        参考: D:\nova-proprietary\themes\ice-girl\prompts.json

STEP 2  写 manifest.json
        声明主题 id / name / type / 角色 / 场景清单
        type 必须选 story | dynamic | static | hybrid
        所有场景初始 status: "todo"
        参考: D:\nova-proprietary\themes\ice-girl\manifest.json

STEP 3  生成素材
        node scripts/theme-generate.mjs {theme-id}
        需要: ARK_API_KEY 环境变量
        输出: D:\nova-themes-assets\{theme-id}\

STEP 4  手动筛选
        删除不满意的图片/视频
        重新生成: node scripts/theme-generate.mjs {theme-id} --scene {key}
        满意后: 将对应 scene 的 status 改为 "done"

STEP 5  编写 theme.css
        定义 --color-primary / 入场动画 / 字体 / 特效
        图片引用: url("../pic/xxx.webp")（相对于 themes/ 目录）
        参考: src/index.css 中 [data-theme="ice-girl"] 段落

STEP 6  打包
        node scripts/theme-pack.mjs {theme-id}
        → 输出 .nvtp 到 dist/ 目录

STEP 7  发布
        scp .nvtp 到 ECS CDN
        POST /api/admin/themes/publish { themeId }
        测试: 在 App 中激活 → 下载 → 切换主题
```

### 3.3 更新已有主题

```
修改素材 → 重新生成对应 scene
  → scene.status 改为 "done"
  → manifest.version 递增
  → STEP 6 → STEP 7
```

---

## 四、功能开发 SOP

### 4.1 从需求到上线

```
① 需求描述
   写入 DIFFERENTIATION-PLAN.md 或用自然语言描述给 Claude Code
   明确：做什么、为什么、影响哪些文件

② 方案讨论
   涉及架构的 → 让 Claude Code 输出方案 → 你确认
   简单改动 → 直接说"执行"

③ 实现
   Claude Code: Read → Edit → Write
   你: 确认每个 Edit 的结果

④ 编译验证
   npx tsc --noEmit
   零错误才算过

⑤ 功能验证
   npm run tauri:dev → 实际跑一遍
   或用 /verify 让 Claude 驱动验证

⑥ Commit
   npm run push "做了什么改动"
```

### 4.2 改动分类

| 类型 | 示例 | 走哪个流程 |
|---|---|---|
| 文案/样式微调 | 改 locale、调颜色 | ①→③→④→⑥ |
| 新增功能 | useGate hook、引导对话框 | ①→②→③→④→⑤→⑥ |
| 后端改动 | 服务端 API、Rust 命令 | ①→②→③→④→⑤→部署→⑥ |
| 架构重构 | 主题安全加密方案 | ①→②（多次讨论）→③→④→⑤→⑥ |

### 4.3 Rust 代码特殊处理

```
修改 src-tauri/src/ 后:
  清理缓存: rm -rf src-tauri/target
  重新编译: npm run tauri:dev
  （首次编译 552 个 crate，约 5-10 分钟）

license 软链接检查:
  ls src-tauri/src/license/mod.rs   # 必须存在
  如果断了: rm -rf src-tauri/src/license && ln -s /d/nova-proprietary/license src-tauri/src/license
```

---

### 4.4 中断恢复规范（关键）

**原则**：任何涉及网络下载或多步操作的流程，状态标记必须在原子完成后才写入。中断后重启必须能自动恢复。

```
❌ 错误：
  激活成功 → 立即写 flag → 开始下载 → 下载到一半崩溃 → flag 已写，重启后跳过

✅ 正确：
  激活成功 → 开始下载 → 全部下载完成 → 写 flag → 完成
  重启后：flag 未写入 → 重新触发下载
```

**恢复检查清单**：

| 操作 | 中断后重启行为 |
|---|---|
| 首次激活下载主题 | Layout.tsx 启动时检测 Pro+ 但无 premium 主题 → 后台自动补下载 |
| 主题更新 | 对比版本号 → 重新下载（覆盖旧版本） |
| .nvtp 自动下载 | 每个主题独立，失败的不影响已完成的 |
| 云端同步 | 待实现：增量同步 + 最后成功时间戳，中断后从上次断点继续 |

**通用规则**：
- flag / 标记只写在全部成功后
- 启动时检查"应该完成但未完成"的状态 → 自动恢复
- 下载失败的跳过，下次启动重试
- 不弹错误对话框阻塞用户，静默重试

## 五、部署 SOP

### 5.1 Landing Page

```bash
# 修改 server/static/index.html 后
scp -i ~/.ssh/ecs_nova server/static/index.html root@39.104.55.38:/var/www/server/static/
# 无需重启服务，Nginx 直接 serve 静态文件
```

### 5.2 服务端

```bash
scp -i ~/.ssh/ecs_nova -r server/src/* root@39.104.55.38:/var/www/server/src/
ssh -i ~/.ssh/ecs_nova root@39.104.55.38 "systemctl restart nova-server"
# 验证: curl https://scm-think.cn/api/health
```

### 5.3 MSI 安装包

```bash
npm run tauri:build
scp -i ~/.ssh/ecs_nova src-tauri/target/release/bundle/msi/*.msi root@39.104.55.38:/var/www/releases/
```

---

## 六、质量检查清单

每个 commit 前：

- [ ] `npx tsc --noEmit` 零错误
- [ ] 新增的中文字符串已在 `zh.json` 和 `en.json` 中定义
- [ ] 删除的功能已清理对应的 i18n key、store 字段、import
- [ ] 无 `console.log` / `TODO` / 硬编码的调试代码
- [ ] 修改 `index.css` 时确认 light palette 不受影响
- [ ] 修改服务端代码时确认 `npm run tauri:dev` 仍能编译

---

## 七、同步检查

换机器或隔天开发前：

```bash
# 1. 公库最新
cd D:\nova-media-manager && npm run pull

# 2. 私库最新
cd D:\nova-proprietary && git pull origin main

# 3. 确认软链接
ls D:\nova-media-manager\src-tauri\src\license\mod.rs

# 4. 确认主题资源（Syncthing 在运行）
ls D:\nova-media-manager\public\themes\ice%20girl\
ls D:\nova-media-manager\public\themes\cyber%20girl\
```

---

## 八、文件职责速查

| 文件 | 职责 | 改它时要注意 |
|---|---|---|
| `src/index.css` | 全局样式 + 主题定义 + 动画 | 别破坏 light palette |
| `src/stores/settingsStore.ts` | 所有设置项 + 持久化 | 新增字段要加 persist |
| `src/stores/licenseStore.ts` | 许可证状态 | tier 结构不能乱改 |
| `src/stores/themeStore.ts` | 当前选中主题 | ThemeName 联合类型保持一致 |
| `src/i18n/locales/zh.json` | 中文翻译（主文件） | 所有 key 7 种语言都得有 |
| `src/components/Layout.tsx` | 全局框架（header/main/footer） | 涉及主题渲染逻辑 |
| `src/pages/Home.tsx` | 首页（Dashboard + 主题角色） | 三个主题分支都要测 |
| `src-tauri/src/theme/` | .nvtp 加解密/打包/解包 | 改动影响所有已发布主题 |
| `server/src/license.ts` | 激活/验证/解绑逻辑 | 改动影响所有已激活用户 |
