import { NextResponse, type NextRequest } from "next/server"

const staticHeaders: ReadonlyArray<[string, string]> = [
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"]
]

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const csp = buildContentSecurityPolicy(nonce)

  // Forward nonce to the layout so Next.js applies it to its own hydration scripts.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  for (const [header, value] of staticHeaders) {
    response.headers.set(header, value)
  }

  response.headers.set("Content-Security-Policy", csp)

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains"
    )
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
}

function buildContentSecurityPolicy(nonce: string): string {
  const scriptSource =
    process.env.NODE_ENV === "production"
      ? `'nonce-${nonce}' 'strict-dynamic'`
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
