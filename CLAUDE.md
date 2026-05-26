# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Commands

```bash
# Development (MySQL must be running locally)
npm run dev            # Next.js dev server at http://localhost:3000 — DB tables auto-created on first request
npm run typecheck      # tsc --noEmit
npm test               # node:test runner against tests/*.test.ts
npm run build          # Production build
npm start              # Serve production build

# Seed (dev only)
curl -X POST http://localhost:3000/api/dev/seed
```

**Pre-PR gate:** `npm run typecheck && npm test`. Run `npm run build` for routing, PWA, or deployment-sensitive changes.

## Architecture

**Stack:** Next.js 15 App Router, React 19, TypeScript, MySQL + `mysql2`, Tailwind CSS 4. No ORM — raw `mysql2/promise` driver.

### Module Boundaries

```
app/api/          → Route handlers (auth, expenses, monthly-closes, health, dev/seed)
components/       → Client React components
lib/types.ts      → Shared domain types (Expense, User, MonthlyClose, etc.)
lib/expenses.ts   → Pure client-safe calculation utilities
lib/i18n.ts       → English/Burmese translation strings
lib/mock-data.ts  → Test/dev fixtures
lib/server/       → Server-only modules — never import into client components
  api.ts          → requireCurrentUser() helper for route handlers
  auth-repository.ts, sessions.ts, passwords.ts → Auth layer
  expense-repository.ts, expense-access.ts → Expense data access + visibility rules
  monthly-close-repository.ts → Monthly close persistence
  mysql.ts        → getMysqlPool() singleton — runs schema migrations on first call
  db/migrations.ts → CREATE TABLE IF NOT EXISTS DDL array (all schema lives here)
  origin.ts       → CSRF origin validation helpers
  security.ts     → validateTrustedOrigin() — call on all state-changing routes
  login-rate-limit.ts → Per-IP login throttle (prunes login_attempts table each check)
middleware.ts     → Security headers (CSP, X-Frame-Options, etc.) for all routes
```

### Key Patterns

**Authorization — every route handler follows this sequence:**
1. `validateTrustedOrigin(request)` — CSRF check (state-changing routes only)
2. `requireCurrentUser()` — returns `{ ok: true, user }` or `{ ok: false, response }`
3. `buildVisibleExpenseWhere(userId)` / `canAccessExpense(expense, userId)` — data-scoping

**Visibility rule:** Business expenses are shared (all users). Personal expenses are owner-scoped (`ownerUserId === userId`). This is enforced in `lib/server/expense-access.ts` and applied in every DB query via `buildVisibleExpenseWhere` which returns `{ clause: string, params: string[] }` for safe parameterized SQL.

**MySQL:** Single workspace `"family-business"` in `workspace_id` column on every table. Application-level UUID in `id CHAR(36) PRIMARY KEY` — no separate auto-increment. All queries filter by `workspace_id` first. `null` from MySQL columns is mapped to `undefined` in TypeScript types via `?? undefined` in row mappers.

**Transactions:** `insertExpense` and `deleteExpense` wrap expense + audit INSERT inside a single `connection.beginTransaction()` / `commit()`. `upsertMonthlyClose` uses a transaction for INSERT + SELECT.

**Session tokens:** Random 32-byte values; only the SHA-256 hash is stored. Cookie is `httpOnly`, `SameSite=Lax`, `Secure` in production.

**Input validation:** Route handlers use local `readString`/`readNumber`/`readDate` helpers that safely handle `unknown` JSON. No Zod — validation is manual and strict.

### Testing

Tests live in `tests/*.test.ts` and use the built-in `node:test` + `node:assert/strict`. They test pure functions and logic only — no HTTP or database in the test suite. When adding tests, match the existing pattern: import directly from `../lib/*.ts` with `.ts` extension.

## Environment Variables

Required in `.env.local` (copy from `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `APP_ORIGIN` | — | Full origin (e.g. `https://your-domain.com`) — CSRF validation |
| `MYSQL_HOST` | `127.0.0.1` | MySQL host |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_USER` | — | MySQL username |
| `MYSQL_PASSWORD` | — | MySQL password |
| `MYSQL_DB` | — | Database name (e.g. `splitledger`) |
| `SPLITLEDGER_SEED_USERS` | — | JSON array of seed user credentials (dev only) |

The dev seed route (`app/api/dev/seed/route.ts`) checks `NODE_ENV` and must never run in production.
