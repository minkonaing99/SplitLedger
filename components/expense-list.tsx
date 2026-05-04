import { formatCurrency, formatDisplayDate, sumNetAmount } from "@/lib/expenses"
import { translate, type Language } from "@/lib/i18n"
import type { Expense } from "@/lib/types"

interface ExpenseListProps {
  expenses: ReadonlyArray<Expense>
  groupByDate?: boolean
  language: Language
  onDeleteExpense?: (expenseId: string) => void
  showSigns?: boolean
}

export function ExpenseList({
  expenses,
  groupByDate = false,
  language,
  onDeleteExpense,
  showSigns = true
}: ExpenseListProps) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
        {translate(language, "noTransactions")}
      </div>
    )
  }

  if (groupByDate) {
    return (
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        {groupExpensesByDate(expenses).map((group) => (
          <section className="border-b border-[var(--line)] last:border-b-0" key={group.date}>
            <div className="flex items-center justify-between gap-3 bg-[var(--surface-muted)] px-3 py-2 sm:px-4">
              <div className="text-xs font-semibold uppercase text-[var(--muted)]">
                {formatDisplayDate(group.date)}
              </div>
              <div className={getGroupSubtotalClassName(group.expenses)}>
                {translate(language, "subtotal")} {formatSubtotal(group.expenses, showSigns)}
              </div>
            </div>
            {group.expenses.map((expense) => (
              <ExpenseRow
                expense={expense}
                hideDate
                key={expense.id}
                language={language}
                onDeleteExpense={onDeleteExpense}
                showSigns={showSigns}
              />
            ))}
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      {expenses.map((expense) => (
        <ExpenseRow
          expense={expense}
          key={expense.id}
          language={language}
          onDeleteExpense={onDeleteExpense}
          showSigns={showSigns}
        />
      ))}
    </div>
  )
}

function ExpenseRow({
  expense,
  hideDate = false,
  language,
  onDeleteExpense,
  showSigns
}: {
  expense: Expense
  hideDate?: boolean
  language: Language
  onDeleteExpense?: (expenseId: string) => void
  showSigns: boolean
}) {
  return (
    <article className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-[var(--line)] p-3 last:border-b-0 sm:gap-3 sm:p-4">
      <div className="min-w-0">
        <div>
          <h3 className="truncate text-sm font-semibold">{expense.note}</h3>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={getTypeClassName(expense.type)}>
            {translate(language, expense.type)}
          </span>
          <span className={getKindClassName(expense.kind)}>
            {translate(language, expense.kind)}
          </span>
        </div>
        {hideDate ? null : (
          <p className="mt-1 text-xs text-[var(--muted)]">{getExpenseMeta(expense)}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className={getAmountClassName(expense)}>
          {showSigns ? getAmountSign(expense) : ""}
          {formatCurrency(expense.amount)}
        </div>
        {onDeleteExpense ? (
          <button
            aria-label={`Delete ${expense.note}`}
            className="grid size-7 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--danger)] sm:size-8"
            onClick={() => handleDeleteClick(expense, language, onDeleteExpense)}
            type="button"
          >
            <TrashIcon />
          </button>
        ) : null}
      </div>
    </article>
  )
}

function handleDeleteClick(
  expense: Expense,
  language: Language,
  onDeleteExpense: (expenseId: string) => void
) {
  const shouldDelete = window.confirm(`${translate(language, "deleteConfirmPrefix")} "${expense.note}"?`)

  if (shouldDelete) {
    onDeleteExpense(expense.id)
  }
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  )
}

function groupExpensesByDate(expenses: ReadonlyArray<Expense>): Array<{
  date: string
  expenses: Expense[]
}> {
  const groups = new Map<string, Expense[]>()

  for (const expense of expenses) {
    groups.set(expense.date, [...(groups.get(expense.date) ?? []), expense])
  }

  return Array.from(groups.entries())
    .map(([date, items]) => ({ date, expenses: items }))
    .sort((left, right) => right.date.localeCompare(left.date))
}

function getExpenseMeta(expense: Expense): string {
  return formatDisplayDate(expense.date)
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
  return `min-w-20 text-right text-sm font-semibold leading-none sm:min-w-24 ${color}`
}

function getAmountSign(expense: Expense): string {
  return expense.kind === "income" ? "+" : "-"
}

function getGroupSubtotalClassName(expenses: ReadonlyArray<Expense>): string {
  const color = sumNetAmount(expenses) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
  return `text-right text-xs font-semibold ${color}`
}

function formatSubtotal(expenses: ReadonlyArray<Expense>, showSigns: boolean): string {
  if (showSigns) {
    return formatCurrency(sumNetAmount(expenses))
  }

  return formatCurrency(expenses.reduce((total, expense) => total + expense.amount, 0))
}
