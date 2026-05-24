# SplitLedger

SplitLedger is a private finance web app for shared business records and private personal records. Business transactions are visible to all users. Personal transactions are scoped to the signed-in user.

## Features

- Next.js 15 app router with Tailwind CSS.
- MySQL-backed users, sessions, login attempts, expenses, and audit logs.
- Server-side authentication with opaque `httpOnly` session cookies.
- Shared business ledger plus private personal ledgers.
- Income and expense tracking with monthly filters, daily grouping, subtotals, reports, and CSV export.
- English and Burmese language toggle with saved language preference.
- Myanmar currency display using `Ks`.
- PWA manifest and production service worker.

## Requirements

- Node.js 22 or newer.
- npm.
- MySQL 8 or newer running locally or on a private server.

## Local Setup

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your MySQL credentials and seed users.

Install dependencies:

```bash
npm install
```

Start the web app:

```bash
npm run dev
```

Database tables are created automatically on the first request.

Open:

```text
http://localhost:3000
```

## Seed Users

Login credentials are not stored in source code. Seed users are configured in `SPLITLEDGER_SEED_USERS` inside `.env`.

With the dev server running:

```bash
curl -X POST http://localhost:3000/api/dev/seed
```

The seed route is disabled in production.

## Scripts

```bash
npm run dev
npm run typecheck
npm test
npm run build
npm start
```

## Production Checks

Before deploying:

```bash
npm run typecheck
npm test
npm run build
```

Production environment must set:

```bash
APP_ORIGIN=https://your-domain.example
MYSQL_HOST=<private-mysql-host>
MYSQL_PORT=3306
MYSQL_USER=<app-user>
MYSQL_PASSWORD=<strong-password>
MYSQL_DB=splitledger
```

Use a least-privilege MySQL user scoped to the `splitledger` database. Do not expose MySQL publicly.

## Security Notes

- Passwords are hashed with Node.js `scrypt`.
- Session tokens are random opaque values. Only SHA-256 token hashes are stored.
- Session cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production.
- State-changing routes validate request origin.
- Security headers are applied through `middleware.ts`.
- Expense create and delete actions write to `expense_audits`.
- Business records are shared by design. Personal records are owner-scoped.

## PWA

The app exposes `/manifest.webmanifest` and `/sw.js`.

Service worker registration runs only in production builds to avoid stale development caches:

```bash
npm run build
npm start
```

Then open `http://localhost:3000` and use the browser install option.

## Backup

```bash
mysqldump -u root -p splitledger > backups/splitledger_$(date +%Y%m%d).sql
```

See `PRODUCTION.md` for the production deployment checklist.
