import { formatCurrency } from "@/lib/expenses"
import type { Expense } from "@/lib/types"

interface ExpenseListProps {
  expenses: ReadonlyArray<Expense>
  onDeleteExpense?: (expenseId: string) => void
}

export function ExpenseList({ expenses, onDeleteExpense }: ExpenseListProps) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
        No expenses match this view yet.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      {expenses.map((expense) => (
        <article
          className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--line)] p-4 last:border-b-0"
          key={expense.id}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{expense.note}</h3>
              <span className={getTypeClassName(expense.type)}>{expense.type}</span>
              <span className={getKindClassName(expense.kind)}>{expense.kind}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {getExpenseMeta(expense)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={getAmountClassName(expense)}>
              {expense.kind === "income" ? "+" : "-"}
              {formatCurrency(expense.amount)}
            </div>
            {onDeleteExpense ? (
              <button
                aria-label={`Delete ${expense.note}`}
                className="h-8 rounded-md border border-[var(--line)] px-2 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                onClick={() => onDeleteExpense(expense.id)}
                type="button"
              >
                Delete
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}

function getExpenseMeta(expense: Expense): string {
  if (expense.type === "business") {
    return `Business ${expense.kind} on ${expense.date}`
  }

  return `Personal expense on ${expense.date}`
}

function getTypeClassName(type: Expense["type"]): string {
  const base = "rounded-md px-2 py-0.5 text-xs font-medium"

  if (type === "business") {
    return `${base} bg-[var(--business-soft)] text-[var(--business)]`
  }

  return `${base} bg-[var(--personal-soft)] text-[var(--personal)]`
}

function getKindClassName(kind: Expense["kind"]): string {
  const base = "rounded-md px-2 py-0.5 text-xs font-medium"

  if (kind === "income") {
    return `${base} bg-[var(--success-soft)] text-[var(--success)]`
  }

  return `${base} bg-[var(--surface-muted)] text-[var(--muted)]`
}

function getAmountClassName(expense: Expense): string {
  const color = expense.kind === "income" ? "text-[var(--success)]" : "text-[var(--text)]"
  return `min-w-24 text-right text-sm font-semibold leading-none ${color}`
}
