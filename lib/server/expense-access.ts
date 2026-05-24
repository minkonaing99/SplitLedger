import type { Expense } from "../types"

export function canAccessExpense(expense: Pick<Expense, "ownerUserId" | "type">, userId: string): boolean {
  return expense.type === "business" || expense.ownerUserId === userId
}

export function buildVisibleExpenseWhere(userId: string): { clause: string, params: string[] } {
  return {
    clause: "(type = 'business' OR (type = 'personal' AND owner_user_id = ?))",
    params: [userId]
  }
}

export function buildAccessibleExpenseWhere(expenseId: string, userId: string): { clause: string, params: string[] } {
  return {
    clause: "id = ? AND (type = 'business' OR (type = 'personal' AND owner_user_id = ?))",
    params: [expenseId, userId]
  }
}
