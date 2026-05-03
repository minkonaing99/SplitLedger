# SplitLedger MongoDB Setup

## Start MongoDB

```bash
npm run db:up
```

This builds `docker/mongo/Dockerfile`, starts MongoDB on `localhost:27017`, creates the `splitledger` database, creates the `splitledger` app user, and initializes the `users`, `sessions`, `loginAttempts`, and `expenses` collections with indexes.

## Environment

Create `.env.local` from `.env.example`:

```bash
MONGODB_URI=mongodb://splitledger:splitledger@localhost:27017/splitledger?authSource=splitledger
MONGODB_DB=splitledger
```

## Verify Connection

With the Next.js dev server running:

```bash
curl http://localhost:3000/api/health/db
```

Expected response:

```json
{"ok":true,"database":"splitledger"}
```

For a write/read/delete smoke test from the web app process:

```bash
curl -X POST http://localhost:3000/api/health/db
```

## Seed Local Users

With MongoDB and the Next.js dev server running:

```bash
curl -X POST http://localhost:3000/api/dev/seed
```

This dev-only route creates local users with `scrypt` password hashes and inserts starter expenses if they are missing.

Local credentials:

```text
aurora@example.com / split1234
brother@example.com / brother1234
```

## Authentication Model

- Passwords are hashed with Node.js `scrypt`; plaintext passwords are never stored.
- Login creates a random opaque session token.
- Only a SHA-256 hash of the session token is stored in MongoDB.
- The browser receives the token in an `httpOnly`, `SameSite=Lax` cookie.
- In production, the cookie is also marked `Secure`.
- Expense APIs require a valid server-side session.
- Failed login attempts are rate-limited with MongoDB TTL cleanup.

## Stop MongoDB

```bash
npm run db:down
```
