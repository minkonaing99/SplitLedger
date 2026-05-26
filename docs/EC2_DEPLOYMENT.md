# SplitLedger v5.1 EC2 Deployment Guide

This guide deploys SplitLedger v5.1 on an Amazon EC2 Ubuntu server with:

- Next.js production server on `127.0.0.1:3001`
- MySQL bound to `127.0.0.1:3306`
- Nginx reverse proxy on ports `80` and `443`
- HTTPS with Certbot
- systemd service for automatic app restart
- MySQL backup and restore commands

Replace these placeholders before running commands:

```text
YOUR_DOMAIN              your real domain, for example ledger.example.com
YOUR_EMAIL               email for Let's Encrypt notices
YOUR_GITHUB_REPO         ssh://git@github.com/minkonaing99/SplitLedger.git
STRONG_DB_PASSWORD       strong MySQL app user password
STRONG_USER_PASSWORD_*   strong login passwords
```

## 1. Create The EC2 Instance

Recommended starting point:

- AMI: Ubuntu Server 24.04 LTS or Ubuntu Server 22.04 LTS
- Instance type: `t3.small` or larger
- Storage: 20 GB minimum, 40 GB preferred
- Security group inbound rules:
  - SSH `22` from your own IP only
  - HTTP `80` from `0.0.0.0/0`
  - HTTPS `443` from `0.0.0.0/0`
- Do not open `3001`
- Do not open `3306`

Point your DNS record to the EC2 public IPv4 address:

```text
YOUR_DOMAIN -> EC2_PUBLIC_IP
```

## 2. SSH Into EC2

From your local machine:

```bash
ssh -i /path/to/key.pem ubuntu@EC2_PUBLIC_IP
```

Update the server:

```bash
sudo apt update
sudo apt upgrade -y
```

Set timezone if useful:

```bash
sudo timedatectl set-timezone Asia/Yangon
```

## 3. Install System Packages

```bash
sudo apt install -y ca-certificates curl gnupg git nginx ufw
```

Enable firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw --force enable
sudo ufw status
```

## 4. Install Node.js

Install Node.js 22 LTS from NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

## 5. Install MySQL

```bash
sudo apt install -y mysql-server
sudo systemctl enable mysql
sudo systemctl start mysql
```

Secure the installation:

```bash
sudo mysql_secure_installation
```

Create the database and app user:

```bash
sudo mysql -u root
```

Inside the MySQL prompt:

```sql
CREATE DATABASE IF NOT EXISTS splitledger CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'splitledger_app'@'localhost' IDENTIFIED BY 'STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON splitledger.* TO 'splitledger_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Verify MySQL is bound to localhost only:

```bash
ss -lntp | grep 3306
```

Expected:

```text
127.0.0.1:3306
```

## 6. Clone The v5.1 Branch

```bash
sudo mkdir -p /var/www
sudo chown ubuntu:ubuntu /var/www
cd /var/www
git clone -b v5.1 YOUR_GITHUB_REPO splitledger
cd /var/www/splitledger
```

Install dependencies:

```bash
npm install
```

## 7. Create Production Environment File

Create a secure env directory:

```bash
sudo mkdir -p /etc/splitledger
sudo chown root:root /etc/splitledger
sudo chmod 700 /etc/splitledger
```

Create the environment file:

```bash
sudo nano /etc/splitledger/splitledger.env
```

Paste this and replace all secrets:

```bash
APP_ORIGIN=https://YOUR_DOMAIN
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=splitledger_app
MYSQL_PASSWORD=STRONG_DB_PASSWORD
MYSQL_DB=splitledger
SPLITLEDGER_SEED_USERS=[{"id":"t_khant_naing","name":"T Khant Naing","email":"tkhantnaing@gmail.com","password":"STRONG_USER_PASSWORD_1"},{"id":"htet_myat_naing","name":"Htet Myat Naing","email":"htetmyatnaing@gmail.com","password":"STRONG_USER_PASSWORD_2"}]
```

Lock down the file:

```bash
sudo chmod 600 /etc/splitledger/splitledger.env
```

Create a symlink for Next.js:

```bash
ln -sf /etc/splitledger/splitledger.env /var/www/splitledger/.env
```

## 8. Seed The First Users

The seed route is disabled in production, so seed once before running `next start` with `NODE_ENV=production`.

Run a temporary dev server bound to localhost on port `3001`:

```bash
cd /var/www/splitledger
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open a second SSH session and run:

```bash
curl -X POST http://127.0.0.1:3001/api/dev/seed \
  -H "Origin: http://127.0.0.1:3001"
```

Expected response:

```json
{"ok":true}
```

Stop the dev server with `Ctrl+C`.

After seeding, remove `SPLITLEDGER_SEED_USERS` from the env file:

```bash
sudo nano /etc/splitledger/splitledger.env
```

Delete the `SPLITLEDGER_SEED_USERS=...` line, then save. This prevents production runtime from keeping login passwords in environment variables.

## 9. Build The App

```bash
cd /var/www/splitledger
npm run typecheck
npm test
npm run build
```

All three commands must pass before continuing.

## 10. Create systemd Service

Create a service file:

```bash
sudo nano /etc/systemd/system/splitledger.service
```

Paste:

```ini
[Unit]
Description=SplitLedger Next.js App
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/splitledger
EnvironmentFile=/etc/splitledger/splitledger.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start -- --hostname 127.0.0.1 --port 3001
Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/var/www/splitledger

[Install]
WantedBy=multi-user.target
```

Start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable splitledger
sudo systemctl start splitledger
sudo systemctl status splitledger
```

Check logs:

```bash
journalctl -u splitledger -f
```

Verify localhost app response:

```bash
curl -I http://127.0.0.1:3001
curl http://127.0.0.1:3001/api/health/db
```

## 11. Configure Nginx

Create Nginx site config:

```bash
sudo nano /etc/nginx/sites-available/splitledger
```

Paste:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;

    client_max_body_size 5m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:

```bash
sudo ln -sf /etc/nginx/sites-available/splitledger /etc/nginx/sites-enabled/splitledger
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Verify:

```bash
curl -I http://YOUR_DOMAIN
```

## 12. Enable HTTPS

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Request a certificate:

```bash
sudo certbot --nginx -d YOUR_DOMAIN --email YOUR_EMAIL --agree-tos --redirect
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

Verify HTTPS:

```bash
curl -I https://YOUR_DOMAIN
```

## 13. Final Production Verification

Run:

```bash
curl -I https://YOUR_DOMAIN
curl https://YOUR_DOMAIN/api/health/db
curl https://YOUR_DOMAIN/manifest.webmanifest
curl -I https://YOUR_DOMAIN/sw.js
```

Check that:

- `/` returns `200`
- `/api/health/db` returns `{"ok":true,"database":"splitledger"}`
- `/manifest.webmanifest` returns JSON
- `/sw.js` returns JavaScript
- Security headers are present:
  - `content-security-policy`
  - `x-frame-options`
  - `x-content-type-options`
  - `referrer-policy`
  - `permissions-policy`

Test login in the browser:

```text
https://YOUR_DOMAIN
```

## 14. PWA Install Check

In Chrome or Edge:

1. Open `https://YOUR_DOMAIN`
2. Sign in
3. Open browser menu
4. Choose install app

Service worker registration only runs in production builds.

## 15. Backup MySQL

Create backup directory:

```bash
sudo mkdir -p /var/backups/splitledger
sudo chown ubuntu:ubuntu /var/backups/splitledger
chmod 700 /var/backups/splitledger
```

Run backup:

```bash
mysqldump -u splitledger_app -p splitledger \
  > /var/backups/splitledger/splitledger-$(date +%Y%m%d-%H%M%S).sql
```

Automate with cron:

```bash
crontab -e
```

Add:

```text
0 2 * * * mysqldump -u splitledger_app -pSTRONG_DB_PASSWORD splitledger > /var/backups/splitledger/splitledger-$(date +\%Y\%m\%d).sql
```

Copy backups off the EC2 instance regularly and encrypt them before long-term storage.

## 16. Restore MySQL

Upload a backup SQL file to EC2, then:

```bash
mysql -u splitledger_app -p splitledger < /var/backups/splitledger/splitledger.sql
```

Restart the app after restore:

```bash
sudo systemctl restart splitledger
```

## 17. Upgrade To A Later Release

```bash
cd /var/www/splitledger
sudo systemctl stop splitledger

# Back up first
mysqldump -u splitledger_app -p splitledger \
  > /var/backups/splitledger/splitledger-pre-upgrade-$(date +%Y%m%d).sql

git fetch origin
git switch RELEASE_BRANCH
git pull --ff-only origin RELEASE_BRANCH
npm install
npm run typecheck
npm test
npm run build

sudo systemctl restart splitledger
sudo systemctl status splitledger
curl http://127.0.0.1:3001/api/health/db
```

Schema changes are applied automatically on startup via `CREATE TABLE IF NOT EXISTS` migrations.

## 18. Useful Commands

App logs:

```bash
journalctl -u splitledger -f
```

MySQL logs:

```bash
sudo journalctl -u mysql -f
```

Restart app:

```bash
sudo systemctl restart splitledger
```

Restart Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Check ports:

```bash
ss -lntp
```

Expected public listeners:

- `0.0.0.0:80`
- `0.0.0.0:443`

Expected private listeners:

- `127.0.0.1:3001`
- `127.0.0.1:3306`

## 19. Production Rules

- Never commit `.env` or real passwords.
- Never expose MySQL port `3306` publicly.
- Keep `APP_ORIGIN` exactly equal to the public HTTPS origin.
- Run backups on a schedule.
- Test restores before relying on backups.
- Keep EC2 security group restricted.
- Keep the server updated with `sudo apt update && sudo apt upgrade`.
