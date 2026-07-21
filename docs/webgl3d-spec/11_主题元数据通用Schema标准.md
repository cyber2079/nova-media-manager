# 11 — 主题元数据通用 Schema 标准

> **优先级**：P0 — 数据契约，所有模块的基础依赖
> **版本**：v1.0 | **冻结日期**：2026-07-22
> **覆盖**：manifest 配置清单、交互绑定、剧情任务 JSON Schema、i18n 多语言节点、可选扩展字段设计、校验规则
> **不覆盖**：具体 UI 组件实现（见 [14_UI/UX规范](14_3D配套UI-UX通用交互规范.md)）、存档数据结构（见 [16_用户存档](16_3D用户存档通用数据结构.md)）、打包脚本实现（见 [17_打包加密规范](17_专属资源包打包加密通用规范.md)）

---

## 一、设计原则

1. **通用字段必填，专属字段可选**：所有主题共有的元数据为必填；各主题特有的扩展数据放入 `extensions` 对象，不存在时自动忽略
2. **Schema 向前兼容**：新增字段不得破坏旧版客户端对 NV3D 文件的解析
3. **i18n 内聚**：所有用户可见文本存储在主题包的多语言节点中，前端代码不硬编码任何主题文本
4. **字段命名**：全部 camelCase，与前端约定一致

---

## 二、Manifest 顶层结构

```jsonc
{
  "$schema": "https://scm-think.cn/schemas/nv3d-manifest.json",
  "formatVersion": "2.0",

  // 主题身份
  "themeId": "cyber-girl-apartment",
  "themeName": { /* i18n 对象 */ },
  "themeType": "webgl3d",

  // 版本
  "version": "1.0.0",
  "minAppVersion": "2.0.0",

  // 资源清单
  "resources": { /* 见第三节 */ },

  // 场景定义
  "scenes": [ /* 见第四节 */ ],

  // 角色定义（可选扩展字段）
  "characters": [ /* 见第五节 */ ],

  // 道具定义（可选扩展字段）
  "props": [ /* 见第六节 */ ],

  // 交互绑定
  "interactions": [ /* 见第七节 */ ],

  // 剧情/任务（可选扩展字段）
  "quests": [ /* 见第八节 */ ],

  // i18n 多语言文本
  "i18n": { /* 见第九节 */ },

  // 渲染配置
  "renderConfig": { /* 见第十节 */ },

  // 专属扩展
  "extensions": { /* 见第十一节 */ }
}
```

### 2.1 必填 vs 可选字段一览

| 字段 | 必填 | 说明 |
|------|:---:|------|
| `$schema` | ✅ | Schema 引用 URL |
| `formatVersion` | ✅ | 固定 `"2.0"` |
| `themeId` | ✅ | 唯一标识符，kebab-case |
| `themeName` | ✅ | i18n 对象 |
| `themeType` | ✅ | 固定 `"webgl3d"` |
| `version` | ✅ | SemVer |
| `minAppVersion` | ✅ | 客户端最低版本要求 |
| `resources` | ✅ | 资源清单 |
| `scenes` | ✅ | 至少一个场景 |
| `characters` | ❌ | 无角色主题可省略 |
| `props` | ❌ | 无道具主题可省略 |
| `interactions` | ❌ | 纯观赏主题可省略 |
| `quests` | ❌ | 无任务主题可省略 |
| `i18n` | ✅ | 至少包含 zh 和 en |
| `renderConfig` | ✅ | 渲染管线配置 |
| `extensions` | ❌ | 主题专属扩展 |

---

## 三、resources — 资源清单

```jsonc
{
  "resources": {
    "models": {
      "scene_low": {
        "path": "models/scene_low.glb",
        "hash": "sha256:abc123...",
        "size": 2048576,
        "compression": "draco"
      },
      "scene_hd": {
        "path": "models/scene_hd.glb",
        "hash": "sha256:def456...",
        "size": 15728640,
        "compression": "draco"
      }
    },
    "textures": {
      "scene_diffuse": {
        "path": "textures/scene/diffuse.ktx2",
        "hash": "sha256:ghi789...",
        "size": 4194304,
        "format": "ktx2",
        "resolution": [4096, 4096]
      }
    },
    "animations": {
      "character_idle": {
        "path": "animations/idle.glb",
        "hash": "sha256:jkl012...",
        "size": 524288
      }
    },
    "shaders": {
      "custom_postprocess": {
        "path": "shaders/postprocess.glsl",
        "hash": "sha256:mno345...",
        "size": 2048
      }
    },
    "audio": {
      "bgm": {
        "path": "audio/bgm.ogg",
        "hash": "sha256:pqr678...",
        "size": 8388608
      }
    },
    "previews": {
      "thumbnail": {
        "path": "preview/thumbnail.webp",
        "hash": "sha256:stu901...",
        "size": 32768,
        "resolution": [256, 256]
      },
      "hero": {
        "path": "preview/hero.webp",
        "hash": "sha256:vwx234...",
        "size": 524288,
        "resolution": [1920, 1080]
      }
    }
  }
}
```

### 3.1 资源路径约定

- 所有 `path` 为 NV3D 包内相对路径（相对于包根目录）
- `hash` 格式：`{algorithm}:{hex}`，目前支持 `sha256`
- `compression` 可选值：`"draco"` | `"meshopt"` | `"none"` — 标记模型压缩方式
- `format` 可选值：`"png"` | `"ktx2"` | `"basis"` | `"jpeg"` | `"webp"` — 贴图编码

---

## 四、scenes — 场景定义

```jsonc
{
  "scenes": [
    {
      "id": "main_room",
      "nameKey": "scene.main_room.name",
      "descriptionKey": "scene.main_room.desc",
      "modelRef": "scene_low",           // ← 引用 resources.models 中的 key
      "hdModelRef": "scene_hd",
      "defaultCamera": {
        "position": [0.0, 1.5, 5.0],
        "target": [0.0, 1.0, 0.0],
        "fov": 60,
        "nearPlane": 0.1,
        "farPlane": 100.0,
        "minDistance": 1.0,
        "maxDistance": 10.0,
        "minPolarAngle": 0.1,
        "maxPolarAngle": 1.5
      },
      "lights": [
        {
          "id": "ambient",
          "type": "ambient",
          "color": [0.3, 0.3, 0.4],
          "intensity": 0.5
        },
        {
          "id": "main_light",
          "type": "point",
          "position": [2.0, 3.0, 1.0],
          "color": [0.8, 0.7, 1.0],
          "intensity": 1.0,
          "range": 15.0,
          "castShadow": true
        }
      ],
      "postProcessing": {
        "bloom": { "threshold": 0.8, "strength": 0.5, "radius": 0.5 },
        "colorGrading": { "lookupTextureRef": "lut_neon" }
      },
      "particleSystems": [
        {
          "id": "digital_rain",
          "emitter": { "position": [0, 5, -2], "shape": "box", "size": [8, 0.1, 1] },
          "particle": { "textureRef": "particle_glow", "maxCount": 500, "lifetime": [3, 8] }
        }
      ]
    }
  ]
}
```

### 4.1 相机约束

| 参数 | 类型 | 说明 |
|------|------|------|
| `position` | `[x,y,z]` | 初始相机位置 |
| `target` | `[x,y,z]` | 初始注视点 |
| `fov` | number | 垂直视角（度） |
| `minDistance` / `maxDistance` | number | 缩放范围限制 |
| `minPolarAngle` / `maxPolarAngle` | number | 俯仰角限制（弧度，0=天顶，π=脚底）|

### 4.2 后处理效果（通用）

| 效果 | 参数 | 说明 |
|------|------|------|
| `bloom` | threshold, strength, radius | 辉光 |
| `colorGrading` | lookupTextureRef | 颜色查找表（LUT） |
| `vignette` | strength, color | 暗角 |
| `chromaticAberration` | strength | 色差 |
| `grain` | strength, size | 胶片颗粒 |

所有后处理效果为**可选项**，不存在则跳过该 pass。

---

## 五、characters — 角色定义（可选扩展字段）

```jsonc
{
  "characters": [
    {
      "id": "cyber_girl",
      "nameKey": "character.cyber_girl.name",
      "modelRef": "character_cyber",
      "defaultPosition": [0.0, 0.0, -1.5],
      "animations": {
        "idle": { "animRef": "character_idle", "loop": true },
        "greet": { "animRef": "character_greet", "loop": false, "nextAnim": "idle" },
        "interact_01": { "animRef": "character_interact_01", "loop": false, "nextAnim": "idle" }
      },
      "interactableHotspots": [
        {
          "id": "head_pat",
          "bone": "Head",
          "radius": 0.15,
          "triggerAction": "character.head_pat_reaction"
        }
      ]
    }
  ]
}
```

- 无角色的纯场景主题：`characters` 字段省略或为空数组 `[]`
- 动画状态机：`nextAnim` 定义非循环动画结束后自动切换的目标动画

---

## 六、props — 道具定义（可选扩展字段）

```jsonc
{
  "props": [
    {
      "id": "hologram_projector",
      "nameKey": "prop.hologram_projector.name",
      "modelRef": "prop_projector",
      "defaultPosition": [1.5, 0.8, -2.0],
      "pickable": true,
      "draggable": true,
      "snapTargets": [
        { "id": "desk_slot_01", "position": [1.5, 0.8, -2.0], "radius": 0.2 }
      ],
      "onPickUp": "prop.projector_pickup",
      "onPlace": "prop.projector_place"
    }
  ]
}
```

- 无道具主题：`props` 省略或空数组
- `snapTargets`：拖拽放置时的吸附点位

---

## 七、interactions — 交互绑定

```jsonc
{
  "interactions": [
    {
      "id": "click_door",
      "trigger": "click",
      "target": { "type": "mesh", "modelRef": "scene_low", "meshName": "Door_Front" },
      "conditions": {
        "questCompleted": "find_keycard"
      },
      "actions": [
        { "type": "playAnimation", "target": "door_front", "anim": "door_open" },
        { "type": "loadScene", "sceneId": "corridor" },
        { "type": "showDialog", "dialogId": "enter_corridor" },
        { "type": "playSound", "audioRef": "sfx_door_open" }
      ]
    }
  ]
}
```

### 7.1 触发类型

| trigger | 说明 |
|---------|------|
| `click` | 鼠标左键点击 |
| `hover` | 鼠标悬停（高亮，不触发动作） |
| `drag_end` | 拖拽放置 |
| `proximity` | 相机接近到阈值距离 |
| `auto` | 场景加载后自动触发 |
| `timer` | 定时器到期触发 |

### 7.2 条件类型

| 条件 | 说明 |
|------|------|
| `questCompleted` | 指定任务已完成 |
| `propPlaced` | 指定道具已放置 |
| `characterVisible` | 指定角色可见 |
| `hasItem` | 用户持有指定道具 |
| `always` | 无条件 |

### 7.3 动作类型

| 动作 | 说明 |
|------|------|
| `playAnimation` | 播放指定动画 |
| `loadScene` | 切换场景 |
| `showDialog` | 显示剧情弹窗 |
| `playSound` | 播放音效 |
| `unlockQuest` | 解锁任务 |
| `giveItem` | 给予道具 |
| `toggleProp` | 显示/隐藏道具 |
| `setShaderParam` | 修改着色器参数 |

---

## 八、quests — 剧情/任务（可选扩展字段）

```jsonc
{
  "quests": [
    {
      "id": "find_keycard",
      "nameKey": "quest.find_keycard.name",
      "descriptionKey": "quest.find_keycard.desc",
      "stages": [
        {
          "id": "stage_1",
          "objectiveKey": "quest.find_keycard.stage_1",
          "trigger": { "type": "click", "target": { "meshName": "Desk_Drawer" } },
          "onComplete": { "type": "giveItem", "itemId": "keycard" }
        },
        {
          "id": "stage_2",
          "objectiveKey": "quest.find_keycard.stage_2",
          "trigger": { "type": "click", "target": { "meshName": "Door_Front" } },
          "condition": { "hasItem": "keycard" },
          "onComplete": { "type": "unlockQuest", "questId": "enter_lab" }
        }
      ]
    }
  ]
}
```

- 无任务主题：`quests` 省略或空数组
- 任务状态管理器兼容"无任务"主题（跳过任务分支逻辑）

---

## 九、i18n — 多语言文本

```jsonc
{
  "i18n": {
    "zh": {
      "theme.name": "赛博公寓",
      "theme.description": "欢迎来到 2077 年的霓虹公寓...",
      "scene.main_room.name": "主起居室",
      "scene.main_room.desc": "一间被全息投影和霓虹灯照亮的公寓",
      "character.cyber_girl.name": "代码幽灵",
      "dialog.greeting": "你终于来了...我等你很久了。",
      "quest.find_keycard.name": "寻找门禁卡",
      "prop.hologram_projector.name": "全息投影仪"
    },
    "en": {
      "theme.name": "Cyber Apartment",
      "theme.description": "Welcome to a neon-lit apartment in 2077...",
      "scene.main_room.name": "Main Living Room",
      "scene.main_room.desc": "An apartment illuminated by holograms and neon lights",
      "character.cyber_girl.name": "Code Ghost",
      "dialog.greeting": "You're finally here... I've been waiting.",
      "quest.find_keycard.name": "Find the Keycard",
      "prop.hologram_projector.name": "Hologram Projector"
    },
    "ja": { /* ... */ },
    "ko": { /* ... */ },
    "de": { /* ... */ },
    "fr": { /* ... */ },
    "it": { /* ... */ }
  }
}
```

### 9.1 i18n 规则

- 所有语种在同一 `i18n` 对象下，key 使用 BCP-47 语言标签
- 文本 key 使用点分隔命名空间：`{category}.{id}.{field}`
- 至少包含 `zh` 和 `en`，其他语种可选
- 前端根据软件当前语言设置选择对应语种；缺失语种 fallback 到 `en`
- 主题包后续更新可增量添加语种

### 9.2 文本 key 命名约定

| 前缀 | 用途 | 示例 |
|------|------|------|
| `theme.` | 主题元信息 | `theme.name` |
| `scene.{id}.` | 场景 | `scene.main_room.name` |
| `character.{id}.` | 角色 | `character.cyber_girl.name` |
| `prop.{id}.` | 道具 | `prop.projector.name` |
| `quest.{id}.` | 任务 | `quest.find_keycard.name` |
| `dialog.{id}.` | 对话 | `dialog.greeting` |
| `ui.` | 主题内 UI 文案 | `ui.loading_tip` |

---

## 十、renderConfig — 渲染配置

```jsonc
{
  "renderConfig": {
    "targetFps": 60,
    "adaptiveQuality": true,
    "qualityLevels": {
      "high": {
        "shadowMapSize": 2048,
        "textureMaxResolution": 4096,
        "antialias": true,
        "postProcessing": true,
        "particleMaxCount": 500
      },
      "medium": {
        "shadowMapSize": 1024,
        "textureMaxResolution": 2048,
        "antialias": false,
        "postProcessing": true,
        "particleMaxCount": 200
      },
      "low": {
        "shadowMapSize": 512,
        "textureMaxResolution": 1024,
        "antialias": false,
        "postProcessing": false,
        "particleMaxCount": 50
      }
    },
    "triangleBudget": 100000,
    "drawCallBudget": 200,
    "textureMemoryBudgetMb": 512
  }
}
```

### 10.1 自适应降级逻辑

当帧率持续低于目标时，自动沿 `high → medium → low` 降级，不跨级跳变。

---

## 十一、extensions — 专属扩展

```jsonc
{
  "extensions": {
    "cyber-girl-apartment": {
      "visualStyle": "cyberpunk",
      "colorPalette": {
        "primary": "#ff00ff",
        "secondary": "#00ffff",
        "accent": "#ff6600",
        "background": "#0a0a1a"
      },
      "shaderParams": {
        "scanlineIntensity": 0.3,
        "hologramFlicker": 0.1,
        "neonGlowRadius": 2.5
      }
    },
    "ink-wash": {
      "visualStyle": "chinese-ink",
      "colorPalette": {
        "primary": "#1a1a1a",
        "secondary": "#5a5a5a",
        "accent": "#c41e3a",
        "background": "#f5f0e8"
      },
      "shaderParams": {
        "inkSpreadSpeed": 0.5,
        "paperTextureStrength": 0.3,
        "brushStrokeWidth": 2.0
      }
    }
  }
}
```

**规则**：
- `extensions` 的 key 为 `themeId`
- 只有匹配到当前 `themeId` 的扩展才被读取，其他 key 忽略
- 同一 NV3D 包可以包含多个主题的扩展数据（供未来合集包使用）
- 客户端不认识的扩展字段 → 忽略，不报错

---

## 十二、校验规则

### 12.1 Schema 校验（打包时，阻断级）

| 校验项 | 规则 |
|--------|------|
| 必填字段完整 | 按第二节必填表逐字段检查 |
| `themeId` 格式 | kebab-case，不含空格和特殊字符 |
| `version` 格式 | 严格 SemVer（`major.minor.patch`） |
| 资源引用完整性 | `modelRef` / `animRef` / `textureRef` 等引用的 key 必须在 `resources` 中存在 |
| i18n 完整性 | 至少包含 `zh` 和 `en` |
| 文件 hash 匹配 | 每个资源文件的 SHA256 与 manifest 中的 hash 一致 |
| 贴图分辨率 | 不超过对应 quality level 的上限 |

### 12.2 运行时校验（加载时，告警级）

| 校验项 | 行为 |
|--------|------|
| 未知字段 | 忽略，不中断加载 |
| 缺失可选字段 | 使用模块默认值 |
| 引用资源不存在 | 跳过该资源，渲染缺失占位（如粉色材质） |
| i18n key 缺失 | fallback 到 `en`，`en` 也缺失则显示 raw key |

### 12.3 安全校验（加载时，阻断级）

| 校验项 | 行为 |
|--------|------|
| NV3D 文件签名无效 | 拒绝加载 |
| Shader 编译超时（> 3s） | 中止编译，使用 fallback shader，场景加载继续 |
| JSON 解析失败 | 拒绝加载整个主题 |
