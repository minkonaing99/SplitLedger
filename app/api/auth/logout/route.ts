import { NextResponse } from "next/server"
import { clearCurrentSession } from "@/lib/server/sessions"

export async function POST() {
  await clearCurrentSession()
  return NextResponse.json({ ok: true })
}
