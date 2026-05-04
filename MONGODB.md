# SplitLedger MongoDB Setup

## Environment

Create `.env.local` from `.env.example` and replace every `replace-with-*` value before starting MongoDB.

Important values:

```bash
APP_ORIGIN=http://localhost:3000
MONGODB_DB=splitledger
MONGODB_URI=mongodb://splitledger_app:replace-with-strong-app-db-password@localhost:27017/splitledger?authSource=splitledger
MONGO_ROOT_USERNAME=root
MONGO_ROOT_PASSWORD=replace-with-strong-root-db-password
MONGO_APP_USERNAME=splitledger_app
MONGO_APP_PASSWORD=replace-with-strong-app-db-password
MONGO_PORT_BIND=127.0.0.1:27017
SPLITLEDGER_SEED_USERS=[{"id":"t_khant_naing","name":"T Khant Naing","email":"tkhantnaing@example.com","password":"replace-with-strong-user-password-1"}]
```

`MONGO_PORT_BIND=127.0.0.1:27017` keeps MongoDB reachable from the local machine only. Do not expose MongoDB publicly.

## Start MongoDB

```bash
npm run db:up
```

The Mongo init script creates the app database, optional app database user, and indexes for `expenses`, `expenseAudits`, `users`, `sessions`, and `loginAttempts`.

## Verify Connection

With the Next.js dev server running:

```bash
curl http://localhost:3000/api/health/db
```

Expected response:

```json
{"ok":true,"database":"splitledger"}
```

The write/read/delete smoke endpoint is dev-only:

```bash
curl -X POST http://localhost:3000/api/health/db
```

## Seed Users

User passwords are not stored in source code. The dev seed route reads users from `SPLITLEDGER_SEED_USERS` and hashes passwords with `scrypt`.

```bash
curl -X POST http://localhost:3000/api/dev/seed
```

The seed route is disabled when `NODE_ENV=production`.

## Backup

Run a backup from the host:

```bash
docker compose exec mongo mongodump --archive=/tmp/splitledger.archive --gzip --db splitledger --username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin
docker compose cp mongo:/tmp/splitledger.archive ./backups/splitledger-$(date +%Y%m%d-%H%M%S).archive
```

Keep backups encrypted and off the application server.

## Restore

Restore into a stopped or maintenance-mode application:

```bash
docker compose cp ./backups/splitledger.archive mongo:/tmp/splitledger.archive
docker compose exec mongo mongorestore --archive=/tmp/splitledger.archive --gzip --drop --username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin
```

## Stop MongoDB

```bash
npm run db:down
```
