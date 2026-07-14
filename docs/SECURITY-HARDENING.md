# Nova Media Manager — 应用层安全加固方案

> 2026-07-15 · 方案阶段，待确认后实施

## 一、威胁回顾

| 攻击向量 | 难度 | 危害 | 当前状态 |
|---|---|---|---|
| 开 F12 查看前端代码 | 极低 | 暴露所有 JS 逻辑、API 端点 | 下个 commit 禁用 |
| 从二进制提取 MASTER_SEED 等字符串 | 低 | 解密所有 .nvtp 主题包 | 无防护 |
| 用 Ghidra/IDA 反编译 Rust 二进制 | 中 | 找到 license 校验分支，patch 跳转绕过 | 无防护 |
| 替换 `dist/` 中的前端 JS 文件 | 低 | 改 `useGate()` 返回值，所有功能免费 | 无防护 |
| 进程内存 dump 提取 token/解密素材 | 中 | 窃取 JWT、截取渲染后的图片 | 无防护 |
| 替换 `public/themes/` 中的素材 | 极低 | 用自己的图换掉官方素材 | 无防护 |

## 二、可用的技术手段

### 2.1 二进制层面

| 手段 | 效果 | 成本 | 推荐 |
|---|---|---|---|
| **UPX 压缩壳** | 把 .exe 压缩，`strings` 命令看不到明文字符串，IDA 看到的入口点不是真实代码 | 免费，一行命令 | ✅ 必做 |
| **Vmprotect / Themida** | 商业级虚拟化保护——把关键函数（license 校验）编译成自定义字节码，在虚拟机中执行。反汇编器看到的是垃圾指令。 | ¥3,000-15,000/年 | ⚠️ 有预算可做 |
| **obsidium / Enigma Protector** | 中档保护，反调试 + 代码加密 + 导入表混淆 | ¥500-2,000/一次性 | ✅ 推荐 |
| **Rust 编译优化 + strip** | `lto = true, opt-level = "z", strip = true` — 符号剥离，函数内联，增加逆向难度 | 免费，Cargo.toml 配置 | ✅ 必做 |

### 2.2 资源完整性

| 手段 | 效果 | 成本 |
|---|---|---|
| **前端 JS bundle hash 校验** | 启动时 Rust 计算 `dist/` 下所有文件的 SHA256，对比编译时嵌入的预期值。任何 JS 被篡改 → 拒绝启动 | 中等（需 Tauri resource 嵌入） |
| **主题素材签名** | 每个 .nvtp 包内含 Ed25519 签名，Rust 安装前验签。替换素材 → 验签失败 → 拒绝安装 | 低（已有密钥对） |
| **Tauri bundle resources 加密** | 把 `dist/` 打包时用 AES 加密，Rust 启动时内存解密后交给 WebView。JS 文件不落明文 | 高（需改 Tauri 构建流程） |

### 2.3 运行时反调试

| 手段 | 效果 | 成本 |
|---|---|---|
| **IsDebuggerPresent** | Rust 启动时检查是否被调试器附加，是则退出 | 极低（5 行代码） |
| **CheckRemoteDebuggerPresent** | 同上，检查远程调试器 | 极低 |
| **NtQueryInformationProcess** | 检测隐藏调试器（如 x64dbg 的 ScyllaHide） | 低 |
| **硬件断点检测** | 检测 Dr0-Dr3 寄存器是否被设置（反硬件断点） | 低 |
| **反内存 dump** | 定时擦除内存中的敏感数据（token、key），用完立即 zeroize | 低 |

### 2.4 WebView 层面

| 手段 | 效果 | 成本 |
|---|---|---|
| **禁用 DevTools** | Tauri window config 中 `devtools: false` — 仅 release 生效，完全禁用 F12 | 1 行配置 |
| **禁用右键** | `contextmenu` 事件拦截 | 1 行代码（已做） |
| **禁用 F5/Ctrl+R 刷新** | 防止用户刷新页面绕过某些前端门控 | 低 |
| **CSP 移除 unsafe-eval** | 防止通过 console 执行任意 JS | 0.5h |

## 三、分层实施方案

### 第一层：零成本基础防护（本周可做）

```
目标：让好奇玩家无法 F12/右键，让初级 cracker 无法用 strings 提取密钥
```

| 措施 | 具体操作 |
|---|---|
| ✅ 禁用 DevTools | `tauri.conf.json` → `"devtools": false`（仅 release 窗口） |
| ✅ 禁用右键 | `main.tsx` 加 `contextmenu` 拦截 |
| ✅ Rust release 优化 | `Cargo.toml` 加 `strip = true`, `lto = true`, `opt-level = "z"` |
| ✅ UPX 加壳 | 构建后 `upx --best --lzma target/release/app.exe` |
| ✅ 调试器检测 | `main.rs` 启动时 `IsDebuggerPresent()` → 退出 |
| ✅ CSP 清理 | 移除 `unsafe-eval` |

**效果**：
- 二进制从 ~8MB 压缩到 ~3MB
- `strings` 输出 MASTER_SEED、SERVER_URL、API 端点的可能性大幅降低
- 调试器附加被检测
- F12 和右键完全失效

### 第二层：中等成本商业防护（发布前做）

```
目标：让专业 cracker 的逆向成本 > ¥199
```

| 措施 | 具体操作 |
|---|---|
| ✅ Enigma Protector | 保护 license 校验函数、MASTER_SEED 常量、API URL |
| ✅ 前端 bundle hash 校验 | Rust 启动时验证 dist/ 完整性 |
| ✅ 主题素材 Ed25519 签名 | packer.rs 打包时加签，loader.rs 安装时验签 |
| ✅ 反内存 dump | `zeroize` crate 加密擦除 token/key |

**效果**：
- license 验证逻辑被虚拟化，无法静态分析
- JS 文件被篡改 → 应用拒绝启动
- .nvtp 被替换 → 验签失败
- token 使用后立即从内存擦除

### 第三层：重度商业防护（商业化后考虑）

```
目标：达到商业软件级别的反逆向水平
```

| 措施 | 具体操作 |
|---|---|
| ✅ Vmprotect | 关键代码段虚拟化执行 |
| ✅ Tauri bundle 加密 | dist/ 在安装包中用 AES 加密，启动时内存解密 |
| ✅ nova:// 协议内存不落地 | 已完成 |
| ✅ 服务器端行为检测 | 同一 license 短时间内多地登录 → 标记可疑 |

## 四、资源替换检测流程

```
应用启动
  ├→ Rust 计算 dist/ 下所有文件的 SHA256
  ├→ 对比嵌入二进制中的预期 hash（编译时生成）
  ├→ 不匹配 → 弹窗 "应用文件已损坏" → 退出
  │
  ├→ 用户选择 .nvtp 主题文件
  ├→ loader.rs 验证 Ed25519 签名
  ├→ 签名无效 → "主题包已损坏或被篡改"
  │
  ├→ <img src="nova://theme/ice-girl/faces/angry.webp">
  ├→ Rust custom protocol 拦截
  ├→ 从加密缓存读取 → 内存 AES 解密 → 返回 WebView
  ├→ 明文图片从不落盘
```

## 五、成本估算

| 项目 | 一次性 | 年费 | 说明 |
|---|---|---|---|
| UPX | 免费 | — | 开源 |
| Enigma Protector | ¥1,500 | — | 永久授权 |
| Vmprotect | — | ¥15,000/年 | 按版本更新 |
| Rust 编译优化 | 免费 | — | 0.5h 配置 |
| 反调试代码 | 免费 | — | 1h 编写 |
| 前端 hash 校验 | 免费 | — | 3h 编写 |
| .nvtp 签名 | 免费 | — | 已有密钥对 |

## 六、建议的起步方案

**免费方案足以防住 90% 的潜在破解者**：

```
UPX 压缩 → strings 失效
Rust 优化 + strip → 符号剥离，逆向难度翻倍
反调试检测 → 调试器直接退出
F12/右键禁用 → 前端代码不可见
前端 hash 校验 → JS 文件不可篡改
.nvtp 签名 → 主题不可替换
```

7 项措施中 5 项零成本、2 项需要编码（反调试 + hash 校验），**本周内可完成**。

> **待确认**：先做免费方案（第一层全做 + 第二层的 hash 校验和签名），还是直接上 Enigma Protector？是否要先搜一下 Vmprotect/Themida 的报价？
