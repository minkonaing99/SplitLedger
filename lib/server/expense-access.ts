import type { Expense } from "../types"

export function canAccessExpense(expense: Pick<Expense, "ownerUserId" | "type">, userId: string): boolean {
  return expense.type === "business" || expense.ownerUserId === userId
}

export function buildVisibleExpenseFilter(userId: string) {
  return {
    $or: [{ type: "business" as const }, { type: "personal" as const, ownerUserId: userId }]
  }
}

export function buildAccessibleExpenseFilter(expenseId: string, userId: string) {
  return {
    id: expenseId,
    ...buildVisibleExpenseFilter(userId)
  }
}
