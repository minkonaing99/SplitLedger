# SplitLedger v4.1 EC2 Deployment Guide

This guide deploys SplitLedger v4.1 on an Amazon EC2 Ubuntu server with:

- Next.js production server on `127.0.0.1:3001`
- MongoDB in Docker Compose, bound to `127.0.0.1:27017`
- Nginx reverse proxy on ports `80` and `443`
- HTTPS with Certbot
- systemd service for automatic app restart
- MongoDB backup and restore commands

Replace these placeholders before running commands:

```text
YOUR_DOMAIN              your real domain, for example ledger.example.com
YOUR_EMAIL               email for Let's Encrypt notices
YOUR_GITHUB_REPO         ssh://git@github.com/minkonaing99/SplitLedger.git
STRONG_ROOT_DB_PASSWORD  strong Mongo root password
STRONG_APP_DB_PASSWORD   strong Mongo app password
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
- Do not open `27017`

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

## 5. Install Docker And Compose

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Log out and SSH back in so the `docker` group is active:

```bash
exit
ssh -i /path/to/key.pem ubuntu@EC2_PUBLIC_IP
```

Verify Docker:

```bash
docker --version
docker compose version
docker ps
```

## 6. Clone The v4.1 Branch

```bash
sudo mkdir -p /var/www
sudo chown ubuntu:ubuntu /var/www
cd /var/www
git clone -b v4.1 YOUR_GITHUB_REPO splitledger
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
MONGODB_DB=splitledger
MONGO_ROOT_USERNAME=root
MONGO_ROOT_PASSWORD=STRONG_ROOT_DB_PASSWORD
MONGO_APP_USERNAME=splitledger_app
MONGO_APP_PASSWORD=STRONG_APP_DB_PASSWORD
MONGO_PORT_BIND=127.0.0.1:27017
MONGODB_URI=mongodb://splitledger_app:STRONG_APP_DB_PASSWORD@localhost:27017/splitledger?authSource=splitledger
SPLITLEDGER_SEED_USERS=[{"id":"t_khant_naing","name":"T Khant Naing","email":"tkhantnaing@gmail.com","password":"STRONG_USER_PASSWORD_1"},{"id":"htet_myat_naing","name":"Htet Myat Naing","email":"htetmyatnaing@gmail.com","password":"STRONG_USER_PASSWORD_2"},{"id":"mg_mg","name":"Maung Maung","email":"maungmaung@gmail.com","password":"STRONG_USER_PASSWORD_3"}]
```

Lock down the file:

```bash
sudo chmod 600 /etc/splitledger/splitledger.env
```

Create local symlinks for Docker Compose and Next.js:

```bash
ln -sf /etc/splitledger/splitledger.env /var/www/splitledger/.env
ln -sf /etc/splitledger/splitledger.env /var/www/splitledger/.env.local
```

Important:

- `.env` is used by Docker Compose interpolation.
- `.env.local` is loaded by Next.js.
- These files are ignored by git.

## 8. Start MongoDB

From the project directory:

```bash
cd /var/www/splitledger
docker compose --env-file /etc/splitledger/splitledger.env up -d mongo
docker compose --env-file /etc/splitledger/splitledger.env ps
```

Check Mongo logs:

```bash
docker compose --env-file /etc/splitledger/splitledger.env logs mongo --tail=100
```

MongoDB must stay bound to localhost only:

```bash
ss -lntp | grep 27017
```

Expected:

```text
127.0.0.1:27017
```

## 9. Seed The First Users

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

After seeding, remove `SPLITLEDGER_SEED_USERS` from the runtime env file:

```bash
sudo nano /etc/splitledger/splitledger.env
```

Delete the `SPLITLEDGER_SEED_USERS=...` line, then save. This prevents production runtime from keeping login passwords in environment variables.

## 10. Build The App

```bash
cd /var/www/splitledger
npm run typecheck
npm test
npm run build
```

All three commands must pass before continuing.

## 11. Create systemd Service

Create a service file:

```bash
sudo nano /etc/systemd/system/splitledger.service
```

Paste:

```ini
[Unit]
Description=SplitLedger Next.js App
After=network.target docker.service
Requires=docker.service

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

## 12. Configure Nginx

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

## 13. Enable HTTPS

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

## 14. Final Production Verification

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

## 15. PWA Install Check

In Chrome or Edge:

1. Open `https://YOUR_DOMAIN`
2. Sign in
3. Open browser menu
4. Choose install app

Service worker registration only runs in production builds.

## 16. Backup MongoDB

Create backup directory:

```bash
sudo mkdir -p /var/backups/splitledger
sudo chown ubuntu:ubuntu /var/backups/splitledger
chmod 700 /var/backups/splitledger
```

Run backup:

```bash
cd /var/www/splitledger
source /etc/splitledger/splitledger.env
docker compose --env-file /etc/splitledger/splitledger.env exec mongo \
  mongodump \
  --archive=/tmp/splitledger.archive \
  --gzip \
  --db "$MONGODB_DB" \
  --username "$MONGO_ROOT_USERNAME" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin

docker compose --env-file /etc/splitledger/splitledger.env cp \
  mongo:/tmp/splitledger.archive \
  /var/backups/splitledger/splitledger-$(date +%Y%m%d-%H%M%S).archive
```

Copy backups off the EC2 instance regularly and encrypt them before long-term storage.

## 17. Restore MongoDB

Upload the backup archive to EC2, then:

```bash
cd /var/www/splitledger
source /etc/splitledger/splitledger.env
docker compose --env-file /etc/splitledger/splitledger.env cp \
  /var/backups/splitledger/splitledger.archive \
  mongo:/tmp/splitledger.archive

docker compose --env-file /etc/splitledger/splitledger.env exec mongo \
  mongorestore \
  --archive=/tmp/splitledger.archive \
  --gzip \
  --drop \
  --username "$MONGO_ROOT_USERNAME" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin
```

Restart the app after restore:

```bash
sudo systemctl restart splitledger
```

## 18. Upgrade From v3.0 To v4.1 Without Deleting MongoDB

Use this path when an EC2 server already has a v3.0 deployment and real data in the Docker MongoDB volume.

Important rules:

- Do not run `docker compose down -v`.
- Do not delete the `splitledger_mongo_data` Docker volume.
- Do not run `mongorestore --drop` unless you intentionally want to replace the database from a backup.
- Running `docker compose up -d mongo` is safe; it preserves the existing volume.

Create a backup before changing code:

```bash
cd /var/www/splitledger
sudo mkdir -p /var/backups/splitledger
sudo chown ubuntu:ubuntu /var/backups/splitledger
chmod 700 /var/backups/splitledger
source /etc/splitledger/splitledger.env
docker compose --env-file /etc/splitledger/splitledger.env exec mongo \
  mongodump \
  --archive=/tmp/splitledger-pre-v4.archive \
  --gzip \
  --db "$MONGODB_DB" \
  --username "$MONGO_ROOT_USERNAME" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin

docker compose --env-file /etc/splitledger/splitledger.env cp \
  mongo:/tmp/splitledger-pre-v4.archive \
  /var/backups/splitledger/splitledger-pre-v4-$(date +%Y%m%d-%H%M%S).archive
```

Stop only the app while upgrading. Keep MongoDB running:

```bash
cd /var/www/splitledger
sudo systemctl stop splitledger
git fetch origin
git switch v4.1
git pull --ff-only origin v4.1
npm install
npm run typecheck
npm test
npm run build
docker compose --env-file /etc/splitledger/splitledger.env up -d mongo
```

Run the ledger data migration. This preserves existing records, updates the MongoDB validator for transfers, creates monthly-close indexes, and fills missing `paymentMethod` on existing business expenses with `cash`:

```bash
npm run db:migrate-ledger-features
```

Start the app again:

```bash
sudo systemctl restart splitledger
sudo systemctl status splitledger
curl http://127.0.0.1:3001/api/health/db
```

After signing in, confirm older business entries still appear and Cash/KPay balances look correct.

## 19. Update To A Later Release

For a later release branch, follow the same backup-first pattern:

```bash
cd /var/www/splitledger
sudo systemctl stop splitledger
git fetch origin
git switch RELEASE_BRANCH
git pull --ff-only origin RELEASE_BRANCH
npm install
npm run typecheck
npm test
npm run build
docker compose --env-file /etc/splitledger/splitledger.env up -d mongo
sudo systemctl restart splitledger
sudo systemctl status splitledger
```

If the later release includes a migration or backfill script, run it after `npm run build` and before restarting the app.

## 20. Useful Commands

App logs:

```bash
journalctl -u splitledger -f
```

Mongo logs:

```bash
cd /var/www/splitledger
docker compose --env-file /etc/splitledger/splitledger.env logs -f mongo
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
- `127.0.0.1:27017`

## 21. Production Rules

- Never commit `.env`, `.env.local`, or real passwords.
- Never expose MongoDB port `27017` publicly.
- Keep `APP_ORIGIN` exactly equal to the public HTTPS origin.
- Run backups on a schedule.
- Test restores before relying on backups.
- Keep EC2 security group restricted.
- Keep the server updated with `sudo apt update && sudo apt upgrade`.
