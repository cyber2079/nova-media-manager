# 14 — 3D 配套 UI/UX 通用交互规范

> **优先级**：P2
> **版本**：v1.0 | **更新日期**：2026-07-22
> **覆盖**：剧情弹窗、加载进度、主题切换 UI、权限解锁界面、多语言文案自动切换、Free 用户引导
> **不覆盖**：画布组件实现（见 [12_画布组件](12_WebGL画布通用组件开发规范.md)）、Schema 定义（见 [11_Schema](11_主题元数据通用Schema标准.md)）、状态结构（见 [13_全局状态](13_3D全局状态通用结构.md)）

---

## 一、UI 组件层

### 1.1 组件树

```
ThreeDModuleRoot
├── ThreeDCanvas               ← 背景 3D 画布（z-index: 0）
├── LoadingOverlay             ← 加载进度（z-index: 10）
├── DialogBox                  ← 剧情弹窗（z-index: 20）
├── InteractionHint            ← 交互提示（z-index: 15）
├── ThemeSwitcherPanel         ← 主题切换面板（z-index: 30）
└── PermissionGate             ← 权限拦截（z-index: 40）
```

### 1.2 Z 序分层

```
z-index    层
─────────────────
40         PermissionGate（权限不足时显示）
30         ThemeSwitcherPanel（设置面板内嵌或独立）
20         DialogBox（剧情对话）
15         InteractionHint（交互高亮提示）
10         LoadingOverlay（加载进度）
0          3D Canvas
```

---

## 二、LoadingOverlay — 加载进度

### 2.1 状态

| 加载阶段 | UI 展示 |
|---------|--------|
| Phase 1：Manifest 读取 | 主题封面图 + 主题名称 + 旋转加载指示器 |
| Phase 2：低模加载 | 进度条 + "正在加载场景..." |
| Phase 3：HD 渐进 | 不显示（后台静默加载） |
| 加载失败 | "加载失败" + 重试按钮 + 跳过按钮（使用低精度） |

### 2.2 组件接口

```typescript
interface LoadingOverlayProps {
  phase: "manifest" | "low_res" | "hd_streaming" | "complete";
  progress: number;                    // 0-100
  currentItem?: string;               // i18n key 或直接文本
  themeName: string;                   // 主题显示名称
  heroImage?: string;                  // 封面图 URL
  onRetry?: () => void;
  onSkip?: () => void;                // 跳过高精度加载
}
```

### 2.3 实现

```tsx
function LoadingOverlay({ phase, progress, themeName, heroImage, onRetry, onSkip }: LoadingOverlayProps) {
  if (phase === "complete") return null;

  return (
    <div className="fixed inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
      {heroImage && <img src={heroImage} className="w-64 h-36 object-cover rounded-lg mb-4" />}
      <h2 className="text-white text-xl mb-2">{themeName}</h2>

      {phase === "manifest" && <Spinner />}
      {phase === "low_res" && (
        <div className="w-64">
          <ProgressBar value={progress} />
          <p className="text-gray-400 text-sm mt-2">正在加载场景...</p>
        </div>
      )}
      {phase === "hd_streaming" && (
        <p className="text-gray-400 text-sm">正在优化画质...</p>
      )}

      {phase === "low_res" && progress > 95 && progress < 100 && (
        <button onClick={onSkip} className="mt-4 text-gray-400 text-sm underline">
          使用低精度模式
        </button>
      )}
    </div>
  );
}
```

---

## 三、DialogBox — 剧情弹窗

### 3.1 组件设计

```tsx
function DialogBox() {
  const dialog = useThreeDStore((s) => s.dialog);
  const i18n = useThemeI18n(); // 根据当前语言获取文案

  if (!dialog.currentDialogId) return null;

  const text = i18n.t(`dialog.${dialog.currentDialogId}.line_${dialog.currentLineIndex}`);
  const speaker = i18n.t(`dialog.${dialog.currentDialogId}.speaker`);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20
                    w-[600px] max-w-[90vw] bg-black/85 border border-white/10
                    rounded-lg p-6 backdrop-blur">
      {/* 说话人 */}
      <p className="text-cyan-400 text-sm mb-2">{speaker}</p>

      {/* 对话文本（打字机效果） */}
      <p className="text-white text-base leading-relaxed min-h-[3em]">
        {dialog.isTyping ? <Typewriter text={text} /> : text}
      </p>

      {/* 选项 */}
      {dialog.choices.length > 0 && (
        <div className="mt-4 space-y-2">
          {dialog.choices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => selectChoice(choice)}
              className="block w-full text-left text-cyan-300 hover:text-white
                         bg-white/5 hover:bg-white/10 rounded px-3 py-2 transition">
              {i18n.t(choice.textKey)}
            </button>
          ))}
        </div>
      )}

      {/* 继续提示 */}
      {dialog.choices.length === 0 && !dialog.isTyping && (
        <p className="text-gray-500 text-xs mt-3">点击继续</p>
      )}
    </div>
  );
}
```

### 3.2 弹窗行为

| 规则 | 说明 |
|------|------|
| 渲染异常 → 自动关闭 | Error Boundary 在弹窗组件外层，异常时关闭弹窗不阻塞其他 UI |
| 不阻塞原生窗口操作 | 弹窗不拦截窗口关闭、最小化等系统操作 |
| 点击背景区域 → 推进对话 | 等价于"点击继续" |
| 按键交互 | Space/Enter → 推进对话；1-9 → 选择对应选项 |

### 3.3 打字机效果

```typescript
function useTypewriter(text: string, speed: number = 30): [string, boolean] {
  const [displayed, setDisplayed] = useState("");
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setIsDone(false);
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(timer);
        setIsDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return [displayed, isDone];
}
```

---

## 四、InteractionHint — 交互提示

### 4.1 悬浮提示

当鼠标悬停在可交互物体上时显示：

```tsx
function InteractionHint() {
  const hoveredId = useThreeDStore((s) => s.interaction.hoveredObjectId);

  if (!hoveredId) return null;

  return (
    <div className="fixed z-15 pointer-events-none"
         style={{ left: mousePos.x, top: mousePos.y - 30 }}>
      <div className="bg-black/70 text-white text-xs px-2 py-1 rounded">
        {getInteractionLabel(hoveredId)} {/* 从 manifest 获取 i18n 标签 */}
      </div>
    </div>
  );
}
```

### 4.2 操作反馈

| 交互 | 反馈 |
|------|------|
| 可点击物体 hover | 物体高亮 + 鼠标变为 pointer |
| 可拖拽物体 hover | 物体高亮 + 鼠标变为 grab |
| 拖拽中 | 鼠标变为 grabbing + 道具跟随 |
| 条件未满足点击 | 轻微抖动 + 一行提示文字淡入淡出（如"需要门禁卡"） |

---

## 五、ThemeSwitcherPanel — 主题切换

### 5.1 入口位置

软件设置面板 → 主题 → 3D 主题

### 5.2 面板内容

```
┌─────────────────────────────────────┐
│  3D 主题                             │
│                                      │
│  当前：[Cyber-Girl Apartment] [切换] │
│                                      │
│  ┌───────────────────────────────┐   │
│  │ [封面] Cyber-Girl Apartment   │   │
│  │ 版本 1.0.0 · 激活中           │   │
│  │ [停用]                        │   │
│  └───────────────────────────────┘   │
│                                      │
│  ┌───────────────────────────────┐   │
│  │ [封面] 古风水墨                │   │
│  │ 版本 1.0.0 · 已下载           │   │
│  │ [激活] [删除]                  │   │
│  └───────────────────────────────┘   │
│                                      │
│  ┌───────────────────────────────┐   │
│  │ [+] 浏览更多主题...            │   │
│  └───────────────────────────────┘   │
│                                      │
│  [导入主题文件]                       │
└─────────────────────────────────────┘
```

---

## 六、PermissionGate — 权限拦截

### 6.1 Free 用户

```tsx
function PermissionGate({ children }: { children: React.ReactNode }) {
  const isMember = useGate("premium-theme");

  if (!isMember) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90">
        <div className="text-center">
          <h2 className="text-white text-2xl mb-4">3D 主题</h2>
          <p className="text-gray-400 mb-6">
            3D 交互主题为 Member 专属功能
          </p>
          <button className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded"
                  onClick={() => openMembershipPage()}>
            升级至 Member
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

### 6.2 Member 过期

与 Free 用户一致，显示升级引导，文案调整为"续费以继续使用 3D 主题"。

---

## 七、多语言文案自动切换

### 7.1 获取主题文案

```typescript
function useThemeI18n(): ThemeI18n {
  const appLang = useSettingsStore((s) => s.language); // 软件全局语言设置
  const themeI18n = useThreeDStore((s) => s.scene.themeMeta?.i18n);

  return {
    t(key: string): string {
      // 1. 优先当前语言
      const langData = themeI18n?.[appLang];
      if (langData?.[key]) return langData[key];

      // 2. Fallback 到 en
      const enData = themeI18n?.["en"];
      if (enData?.[key]) return enData[key];

      // 3. 最后显示 raw key
      return key;
    },
  };
}
```

### 7.2 切换语言时

- 软件语言设置变更 → 触发 3D 模块重新渲染文本节点
- 正在显示的 DialogBox 文本即时切换
- 不重启渲染循环、不重载场景

---

## 八、错误状态 UI

### 8.1 场景异常

```
┌──────────────────────────────────┐
│                                  │
│         ⚠                       │
│    3D 场景加载异常                │
│                                  │
│   [重试]  [使用静态预览]  [关闭]  │
│                                  │
└──────────────────────────────────┘
```

### 8.2 模块已禁用（熔断后）

```
┌──────────────────────────────────┐
│                                  │
│    3D 主题模块已暂停              │
│    检测到异常，已自动禁用以保护   │
│    软件正常运行                   │
│                                  │
│   [重新启用]  [了解更多]          │
│                                  │
└──────────────────────────────────┘
```
