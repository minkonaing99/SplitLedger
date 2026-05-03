import type { Collection, WithId } from "mongodb"
import { getMongoConnection } from "@/lib/server/mongodb"
import type { User } from "@/lib/types"

export interface UserDocument extends User {
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

export interface SessionDocument {
  tokenHash: string
  userId: string
  createdAt: Date
  expiresAt: Date
}

export interface LoginAttemptDocument {
  key: string
  createdAt: Date
}

export async function findUserByEmail(email: string): Promise<UserDocument | null> {
  const collection = await getUsersCollection()
  return collection.findOne({ email: normalizeEmail(email) })
}

export async function findUserById(userId: string): Promise<UserDocument | null> {
  const collection = await getUsersCollection()
  return collection.findOne({ id: userId })
}

export async function upsertUser(input: {
  id: string
  name: string
  email: string
  passwordHash: string
}): Promise<void> {
  const collection = await getUsersCollection()
  const now = new Date()

  await collection.updateOne(
    { id: input.id },
    {
      $set: {
        name: input.name,
        email: normalizeEmail(input.email),
        passwordHash: input.passwordHash,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true }
  )
}

export async function createSession(input: {
  tokenHash: string
  userId: string
  expiresAt: Date
}): Promise<void> {
  const collection = await getSessionsCollection()

  await collection.insertOne({
    tokenHash: input.tokenHash,
    userId: input.userId,
    expiresAt: input.expiresAt,
    createdAt: new Date()
  })
}

export async function findSessionWithUser(tokenHash: string): Promise<User | null> {
  const sessions = await getSessionsCollection()
  const session = await sessions.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() }
  })

  if (!session) {
    return null
  }

  const user = await findUserById(session.userId)
  return user ? toPublicUser(user) : null
}

export async function deleteSession(tokenHash: string): Promise<void> {
  const collection = await getSessionsCollection()
  await collection.deleteOne({ tokenHash })
}

export async function deleteExpiredSessions(): Promise<void> {
  const collection = await getSessionsCollection()
  await collection.deleteMany({ expiresAt: { $lte: new Date() } })
}

export async function countRecentLoginAttempts(input: {
  key: string
  since: Date
}): Promise<number> {
  const collection = await getLoginAttemptsCollection()
  return collection.countDocuments({
    key: input.key,
    createdAt: { $gte: input.since }
  })
}

export async function recordLoginAttempt(key: string): Promise<void> {
  const collection = await getLoginAttemptsCollection()
  await collection.insertOne({
    key,
    createdAt: new Date()
  })
}

export async function clearLoginAttempts(key: string): Promise<void> {
  const collection = await getLoginAttemptsCollection()
  await collection.deleteMany({ key })
}

export async function ensureAuthIndexes(): Promise<void> {
  const users = await getUsersCollection()
  const sessions = await getSessionsCollection()
  const loginAttempts = await getLoginAttemptsCollection()

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ id: 1 }, { unique: true }),
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    loginAttempts.createIndex({ key: 1, createdAt: -1 }),
    loginAttempts.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })
  ])
}

export function toPublicUser(user: WithId<UserDocument> | UserDocument): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const { db } = await getMongoConnection()
  return db.collection<UserDocument>("users")
}

async function getSessionsCollection(): Promise<Collection<SessionDocument>> {
  const { db } = await getMongoConnection()
  return db.collection<SessionDocument>("sessions")
}

async function getLoginAttemptsCollection(): Promise<Collection<LoginAttemptDocument>> {
  const { db } = await getMongoConnection()
  return db.collection<LoginAttemptDocument>("loginAttempts")
}
