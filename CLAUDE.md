# Nova Media Manager — 项目开发指南

## 项目定位

个人影音管理中心 — 面向中文用户的桌面影音管理工具，以精美主题和沉浸式剧情体验为差异化竞争力。

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
| `nova-proprietary` | 私有 (闭源) | `main` | license 模块 |

## 项目路径（两台机器统一）

```
D:\nova-media-manager\      ← GitHub 公库
├── src/                    # React 前端
├── src-tauri/src/          # Rust 后端
│   ├── license/            # → 软链接到 D:\nova-proprietary\license\
│   └── theme/              # .nvtp 主题包系统
├── public/themes/          # 主题资源（CDN，不在 Git 中）
├── server/                 # ECS 服务端（不在 Git 中）
├── scripts/
└── index.html

D:\nova-proprietary\        ← GitHub 私有仓库
└── license/mod.rs          # 许可证验证模块
```

## ECS 服务器

| 项目 | 值 |
|---|---|
| 域名 | scm-think.cn |
| SSH | `ssh -i ~/.ssh/ecs_nova root@39.104.55.38` |
| 服务 | systemd `nova-server`，端口 3000 |
| 代码 | `/var/www/server/` |
| 数据库 | `/var/www/server/data/server.db` |
| CDN | `/var/www/themes/` → https://scm-think.cn/themes/ |

### API
| 端点 | 功能 |
|---|---|
| `GET  /api/health` | 健康检查 |
| `POST /api/activate` | 激活许可证 |
| `POST /api/check-license` | 验证许可证 |
| `POST /api/afdian-webhook` | 爱发电 Webhook |
| `POST /api/events` | 接收遥测数据 |
| `GET  /api/update/:platform/:arch/:version` | Tauri updater |
| `GET  /api/themes/list` | 主题包列表 |
| `GET  /api/themes/:id` | 下载 .nvtp |
| `POST /api/admin/themes/pack` | 构建 .nvtp |
| `POST /api/admin/licenses` | 手动生成激活码 |
| `POST /api/admin/licenses/:id/revoke` | 吊销许可证 |

管理 API 需 Header: `X-Admin-Key`

### 服务管理
```bash
systemctl status nova-server
systemctl restart nova-server
journalctl -u nova-server -f
```

## 定价

| | 标准版 Pro | 旗舰版 Ultra |
|---|---|---|
| 月付 | ¥22/月 | ¥39/月 |
| 年付 | ¥168/年 (¥14/月) | ¥328/年 (¥27/月) |
| 永久 | ¥899 | ¥1599 |

爱发电：https://ifdian.net/a/cyber2079

## 日常开发

### 启动
```powershell
cd D:\nova-media-manager
npm install
npm run tauri:dev
```

### 拉取代码（公库+私库一次完成）
```powershell
npm run pull
```

### 推送代码（add + commit + push 一次完成）
```powershell
npm run push "描述改动"
```

### 构建安装包
```powershell
npm run tauri:build
# 安装包在 src-tauri/target/release/bundle/msi/
# 上传到 ECS: scp -i ~/.ssh/ecs_nova *.msi root@39.104.55.38:/var/www/releases/
```

### 部署服务端
```powershell
scp -i ~/.ssh/ecs_nova -r server/src/* root@39.104.55.38:/var/www/server/src/
ssh -i ~/.ssh/ecs_nova root@39.104.55.38 "systemctl restart nova-server"
```

## CI/CD

GitHub Actions `.github/workflows/release.yml`：推送 `v*` tag 自动构建 Windows 安装包并部署到 ECS。

## 主题包 (.nvtp)

- 加密：XOR + SHA256 完整性校验
- 打包：ZIP + 加密 → `.nvtp` 单文件
- 密钥派生：`SHA256(编译种子 + theme_id)`
- Rust 模块：`src-tauri/src/theme/`

构建主题包：
```
POST /api/admin/themes/pack  { themeId, sourceDir, manifest }
```

## 许可证系统

- license 模块编译在 Rust 二进制中（闭源）
- 激活流程：爱发电付款 → Webhook → 服务端生成激活码 → 用户填入 App → 绑定设备 → JWT Token
- 每 7 天联网校验，离线 30 天宽限期
- 手动生成激活码：POST /api/admin/licenses

## 主题资源同步

- 本地开发需 `public/themes/` 目录（约 1.5G），从另一台机器或 ECS 复制
- 后续 App 启动时从 CDN 自动缓存
- 更新 landing page：修改 server/static/index.html 后 scp 到 ECS

## Landing Page

`server/static/index.html` — 4 套配色 + 中英文切换，部署到 `scm-think.cn`
