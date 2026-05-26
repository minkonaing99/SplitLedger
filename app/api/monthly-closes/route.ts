import { NextResponse } from "next/server"
import { calculateMonthlyCloseSnapshot } from "@/lib/expenses"
import { requireCurrentUser } from "@/lib/server/api"
import { listBusinessExpenses } from "@/lib/server/expense-repository"
import {
  listMonthlyCloses,
  upsertMonthlyClose
} from "@/lib/server/monthly-close-repository"
import { validateTrustedOrigin } from "@/lib/server/security"

export async function GET() {
  const auth = await requireCurrentUser()

  if (!auth.ok) {
    return auth.response
  }

  const monthlyCloses = await listMonthlyCloses()
  return NextResponse.json({ monthlyCloses })
}

export async function POST(request: Request) {
  const originError = validateTrustedOrigin(request)

  if (originError) {
    return originError
  }

  const auth = await requireCurrentUser()

  if (!auth.ok) {
    return auth.response
  }

  const body = await readJson(request)
  const monthKey = readMonthKey(body)

  if (!monthKey) {
    return NextResponse.json({ error: "Month is required." }, { status: 400 })
  }

  const expenses = await listBusinessExpenses()
  const snapshot = calculateMonthlyCloseSnapshot(expenses, monthKey)
  const monthlyClose = await upsertMonthlyClose({
    closedByUserId: auth.user.id,
    snapshot
  })

  return NextResponse.json({ monthlyClose }, { status: 201 })
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function readMonthKey(value: unknown): string {
  if (!value || typeof value !== "object" || !("monthKey" in value)) {
    return ""
  }

  const monthKey = (value as Record<string, unknown>).monthKey
  return typeof monthKey === "string" && /^\d{4}-\d{2}$/.test(monthKey)
    ? monthKey
    : ""
}
