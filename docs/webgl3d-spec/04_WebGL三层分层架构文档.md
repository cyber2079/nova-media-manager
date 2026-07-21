# 04 — WebGL 三层分层架构文档

> **优先级**：P0
> **版本**：v1.0 | **冻结日期**：2026-07-22
> **覆盖**：软件底层、前端业务、WebGL 渲染三层通信逻辑、调用链路中转封装、各层职责边界、模块隔离机制
> **不覆盖**：具体渲染循环/资源销毁（见 [05_渲染管线](05_3D场景通用渲染管线规范.md)）、着色器语法（见 [06_着色器规范](06_着色器开发通用规范.md)）、画布 DOM 挂载（见 [12_画布组件](12_WebGL画布通用组件开发规范.md)）

---

## 一、三层架构总览

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  第一层：主应用业务层（Nova Media Manager）        │
│  ┌────────────────────────────────────────────┐  │
│  │ React UI · 路由 · 状态管理 · 原生功能      │  │
│  │                                            │  │
│  │ ★ 只通过 Feature Flag + 动态 import        │  │
│  │   接触第二层，不直接触及第三层              │  │
│  └──────────────┬─────────────────────────────┘  │
│                 │  封装中转接口                    │
│                 │  (bridge/)                       │
│  ┌──────────────▼─────────────────────────────┐  │
│  │                                            │  │
│  │  第二层：3D 扩展模块层（隔离层）            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │ Feature Flag · Error Boundary        │  │  │
│  │  │ Canvas 组件 · Zustand Store · 熔断器 │  │  │
│  │  │                                      │  │  │
│  │  │ ★ 自己的状态、自己的异常处理         │  │  │
│  │  │ ★ 崩溃不影响第一层                    │  │  │
│  │  └──────────────┬───────────────────────┘  │  │
│  │                 │  WebGL API 调用             │  │
│  │  ┌──────────────▼───────────────────────┐  │  │
│  │  │                                      │  │  │
│  │  │  第三层：WebGL 渲染引擎层             │  │  │
│  │  │  RenderManager · SceneManager        │  │  │
│  │  │  ShaderCompiler · ResourceCache      │  │  │
│  │  │  AnimationController · RayPicker     │  │  │
│  │  │                                      │  │  │
│  │  │  ★ 独立渲染循环、独立资源池          │  │  │
│  │  │  ★ 通过 Web Worker 处理重活          │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  │  第二层 + 第三层 = src/webgl3d/ 全部代码   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ★ Rust 底层（WebGL 不直接接触）                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Tauri Commands · 文件系统 · SQLite · 加密 │  │
│  │ 通过 Tauri invoke → bridge/tauriCommands  │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## 二、各层职责

### 2.1 第一层：主应用业务层

**职责**：
- 提供 UI shell（设置面板入口、主题切换界面）
- 管理全局 Feature Flag 状态
- 提供权限检查能力（`useGate`）
- 在 Flag 为 true 时动态加载第二层

**不应做的事**：
- 不直接创建 WebGL context
- 不 import WebGL 渲染相关类型
- 不直接调用 `invoke("webgl3d_*")` 等底层接口
- 不在自己的 error boundary 里 try-catch 3D 模块异常（那是第二层的事）

**对第二层的接口**：

```typescript
// 第一层唯一接触第二层的方式
interface ThreeDModuleAPI {
  init(container: HTMLElement): Promise<void>;
  destroy(): Promise<void>;
  switchTheme(themeId: string): Promise<void>;
  isActive(): boolean;
}
```

### 2.2 第二层：3D 扩展模块层（隔离层）

**职责**：
- 管理 Feature Flag 检查和动态导入
- Error Boundary 包裹整个第三层，捕获所有渲染异常
- 管理独立的 Zustand store
- 实现熔断器状态机
- 通过 bridge/ 调用第一层提供的能力（权限、文件系统）
- 通过 bridge/ 调用 Rust 侧命令
- 管理 3D 功能启停的生命周期

**不应做的事**：
- 不直接修改第一层的 Zustand store
- 不直接操作 DOM 中不属于自己的节点
- 不在自己的 Error Boundary 之外抛出异常
- 不在未检查权限的情况下初始化第三层

### 2.3 第三层：WebGL 渲染引擎层

**职责**：
- 管理全局唯一 WebGL context
- 渲染循环（requestAnimationFrame）
- 场景管理（加载、卸载、切换）
- 着色器编译与缓存
- 资源加载与生命周期（纹理、模型、动画）
- 交互系统（射线检测、动画状态机）
- Web Worker 管理（资源解压、解码）
- 性能指标采集

**不应做的事**：
- 不感知会员权限、付费状态
- 不直接访问文件系统（通过 bridge 请求）
- 不直接操作 React 组件或 DOM（仅操作自己的 Canvas）
- 不在 Worker 之外执行超过 16ms 的同步计算

---

## 三、层间通信规范

### 3.1 第一层 → 第二层

```
第一层                   第二层
  │                        │
  │── Feature Flag check ─→│  (同步)
  │                        │
  │── import() ───────────→│  (异步，懒加载)
  │                        │
  │── init(container) ────→│  (异步)
  │←── { success } ───────│
  │                        │
  │── switchTheme(id) ────→│  (异步，可取消)
  │←── { success } ───────│
  │                        │
  │── destroy() ──────────→│  (异步，强制清理)
  │←── { success } ───────│
```

### 3.2 第二层 → Rust 底层

```
第二层 (bridge/)          Rust (commands/webgl3d.rs)
  │                        │
  │── invoke("nv3d_open",  │
  │    { path }) ─────────→│  返回 Manifest JSON
  │←── Manifest ──────────│
  │                        │
  │── invoke("nv3d_read_   │
  │    block", {id,hash})─→│  返回 ArrayBuffer
  │←── Block Data ────────│
  │                        │
  │── invoke("webgl3d_     │
  │    save", {theme,data})→│  写入独立数据表
  │←── { ok } ────────────│
```

**关键约束**：所有 invoke 调用必须 try-catch，失败返回 null，不抛异常。

### 3.3 第二层 → 第一层（反向通知）

通过回调或事件，不直接修改第一层状态：

```typescript
// 第二层暴露的事件钩子
interface ThreeDEventHooks {
  onStateChange: (state: "loading" | "active" | "degraded" | "disabled") => void;
  onError: (error: ThreeDError) => void;       // 仅通知，不做恢复
  onFpsUpdate: (fps: number) => void;          // 调试用
}
```

---

## 四、调用链路的异常隔离

### 4.1 每一层的异常边界

```
第一层异常
  └─ React Error Boundary（应用级）
     └─ 捕获第一层自身的异常
     └─ 不会收到第三层的异常 —— Error Boundary 在第二层拦截

第二层异常
  └─ ThreeDErrorBoundary（模块级）
     └─ 捕获第三层所有异常
     └─ 渲染静态降级内容
     └─ 不向第一层传播

第三层异常
  └─ WebGL context lost → 自动恢复流程
  └─ Shader compile fail → 跳过该 shader
  └─ Worker crash → error 事件处理
  └─ 未捕获异常 → 第二层 Error Boundary 兜底
```

### 4.2 隔离验证测试

以下场景必须全部通过：

| 测试场景 | 预期结果 |
|---------|---------|
| 第三层抛出 JS 异常 | 第二层捕获 → 降级 UI → 第一层正常运行 |
| WebGL context lost 且恢复失败 | 第二层降级 → 第一层正常运行 |
| Worker 线程崩溃 | 第三层标记资源加载失败 → 第二层降级 → 第一层正常运行 |
| Rust 侧 3D command panic | Tauri 返回 error → bridge catch → 第二层降级 |
| 3D 模块 import() 失败 | catch → Flag 标记为 disabled → 第一层正常运行 |
| Feature Flag = false | 3D 模块 0 代码加载 → 第一层正常运行 |

---

## 五、模块独立启停流程

### 5.1 启动流程

```
1. 用户开启开关（或软件启动时读取持久化状态）
2. 检查 Feature Flag → 权限检查
3. 动态 import("src/webgl3d")
4. 初始化第三层 RenderManager（创建 WebGL context）
5. 加载当前主题 Manifest
6. 渲染低模预览 → 后台加载高精度资源
7. 进入可交互状态
```

### 5.2 停止流程

```
1. 用户关闭开关（或熔断触发）
2. 暂停渲染循环
3. 保存当前用户存档
4. 执行全资源 dispose
5. 销毁 WebGL context
6. 卸载 React 组件
7. 恢复原生壁纸
8. 持久化状态 = disabled
```

---

## 六、与现有架构的关系

```
现有架构                          新增（3D 模块）
─────────                        ─────────
React UI ─────────────────────── 互不侵入
Zustand stores (game/widget/     独立 Zustand store (threeDStore)
  settings)
Tauri commands (game/steam/      独立 command 模块 (webgl3d)
  performance)
SQLite tables (games/settings)   独立表 (webgl3d_user_data)
NVTP (.nvtp) 普通主题                  NV3D (.nv3d) 3D 主题（独立格式）
public/themes/                    nova-themes-assets/webgl3d/
```

**关键原则**：新增代码只做加法（新增文件、新表、新接口），不做修改（不改现有文件、不改现有表结构、不改现有命令）。
