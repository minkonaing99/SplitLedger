import type { DashboardTotals, Expense, ExpenseInput, PaymentMethod } from "./types"

const currencyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
})

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  compactDisplay: "short",
  maximumFractionDigits: 1,
  notation: "compact"
})

const shortMonthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
]

export function formatCurrency(amount: number): string {
  return `${currencyFormatter.format(amount)} Ks`
}

export function formatCompactCurrency(amount: number): string {
  return `${compactCurrencyFormatter.format(amount)} Ks`
}

export function formatDisplayDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-")
  const monthIndex = Number(month) - 1

  if (!year || !day || monthIndex < 0 || monthIndex >= shortMonthNames.length) {
    return dateKey
  }

  return `${day}-${shortMonthNames[monthIndex]}-${year.slice(-2)}`
}

export function createExpense(input: ExpenseInput): Expense {
  return {
    ...input,
    id: crypto.randomUUID()
  }
}

export function calculateDashboardTotals(
  expenses: ReadonlyArray<Expense>,
  currentUserId: string,
  today: Date = new Date()
): DashboardTotals {
  const todayKey = toDateKey(today)
  const monthKey = todayKey.slice(0, 7)
  const currentUserExpenses = expenses.filter(
    (expense) =>
      expense.type === "business" ||
      (expense.type === "personal" && expense.ownerUserId === currentUserId)
  )

  return {
    today: sumNetAmount(currentUserExpenses.filter((expense) => expense.date === todayKey)),
    businessMonth: sumNetAmount(
      expenses.filter(
        (expense) => expense.type === "business" && expense.date.startsWith(monthKey)
      )
    ),
    personalMonth: sumNetAmount(
      expenses.filter(
        (expense) =>
          expense.type === "personal" &&
          expense.ownerUserId === currentUserId &&
          expense.date.startsWith(monthKey)
      )
    ),
    businessCount: expenses.filter((expense) => expense.type === "business").length
  }
}

export function getVisibleExpenses(
  expenses: ReadonlyArray<Expense>,
  currentUserId: string
): Expense[] {
  return expenses.filter(
    (expense) =>
      expense.type === "business" ||
      (expense.type === "personal" && expense.ownerUserId === currentUserId)
  )
}

export function sumExpenses(expenses: ReadonlyArray<Expense>): number {
  return expenses.reduce((total, expense) => total + expense.amount, 0)
}

export function sumIncome(expenses: ReadonlyArray<Expense>): number {
  return sumExpenses(expenses.filter((expense) => expense.kind === "income"))
}

export function sumExpenseOutflow(expenses: ReadonlyArray<Expense>): number {
  return sumExpenses(expenses.filter((expense) => expense.kind !== "income"))
}

export function sumNetAmount(expenses: ReadonlyArray<Expense>): number {
  return expenses.reduce(
    (total, expense) => total + (expense.kind === "income" ? expense.amount : -expense.amount),
    0
  )
}

export function getBusinessPaymentMethod(expense: Expense): PaymentMethod {
  return expense.type === "business" ? expense.paymentMethod ?? "cash" : "cash"
}

export function sumNetAmountByPaymentMethod(
  expenses: ReadonlyArray<Expense>,
  paymentMethod: PaymentMethod
): number {
  return sumNetAmount(
    expenses.filter(
      (expense) =>
        expense.type === "business" &&
        getBusinessPaymentMethod(expense) === paymentMethod
    )
  )
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
