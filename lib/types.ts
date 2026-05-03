export type ExpenseType = "business" | "personal"
export type TransactionKind = "expense" | "income"

export interface User {
  id: string
  name: string
  email: string
}

export interface DemoCredential {
  userId: string
  email: string
  password: string
}

export interface Expense {
  id: string
  type: ExpenseType
  kind: TransactionKind
  amount: number
  paidByUserId: string
  ownerUserId: string
  date: string
  note: string
}

export interface ExpenseInput {
  type: ExpenseType
  kind: TransactionKind
  amount: number
  paidByUserId: string
  ownerUserId: string
  date: string
  note: string
}

export interface DashboardTotals {
  today: number
  businessMonth: number
  personalMonth: number
  businessCount: number
}
