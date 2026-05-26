import { NextResponse } from "next/server"
import {
  isTrustedOrigin,
  readRequestOrigin as readRequestOriginHeader
} from "@/lib/server/origin"

export function validateTrustedOrigin(request: Request): NextResponse | null {
  const requestOrigin = readRequestOrigin(request)

  if (!requestOrigin) {
    return process.env.NODE_ENV === "production"
      ? NextResponse.json({ error: "Origin header is required." }, { status: 403 })
      : null
  }

  if (
    isTrustedOrigin({
      appOrigin: process.env.APP_ORIGIN,
      host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      origin: request.headers.get("origin"),
      protocol:
        request.headers.get("x-forwarded-proto") ??
        (process.env.NODE_ENV === "production" ? "https" : "http"),
      referer: request.headers.get("referer")
    })
  ) {
    return null
  }

  return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 })
}

function readRequestOrigin(request: Request): string | null {
  return readRequestOriginHeader(request.headers.get("origin"), request.headers.get("referer"))
}
