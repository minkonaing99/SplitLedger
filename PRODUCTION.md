# SplitLedger Production Checklist

## Required Environment

Set these values in the deployment environment:

```bash
APP_ORIGIN=https://your-domain.example
MONGODB_DB=splitledger
MONGODB_URI=mongodb://splitledger_app:<strong-password>@<private-mongo-host>:27017/splitledger?authSource=splitledger
```

Do not use `.env.example` placeholder passwords in production.

## Authentication

- Passwords are hashed with Node.js `scrypt`.
- Sessions use opaque random tokens.
- Only the SHA-256 session token hash is stored in MongoDB.
- Cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production.
- Login attempts are rate-limited and expire through a MongoDB TTL index.
- Seed users outside production, then remove `SPLITLEDGER_SEED_USERS` from the runtime environment.

## Request Protection

- State-changing API routes reject untrusted `Origin` or `Referer` headers.
- `APP_ORIGIN` must match the public deployment origin exactly.
- Security headers are set in `middleware.ts`, including CSP, frame blocking, `nosniff`, referrer policy, and permissions policy.

## MongoDB

- Keep MongoDB on a private network.
- Do not publish port `27017` to the public internet.
- Use a least-privilege app database user for `MONGODB_URI`.
- Keep root credentials only for maintenance and backups.
- Enable provider-level disk encryption when available.

## Backups

- Run `mongodump` on a schedule.
- Store backups off-server.
- Encrypt backups before long-term storage.
- Test `mongorestore` before trusting the backup plan.

## Audit

Expense create and delete actions write to `expenseAudits` with:

- action
- actor user id
- expense id
- full expense snapshot
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
- Deployment provider and private MongoDB networking model.
