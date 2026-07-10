# 部署指南

## 一、ECS 服务器初始化

### 1. 环境要求
- 阿里云 ECS（CentOS 7+ 或 Ubuntu 20.04+）
- Node.js 22+
- Nginx
- Docker & Docker Compose（推荐）

### 2. 部署步骤

```bash
# 在 ECS 上

# 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 Nginx
sudo apt-get install -y nginx

# 安装 Docker
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER

# 克隆私有仓库（server/ 目录）
mkdir -p /var/www
cd /var/www
git clone <你的私有仓库> .

# 配置环境变量
cd server
cp .env.example .env
nano .env  # 填入真实的 JWT_SECRET、ADMIN_KEY、AFDIAN_TOKEN

# 启动服务
docker compose up -d
```

### 3. Nginx + SSL 配置

```bash
# 复制 nginx 配置
sudo cp server/nginx.conf /etc/nginx/sites-available/media-manager
sudo ln -s /etc/nginx/sites-available/media-manager /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# 安装 SSL 证书（阿里云免费 SSL 或 Let's Encrypt）
# 阿里云：在控制台下载证书，上传到 /etc/nginx/ssl/
# Let's Encrypt：
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d scm-think.cn

# 重启 Nginx
sudo nginx -t && sudo systemctl restart nginx
```

### 4. 域名 DNS 配置

在阿里云 DNS 控制台添加 A 记录：
- 主机记录：`@` → ECS 公网 IP
- 主机记录：`www` → ECS 公网 IP

---

## 二、首次发布

### 1. 生成更新签名密钥

```bash
node scripts/generate-updater-key.mjs
```

输出：
- **私钥**：保存到安全位置（不要提交到 Git），设为 GitHub Secret `TAURI_SIGNING_PRIVATE_KEY`
- **公钥**：粘贴到 `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`

### 2. 配置 GitHub Secrets

在 GitHub 仓库 Settings → Secrets 中添加：

| Secret | 说明 |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | 上一步生成的 Ed25519 私钥 |
| `ECS_HOST` | ECS 公网 IP 或域名 |
| `ECS_USER` | SSH 用户名（如 root） |
| `ECS_SSH_KEY` | SSH 私钥内容 |
| `ADMIN_KEY` | 与服务端 .env 中 ADMIN_KEY 一致 |
| `GITHUB_TOKEN` | 自动生成 Release（GitHub 自动提供） |

### 3. 发布新版本

```bash
# 本地
npm version patch    # 或 minor / major
git push --tags      # 触发 GitHub Actions 自动构建部署
```

---

## 三、更新服务器地址

发布前，将以下文件中的 `scm-think.cn` 替换为你的真实域名：

- `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`
- `src-tauri/tauri.conf.json` → `security.csp`
- `src-tauri/src/license/mod.rs` → `SERVER_URL`
- `src/lib/analytics.ts` → `ANALYTICS_ENDPOINT`
- `server/nginx.conf` → `server_name`
- `.github/workflows/release.yml` → ECS deploy config

---

## 四、爱发电配置

1. 在 [afdian.net](https://afdian.net) 注册创作者账号
2. 创建赞助档位：
   - Pro 年费（plan_id: `pro_yearly`）→ ¥68/年
   - Pro 永久（plan_id: `pro_permanent`）→ ¥198
   - Ultra 年费（plan_id: `ultra_yearly`）→ ¥128/年
   - Ultra 永久（plan_id: `ultra_permanent`）→ ¥398
3. 在爱发电设置中配置 Webhook URL：
   ```
   https://scm-think.cn/api/afdian-webhook
   ```
4. 将爱发电 Webhook token 填入服务器 `.env` 的 `AFDIAN_TOKEN`
