# MySQL Migration Plan

Migrated SplitLedger from MongoDB to MySQL (`mysql2`).

## Connection Details (local)

- Host: `127.0.0.1`, Port: `3306`
- Database: `splitledger` (pre-created)
- User / Password: set in `.env.local` via `MYSQL_USER` / `MYSQL_PASSWORD`

## Why MySQL

- Local MySQL replaces the Docker Compose MongoDB container — no container management needed
- `mysql2/promise` is a pure-JS async driver with no native binary compilation
- Native `ENUM` columns replace Mongo `$jsonSchema` validators
- SQL transactions replace Mongo's two-step find-then-delete pattern (fixing a race window)
- `ON DUPLICATE KEY UPDATE` replaces Mongo `updateOne(..., { upsert: true })`
- FK cascade (`sessions` → `users`) replaces manual session cleanup on user delete

## Schema

Tables created automatically on first server start via `runMigrations()` in `lib/server/mysql.ts`.

| Table | Replaces collection |
|---|---|
| `users` | `users` |
| `sessions` | `sessions` |
| `login_attempts` | `loginAttempts` |
| `expenses` | `expenses` |
| `expense_audits` | `expenseAudits` |
| `monthly_closes` | `monthlyCloses` |

Key schema decisions:
- `id CHAR(36)` — keeps application-level UUIDs as PRIMARY KEY (no Mongo `_id`)
- `expense_audits.expense_json TEXT` — Mongo nested document becomes a JSON snapshot
- `UNIQUE(workspace_id, month_key)` on `monthly_closes` — replaces Mongo unique index
- `login_attempts.attempt_key` — renamed from `key` to avoid MySQL reserved word
- All enum columns use MySQL `ENUM(...)` type — runtime CHECK enforcement

## Architectural Changes

### `lib/server/mysql.ts` (replaces `lib/server/mongodb.ts`)

- `getMysqlPool()` — returns the connection pool, runs migrations once on first call
- Pool config: `connectionLimit: 10`, `timezone: "+00:00"` (UTC), `waitForConnections: true`

### `lib/server/expense-access.ts`

- `buildVisibleExpenseWhere(userId)` replaces `buildVisibleExpenseFilter(userId)` — returns `{ clause: string, params: string[] }` SQL fragment instead of Mongo `$or` object
- `buildAccessibleExpenseWhere(expenseId, userId)` replaces `buildAccessibleExpenseFilter`
- `canAccessExpense` unchanged (pure predicate, no DB dependency)

### Repositories

All repository internals rewritten to use `pool.execute()` / `connection.execute()`.
Public function signatures are **unchanged** — route handlers need no modifications.

Notable improvements over Mongo implementation:
- `deleteExpense` — SELECT + DELETE + audit INSERT now atomic (single SQL transaction)
- `insertExpense` — INSERT + audit INSERT now atomic (single SQL transaction)
- `upsertMonthlyClose` — INSERT + SELECT now in a transaction for consistent return value
- `removeLegacyUsers` — cascade FK deletes sessions automatically

### Rate Limiting

Mongo's TTL index on `loginAttempts` is replaced by `pruneOldLoginAttempts(since)`, called on every `checkLoginRateLimit` invocation. Prunes records older than the 15-minute window to keep the table bounded.

## Environment Variables

Removed:
- `MONGODB_URI`
- `MONGODB_DB`
- `MONGO_ROOT_USERNAME`
- `MONGO_ROOT_PASSWORD`
- `MONGO_APP_USERNAME`
- `MONGO_APP_PASSWORD`
- `MONGO_PORT_BIND`

Added:
- `MYSQL_HOST` (default: `127.0.0.1`)
- `MYSQL_PORT` (default: `3306`)
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DB`

## Files Changed

**Created:**
- `lib/server/mysql.ts` — pool singleton + migration runner
- `lib/server/db/migrations.ts` — `CREATE TABLE IF NOT EXISTS` DDL array

**Rewritten:**
- `lib/server/expense-access.ts`
- `lib/server/auth-repository.ts`
- `lib/server/expense-repository.ts`
- `lib/server/monthly-close-repository.ts`
- `lib/server/login-rate-limit.ts`
- `app/api/health/db/route.ts`
- `app/api/dev/seed/route.ts`
- `tests/expense-access.test.ts`

**Updated:**
- `package.json` — removed `mongodb`, added `mysql2`; removed `db:up/down/logs/backfill/migrate` scripts
- `.env.example` — swapped Mongo vars for MySQL vars
- `CLAUDE.md` — updated stack description

**Deleted:**
- `lib/server/mongodb.ts`
- `docker-compose.yml`
- `docker/mongo/Dockerfile`
- `docker/mongo/init/01-init.js`
- `MONGODB.md`
- `scripts/migrate-ledger-features.ts`
- `scripts/backfill-payment-method.ts`

## Local Setup (after migration)

```bash
# MySQL must already be running locally
# Create the database once:
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS splitledger;"

# Install dependencies
npm install

# Start dev server (migrations run automatically on first request)
npm run dev

# Seed data
curl -X POST http://localhost:3000/api/dev/seed
```

## Backup

```bash
mysqldump -u root -p splitledger > backups/splitledger_$(date +%Y%m%d).sql
```
