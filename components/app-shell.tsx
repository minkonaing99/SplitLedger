"use client"

import { useEffect, useMemo, useState } from "react"
import { AddExpenseForm } from "@/components/add-expense-form"
import { ExpenseList } from "@/components/expense-list"
import { LoginScreen } from "@/components/login-screen"
import { Logo } from "@/components/logo"
import { ReportsView } from "@/components/reports-view"
import { SummaryCard } from "@/components/summary-card"
import {
  calculateDashboardTotals,
  formatCompactCurrency,
  formatCurrency,
  getVisibleExpenses,
  sumExpenseOutflow,
  sumIncome,
  sumNetAmount
} from "@/lib/expenses"
import { users } from "@/lib/mock-data"
import type { Expense, ExpenseInput, User } from "@/lib/types"

type View = "home" | "business" | "personal" | "add" | "reports"

const navigation: { id: View; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "business", label: "Business" },
  { id: "personal", label: "Personal" },
  { id: "add", label: "Add" },
  { id: "reports", label: "Reports" }
]

export function AppShell() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeView, setActiveView] = useState<View>("home")
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isBooting, setIsBooting] = useState(true)
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false)
  const currentUserId = currentUser?.id ?? ""
  const visibleExpenses = useMemo(
    () => getVisibleExpenses(expenses, currentUserId),
    [expenses, currentUserId]
  )
  const totals = useMemo(
    () => calculateDashboardTotals(expenses, currentUserId, new Date()),
    [expenses, currentUserId]
  )

  useEffect(() => {
    void loadCurrentUser()
  }, [])

  async function loadCurrentUser() {
    const response = await fetch("/api/auth/me")

    if (!response.ok) {
      setCurrentUser(null)
      setIsBooting(false)
      return
    }

    const result = (await response.json()) as { user: User }
    setCurrentUser(result.user)
    setIsBooting(false)
    await loadExpenses()
  }

  async function loadExpenses() {
    setIsLoadingExpenses(true)
    setError(null)

    const response = await fetch("/api/expenses")
    const result = (await response.json()) as { error?: string; expenses?: Expense[] }

    if (!response.ok || !result.expenses) {
      setError(result.error ?? "Unable to load expenses.")
      setIsLoadingExpenses(false)
      return
    }

    setExpenses(result.expenses)
    setIsLoadingExpenses(false)
  }

  if (isBooting) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-sm text-[var(--muted)]">
        Loading secure session...
      </main>
    )
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={async (user) => {
          setCurrentUser(user)
          await loadExpenses()
        }}
      />
    )
  }

  async function handleAddExpense(input: ExpenseInput) {
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: input.type,
        kind: input.kind,
        amount: input.amount,
        date: input.date,
        note: input.note
      })
    })
    const result = (await response.json()) as { error?: string; expense?: Expense }

    if (!response.ok || !result.expense) {
      throw new Error(result.error ?? "Unable to add expense.")
    }

    const expense = result.expense
    setExpenses((currentExpenses) => [expense, ...currentExpenses])
    setActiveView(input.type === "business" ? "business" : "personal")
  }

  async function handleDeleteExpense(expenseId: string) {
    const response = await fetch(`/api/expenses/${expenseId}`, {
      method: "DELETE"
    })

    if (!response.ok) {
      const result = (await response.json()) as { error?: string }
      setError(result.error ?? "Unable to delete expense.")
      return
    }

    setExpenses((currentExpenses) =>
      currentExpenses.filter((expense) => expense.id !== expenseId)
    )
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST"
    })
    setCurrentUser(null)
    setExpenses([])
    setActiveView("home")
  }

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[240px_1fr_320px]">
      <aside className="hidden border-r border-[var(--line)] bg-[var(--surface)] p-4 lg:block">
        <div className="mb-8">
          <Logo />
          <p className="mt-1 text-sm text-[var(--muted)]">Two-person expense control.</p>
        </div>
        <Navigation activeView={activeView} onChange={setActiveView} />
      </aside>

      <section className="pb-24 lg:pb-0">
        <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--background)]/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{getPageTitle(activeView)}</h1>
              <p className="text-sm text-[var(--muted)]">Signed in as {currentUser.name}</p>
            </div>
            <button
              className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
              onClick={handleLogout}
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          <Stack>
            {error ? (
              <div className="rounded-md bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
                {error}
              </div>
            ) : null}
            {isLoadingExpenses ? (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
                Loading expenses...
              </div>
            ) : (
              renderView({
                activeView,
                expenses,
                visibleExpenses,
                currentUserId,
                totals,
                onChangeView: setActiveView,
                onAddExpense: handleAddExpense,
                onDeleteExpense: handleDeleteExpense
              })
            )}
          </Stack>
        </div>
      </section>

      <aside className="hidden border-l border-[var(--line)] bg-[var(--surface)] p-5 lg:block">
        <RightSummary
          businessCount={totals.businessCount}
          businessTotal={totals.businessMonth}
          personalTotal={totals.personalMonth}
        />
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--surface)] p-2 lg:hidden">
        <Navigation activeView={activeView} mobile onChange={setActiveView} />
      </nav>
    </main>
  )
}

interface RenderViewArgs {
  activeView: View
  expenses: ReadonlyArray<Expense>
  visibleExpenses: ReadonlyArray<Expense>
  currentUserId: string
  totals: ReturnType<typeof calculateDashboardTotals>
  onChangeView: (view: View) => void
  onAddExpense: (input: ExpenseInput) => Promise<void>
  onDeleteExpense: (expenseId: string) => Promise<void>
}

function renderView({
  activeView,
  expenses,
  visibleExpenses,
  currentUserId,
  totals,
  onChangeView,
  onAddExpense,
  onDeleteExpense
}: RenderViewArgs) {
  if (activeView === "business") {
    const businessExpenses = expenses.filter((expense) => expense.type === "business")
    return (
      <Stack>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            detail="Business net"
            label="All total"
            tone="business"
            value={formatCurrency(sumNetAmount(businessExpenses))}
          />
          <SummaryCard
            detail="Incoming cash"
            label="Income"
            value={formatCurrency(sumIncome(businessExpenses))}
          />
          <SummaryCard
            detail="Outgoing cash"
            label="Expenses"
            tone="personal"
            value={formatCurrency(sumExpenseOutflow(businessExpenses))}
          />
        </div>
        <TransactionEntry
          currentUserId={currentUserId}
          fixedType="business"
          onAddExpense={onAddExpense}
        />
        <Panel title="Daily subtotals">
          <DailySubtotals expenses={businessExpenses} />
        </Panel>
        <Panel title="Business transactions">
          <ExpenseList
            expenses={businessExpenses}
            onDeleteExpense={onDeleteExpense}
          />
        </Panel>
      </Stack>
    )
  }

  if (activeView === "personal") {
    const personalExpenses = visibleExpenses.filter((expense) => expense.type === "personal")
    return (
      <Stack>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            detail="Personal net"
            label="All total"
            tone="personal"
            value={formatCurrency(sumNetAmount(personalExpenses))}
          />
          <SummaryCard
            detail="Personal income"
            label="Income"
            value={formatCurrency(sumIncome(personalExpenses))}
          />
          <SummaryCard
            detail="Personal spending"
            label="Expenses"
            tone="personal"
            value={formatCurrency(sumExpenseOutflow(personalExpenses))}
          />
        </div>
        <TransactionEntry
          currentUserId={currentUserId}
          fixedType="personal"
          onAddExpense={onAddExpense}
        />
        <Panel title="Daily subtotals">
          <DailySubtotals expenses={personalExpenses} />
        </Panel>
        <Panel title="Personal transactions">
          <ExpenseList
            expenses={personalExpenses}
            onDeleteExpense={onDeleteExpense}
          />
        </Panel>
      </Stack>
    )
  }

  if (activeView === "add") {
    return (
      <Panel title="Add expense">
        <AddExpenseForm currentUserId={currentUserId} onAddExpense={onAddExpense} users={users} />
      </Panel>
    )
  }

  if (activeView === "reports") {
    return <ReportsView currentUserId={currentUserId} expenses={expenses} />
  }

  return (
    <HomeView
      onChangeView={onChangeView}
      onDeleteExpense={onDeleteExpense}
      totals={totals}
      visibleExpenses={visibleExpenses}
    />
  )
}

function HomeView({
  onChangeView,
  onDeleteExpense,
  totals,
  visibleExpenses
}: {
  onChangeView: (view: View) => void
  onDeleteExpense: (expenseId: string) => Promise<void>
  totals: ReturnType<typeof calculateDashboardTotals>
  visibleExpenses: ReadonlyArray<Expense>
}) {
  const monthTransactions = getCurrentMonthTransactions(visibleExpenses)

  return (
    <Stack>
      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">This month</h2>
            <p className="text-sm text-[var(--muted)]">Net cashflow across visible accounts.</p>
          </div>
          <button
            className="h-9 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
            onClick={() => onChangeView("reports")}
            type="button"
          >
            View reports
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            detail="Business and personal"
            label="Month net"
            tone="business"
            value={formatCompactCurrency(sumNetAmount(monthTransactions))}
          />
          <SummaryCard
            detail="Incoming cash"
            label="Income"
            value={formatCompactCurrency(sumIncome(monthTransactions))}
          />
          <SummaryCard
            detail="Outgoing cash"
            label="Expenses"
            tone="personal"
            value={formatCompactCurrency(sumExpenseOutflow(monthTransactions))}
          />
          <SummaryCard label="Today" value={formatCompactCurrency(totals.today)} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <HomeAction
          detail="Shared ledger"
          label="Business"
          onClick={() => onChangeView("business")}
        />
        <HomeAction
          detail="Only visible to you"
          label="Personal"
          onClick={() => onChangeView("personal")}
        />
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Recent transactions</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Latest income and expenses you can access.
            </p>
          </div>
          <button
            className="h-9 rounded-md border border-[var(--line)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
            onClick={() => onChangeView("business")}
            type="button"
          >
            Open ledger
          </button>
        </div>
        <ExpenseList
          expenses={visibleExpenses.slice(0, 6)}
          onDeleteExpense={onDeleteExpense}
        />
      </section>
    </Stack>
  )
}

function HomeAction({
  detail,
  label,
  onClick
}: {
  detail: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-left shadow-sm transition-colors hover:bg-[var(--surface-muted)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)]"
      onClick={onClick}
      type="button"
    >
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-1 text-sm text-[var(--muted)]">{detail}</div>
    </button>
  )
}

interface DailySubtotalRow {
  count: number
  date: string
  expenses: number
  income: number
  net: number
}

function DailySubtotals({ expenses }: { expenses: ReadonlyArray<Expense> }) {
  const rows = buildDailySubtotalRows(expenses)

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">
        No transactions for this view yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-[var(--line)] text-left text-xs font-semibold uppercase text-[var(--muted)]">
            <th className="py-2 pr-3">Date</th>
            <th className="px-3 py-2 text-right">Income</th>
            <th className="px-3 py-2 text-right">Expenses</th>
            <th className="px-3 py-2 text-center">Records</th>
            <th className="py-2 pl-3 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-[var(--line)] last:border-b-0" key={row.date}>
              <td className="py-3 pr-3 font-medium">{row.date}</td>
              <td className="px-3 py-3 text-right text-[var(--success)]">
                {formatCurrency(row.income)}
              </td>
              <td className="px-3 py-3 text-right">{formatCurrency(row.expenses)}</td>
              <td className="px-3 py-3 text-center">{row.count}</td>
              <td className={getSubtotalClassName(row.net)}>{formatCurrency(row.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function buildDailySubtotalRows(expenses: ReadonlyArray<Expense>): DailySubtotalRow[] {
  const rows = new Map<string, DailySubtotalRow>()

  for (const expense of expenses) {
    const current = rows.get(expense.date) ?? {
      count: 0,
      date: expense.date,
      expenses: 0,
      income: 0,
      net: 0
    }
    const isIncome = expense.kind === "income"

    rows.set(expense.date, {
      count: current.count + 1,
      date: expense.date,
      expenses: current.expenses + (isIncome ? 0 : expense.amount),
      income: current.income + (isIncome ? expense.amount : 0),
      net: current.net + (isIncome ? expense.amount : -expense.amount)
    })
  }

  return Array.from(rows.values()).sort((left, right) => right.date.localeCompare(left.date))
}

function getSubtotalClassName(amount: number): string {
  const color = amount >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
  return `py-3 pl-3 text-right font-semibold ${color}`
}

function getCurrentMonthTransactions(expenses: ReadonlyArray<Expense>): Expense[] {
  const monthKey = new Date().toISOString().slice(0, 7)
  return expenses.filter((expense) => expense.date.startsWith(monthKey))
}

function TransactionEntry({
  currentUserId,
  fixedType,
  onAddExpense
}: {
  currentUserId: string
  fixedType: "business" | "personal"
  onAddExpense: (input: ExpenseInput) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const label = fixedType === "business" ? "Business" : "Personal"

  async function handleAddExpense(input: ExpenseInput) {
    await onAddExpense(input)
    setIsOpen(false)
  }

  if (isOpen) {
    return (
      <Panel title={`Add ${fixedType} transaction`}>
        <AddExpenseForm
          currentUserId={currentUserId}
          fixedType={fixedType}
          onAddExpense={handleAddExpense}
          users={users}
        />
      </Panel>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-semibold">{label} transactions</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Add income or expense when needed.</p>
      </div>
      <button
        className="h-10 rounded-md bg-[var(--text)] px-4 text-sm font-semibold text-[var(--surface)] hover:opacity-90 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Add transaction
      </button>
    </section>
  )
}

interface NavigationProps {
  activeView: View
  mobile?: boolean
  onChange: (view: View) => void
}

function Navigation({ activeView, mobile = false, onChange }: NavigationProps) {
  return (
    <div className={mobile ? "grid grid-cols-5 gap-1" : "space-y-1"}>
      {navigation.map((item) => (
        <button
          className={getNavigationClassName(activeView === item.id, mobile)}
          key={item.id}
          onClick={() => onChange(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function Panel({
  children,
  title
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function RightSummary({
  businessCount,
  businessTotal,
  personalTotal
}: {
  businessCount: number
  businessTotal: number
  personalTotal: number
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Shared ledger</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Business data is one linked account for both users.
        </p>
      </div>
      <SummaryCard
        detail={`${businessCount} shared records`}
        label="Business month"
        tone="business"
        value={formatCurrency(businessTotal)}
      />
      <SummaryCard
        detail="Only visible to you"
        label="Personal month"
        tone="personal"
        value={formatCurrency(personalTotal)}
      />
    </div>
  )
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5">{children}</div>
}

function getNavigationClassName(isActive: boolean, mobile: boolean): string {
  const base =
    "rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)]"
  const size = mobile ? "min-h-11 text-xs" : "w-full text-left"
  const state = isActive
    ? "bg-[var(--text)] text-[var(--surface)]"
    : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"

  return `${base} ${size} ${state}`
}

function getPageTitle(view: View): string {
  const titles: Record<View, string> = {
    home: "Home",
    business: "Business expenses",
    personal: "Personal expenses",
    add: "Add expense",
    reports: "Reports"
  }

  return titles[view]
}
