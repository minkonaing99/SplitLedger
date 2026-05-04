import { NextResponse, type NextRequest } from "next/server"

const securityHeaders: ReadonlyArray<[string, string]> = [
  ["Content-Security-Policy", buildContentSecurityPolicy()],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"]
]

export function middleware(_request: NextRequest) {
  const response = NextResponse.next()

  for (const [header, value] of securityHeaders) {
    response.headers.set(header, value)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
}

function buildContentSecurityPolicy(): string {
  const scriptSource =
    process.env.NODE_ENV === "production"
      ? "'self' 'unsafe-inline'"
      : "'self' 'unsafe-inline' 'unsafe-eval'"

  return [
    "default-src 'self'",
    `script-src ${scriptSource}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'"
  ].join("; ")
}
