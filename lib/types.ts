export type ExpenseType = "business" | "personal"
export type TransactionKind = "expense" | "income" | "transfer"
export type PaymentMethod = "cash" | "kpay"

export interface User {
  id: string
  name: string
  email: string
}

export interface Expense {
  id: string
  type: ExpenseType
  kind: TransactionKind
  paymentMethod?: PaymentMethod
  transferFromPaymentMethod?: PaymentMethod
  transferToPaymentMethod?: PaymentMethod
  amount: number
  paidByUserId: string
  ownerUserId: string
  date: string
  note: string
}

export interface ExpenseInput {
  type: ExpenseType
  kind: TransactionKind
  paymentMethod?: PaymentMethod
  transferFromPaymentMethod?: PaymentMethod
  transferToPaymentMethod?: PaymentMethod
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

export interface MonthlyClose {
  id: string
  monthKey: string
  cashOpeningBalance: number
  kpayOpeningBalance: number
  cashClosingBalance: number
  kpayClosingBalance: number
  incomeTotal: number
  expenseTotal: number
  transferTotal: number
  transactionCount: number
  closedByUserId: string
  closedAt: string
}

export type MonthlyCloseSnapshot = Omit<
  MonthlyClose,
  "closedAt" | "closedByUserId" | "id"
>
