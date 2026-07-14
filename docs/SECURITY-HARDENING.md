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

## 四、实施顺序

```
① P0-1~P0-3（1h）      → 防住好奇玩家
② P1-1 + P1-2（1h）     → strings 失效 + 体积缩小
③ P1-3（1h）            → 反调试
④ P1-4 + P1-5（5h）     → 防篡改 JS + 主题
⑤ P1-6（1h）            → 防内存 dump
⑥ P2（后续）            → 终极防线
```

---

> **待确认**：按顺序从 P0 开始执行？
