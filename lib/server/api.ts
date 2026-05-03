import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/server/sessions"
import type { User } from "@/lib/types"

export async function requireCurrentUser(): Promise<
  | {
      ok: true
      user: User
    }
  | {
      ok: false
      response: NextResponse
    }
> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }
  }

  return { ok: true, user }
}
