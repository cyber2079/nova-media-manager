# Nova Media Manager — 应用层安全加固方案

> 2026-07-15 · 全部使用免费/开源方案

## 一、当前状态

| 措施 | 状态 |
|---|---|
| 禁用右键 | ✅ 已实现 (`main.tsx`) |
| 代码混淆 (license + crypto 在私库) | ✅ 已实现 |
| 主题加密 (XOR + SHA256) | ✅ 已实现 |
| nova:// custom protocol | ⚠️ 笔记本规划中 |
| DevTools 禁用 (release) | ❌ 未做 |
| CSP 移除 `unsafe-eval` | ❌ 未做 |
| Rust release 优化 (strip/lto) | ❌ 未做 |
| UPX 压缩壳 | ❌ 未做 |
| 反调试检测 | ❌ 未做 |
| 前端 bundle hash 校验 | ❌ 未做 |
| .nvtp Ed25519 签名 | ❌ 未做 |
| 反内存 dump (zeroize) | ❌ 未做 |
| 禁用 F5/Ctrl+R 刷新 | ❌ 未做 |

---

## 二、待实施清单（全部免费）

### 🔴 P0 — 立刻做

| # | 措施 | 操作 | 效果 | 工作量 |
|---|---|---|---|---|
| P0-1 | DevTools 禁用 | `tauri.conf.json` 加 `"devtools": false`（release 生效） | F12 完全失效 | 1 行 |
| P0-2 | CSP 移除 unsafe-eval | `tauri.conf.json` CIP 中去掉 `'unsafe-eval'` | 禁止 console 执行任意 JS | 0.5h |
| P0-3 | 禁用 F5/Ctrl+R | `main.tsx` 拦截 `keydown` — F5 和 Ctrl+R 被阻止 | 前端状态不可恢复 | 5 行 |

### 🟡 P1 — 发布前做

| # | 措施 | 操作 | 效果 | 工作量 |
|---|---|---|---|---|
| P1-1 | Rust release 优化 | `Cargo.toml` `[profile.release]` 加 `strip = true`, `lto = true`, `opt-level = "z"`, `panic = "abort"` | 符号剥离 + 函数内联 + 体积缩小 ~40% | 0.5h |
| P1-2 | UPX 压缩壳 | 构建后 `upx --best --lzma app.exe` | `.exe` 从 ~8MB 压到 ~3MB，`strings` 看不到明文 | 免费一行命令 |
| P1-3 | 反调试检测 | `main.rs` 启动时检测 `IsDebuggerPresent()` + `CheckRemoteDebuggerPresent()` + 硬件断点 Dr0-Dr3 | 调试器附加 → 应用退出 | 1h |
| P1-4 | 前端 bundle hash | 编译时 Rust 嵌入 `dist/` 各文件 SHA256；启动时逐文件对比；不匹配 → 弹窗退出 | JS 被篡改 → 拒绝启动 | 3h |
| P1-5 | .nvtp Ed25519 签名 | `packer.rs` 打包时用私钥签名 manifest；`loader.rs` 安装前用公钥验签 | 主题被替换 → 验签失败 | 已有密钥对，2h |
| P1-6 | 内存 token 擦除 | 引入 `zeroize` crate；token/key 使用后立即 `zeroize()` | dump 内存找不到 token | 1h |

### 🟢 P2 — 长期

| # | 措施 | 操作 | 效果 | 工作量 |
|---|---|---|---|---|
| P2-1 | nova:// 内存解密 | Rust custom protocol → 拦截 `nova://` URL → 从加密缓存读 → 内存 AES 解密 → 返回 WebView | 明文素材从不落盘 | 3-5 天 |
| P2-2 | 字符串混淆 | 编译时用宏展开 + XOR 编码编译期常量，运行时解码 | MASTER_SEED/SERVER_URL 不出现于二进制 | 1h (macro_rules) |

---

## 三、所有方案均为免费

| 方案 | 类型 | 说明 |
|---|---|---|
| UPX | 开源 (GPL) | 二进制压缩壳，20 年历史 |
| Rust strip/lto | 内置 | 无需额外工具 |
| IsDebuggerPresent | Windows API | 系统自带 |
| zeroize | Rust crate | MIT/Apache 2.0 |
| Ed25519 签名 | rust-ed25519-compact | 已有密钥对 |
| 前端 hash | 自实现 | SHA256 + include_bytes! |

没有任何付费方案。所有措施用 Rust 生态 + Windows API + 开源工具即可完成。

---

## 四、副作用分析

| # | 措施 | 副作用 | 严重程度 |
|---|---|---|---|
| P0-1 | DevTools 禁用 | 无。纯配置项 | 🟢 无 |
| P0-2 | CSP 去 unsafe-eval | 需确认代码中没用 `eval()`/`new Function()` | 🟢 无 |
| P0-3 | 禁用 F5/Ctrl+R | 无。键盘事件拦截 | 🟢 无 |
| P1-1 | Rust opt-level="z" | **体积优先优化，速度略降**。`z` 为最小体积牺牲约 5-10% 性能。若在意速度，可改为 `opt-level="s"`（体积/速度折中）。`lto` 增加编译时间（release build 多 30s-1min），运行时不变。`strip` 无影响 | 🟡 轻微 |
| P1-2 | UPX 压缩 | **三项副作用**：①启动时解压 8MB 约 +100-300ms；②部分杀软误报 UPX 壳为病毒（需提交白名单）；③运行后性能完全恢复，不持续影响 | 🟡 中等 |
| P1-3 | IsDebuggerPresent | 无。启动时一次 API 调用 | 🟢 无 |
| P1-4 | 前端 hash 校验 | 启动时扫描 `dist/` 所有文件计算 SHA256，~50 个文件约 100-200ms | 🟢 可接受 |
| P1-5 | .nvtp Ed25519 签名 | 安装主题时单次验签 <1ms，无持续消耗 | 🟢 无 |
| P1-6 | zeroize | 无。内存覆盖不消耗 CPU | 🟢 无 |
| P2-1 | nova:// 内存解密 | **每次加载图片都走 AES 解密**。单张 <1ms，幻灯片场景（30 张/分钟）可忽略。需加内存缓存避免重复解密 | 🟡 轻微 |
| P2-2 | 字符串 XOR | 无。启动时解码一次 | 🟢 无 |

**结论**：唯一的实质副作用是 P1-1（编译优化）和 P1-2（UPX）。其余措施完全无感。

### 开发环境兼容性

四项措施需要区分 dev / release，否则影响本地开发：

| # | 措施 | dev 环境 | release 环境 | 实现方式 |
|---|---|---|---|---|
| P0-1 | DevTools 禁用 | ❌不禁用 | ✅禁用 | `#[cfg(not(debug_assertions))]` 条件编译 |
| P0-2 | CIP 去 unsafe-eval | ❌保留（Vite HMR 用 `eval` 实现热更新，去掉开发环境会崩） | ✅去掉 | 两套 CIP：release 用 Rust 注入，dev 保持现状 |
| P0-3 | F5 禁用 | ❌不禁用 | ✅禁用 | `if (import.meta.env.DEV) return` 跳过 |
| P1-3 | 反调试检测 | ❌不启用 | ✅启用 | `#[cfg(not(debug_assertions))]` 包裹 |

其余 9 项无影响：
- P1-1 `Cargo.toml [profile.release]` — 天生只作用于 release
- P1-2 UPX — 只压缩发布后的 `.exe`
- P1-4 前端 hash — 启动校验，dev 模式可跳过
- P1-5 .nvtp 签名 — 开发者自己用私钥签，不影响
- P1-6 zeroize — 无感知
- P2-1/2 — 类型，发布前才启用

### 优化建议

| 如果担心... | 调整方案 |
|---|---|
| UPX 误报 | 跳过 UPX，仅用 Rust strip + lto。strings 仍能看到 MASTER_SEED，但逆向难度已在 |
| opt-level="z" 太激进 | 改为 `opt-level="s"`（体积和速度折中），或保持默认 `opt-level=3`（最快） |
| 启动慢 | P1-2 + P1-4 叠加约 300-500ms 启动延迟，对桌面应用可以接受 |

---

## 五、实施顺序

```
① P0-1~P0-3（1h）      → 防住好奇玩家
② P1-1 + P1-2（1h）     → strings 失效 + 体积缩小
③ P1-3（1h）            → 反调试
④ P1-4 + P1-5（5h）     → 防篡改 JS + 主题
⑤ P1-6（1h）            → 防内存 dump
⑥ P2（后续）            → 终极防线
```

---

## 六、开发环境不受影响

一句话总结：**加了 `#[cfg(not(debug_assertions))]` 或 `import.meta.env.DEV` 判断之后，本地 `npm run tauri:dev` 和现在的体验完全一样**。

| 你开发时 | 发布后 |
|---|---|
| F12 能用 ✅ | F12 禁用 ❌ |
| F5 刷新 ✅ | F5 禁用 ❌ |
| CIP 含 unsafe-eval（Vite HMR 需要）✅ | CIP 纯净 ❌ |
| 调试器不会退出 ✅ | 调试器被检测 → 退出 ❌ |

所有安全措施通过编译期判断，只对 `cargo build --release` 产物生效。

---

> **待确认**：按顺序从 P0 开始执行？
