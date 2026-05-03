import { createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findSessionWithUser
} from "@/lib/server/auth-repository"
import type { User } from "@/lib/types"

const SESSION_COOKIE_NAME = "splitledger_session"
const SESSION_DAYS = 30

export async function createUserSession(userId: string): Promise<{
  expiresAt: Date
  token: string
}> {
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await deleteExpiredSessions()
  await createSession({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt
  })

  const cookieStore = await cookies()
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  })

  return { expiresAt, token }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  return findSessionWithUser(hashSessionToken(token))
}

export async function clearCurrentSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await deleteSession(hashSessionToken(token))
  }

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  })
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url")
}
