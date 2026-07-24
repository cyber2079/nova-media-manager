# 桌面小组件设计规范

> 基于实际代码行为梳理，版本 2.0 · 2026-07-25

---

## 一、DesktopWidget 接口与行为

### 1.1 Props

```typescript
interface DesktopWidgetProps {
  id: string;            // 必需 — store key（"myComputer" | "clock" | …）
  position: string;      // 预设位置（PRESET_CLASSES 的 key）
  children: ReactNode;   // 小组件内容
}
```

### 1.2 自动处理

- **定位**：无自定义坐标时用 CSS class（`bottom-20 right-5` 等），有自定义坐标时用 inline `left/top` px
- **锁定/解锁**：默认 `widgetLocked[id] !== false`→locked。hover 显示 🔒，点解锁显示拖拽手柄+🔓锁定按钮
- **拖拽**：手柄 `onPointerDown→pointermove→pointerup`，松开时 `Math.round` 存盘
- **边界 clamp**：`top ≥ HEADER_H(64) + HANDLE_H(22) = 86px`，`bottom ≤ windowH - FOOTER_H(48)`，`0 ≤ left ≤ windowW - widgetW`
- **header 保护**：`onMove` 中 `clientY ≤ 86` 直接 return；`onUp` 中鼠标在 header 区域松手取当前显示坐标 clamp 后存盘
- **模式切换**：`setCountdown` 检测 `displayMode` 变化时清除自定义坐标，回到预设位置
- **预设切换**：`setPosition` 调用时删除 `widgetCustomPos[id]`

### 1.3 定位预设

```typescript
const PRESET_CLASSES = {
  "top-left":      "top-20 left-5",
  "top-right":     "top-20 right-5",
  "center-left":   "top-1/2 -translate-y-1/2 left-5",
  "center-right":  "top-1/2 -translate-y-1/2 right-5",
  "bottom-left":   "bottom-20 left-5",
  "bottom-right":  "bottom-20 right-5",
};
```

### 1.4 层级

| 层 | z-index |
|----|---------|
| 小组件（fixed） | 47 |
| 小组件内容区（relative） | z-1 |
| 控制条（absolute, top -22px） | z-10 |
| Header | 50 |
| Footer | 50 |
| QuickHub 遮罩 | 55 |

小组件内容区 `z-index: 1`，控制条 `z-index: 10`。控制条悬在内容上方，pointer 事件不冒泡到内容。

---

## 二、拖拽约束

```
小组件 top 最小 86px（64 header + 22 手柄高度）
小组件 bottom 最大 windowH - 48（footer）
```

`onMove` 中 `clientY ≤ 86` 直接 return，不跟随鼠标。
`onUp` 中如果在 header 区域松手，取 `el.style.left/top` 当前值 clamp 后存盘。

---

## 三、交互规范

### 3.1 指针事件分配

| 元素 | 行为 |
|------|------|
| 小组件根 div | `pointer-events-auto` |
| DesktopWidget 内容包裹层 | `relative z-[1] pointer-events-auto` |
| 控制条（解锁时） | `absolute top: 0, marginTop: -22, z-10 pointer-events-auto` |
| 拖拽手柄 | `onPointerDown + setPointerCapture` |
| 锁/解锁按钮 | `w-5 h-5`(20px)，`onClick + e.stopPropagation()` |
| 解锁后的 Hover 图标 | `opacity-0 group-hover/widget:opacity-100` |
| 装饰性 SVG | `pointer-events-none`（环、背景圆） |
| 小组件内部按钮 | `pointer-events-auto` |

### 3.2 嵌套小组件的指针隔离

小组件外层容器加 `pointer-events-none`，只让 `<button>` 用 `pointer-events-auto`：

```tsx
<DesktopWidget id="myComputer" position={config.position}>
  <div className="flex flex-col items-center gap-1 pointer-events-none">
    <button className="group pointer-events-auto" onClick={handleClick}>
      <svg className="pointer-events-none">…</svg>
      <span>label</span>
    </button>
  </div>
</DesktopWidget>
```

### 3.3 避免的问题

| 问题 | 原因 | 解决 |
|------|------|------|
| Hover 时小组件偏移 1px | SVG `drop-shadow` 滤镜改变 GPU 合成层边界 | **禁止在小组件 SVG 上用 `drop-shadow-lg`** |
| 锁定图标 hover 不到 | 被内部大按钮覆盖 | 锁定图标用 `absolute top:-20px left-1/2`，不受内容尺寸影响 |
| 拖拽手柄跑进 header | 手柄在组件上方悬出 22px | `clamp` 中 `topMin = HEADER_H + HANDLE_H`，onMove 中 `clientY ≤ 86` 停止跟随 |
| 内容点击误触控制条 | 事件冒泡 | 控制条 `z-10`，内容区 `z-1`，手柄 `stopPropagation` |

---

## 四、视觉效果

### 4.1 颜色 —— 只使用 CSS 变量

```css
color: var(--font-primary);
color: var(--font-secondary);
color: var(--font-widget);
background: var(--color-primary);
stroke: var(--color-primary-light);
fill: var(--color-primary-dark);
```

**禁止**：`#4788f0`、`#ffffff`、`rgba(...)` 等硬编码颜色。

### 4.2 玻璃面板

用于展开/全尺寸小组件：
```
bg-surface-light/95 backdrop-blur-md border border-primary/30 rounded-xl shadow-xl
```

### 4.3 霓虹发光

```css
filter: brightness(1.2);         /* 图标提亮 */
text-shadow: 0 0 8px var(--color-primary-light); /* 文字发光 */
```

SVG 内部的 `filter: drop-shadow()` 仅在 `<circle>` 等具体元素上可用，**永远别放 SVG 根元素上**。

---

## 五、性能

| 规则 | 理由 |
|------|------|
| 数据轮询 ≥ 3s | `setInterval(fetch, 3000)` |
| 不用 `requestAnimationFrame` 做状态更新 | 60fps setState 让 React 没法处理交互（倒计时是反例——已修复，从 60fps 降到 10fps） |
| 进度环用 SVG `stroke-dashoffset` + `transition` | 比 JS 重绘便宜 |
| 小组件数量少不滥用 | 少用 `useMemo`，小组件内元素少，开销低 |
| `document.hidden` 时暂停轮询 | 省 CPU |

---

## 六、尺寸 & 无障碍

| 规则 | 值 |
|------|-----|
| 迷你模式 | 40×40px |
| 标准模式 | ~100×100px 容器 |
| 展开面板 | 绝对定位弹出，不与小组件挤空间 |
| 按钮最小可点击区域 | 20×20px（小图标按钮）/ 28×28px（面板内按钮）|
| 最小字号 | `text-[10px]` |
| Hover tooltip | 所有按钮必须有 `title` |
| 默认状态 | 锁定，防止误触拖拽 |

---

## 七、Store 集成

### 7.1 数据流

```
widgetStore.ts
├── {id}.enabled       → 是否显示
├── {id}.position      → 预设位置
├── widgetCustomPos    → 拖拽后的自定义坐标 {x, y}
├── widgetLocked       → 是否锁定（默认 true）
└── 专有配置            → 小组件自定义字段
```

### 7.2 新增小组件步骤

1. Store — `widgetStore.ts` 添加配置字段 + 默认值
2. 组件 — `src/components/widgets/YourWidget.tsx`
3. Layout — `Layout.tsx` 引入并用 `<DesktopWidget id=… position=…>` 包裹
4. 设置 — `SettingsDialog.tsx → WidgetsTab` 添加开关
5. i18n — 7 个语言文件补齐翻译
6. 检查 — `npm run typecheck`

---

## 八、检查清单

- [ ] CSS 变量做颜色，不硬编码
- [ ] SVG 不用 `drop-shadow-lg`
- [ ] 外层 `pointer-events-none`，按钮 `pointer-events-auto`
- [ ] 不在 RAF 中高频 setState
- [ ] 数据轮询 ≥ 3s
- [ ] 所有按钮有 `title`
- [ ] Store 类型完整，持久化路径正确
- [ ] 7 locales 都有 i18n
- [ ] `npm run typecheck` 通过
