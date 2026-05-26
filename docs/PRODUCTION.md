# SplitLedger Production Checklist

## Required Environment

Set these values in the deployment environment:

```bash
APP_ORIGIN=https://your-domain.example
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=splitledger_app
MYSQL_PASSWORD=<strong-password>
MYSQL_DB=splitledger
```

Do not use placeholder passwords in production.

## Authentication

- Passwords are hashed with Node.js `scrypt`.
- Sessions use opaque random tokens.
- Only the SHA-256 session token hash is stored in MySQL.
- Cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production.
- Login attempts are rate-limited per IP. Old attempts are pruned automatically on each check.
- Seed users outside production, then remove `SPLITLEDGER_SEED_USERS` from the runtime environment.

## Request Protection

- State-changing API routes reject untrusted `Origin` or `Referer` headers.
- `APP_ORIGIN` must match the public deployment origin exactly.
- Security headers are set in `middleware.ts`, including CSP, frame blocking, `nosniff`, referrer policy, and permissions policy.

## MySQL

- Keep MySQL bound to `127.0.0.1` — do not expose port `3306` publicly.
- Use a least-privilege app user scoped to the `splitledger` database.
- Keep root credentials only for maintenance and backups.
- Enable provider-level disk encryption when available.
- Schema tables are created automatically on first server start (`CREATE TABLE IF NOT EXISTS`).

## Backups

```bash
mysqldump -u root -p splitledger > /var/backups/splitledger/splitledger-$(date +%Y%m%d-%H%M%S).sql
```

- Run on a schedule (cron or systemd timer).
- Store backups off-server.
- Encrypt backups before long-term storage.
- Test restore before relying on the backup plan.

## Audit

Expense create and delete actions write to `expense_audits` with:

- action (`create` / `delete`)
- actor user id
- expense id
- full expense snapshot (JSON)
- timestamp

## Pre-Deploy Commands

```bash
npm run typecheck
npm test
npm run build
```

## Remaining Policy Decisions

- Password reset flow.
- Account disable flow.
- Audit log viewer.
- Backup retention period.
