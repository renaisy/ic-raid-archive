# 云服务器 Docker 运维手册

给 **海加尔 · ZOO 团本档案**（`ic-raid-archive`）用。一台小 VPS + Docker Compose 即可。不接 Discord / 战网 / WCL。

仓库：https://github.com/renaisy/ic-raid-archive

## 服务是否完整

前后端是**同一进程**：`server.js` 提供 JSON API，并托管 `public/`（`index.html` + `app.js` + `style.css`）。无 npm 依赖，无独立前端构建。

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 邀请码登录（团长 / 队员） | 可用 | 登录后 Bearer token，会话写在 `data/store.json` |
| 本周意向 / 分配导入 | 可用 | 文本须为 `ICRC1:intent:` / `ICRC1:loot:`；16 栏预设，本周意向最多 2 件 |
| 名册、Boss、备忘、优先、团规、战术备注 | 可用 | 团长接口；战术手册只读自 `raid-journal.json` |
| 周历开团、按场报名 | 可用 | 开团按日期落入「周四～下周三」；报名按场次 ID |
| 记录 / 公平 / 覆盖 | 可用 | 读赛季汇总 |
| 健康检查 | 可用 | `GET /api/health`，不必登录 |
| HTTPS / 账号体系 | 没有 | 上公网必须自己反代；邀请码即权限 |
| 改已有开团 | 后端有 `update` | 页面目前是删了重加 |

默认只绑 `127.0.0.1`。容器和公网必须设 `HOST=0.0.0.0`。`data/store.json` 含会话 token，**不要打进镜像、不要提交 git**。

周编号与插件相同：上海时间**周四 5 点**切周。首页「本周开团」只显示当前 CD 周；周四之前标的下场，看周历。

浏览器会访问 Wowhead / `wow.zamimg.com` 做物品提示，队员电脑要能出网。服务器本身不必访问这些域名。

## 机器要求

- 系统：Ubuntu 22.04 / 24.04（Debian 12 同类即可）
- 配置：1 核 1G 内存够用
- 磁盘：系统盘 + 预留几百 MB 给镜像和数据卷
- 网络：开放 22（SSH）。若前面用 Nginx，再开放 80 / 443；若直接暴露应用，开放 8765
- 域名（建议）：例如 `archive.example.com`，做 HTTPS

## 1. 安装 Docker

以 Ubuntu 为例，用官方源：

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"
```

重新登录后执行 `docker compose version`，能看到版本即可。

## 2. 拉取并启动

```bash
sudo mkdir -p /opt/zoo-archive
sudo chown "$USER:$USER" /opt/zoo-archive
cd /opt/zoo-archive
git clone https://github.com/renaisy/ic-raid-archive.git .
cp .env.example .env
```

编辑 `.env`，**务必改掉默认邀请码**后再启动：

```bash
nano .env
```

```
HOST=0.0.0.0
PORT=8765
LEAD_CODE=换成很长的团长码
RAIDER_CODE=换成很长的队员码
SEASON_START=2026-08-13
```

```bash
docker compose up -d --build
docker compose ps
curl -sS http://127.0.0.1:8765/api/health
```

应返回类似：`{"ok":true,"service":"ic-raid-archive","week":"YYYY-MM-DD"}`。

数据落在 Docker 卷 `archive-data`，挂到容器内 `/app/data`。首次启动会把镜像里的 `raid-loot.json`、`raid-journal.json` 拷进卷；之后导入分配会回写掉落表，**不要删卷**。

本机或内网先访问 `http://服务器IP:8765` 做验收。公网请走下一节反代，不要长期裸奔 8765。

## 3. Nginx 反代 + HTTPS

安装：

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

站点配置 `/etc/nginx/sites-available/zoo-archive`：

```nginx
server {
    listen 80;
    server_name archive.example.com;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:8765;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/zoo-archive /etc/nginx/sites-enabled/zoo-archive
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d archive.example.com
```

云厂商安全组放行 80 / 443。若只用 Nginx 对外，安全组可以关掉 8765。

没有域名时，可先只开 8765 做内网或 IP 访问；有域名后再补证书。

## 4. 日常命令

在 `/opt/zoo-archive` 下：

```bash
docker compose ps
docker compose logs -f --tail=200
docker compose restart
curl -sS http://127.0.0.1:8765/api/health
```

改邀请码：改 `.env` 里的 `LEAD_CODE` / `RAIDER_CODE`，然后 `docker compose up -d`。环境变量优先于 `store.json` 的 `config`。

看数据卷里的文件：

```bash
docker compose exec archive ls -l /app/data
```

## 5. 更新

```bash
cd /opt/zoo-archive
git pull
docker compose up -d --build
```

卷不会随镜像重建而清空。更新后看一眼 `health` 和登录。

回退到某一提交：`git checkout <hash>` 后再 `docker compose up -d --build`。

## 6. 备份与恢复

数据只有 `/app/data`（`store.json`、掉落表、手册）。每天备份一次即可。

导出：

```bash
mkdir -p /opt/zoo-archive/backups
docker run --rm -v zoo-archive_archive-data:/data -v /opt/zoo-archive/backups:/backup alpine \
  tar czf /backup/zoo-data-$(date +%F).tgz -C /data .
```

卷名若不同，先 `docker volume ls | grep archive` 核对。

恢复（先停服务）：

```bash
docker compose stop
docker run --rm -v zoo-archive_archive-data:/data -v /opt/zoo-archive/backups:/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/zoo-data-YYYY-MM-DD.tgz -C /data"
docker compose start
```

可选 crontab（每天 4:30）：

```
30 4 * * * cd /opt/zoo-archive && docker run --rm -v zoo-archive_archive-data:/data -v /opt/zoo-archive/backups:/backup alpine tar czf /backup/zoo-data-$(date +\%F).tgz -C /data .
```

## 7. 防火墙

UFW 示例（有 Nginx 时）：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

不要把 Docker 和邀请码后台暴露到没有 HTTPS 的公网。默认码 `ic-lead` / `ic-raid` 上线前必须换掉。

## 8. 常见问题

**8765 连不上**  
`docker compose ps` 是否 `healthy`；`HOST` 是否为 `0.0.0.0`；安全组是否放行。

**登录提示邀请码不对**  
`.env` 有值时以环境变量为准。改完要 `docker compose up -d`，旧浏览器会话可能仍有效，可清站点本地存储后重登。

**周历有场、首页没有**  
当前 CD 周还没到那场的周四。看周历，或等周四 5 点之后。

**更新后掉落名空了**  
多半误删了数据卷。从备份恢复 `/app/data`。手册和掉落种子只在卷里还没有对应文件时拷一次，不会覆盖已有文件。

**容器起不来**  
`docker compose logs archive`。本仓库无 npm install，构建失败通常是 `git clone` 不完整或磁盘满。

**本机开发**  
不要走 Docker 也可以：`node server.js` → http://127.0.0.1:8765 。局域网再设 `HOST=0.0.0.0`。
