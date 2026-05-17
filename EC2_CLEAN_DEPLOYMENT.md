# SplitLedger v4.1 Clean EC2 Deployment

Use this guide when deploying SplitLedger to a new EC2 server with an empty MongoDB volume. If the server already has production data, use `EC2_DEPLOYMENT.md` and its backup-first upgrade path instead.

This clean install runs:

- Next.js on `127.0.0.1:3001`
- MongoDB in Docker Compose on `127.0.0.1:27017`
- Nginx on public ports `80` and `443`
- systemd for app restart
- v4.1 ledger features: Cash/KPay transfers and monthly closes

Replace these placeholders:

```text
YOUR_DOMAIN
YOUR_EMAIL
YOUR_GITHUB_REPO
STRONG_ROOT_DB_PASSWORD
STRONG_APP_DB_PASSWORD
STRONG_USER_PASSWORD_*
```

## 1. Create EC2

Use Ubuntu Server 24.04 LTS or 22.04 LTS.

Security group inbound rules:

- SSH `22` from your IP only
- HTTP `80` from anywhere
- HTTPS `443` from anywhere
- Do not open `3001`
- Do not open `27017`

Point DNS to the EC2 public IPv4 address.

## 2. Install Dependencies

```bash
ssh -i /path/to/key.pem ubuntu@EC2_PUBLIC_IP
sudo apt update
sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Yangon
sudo apt install -y ca-certificates curl gnupg git nginx ufw
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw --force enable
```

Install Node.js 22:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

Install Docker:

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

Log out and back in.

## 3. Clone v4.1

```bash
sudo mkdir -p /var/www
sudo chown ubuntu:ubuntu /var/www
cd /var/www
git clone -b v4.1 YOUR_GITHUB_REPO splitledger
cd /var/www/splitledger
npm install
```

## 4. Configure Environment

```bash
sudo mkdir -p /etc/splitledger
sudo chown root:root /etc/splitledger
sudo chmod 700 /etc/splitledger
sudo nano /etc/splitledger/splitledger.env
```

Paste and replace values:

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

```bash
sudo chmod 600 /etc/splitledger/splitledger.env
ln -sf /etc/splitledger/splitledger.env /var/www/splitledger/.env
ln -sf /etc/splitledger/splitledger.env /var/www/splitledger/.env.local
```

## 5. Start MongoDB

```bash
cd /var/www/splitledger
docker compose --env-file /etc/splitledger/splitledger.env up -d mongo
docker compose --env-file /etc/splitledger/splitledger.env ps
docker compose --env-file /etc/splitledger/splitledger.env logs mongo --tail=100
ss -lntp | grep 27017
```

Expected listener:

```text
127.0.0.1:27017
```

## 6. Seed Users

Temporarily run the dev server on port `3001`:

```bash
cd /var/www/splitledger
npm run dev -- --hostname 127.0.0.1 --port 3001
```

In a second SSH session:

```bash
curl -X POST http://127.0.0.1:3001/api/dev/seed \
  -H "Origin: http://127.0.0.1:3001"
```

Stop the dev server with `Ctrl+C`.

Remove `SPLITLEDGER_SEED_USERS` after seeding:

```bash
sudo nano /etc/splitledger/splitledger.env
```

Delete the `SPLITLEDGER_SEED_USERS=...` line and save.

## 7. Build

```bash
cd /var/www/splitledger
npm run typecheck
npm test
npm run build
```

## 8. Create systemd Service

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

Start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable splitledger
sudo systemctl start splitledger
sudo systemctl status splitledger
curl -I http://127.0.0.1:3001
curl http://127.0.0.1:3001/api/health/db
```

## 9. Configure Nginx

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

Enable:

```bash
sudo ln -sf /etc/nginx/sites-available/splitledger /etc/nginx/sites-enabled/splitledger
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
curl -I http://YOUR_DOMAIN
```

## 10. Enable HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN --email YOUR_EMAIL --agree-tos --redirect
sudo certbot renew --dry-run
curl -I https://YOUR_DOMAIN
```

## 11. Verify Production

```bash
curl -I https://YOUR_DOMAIN
curl https://YOUR_DOMAIN/api/health/db
curl https://YOUR_DOMAIN/manifest.webmanifest
curl -I https://YOUR_DOMAIN/sw.js
```

Confirm:

- Login works.
- Business income/expense entries work.
- Cash/KPay transfer entries work.
- Reports can close a month and show a saved monthly close.
- `/api/health/db` returns `{"ok":true,"database":"splitledger"}`.

## 12. Backups

```bash
sudo mkdir -p /var/backups/splitledger
sudo chown ubuntu:ubuntu /var/backups/splitledger
chmod 700 /var/backups/splitledger
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

Copy backups off the EC2 instance and test restores regularly.

## 13. Useful Commands

```bash
journalctl -u splitledger -f
sudo systemctl restart splitledger
sudo nginx -t
sudo systemctl reload nginx
cd /var/www/splitledger
docker compose --env-file /etc/splitledger/splitledger.env logs -f mongo
ss -lntp
```

Expected public listeners:

- `0.0.0.0:80`
- `0.0.0.0:443`

Expected private listeners:

- `127.0.0.1:3001`
- `127.0.0.1:27017`

## Clean Deployment Rules

- Use this guide only when starting with an empty MongoDB volume.
- Never expose MongoDB publicly.
- Never commit `.env`, `.env.local`, or real credentials.
- Remove `SPLITLEDGER_SEED_USERS` after seeding.
- Keep `APP_ORIGIN` exactly equal to `https://YOUR_DOMAIN`.
- Use `EC2_DEPLOYMENT.md` instead when preserving an existing database.
