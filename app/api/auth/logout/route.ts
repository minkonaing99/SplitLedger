import { NextResponse } from "next/server"
import { validateTrustedOrigin } from "@/lib/server/security"
import { clearCurrentSession } from "@/lib/server/sessions"

export async function POST(request: Request) {
  const originError = validateTrustedOrigin(request)

  if (originError) {
    return originError
  }

  await clearCurrentSession()
  return NextResponse.json({ ok: true })
}
