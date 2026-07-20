# Nova Media Manager — 项目开发指南

> 开发流程详见 [DEVELOPMENT.md](DEVELOPMENT.md)

## 项目定位

桌面娱乐主机 — 定位语「**让桌面配得上你的热爱**」。面向中文用户的本地影音 + 游戏 + 桌面美化一体应用，以精美主题和沉浸式剧情体验为差异化竞争力。对标心智是"PC 上的娱乐主机界面"，不是媒体管理器。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Tailwind CSS 4 + Zustand + Vite 8 |
| 后端 | Tauri 2.11 + Rust (rusqlite, serde, chrono, zip, sha2) |
| 服务端 | Node.js 22 + Express + sql.js |
| 部署 | Alibaba Cloud ECS + Nginx + Docker Compose |

## 仓库

| 仓库 | 类型 | 分支 | 说明 |
|---|---|---|---|
| `nova-media-manager` | 公开 (AGPL v3) | `master` | 主代码 |
| `nova-proprietary` | 私有 (闭源) | `main` | license 模块 + 主题元数据 |

## 项目路径

```
D:\nova-media-manager\      ← GitHub 公库
├── src/                    # React 前端
├── src-tauri/src/          # Rust 后端
│   ├── license/            # → D:\nova-proprietary\license\ (软链接)
│   └── theme/              # .nvtp 加密/打包/解包
├── public/themes/          # 主题资源（Syncthing，不在 Git）
├── server/                 # ECS 服务端（不在 Git）
└── scripts/                # 构建/生成/打包脚本

D:\nova-proprietary\        ← GitHub 私有仓库
├── license/mod.rs          # 许可证验证（闭源）
├── theme/crypto.rs         # 主题加密密钥
└── themes/                 # 主题元数据 + 提示词（Git 版本控制）
    ├── manifest.schema.json
    ├── prompts.schema.json
    ├── ice-girl/
    └── cyber-girl/

D:\nova-themes-assets\      ← Syncthing 同步 — AI 生成的素材
├── ice-girl/               # 图片/视频/图标
└── cyber-girl/
```

## 主题架构

- **default** — 唯一内置主题，永久免费，无 license 要求
- **ice-girl**（冰霜女皇）、**cyber-girl**（代码幽灵）— premium 主题，Member 可用
- 分发：`.nvtp` 单文件（ZIP + XOR/SHA256 加密），密钥派生自编译种子 + theme_id
- 未来：AES-256-GCM + 内存解密 + `nova://` custom protocol，图片不落地
- 代码路径：`poe_*` 已全部重命名为 `ice_*`

## 许可证系统

- 一码一机（一个激活码 = 一台设备）
- 随时可解绑；换绑后 15 天冷却期内不可再绑新设备；365 天内最多解绑 3 次
- 月付 = 30 天，年付 = 365 天，永久 = 终身，精确到秒
- 每 7 天联网校验 JWT，30 天离线宽限期后降级 Free
- FeatureFlag：`premium-theme` | `auto-update`
- Hook：`src/lib/useGate.ts` — `useGate(flag)` → boolean
- 会员过期后自动降级 Free，已下载主题锁定（不删除），续费后恢复

## 定价

| | Free | Member |
|---|---|---|
| 价格 | 免费 | ¥19.9/月 · ¥199/年 · ¥899 永久 |
| 设备 | — | 1（一码一机） |

**功能分层**：

| 功能 | Free | Member |
|------|:---:|:---:|
| 全部影音管理基础功能 | ✅ | ✅ |
| 全功能桌面小部件 | ✅ | ✅ |
| default 主题 + 自定义调色板 | ✅ | ✅ |
| Premium 主题 + 角色剧情 + BGM | ❌ | ✅ |
| 主题自动更新 | ❌ | ✅ |
| 字体/图标大小额外档位 | ❌ | ✅ |
| 歌词/播放器颜色自定义 | ❌ | ✅ |
| 自定义壁纸（单张/文件夹/幻灯片） | ❌ | ✅ |
| 电影设为壁纸 | ❌ | ✅ |
| 背景视频调参 | ❌ | ✅ |
| 倒计时语音+光晕 | ❌ | ✅ |
| 我的电脑主题定制 | ❌ | ❌ | ✅ |
| 系统主题（壁纸包+图标集+全局皮肤） | ❌ | ✅ | ✅ |
| 在线备份/恢复 | ❌ | ❌ | ✅ |

爱发电：https://ifdian.net/a/cyber2079

## ECS 服务器

| 项目 | 值 |
|---|---|
| 域名 | scm-think.cn |
| SSH | `ssh -i ~/.ssh/ecs_nova root@39.104.55.38` |
| 服务 | systemd `nova-server`，端口 3000 |
| 代码 | `/var/www/server/` |
| CDN | `/var/www/themes/` → https://scm-think.cn/themes/ |

### 服务管理
```bash
systemctl status nova-server
systemctl restart nova-server
journalctl -u nova-server -f
```

### 部署
```bash
# Landing page
scp -i ~/.ssh/ecs_nova server/static/index.html root@39.104.55.38:/var/www/server/static/

# 服务端
scp -i ~/.ssh/ecs_nova -r server/src/* root@39.104.55.38:/var/www/server/src/
ssh -i ~/.ssh/ecs_nova root@39.104.55.38 "systemctl restart nova-server"

# MSI 安装包
npm run tauri:build
scp -i ~/.ssh/ecs_nova src-tauri/target/release/bundle/msi/*.msi root@39.104.55.38:/var/www/releases/
```

## 日常开发

```bash
npm run tauri:dev          # 启动
npm run pull               # 拉取公库+私库
npm run push "描述"         # add + commit + push
npm run typecheck          # 编译检查（commit 前必须过）— 即 tsc --noEmit -p tsconfig.app.json
```

> ⚠️ 不要用裸 `npx tsc --noEmit`：根 tsconfig.json 是 `files: []` + references，裸命令检查 0 个文件、永远退出 0。

## 已知 Bug

- `media_library.db` 和 localStorage 在同一 AppData 目录，清缓存会误删用户媒体数据

## 记忆系统

`~/.claude/projects/d--nova-media-manager/memory/` — 跨会话持久记忆，包含主题架构、安全分离、数据同步、分层规划、已知 Bug 等。详见 MEMORY.md。

### 多机同步约定

- **仓库内知识**（开发规则、教训、门禁命令）→ 写进 CLAUDE.md / DEVELOPMENT.md，随 `npm run push` / `npm run pull` 在台式机与笔记本间同步，两边的 Claude 自动读取。
- **Claude 记忆目录**是本机文件，另一台机器读不到 → 用 Syncthing 把 memory 文件夹加为同步共享（和主题素材同一套方案）。前提：两台机器仓库路径都必须是 `D:\nova-media-manager`，记忆目录名 `d--nova-media-manager` 由该路径推导，路径不同则记忆不会被加载。
- **⚠️ 红线**：memory 里的 secrets.md / ecs-ssh.md / afdian.md 含密钥（JWT_SECRET、ADMIN_KEY、GitHub PAT 等），**绝不能进公库**（本仓库是公开 AGPL）。含密钥的记忆只走 Syncthing 点对点或私库 nova-proprietary；能进公库的只有纯方法论。
