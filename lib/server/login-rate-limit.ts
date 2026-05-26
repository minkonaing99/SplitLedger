import {
  clearLoginAttempts,
  countRecentLoginAttempts,
  pruneOldLoginAttempts,
  recordLoginAttempt
} from "@/lib/server/auth-repository"

const MAX_LOGIN_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

export async function checkLoginRateLimit(request: Request, email: string): Promise<{
  allowed: boolean
  key: string
  retryAfterSeconds: number
}> {
  const key = createLoginAttemptKey(request, email)
  const since = new Date(Date.now() - WINDOW_MS)

  await pruneOldLoginAttempts(since)

  const attempts = await countRecentLoginAttempts({ key, since })

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
  // Prefer x-real-ip (set by nginx/trusted proxy, not forwardable by clients).
  // Fall back to the last segment of x-forwarded-for, which is appended by
  // the outermost proxy — unlike the first segment, it cannot be forged by
  // the client when a reverse proxy is in front.
  const realIp = request.headers.get("x-real-ip")
  if (realIp) {
    return realIp.trim()
  }

  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const segments = forwardedFor.split(",")
    return segments[segments.length - 1]?.trim() ?? "unknown"
  }

  return "unknown"
}
