import { readDb, updateDb } from "@/lib/server/json-db"
import type { User } from "@/lib/types"

export interface UserDocument extends User {
  email: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

interface SessionRecord {
  tokenHash: string
  userId: string
  createdAt: string
  expiresAt: string
}

interface LoginAttemptRecord {
  key: string
  createdAt: string
}

export async function findUserByEmail(email: string): Promise<UserDocument | null> {
  const users = await readDb<UserDocument>("users.json")
  return users.find(u => u.email === normalizeEmail(email)) ?? null
}

export async function findUserById(userId: string): Promise<UserDocument | null> {
  const users = await readDb<UserDocument>("users.json")
  return users.find(u => u.id === userId) ?? null
}

export async function upsertUser(input: {
  id: string
  name: string
  email: string
  passwordHash: string
}): Promise<void> {
  await updateDb<UserDocument>("users.json", users => {
    const now = new Date().toISOString()
    const normalizedEmail = normalizeEmail(input.email)
    const existing = users.find(u => u.id === input.id || u.email === normalizedEmail)

    if (existing) {
      return users.map(u =>
        u.id === existing.id
          ? { ...u, name: input.name, email: normalizedEmail, passwordHash: input.passwordHash, updatedAt: now }
          : u
      )
    }

    return [...users, {
      id: input.id,
      name: input.name,
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now
    }]
  })
}

export async function createSession(input: {
  tokenHash: string
  userId: string
  expiresAt: Date
}): Promise<void> {
  await updateDb<SessionRecord>("sessions.json", sessions => [
    ...sessions,
    {
      tokenHash: input.tokenHash,
      userId: input.userId,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt.toISOString()
    }
  ])
}

export async function findSessionWithUser(tokenHash: string): Promise<User | null> {
  const [sessions, users] = await Promise.all([
    readDb<SessionRecord>("sessions.json"),
    readDb<UserDocument>("users.json")
  ])

  const now = new Date().toISOString()
  const session = sessions.find(s => s.tokenHash === tokenHash && s.expiresAt > now)
  if (!session) return null

  const user = users.find(u => u.id === session.userId)
  return user ? { id: user.id, name: user.name, email: user.email } : null
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await updateDb<SessionRecord>("sessions.json", sessions =>
    sessions.filter(s => s.tokenHash !== tokenHash)
  )
}

export async function deleteExpiredSessions(): Promise<void> {
  const now = new Date().toISOString()
  await updateDb<SessionRecord>("sessions.json", sessions =>
    sessions.filter(s => s.expiresAt > now)
  )
}

export async function countRecentLoginAttempts(input: {
  key: string
  since: Date
}): Promise<number> {
  const attempts = await readDb<LoginAttemptRecord>("login-attempts.json")
  const since = input.since.toISOString()
  return attempts.filter(a => a.key === input.key && a.createdAt >= since).length
}

export async function recordLoginAttempt(key: string): Promise<void> {
  await updateDb<LoginAttemptRecord>("login-attempts.json", attempts => [
    ...attempts,
    { key, createdAt: new Date().toISOString() }
  ])
}

export async function clearLoginAttempts(key: string): Promise<void> {
  await updateDb<LoginAttemptRecord>("login-attempts.json", attempts =>
    attempts.filter(a => a.key !== key)
  )
}

export async function pruneOldLoginAttempts(olderThan: Date): Promise<void> {
  const threshold = olderThan.toISOString()
  await updateDb<LoginAttemptRecord>("login-attempts.json", attempts =>
    attempts.filter(a => a.createdAt >= threshold)
  )
}

export async function ensureAuthIndexes(): Promise<void> {}

export function toPublicUser(user: UserDocument): User {
  return { id: user.id, name: user.name, email: user.email }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
