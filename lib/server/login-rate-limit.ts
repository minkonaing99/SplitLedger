import {
  clearLoginAttempts,
  countRecentLoginAttempts,
  ensureAuthIndexes,
  recordLoginAttempt
} from "@/lib/server/auth-repository"

const MAX_LOGIN_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

export async function checkLoginRateLimit(request: Request, email: string): Promise<{
  allowed: boolean
  key: string
  retryAfterSeconds: number
}> {
  await ensureAuthIndexes()

  const key = createLoginAttemptKey(request, email)
  const attempts = await countRecentLoginAttempts({
    key,
    since: new Date(Date.now() - WINDOW_MS)
  })

  return {
    allowed: attempts < MAX_LOGIN_ATTEMPTS,
    key,
    retryAfterSeconds: Math.ceil(WINDOW_MS / 1000)
  }
}

export async function recordFailedLogin(key: string): Promise<void> {
  await recordLoginAttempt(key)
}

export async function clearFailedLogins(key: string): Promise<void> {
  await clearLoginAttempts(key)
}

function createLoginAttemptKey(request: Request, email: string): string {
  const ipAddress = getClientIpAddress(request)
  return `${ipAddress}:${email.trim().toLowerCase()}`
}

function getClientIpAddress(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown"
  }

  return request.headers.get("x-real-ip") ?? "unknown"
}
