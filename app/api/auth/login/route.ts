import { NextResponse } from "next/server"
import { findUserByEmail, toPublicUser } from "@/lib/server/auth-repository"
import {
  checkLoginRateLimit,
  clearFailedLogins,
  recordFailedLogin
} from "@/lib/server/login-rate-limit"
import { verifyPassword } from "@/lib/server/passwords"
import { createUserSession } from "@/lib/server/sessions"

export async function POST(request: Request) {
  const body = await readJson(request)
  const email = readString(body, "email")
  const password = readString(body, "password")

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
  }

  const rateLimit = await checkLoginRateLimit(request, email)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many failed login attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds)
        }
      }
    )
  }

  const user = await findUserByEmail(email)
  const isValidPassword = user ? await verifyPassword(password, user.passwordHash) : false

  if (!user || !isValidPassword) {
    await recordFailedLogin(rateLimit.key)
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 })
  }

  await clearFailedLogins(rateLimit.key)
  await createUserSession(user.id)

  return NextResponse.json({
    user: toPublicUser(user)
  })
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function readString(value: unknown, key: string): string {
  if (!value || typeof value !== "object" || !(key in value)) {
    return ""
  }

  const field = (value as Record<string, unknown>)[key]
  return typeof field === "string" ? field.trim() : ""
}
