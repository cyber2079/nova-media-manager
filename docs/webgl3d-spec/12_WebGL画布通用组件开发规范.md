# 12 — WebGL 画布通用组件开发规范

> **优先级**：P2
> **版本**：v1.0 | **更新日期**：2026-07-22
> **覆盖**：复用型画布组件生命周期、挂载/销毁、Resize/DPI 适配、Error Boundary 包裹、事件穿透与 Z 序
> **不覆盖**：交互事件逻辑（见 [07_交互系统](07_3D交互系统通用设计标准.md)）、状态结构（见 [13_全局状态](13_3D全局状态通用结构.md)）、弹窗 UI（见 [14_UI/UX规范](14_3D配套UI-UX通用交互规范.md)）

---

## 一、组件树结构

```tsx
// 主应用中的挂载点
{webgl3dEnabled && (
  <ThreeDModuleRoot>
    <ThreeDErrorBoundary>
      <ThreeDCanvas />
      <ThreeDOverlay />      {/* 加载进度、提示信息 */}
      <ThemeDialog />         {/* 剧情弹窗（按需渲染） */}
    </ThreeDErrorBoundary>
  </ThreeDModuleRoot>
)}
```

---

## 二、ThreeDCanvas 组件

### 2.1 生命周期

```
挂载（mount）
    │
    ├─ 1. 创建 <canvas> 元素
    ├─ 2. RenderManager.createContext(canvas)
    ├─ 3. 注册 context 事件监听（lost/restored）
    ├─ 4. 加载当前主题
    ├─ 5. 启动渲染循环
    └─ 6. 设置状态为 "active"
    
更新（update）
    │
    └─ themeId 变化 → 执行主题热切换（见 05 文档第七章）

卸载（unmount）
    │
    ├─ 1. 暂停渲染循环
    ├─ 2. 保存当前存档
    ├─ 3. 全资源 dispose
    ├─ 4. RenderManager.destroyContext()
    ├─ 5. 移除 canvas 元素
    └─ 6. 终止所有 Worker
```

### 2.2 组件接口

```typescript
interface ThreeDCanvasProps {
  /** 要加载的主题 ID，变化时触发热切换 */
  themeId: string | null;
  /** canvas 的父容器（默认创建一个全屏层） */
  container?: HTMLElement;
  /** 性能模式 */
  performanceMode?: "quality" | "balanced" | "powersave";
  /** 状态变化回调 */
  onStateChange?: (state: CanvasState) => void;
}

type CanvasState = "uninitialized" | "loading" | "active" | "degraded" | "disabled";
```

### 2.3 Canvas 定位

```
Canvas 定位策略：
┌─────────────────────────────────────┐
│  z-index 层                          │
│                                      │
│  最高层：React UI（设置面板、对话框） │
│  ────────────────────────────────    │
│  中间层：3D Canvas（背景层）          │
│  z-index: 0                          │
│  ────────────────────────────────    │
│  底层：原生壁纸（禁用时显示）          │
└─────────────────────────────────────┘
```

- Canvas 默认覆盖整个窗口（`position: fixed; inset: 0`）
- z-index 低于 React UI 组件，不遮挡设置面板、弹窗、底栏

### 2.4 实现骨架

```typescript
function ThreeDCanvas({ themeId, onStateChange }: ThreeDCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderManagerRef = useRef<RenderManager | null>(null);
  const [state, setState] = useState<CanvasState>("uninitialized");

  // 挂载：创建 context + 渲染循环
  useEffect(() => {
    if (!canvasRef.current) return;
    const rm = RenderManager.getInstance();
    rm.createContext(canvasRef.current);
    renderManagerRef.current = rm;
    setState("active");
    onStateChange?.("active");

    return () => {
      rm.pauseLoop();
      rm.disposeAll();
      rm.destroyContext();
      renderManagerRef.current = null;
    };
  }, []);

  // 主题切换
  useEffect(() => {
    if (!themeId || !renderManagerRef.current) return;
    setState("loading");
    renderManagerRef.current.switchTheme(themeId).then(() => {
      setState("active");
    });
  }, [themeId]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 0 }}
    />
  );
}
```

---

## 三、ThreeDErrorBoundary

### 3.1 设计

```typescript
class ThreeDErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; errorInfo: string | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError("three_d_canvas_crash", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    // 触发降级：恢复原生壁纸
    fallbackToNativeWallpaper();
  }

  render() {
    if (this.state.hasError) {
      // 渲染降级内容
      return this.props.fallback ?? <StaticPreviewFallback />;
    }
    return this.props.children;
  }
}
```

### 3.2 降级内容

```tsx
function StaticPreviewFallback() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#0a0a1a" }}>
      <img src={currentThemePreview} alt="" style={{ maxWidth: "100%", maxHeight: "100%" }} />
    </div>
  );
}
```

---

## 四、Resize 与 DPI 适配

### 4.1 Resize Observer

```typescript
useEffect(() => {
  const observer = new ResizeObserver(
    debounce((entries) => {
      const { width, height } = entries[0].contentRect;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      renderManager.resize(width, height, dpr);
    }, 200)  // 200ms debounce 防止频繁重建
  );

  observer.observe(canvas);
  return () => observer.disconnect();
}, []);
```

### 4.2 DPI 变化监听

```typescript
useEffect(() => {
  const onDprChange = () => {
    const dpr = window.devicePixelRatio;
    renderManager.updatePixelRatio(dpr);
  };

  // matchMedia 监听 DPI 变化
  const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  mq.addEventListener("change", onDprChange);
  return () => mq.removeEventListener("change", onDprChange);
}, []);
```

### 4.3 虚拟显示适配器检测

```typescript
function isVirtualDisplay(): boolean {
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) return true; // WebGL 完全不可用

  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  if (debugInfo) {
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    // 匹配已知虚拟适配器模式
    if (/Microsoft Basic Render|GDI Generic/i.test(renderer)) {
      return true;
    }
  }
  return false;
}
```

检测到虚拟适配器 → 直接走静态降级。

---

## 五、事件穿透与 Z 序

### 5.1 穿透逻辑

```
鼠标事件到达 Canvas 层
    │
    ├─ 检查：是否有 React UI 面板显示在上方？
    │   检查条件：document.activeElement 在 UI 层 / UI 面板 visibility
    │   → 是 → Canvas 忽略事件
    │
    └─ Canvas 处理事件
        ├─ 命中可交互物体 → 3D 交互系统消费
        └─ 命中场景背景 → 相机操作消费
```

### 5.2 实现

```typescript
// Canvas 的 pointer-events 管理
function shouldCanvasReceiveEvents(): boolean {
  // 设置面板、弹窗等 UI 打开时
  const overlayOpen = document.querySelector("[data-ui-overlay]") !== null;
  return !overlayOpen;
}

// 在 Canvas 上应用
function updateCanvasPointerEvents() {
  if (canvasRef.current) {
    canvasRef.current.style.pointerEvents = shouldCanvasReceiveEvents()
      ? "auto" : "none";
  }
}
```

---

## 六、组件销毁与资源清理检查清单

组件卸载时必须确认以下全部完成：

| 检查项 | 方法 |
|--------|------|
| ✅ requestAnimationFrame 已停止 | `cancelAnimationFrame(rafId)` |
| ✅ 所有 Worker 已终止 | `worker.terminate()` |
| ✅ 所有 WebGL 资源已 dispose | 遍历 ResourceCache |
| ✅ WebGL context 已 lost | `loseContext()` extension |
| ✅ Canvas 元素已从 DOM 移除 | `canvas.remove()` |
| ✅ React 状态已重置 | component unmount |
| ✅ 事件监听器已移除 | `removeEventListener` |
