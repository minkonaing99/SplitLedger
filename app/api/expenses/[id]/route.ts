import { NextResponse } from "next/server"
import { requireCurrentUser } from "@/lib/server/api"
import { deleteExpense } from "@/lib/server/expense-repository"

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function DELETE(_request: Request, context: RouteContext) {
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
