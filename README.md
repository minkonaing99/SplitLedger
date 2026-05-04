# SplitLedger

SplitLedger is a private finance web app for shared business records and private personal records. Business transactions are visible to all users. Personal transactions are scoped to the signed-in user.

## Features

- Next.js 15 app router with Tailwind CSS.
- MongoDB-backed users, sessions, login attempts, expenses, and audit logs.
- Server-side authentication with opaque `httpOnly` session cookies.
- Shared business ledger plus private personal ledgers.
- Income and expense tracking with monthly filters, daily grouping, subtotals, reports, and CSV export.
- English and Burmese language toggle with saved language preference.
- Myanmar currency display using `Ks`.
- PWA manifest and production service worker.
- Docker Compose MongoDB setup for local development.

## Requirements

- Node.js 22 or newer.
- npm.
- Docker Desktop or Docker Engine with Compose.
- MongoDB via the included Docker Compose service or a private MongoDB deployment.

## Local Setup

Create local environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` and replace all `replace-with-*` values with strong local secrets.

Start MongoDB:

```bash
npm run db:up
```

Install dependencies:

```bash
npm install
```

Start the web app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Seed Users

Login credentials are not stored in source code. Seed users are read from `SPLITLEDGER_SEED_USERS` in `.env.local`.

With MongoDB and the dev server running:

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
npm run db:up
npm run db:down
npm run db:logs
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
MONGODB_DB=splitledger
MONGODB_URI=mongodb://splitledger_app:<strong-password>@<private-mongo-host>:27017/splitledger?authSource=splitledger
```

Do not expose MongoDB publicly. Keep it on a private network and use a least-privilege app database user.

## Security Notes

- Passwords are hashed with Node.js `scrypt`.
- Session tokens are random opaque values. Only SHA-256 token hashes are stored.
- Session cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production.
- State-changing routes validate request origin.
- Security headers are applied through `middleware.ts`.
- Expense create and delete actions write to `expenseAudits`.
- Business records are shared by design. Personal records are owner-scoped.

## PWA

The app exposes `/manifest.webmanifest` and `/sw.js`.

Service worker registration runs only in production builds to avoid stale development caches:

```bash
npm run build
npm start
```

Then open `http://localhost:3000` and use the browser install option.

## MongoDB Docs

See `MONGODB.md` for local MongoDB setup, connection checks, backups, and restore commands.

See `PRODUCTION.md` for the production deployment checklist.
