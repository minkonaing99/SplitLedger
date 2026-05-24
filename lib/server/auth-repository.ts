import type { RowDataPacket, ResultSetHeader } from "mysql2/promise"
import { getMysqlPool } from "@/lib/server/mysql"
import type { User } from "@/lib/types"

export interface UserDocument extends User {
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

interface UserRow extends RowDataPacket {
  id: string
  name: string
  email: string
  password_hash: string
  created_at: Date
  updated_at: Date
}

interface SessionRow extends RowDataPacket {
  token_hash: string
  user_id: string
  created_at: Date
  expires_at: Date
}

interface UserFromSessionRow extends RowDataPacket {
  id: string
  name: string
  email: string
}

export async function findUserByEmail(email: string): Promise<UserDocument | null> {
  const pool = await getMysqlPool()
  const [rows] = await pool.execute<UserRow[]>(
    "SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE email = ?",
    [normalizeEmail(email)]
  )
  return rows[0] ? toUserDocument(rows[0]) : null
}

export async function findUserById(userId: string): Promise<UserDocument | null> {
  const pool = await getMysqlPool()
  const [rows] = await pool.execute<UserRow[]>(
    "SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE id = ?",
    [userId]
  )
  return rows[0] ? toUserDocument(rows[0]) : null
}

export async function upsertUser(input: {
  id: string
  name: string
  email: string
  passwordHash: string
}): Promise<void> {
  const pool = await getMysqlPool()
  const now = new Date()

  await pool.execute<ResultSetHeader>(
    `INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       email = VALUES(email),
       password_hash = VALUES(password_hash),
       updated_at = VALUES(updated_at)`,
    [input.id, input.name, normalizeEmail(input.email), input.passwordHash, now, now]
  )
}

export async function createSession(input: {
  tokenHash: string
  userId: string
  expiresAt: Date
}): Promise<void> {
  const pool = await getMysqlPool()

  await pool.execute<ResultSetHeader>(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    [input.tokenHash, input.userId, new Date(), input.expiresAt]
  )
}

export async function findSessionWithUser(tokenHash: string): Promise<User | null> {
  const pool = await getMysqlPool()
  const [rows] = await pool.execute<UserFromSessionRow[]>(
    `SELECT u.id, u.name, u.email
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = ? AND s.expires_at > NOW()`,
    [tokenHash]
  )
  return rows[0] ?? null
}

export async function deleteSession(tokenHash: string): Promise<void> {
  const pool = await getMysqlPool()
  await pool.execute<ResultSetHeader>("DELETE FROM sessions WHERE token_hash = ?", [tokenHash])
}

export async function deleteExpiredSessions(): Promise<void> {
  const pool = await getMysqlPool()
  await pool.execute<ResultSetHeader>("DELETE FROM sessions WHERE expires_at <= NOW()")
}

export async function countRecentLoginAttempts(input: {
  key: string
  since: Date
}): Promise<number> {
  const pool = await getMysqlPool()
  const [rows] = await pool.execute<(RowDataPacket & { count: number })[]>(
    "SELECT COUNT(*) AS count FROM login_attempts WHERE attempt_key = ? AND created_at >= ?",
    [input.key, input.since]
  )
  return rows[0]?.count ?? 0
}

export async function recordLoginAttempt(key: string): Promise<void> {
  const pool = await getMysqlPool()
  await pool.execute<ResultSetHeader>(
    "INSERT INTO login_attempts (attempt_key, created_at) VALUES (?, ?)",
    [key, new Date()]
  )
}

export async function clearLoginAttempts(key: string): Promise<void> {
  const pool = await getMysqlPool()
  await pool.execute<ResultSetHeader>("DELETE FROM login_attempts WHERE attempt_key = ?", [key])
}

export async function pruneOldLoginAttempts(olderThan: Date): Promise<void> {
  const pool = await getMysqlPool()
  await pool.execute<ResultSetHeader>("DELETE FROM login_attempts WHERE created_at < ?", [olderThan])
}

export async function ensureAuthIndexes(): Promise<void> {
  // Indexes are managed by schema migrations in lib/server/db/migrations.ts
}

export function toPublicUser(user: UserDocument): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function toUserDocument(row: UserRow): UserDocument {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

interface SessionDocumentRow extends RowDataPacket {
  tokenHash: string
  userId: string
  createdAt: Date
  expiresAt: Date
}

export type { SessionDocumentRow as SessionDocument }
