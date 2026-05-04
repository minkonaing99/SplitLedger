import { NextResponse } from "next/server"
import { requireCurrentUser } from "@/lib/server/api"
import { deleteExpense } from "@/lib/server/expense-repository"
import { validateTrustedOrigin } from "@/lib/server/security"

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function DELETE(request: Request, context: RouteContext) {
  const originError = validateTrustedOrigin(request)

  if (originError) {
    return originError
  }

  const auth = await requireCurrentUser()

  if (!auth.ok) {
    return auth.response
  }

  const { id } = await context.params
  const wasDeleted = await deleteExpense(id, auth.user.id)

  if (!wasDeleted) {
    return NextResponse.json({ error: "Expense was not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
