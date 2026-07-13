# Nova 场景脚本系统 — 设计方案

> 2026-07-14 · 待确认后实施

## 一、核心原则

**文件名无意义，脚本是唯一真理。**

```
❌ 当前：manifest.scenes 按场景 ID/文件名排序 → 文件名一变顺序全乱
✅ 未来：manifest.script 是播放列表 → 每个节点引用素材（不管它叫什么名字）
```

## 二、数据结构

### story 型（cyber-girl）

```json
{
  "type": "story",
  "script": [
    {
      "id": "s1",
      "label": "城市全景",
      "background": "scenes/scene-01.webp",    // 引用素材文件
      "bgm": "start",                          // BGM 分区
      "text": "home.cg_scene1_text",           // i18n key
      "face": "talk"                           // 角色表情（可选）
    },
    {
      "id": "s2",
      "label": "绫的日常",
      "background": "scenes/skill-show-music.webp",
      "skillShow": true,                       // 技能展示模式（四角飞入）
      "text": "home.cg_scene2_text"
    }
    // ... 16 个节点
  ]
}
```

### dynamic 型（ice-girl）

```json
{
  "type": "dynamic",
  "script": [
    {
      "id": "q1",
      "label": "登场宣言",
      "background": "video/bg-loop.mp4",       // 背景视频覆盖全局
      "face": "smug",
      "text": "home.ice_ascendancy_text"
    },
    {
      "id": "q2",
      "label": "玲珑霜衣",
      "background": "video/bg-loop.mp4",       // 同样的背景，不同的 face+text
      "face": "happy",
      "text": "home.ice_quote_1"
    }
    // ... 17 条
  ]
}
```

## 三、与旧 manifest 的兼容

旧 `manifest.scenes` 数组只存**素材清单**（AI 生成目录），不存播放顺序：

```json
{
  "assets": [                         // ← 改名，不再是 "scenes"
    { "id": "scene-01.webp", "status": "done" },
    { "id": "skill-show-music.webp", "status": "done" }
  ],
  "script": [                         // ← 这才是播放列表
    { "id": "s1", "background": "scene-01.webp", "text": "..." }
  ]
}
```

素材清单 = 我有这些文件。脚本 = 我按这个顺序播。

## 四、Theme Studio 界面改造

### 场景脚本编辑器（新页面）

```
┌──────────────────────────────────────────────────────────┐
│ ← 返回  │  cyber-girl · 场景脚本  │  [+ 添加节点]        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   ┌────┐    ┌────┐    ┌────┐    ┌────┐                  │
│   │ s1 │ → │ s2 │ → │ s3 │ → │ s4 │ → ...              │
│   │ 🌆 │    │ 🎵 │    │ 🌆 │    │ 📡 │                  │
│   └────┘    └────┘    └────┘    └────┘                  │
│                                                          │
│   ┌───────────── 选中节点: s3 ──────────────┐            │
│   │                                         │            │
│   │  标签: [城市全景____________]            │            │
│   │                                         │            │
│   │  背景图: [scenes/scene-01.webp ▾]       │            │
│   │  ┌──────────────────────┐               │            │
│   │  │   [缩略图预览]        │               │            │
│   │  └──────────────────────┘               │            │
│   │                                         │            │
│   │  文本: [home.cg_scene1_text ▾]          │            │
│   │  💬 "新星城——2079年。世界充满了不确定..." │            │
│   │                                         │            │
│   │  表情: [无 ▾]  BGM: [start ▾]          │            │
│   │  技能展示: [ ]                           │            │
│   │                                         │            │
│   │  [删除节点]  [↑ 上移]  [↓ 下移]         │            │
│   └─────────────────────────────────────────┘            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 关键交互

| 操作 | 行为 |
|---|---|
| 拖拽节点 | 重排序 → 自动更新 `script` 数组 |
| 添加节点 | 弹出下拉选素材（background）+ 文本框 |
| 背景图下拉 | 列出 `assets[]` 中所有 done 状态的素材 + 缩略图预览 |
| 文本下拉 | 列出 `zh.json` 中所有 `home.xxx_text` / `home.xxx_quote_N` 的 key |
| 表情下拉 | 列出 `faces/` 中存在的文件 + 无 |
| 删除节点 | 从 script 中移除，素材文件不受影响 |
| 实时预览 | 右侧显示当前选中节点的合成效果（背景+文字+表情） |

## 五、答案：纯脚本驱动，不碰文件名

| 方案 | 说明 |
|---|---|
| ❌ 按脚本顺序重命名文件 | 文件名改了 = Git/Syncthing 重新同步 = 乱 |
| ✅ **纯脚本顺序无关化** | 文件名永远是存储标识，`script[].background` 引用它，顺序由 `script` 数组决定 |

```js
// Home.tsx 播放逻辑
script.forEach(node => {
  showBackground(node.background);   // 不管你叫什么名字
  showText(t(node.text));            // 取 i18n
  if (node.face) showFace(node.face); // 显示表情
  if (node.skillShow) playSkillAnimation();
});
```

**永远不问文件名是什么**。只问脚本中引用了什么。

## 六、实施步骤

| 步 | 做什么 | 影响 |
|---|---|---|
| 1 | manifest 加 `script` 数组，旧 `scenes` 改 `assets` | 数据格式 |
| 2 | Rust `theme_studio.rs` 返回 script + assets | 后端 |
| 3 | Theme Studio 新增「场景脚本」标签页 | 前端 |
| 4 | 脚本编辑器（可视化时间线 + 节点编辑） | 前端 |
| 5 | Home.tsx 改为按 script 顺序播放 | 播放逻辑 |
| 6 | ice-girl manifest 迁移到新格式 | 数据迁移 |

## 七、ice-girl 的特殊性

dynamic 型的 `background` 可以**声明默认值**，每个节点不写就用默认：

```json
{
  "type": "dynamic",
  "backgroundDefault": "video/bg-loop.mp4",   // ← 全局默认背景
  "script": [
    { "id": "q1", "face": "smug", "text": "home.ice_ascendancy_text" },
    // background 不写 → 自动用 backgroundDefault
    { "id": "q2", "face": "happy", "text": "home.ice_quote_1" }
  ]
}
```

这样每个节点只需写 `face` + `text`，极简。

## 八、与现有 manifest 的关系

```
旧 manifest.scenes   → 新 manifest.assets    (素材清单，AI 生成用)
旧 Home.tsx 硬编码    → 新 manifest.script    (播放顺序，运行时用)
```

`assets` 只管生成进度。`script` 只管播放。**解耦。**

---

> **待确认**：脚本驱动方案是否 OK？确认后开始实施。
