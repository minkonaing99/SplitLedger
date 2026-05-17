"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  sumNetAmount,
  sumNetAmountByPaymentMethod
} from "@/lib/expenses"
import {
  languageStorageKey,
  translate,
  type Language
} from "@/lib/i18n"
import { users } from "@/lib/mock-data"
import type { Expense, ExpenseInput, User } from "@/lib/types"

type View = "home" | "business" | "personal" | "add" | "reports"

const navigation: { id: View; label: string }[] = [
  { id: "home", label: "home" },
  { id: "business", label: "business" },
  { id: "personal", label: "personal" },
  { id: "add", label: "addTransaction" },
  { id: "reports", label: "reports" }
]

const expenseCacheKey = "splitledger_visible_expenses"
const userCacheKey = "splitledger_current_user"

export function AppShell() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeView, setActiveView] = useState<View>("home")
  const [openEntryType, setOpenEntryType] = useState<Expense["type"] | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [language, setLanguage] = useState<Language>("en")
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [isBooting, setIsBooting] = useState(true)
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const lastAutoRefreshAt = useRef(0)
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
    const storedLanguage = window.localStorage.getItem(languageStorageKey)

    if (storedLanguage === "en" || storedLanguage === "my") {
      setLanguage(storedLanguage)
    }

    void loadCurrentUser()
  }, [])

  useEffect(() => {
    setIsOnline(navigator.onLine)

    function handleOnline() {
      setIsOnline(true)
      if (currentUserId) {
        void loadExpenses(currentUserId)
      }
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [currentUserId])

  useEffect(() => {
    function refreshVisibleData() {
      const now = Date.now()

      if (
        !currentUserId ||
        !navigator.onLine ||
        now - lastAutoRefreshAt.current < 15000
      ) {
        return
      }

      lastAutoRefreshAt.current = now
      void loadExpenses(currentUserId)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshVisibleData()
      }
    }

    window.addEventListener("focus", refreshVisibleData)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", refreshVisibleData)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [currentUserId])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage)
    window.localStorage.setItem(languageStorageKey, nextLanguage)
  }

  function handleChangeView(view: View) {
    setOpenEntryType(null)
    setActiveView(view)
  }

  function handleStartEntry(type: Expense["type"]) {
    setOpenEntryType(type)
    setActiveView(type)
  }

  async function loadCurrentUser() {
    const cachedUser = readCachedUser()

    if (!navigator.onLine) {
      if (cachedUser) {
        setCurrentUser(cachedUser)
        setIsBooting(false)
        void loadExpenses(cachedUser.id)
        return
      }
    }

    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store"
      })

      if (!response.ok) {
        setCurrentUser(null)
        setIsBooting(false)
        return
      }

      const result = (await response.json()) as { user: User }
      setCurrentUser(result.user)
      writeCachedUser(result.user)
      setIsBooting(false)
      void loadExpenses(result.user.id)
      return
    } catch {
      if (cachedUser) {
        setCurrentUser(cachedUser)
        setError(translate(language, "offlineReadOnly"))
        setIsBooting(false)
        void loadExpenses(cachedUser.id)
        return
      }
    }

    setIsBooting(false)
  }

  async function loadExpenses(userId = currentUserId) {
    if (!navigator.onLine) {
      const cachedExpenses = readCachedExpenses(userId)

      if (cachedExpenses.length > 0) {
        setExpenses(cachedExpenses)
        setError(null)
      } else {
        setError(translate(language, "offlineReadOnly"))
      }

      setIsLoadingExpenses(false)
      return
    }

    setIsLoadingExpenses(true)
    setError(null)

    try {
      const response = await fetch("/api/expenses", {
        cache: "no-store"
      })
      const result = (await response.json()) as { error?: string; expenses?: Expense[] }

      if (!response.ok || !result.expenses) {
        setError(result.error ?? "Unable to load expenses.")
        setIsLoadingExpenses(false)
        return
      }

      setExpenses(result.expenses)
      writeCachedExpenses(userId, result.expenses)
    } catch {
      const cachedExpenses = readCachedExpenses(userId)

      if (cachedExpenses.length > 0) {
        setExpenses(cachedExpenses)
        setError(translate(language, "offlineReadOnly"))
      } else {
        setError("Unable to load expenses.")
      }
    } finally {
      setIsLoadingExpenses(false)
    }
  }

  if (isBooting) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-sm text-[var(--muted)]">
        {translate(language, "loadingSecureSession")}
      </main>
    )
  }

  if (!currentUser) {
    return (
      <LoginScreen
        language={language}
        onLanguageChange={handleLanguageChange}
        onLogin={async (user) => {
          setCurrentUser(user)
          writeCachedUser(user)
          await loadExpenses(user.id)
        }}
      />
    )
  }

  async function handleAddExpense(input: ExpenseInput) {
    if (!isOnline) {
      throw new Error(translate(language, "offlineReadOnly"))
    }

    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: input.type,
        kind: input.kind,
        paymentMethod: input.paymentMethod,
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
    setOpenEntryType(null)
    setNotice(translate(language, "transactionSaved"))
    setActiveView(input.type === "business" ? "business" : "personal")
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!isOnline) {
      setError(translate(language, "offlineReadOnly"))
      return
    }

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
    setNotice(translate(language, "deletedTransaction"))
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST"
    })
    setCurrentUser(null)
    setExpenses([])
    window.localStorage.removeItem(userCacheKey)
    setActiveView("home")
  }

  async function handleRefresh() {
    window.scrollTo({ top: 0, behavior: "smooth" })
    await loadExpenses(currentUserId)
  }

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[240px_1fr_320px]">
      <aside className="hidden border-r border-[var(--line)] bg-[var(--surface)] p-4 lg:block">
        <div className="mb-8">
          <Logo />
        </div>
        <Navigation activeView={activeView} language={language} onChange={handleChangeView} />
      </aside>

      <section className="pb-24 lg:pb-0">
        <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
            <div className="min-w-0">
              <h1 className="max-w-44 text-xl font-semibold leading-tight sm:max-w-none sm:text-2xl">
                {getPageTitle(activeView, language)}
              </h1>
              <p className="mt-1 truncate text-xs text-[var(--muted)] sm:text-sm">
                {translate(language, "signedInAs")} {currentUser.name}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                aria-label={translate(language, "refresh")}
                className="hidden h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)] disabled:cursor-not-allowed disabled:opacity-50 lg:flex"
                disabled={isLoadingExpenses}
                onClick={handleRefresh}
                title={translate(language, "refresh")}
                type="button"
              >
                <RefreshIcon />
                <span className="hidden xl:inline">{translate(language, "refresh")}</span>
              </button>
              <LanguageSwitcher language={language} onChange={handleLanguageChange} />
              <button
                aria-label={translate(language, "signOut")}
                className="grid size-10 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-sm font-medium hover:bg-[var(--surface-muted)] sm:w-auto sm:px-3"
                onClick={handleLogout}
                type="button"
              >
                <span className="hidden sm:inline">{translate(language, "signOut")}</span>
                <LogOutIcon />
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <Stack>
            {error ? (
              <div className="rounded-md bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="rounded-md bg-[var(--success-soft)] px-3 py-2 text-sm font-medium text-[var(--success)]">
                {notice}
              </div>
            ) : null}
            {!isOnline ? (
              <div className="rounded-md bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--muted)]">
                {translate(language, "offlineReadOnly")}
              </div>
            ) : null}
            {isLoadingExpenses ? (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
                {translate(language, "loadingExpenses")}
              </div>
            ) : (
              renderView({
                activeView,
                expenses,
                isOnline,
                language,
                visibleExpenses,
                currentUserId,
                totals,
                openEntryType,
                onChangeView: handleChangeView,
                onAddExpense: handleAddExpense,
                onDeleteExpense: handleDeleteExpense,
                onStartEntry: handleStartEntry
              })
            )}
          </Stack>
        </div>
      </section>

      <aside className="hidden border-l border-[var(--line)] bg-[var(--surface)] p-5 lg:block">
        <RightSummary
          businessCount={totals.businessCount}
          businessTotal={totals.businessMonth}
          language={language}
          personalTotal={totals.personalMonth}
        />
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--surface)] p-2 lg:hidden">
        <Navigation activeView={activeView} language={language} mobile onChange={handleChangeView} />
      </nav>
    </main>
  )
}

interface RenderViewArgs {
  activeView: View
  expenses: ReadonlyArray<Expense>
  isOnline: boolean
  visibleExpenses: ReadonlyArray<Expense>
  currentUserId: string
  language: Language
  totals: ReturnType<typeof calculateDashboardTotals>
  openEntryType: Expense["type"] | null
  onChangeView: (view: View) => void
  onAddExpense: (input: ExpenseInput) => Promise<void>
  onDeleteExpense: (expenseId: string) => Promise<void>
  onStartEntry: (type: Expense["type"]) => void
}

function renderView({
  activeView,
  expenses,
  isOnline,
  visibleExpenses,
  currentUserId,
  language,
  totals,
  openEntryType,
  onChangeView,
  onAddExpense,
  onDeleteExpense,
  onStartEntry
}: RenderViewArgs) {
  if (activeView === "business") {
    const businessExpenses = expenses.filter((expense) => expense.type === "business")
    return (
      <Stack>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            detail={translate(language, "businessNet")}
            label={translate(language, "allTotal")}
            tone="business"
            value={formatCurrency(sumNetAmount(businessExpenses))}
          />
          <SummaryCard
            detail={translate(language, "cash")}
            label={translate(language, "cashBalance")}
            value={formatCurrency(sumNetAmountByPaymentMethod(businessExpenses, "cash"))}
          />
          <SummaryCard
            detail={translate(language, "kpay")}
            label={translate(language, "kpayBalance")}
            value={formatCurrency(sumNetAmountByPaymentMethod(businessExpenses, "kpay"))}
          />
          <SummaryCard
            detail={translate(language, "incomingCash")}
            label={translate(language, "income")}
            value={formatCurrency(sumIncome(businessExpenses))}
          />
          <SummaryCard
            detail={translate(language, "outgoingCash")}
            label={translate(language, "expenses")}
            tone="personal"
            value={formatCurrency(sumExpenseOutflow(businessExpenses))}
          />
        </div>
        <TransactionEntry
          currentUserId={currentUserId}
          fixedType="business"
          defaultOpen={openEntryType === "business"}
          isOnline={isOnline}
          language={language}
          onAddExpense={onAddExpense}
        />
        <FilteredTransactionsPanel
          expenses={businessExpenses}
          isOnline={isOnline}
          language={language}
          onDeleteExpense={onDeleteExpense}
          title={translate(language, "businessTransactions")}
        />
      </Stack>
    )
  }

  if (activeView === "personal") {
    const personalExpenses = visibleExpenses.filter((expense) => expense.type === "personal")
    return (
      <Stack>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            detail={translate(language, "personalNet")}
            label={translate(language, "allTotal")}
            tone="personal"
            value={formatCurrency(sumNetAmount(personalExpenses))}
          />
          <SummaryCard
            detail={translate(language, "income")}
            label={translate(language, "income")}
            value={formatCurrency(sumIncome(personalExpenses))}
          />
          <SummaryCard
            detail={translate(language, "personalSpending")}
            label={translate(language, "expenses")}
            tone="personal"
            value={formatCurrency(sumExpenseOutflow(personalExpenses))}
          />
        </div>
        <TransactionEntry
          currentUserId={currentUserId}
          fixedType="personal"
          defaultOpen={openEntryType === "personal"}
          isOnline={isOnline}
          language={language}
          onAddExpense={onAddExpense}
        />
        <FilteredTransactionsPanel
          expenses={personalExpenses}
          isOnline={isOnline}
          language={language}
          onDeleteExpense={onDeleteExpense}
          title={translate(language, "personalTransactions")}
        />
      </Stack>
    )
  }

  if (activeView === "add") {
    return (
      <Panel title={translate(language, "addTransaction")}>
        <AddExpenseForm
          currentUserId={currentUserId}
          isOnline={isOnline}
          language={language}
          onAddExpense={onAddExpense}
          users={users}
        />
      </Panel>
    )
  }

  if (activeView === "reports") {
    return <ReportsView currentUserId={currentUserId} expenses={expenses} language={language} />
  }

  return (
    <HomeView
      onChangeView={onChangeView}
      onStartEntry={onStartEntry}
      language={language}
      isOnline={isOnline}
      onDeleteExpense={onDeleteExpense}
      totals={totals}
      visibleExpenses={visibleExpenses}
    />
  )
}

function HomeView({
  onChangeView,
  onStartEntry,
  isOnline,
  language,
  onDeleteExpense,
  totals,
  visibleExpenses
}: {
  onChangeView: (view: View) => void
  onStartEntry: (type: Expense["type"]) => void
  isOnline: boolean
  language: Language
  onDeleteExpense: (expenseId: string) => Promise<void>
  totals: ReturnType<typeof calculateDashboardTotals>
  visibleExpenses: ReadonlyArray<Expense>
}) {
  const monthTransactions = getCurrentMonthTransactions(visibleExpenses)
  const monthNet = sumNetAmount(monthTransactions)
  const monthIncome = sumIncome(monthTransactions)
  const monthOutflow = sumExpenseOutflow(monthTransactions)

  return (
    <Stack>
      <DashboardHero
        income={monthIncome}
        language={language}
        net={monthNet}
        onAddBusiness={() => onStartEntry("business")}
        onAddPersonal={() => onStartEntry("personal")}
        onViewReports={() => onChangeView("reports")}
        outflow={monthOutflow}
        today={totals.today}
      />

      <section className="grid gap-3 sm:grid-cols-2">
        <HomeAction
          detail={translate(language, "sharedLedger")}
          label={translate(language, "business")}
          onClick={() => onChangeView("business")}
        />
        <HomeAction
          detail={translate(language, "personalNet")}
          label={translate(language, "personal")}
          onClick={() => onChangeView("personal")}
        />
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">{translate(language, "recentTransactions")}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {translate(language, "latestTransactions")}
            </p>
          </div>
          <button
            className="h-9 rounded-md border border-[var(--line)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
            onClick={() => onChangeView("business")}
            type="button"
          >
            {translate(language, "openLedger")}
          </button>
        </div>
        <ExpenseList
          expenses={visibleExpenses.slice(0, 6)}
          isOnline={isOnline}
          language={language}
          onDeleteExpense={onDeleteExpense}
        />
      </section>
    </Stack>
  )
}

function DashboardHero({
  income,
  language,
  net,
  onAddBusiness,
  onAddPersonal,
  onViewReports,
  outflow,
  today
}: {
  income: number
  language: Language
  net: number
  onAddBusiness: () => void
  onAddPersonal: () => void
  onViewReports: () => void
  outflow: number
  today: number
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        <div>
          <div className="text-xs font-semibold uppercase text-[var(--muted)]">
            {translate(language, "monthSnapshot")}
          </div>
          <div className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
            {formatCompactCurrency(net)}
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {translate(language, "netPosition")} - {translate(language, "businessAndPersonal")}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MiniMetric
              label={translate(language, "income")}
              tone="success"
              value={formatCompactCurrency(income)}
            />
            <MiniMetric
              label={translate(language, "expenses")}
              tone="danger"
              value={formatCompactCurrency(outflow)}
            />
            <MiniMetric
              label={translate(language, "todayMovement")}
              tone={today >= 0 ? "success" : "danger"}
              value={formatCompactCurrency(today)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <button
            className="h-10 rounded-md bg-[var(--text)] px-4 text-sm font-semibold text-[var(--surface)] hover:opacity-90 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)]"
            onClick={onAddBusiness}
            type="button"
          >
            {translate(language, "addBusiness")}
          </button>
          <button
            className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-muted)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)]"
            onClick={onAddPersonal}
            type="button"
          >
            {translate(language, "addPersonal")}
          </button>
          <button
            className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)]"
            onClick={onViewReports}
            type="button"
          >
            {translate(language, "viewReports")}
          </button>
        </div>
      </div>
    </section>
  )
}

function MiniMetric({
  label,
  tone,
  value
}: {
  label: string
  tone: "danger" | "success"
  value: string
}) {
  const toneClassName = tone === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"

  return (
    <div className="rounded-md bg-[var(--surface-muted)] p-3">
      <div className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</div>
      <div className={`mt-1 text-base font-semibold ${toneClassName}`}>{value}</div>
    </div>
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

type TransactionFilter = "expense" | "income" | "all"

const transactionFilters: { id: TransactionFilter; label: string }[] = [
  { id: "expense", label: "expenses" },
  { id: "income", label: "income" },
  { id: "all", label: "all" }
]

function FilteredTransactionsPanel({
  expenses,
  isOnline,
  language,
  onDeleteExpense,
  title
}: {
  expenses: ReadonlyArray<Expense>
  isOnline: boolean
  language: Language
  onDeleteExpense: (expenseId: string) => Promise<void>
  title: string
}) {
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>("expense")
  const monthOptions = getMonthOptions(expenses, language)
  const [activeMonth, setActiveMonth] = useState(getDefaultMonth(monthOptions))
  const filteredExpenses = filterTransactionsByMonth(
    filterTransactions(expenses, activeFilter),
    activeMonth
  )

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {filteredExpenses.length}{" "}
            {translate(language, filteredExpenses.length === 1 ? "record" : "records")}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className="h-9 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium outline-none focus:border-[var(--business)] sm:h-10"
            onChange={(event) => setActiveMonth(event.target.value)}
            value={activeMonth}
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-1">
            {transactionFilters.map((filter) => (
              <button
                className={getFilterButtonClassName(activeFilter === filter.id)}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                {translate(language, filter.label)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ExpenseList
        expenses={filteredExpenses}
        groupByDate
        isOnline={isOnline}
        language={language}
        onDeleteExpense={onDeleteExpense}
        showSigns={activeFilter === "all"}
      />
    </section>
  )
}

function filterTransactionsByMonth(
  expenses: ReadonlyArray<Expense>,
  activeMonth: string
): Expense[] {
  return expenses.filter((expense) => expense.date.startsWith(activeMonth))
}

function filterTransactions(
  expenses: ReadonlyArray<Expense>,
  activeFilter: TransactionFilter
): Expense[] {
  if (activeFilter === "all") {
    return [...expenses]
  }

  return expenses.filter((expense) => expense.kind === activeFilter)
}

function getMonthOptions(expenses: ReadonlyArray<Expense>, language: Language): Array<{
  label: string
  value: string
}> {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthKeys = new Set([currentMonth])

  for (const expense of expenses) {
    monthKeys.add(expense.date.slice(0, 7))
  }

  return Array.from(monthKeys)
    .sort((left, right) => right.localeCompare(left))
    .map((monthKey) => ({
      label: formatMonthLabel(monthKey, language),
      value: monthKey
    }))
}

function getDefaultMonth(monthOptions: ReadonlyArray<{ value: string }>): string {
  return monthOptions[0]?.value ?? new Date().toISOString().slice(0, 7)
}

function formatMonthLabel(monthKey: string, language: Language = "en"): string {
  const [year, month] = monthKey.split("-")
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ]
  const burmeseMonthNames = [
    "ဇန်နဝါရီ",
    "ဖေဖော်ဝါရီ",
    "မတ်",
    "ဧပြီ",
    "မေ",
    "ဇွန်",
    "ဇူလိုင်",
    "ဩဂုတ်",
    "စက်တင်ဘာ",
    "အောက်တိုဘာ",
    "နိုဝင်ဘာ",
    "ဒီဇင်ဘာ"
  ]
  const labels = language === "my" ? burmeseMonthNames : monthNames
  const monthName = labels[Number(month) - 1] ?? monthKey

  return monthName
}

function getFilterButtonClassName(isActive: boolean): string {
  const base = "h-8 rounded px-2 text-xs font-semibold transition-colors sm:px-3"
  const state = isActive
    ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
    : "text-[var(--muted)] hover:text-[var(--text)]"

  return `${base} ${state}`
}

function getCurrentMonthTransactions(expenses: ReadonlyArray<Expense>): Expense[] {
  const monthKey = new Date().toISOString().slice(0, 7)
  return expenses.filter((expense) => expense.date.startsWith(monthKey))
}

function TransactionEntry({
  currentUserId,
  defaultOpen = false,
  fixedType,
  isOnline,
  language,
  onAddExpense
}: {
  currentUserId: string
  defaultOpen?: boolean
  fixedType: "business" | "personal"
  isOnline: boolean
  language: Language
  onAddExpense: (input: ExpenseInput) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const label = fixedType === "business" ? translate(language, "business") : translate(language, "personal")

  async function handleAddExpense(input: ExpenseInput) {
    await onAddExpense(input)
    setIsOpen(false)
  }

  if (isOpen) {
    return (
      <Panel
        title={
          fixedType === "business"
            ? translate(language, "addBusinessTransaction")
            : translate(language, "addPersonalTransaction")
        }
      >
        <AddExpenseForm
          currentUserId={currentUserId}
          fixedType={fixedType}
          isOnline={isOnline}
          language={language}
          onAddExpense={handleAddExpense}
          users={users}
        />
      </Panel>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div>
        <h2 className="text-base font-semibold">
          {label} {translate(language, "transactions")}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {translate(language, "addIncomeOrExpense")}
        </p>
      </div>
      <button
        className="h-10 rounded-md bg-[var(--text)] px-4 text-sm font-semibold text-[var(--surface)] hover:opacity-90 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!isOnline}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {translate(language, "addTransaction")}
      </button>
    </section>
  )
}

interface NavigationProps {
  activeView: View
  language: Language
  mobile?: boolean
  onChange: (view: View) => void
}

function Navigation({ activeView, language, mobile = false, onChange }: NavigationProps) {
  return (
    <div className={mobile ? "grid grid-cols-5 gap-1" : "space-y-1"}>
      {navigation.map((item) => {
        const label = translate(language, item.label)

        return (
          <button
            aria-label={label}
            className={getNavigationClassName(activeView === item.id, mobile)}
            key={item.id}
            onClick={() => onChange(item.id)}
            title={label}
            type="button"
          >
            {mobile ? (
              <>
                <NavigationIcon view={item.id} />
                <span className="mt-1 max-w-full truncate text-[0.625rem] font-semibold leading-none">
                  {label}
                </span>
              </>
            ) : (
              label
            )}
          </button>
        )
      })}
    </div>
  )
}

function NavigationIcon({ view }: { view: View }) {
  const iconClassName = "size-5"

  if (view === "home") {
    return (
      <svg aria-hidden="true" className={iconClassName} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10.5V20h14v-9.5" />
        <path d="M9 20v-6h6v6" />
      </svg>
    )
  }

  if (view === "business") {
    return (
      <svg aria-hidden="true" className={iconClassName} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 7V5h6v2" />
        <path d="M4 7h16v13H4z" />
        <path d="M4 12h16" />
        <path d="M10 12v2h4v-2" />
      </svg>
    )
  }

  if (view === "personal") {
    return (
      <svg aria-hidden="true" className={iconClassName} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="8" r="4" />
      </svg>
    )
  }

  if (view === "add") {
    return (
      <svg aria-hidden="true" className={iconClassName} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" className={iconClassName} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-5" />
      <path d="M12 16V8" />
      <path d="M16 16v-3" />
    </svg>
  )
}

function LogOutIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 sm:hidden"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M21 19V5" />
    </svg>
  )
}

function RefreshIcon() {
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
      <path d="M20 11a8.1 8.1 0 0 0-15.5-2" />
      <path d="M4 5v4h4" />
      <path d="M4 13a8.1 8.1 0 0 0 15.5 2" />
      <path d="M20 19v-4h-4" />
    </svg>
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
  language,
  personalTotal
}: {
  businessCount: number
  businessTotal: number
  language: Language
  personalTotal: number
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">{translate(language, "sharedLedger")}</h2>
      </div>
      <SummaryCard
        label={translate(language, "businessMonth")}
        tone="business"
        value={formatCurrency(businessTotal)}
      />
      <SummaryCard
        label={translate(language, "personalMonth")}
        tone="personal"
        value={formatCurrency(personalTotal)}
      />
    </div>
  )
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 sm:space-y-5">{children}</div>
}

function getNavigationClassName(isActive: boolean, mobile: boolean): string {
  const base =
    "rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)]"
  const size = mobile
    ? "grid min-h-14 place-items-center overflow-hidden"
    : "w-full text-left"
  const state = isActive
    ? "bg-[var(--text)] text-[var(--surface)]"
    : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"

  return `${base} ${size} ${state}`
}

function LanguageSwitcher({
  language,
  onChange
}: {
  language: Language
  onChange: (language: Language) => void
}) {
  const nextLanguage = language === "en" ? "my" : "en"
  const label = language === "en" ? "EN" : "မြန်"
  const nextLabel = nextLanguage === "en" ? "English" : "မြန်မာ"

  return (
    <button
      aria-label={`Switch language to ${nextLabel}`}
      className="grid h-10 min-w-14 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold hover:bg-[var(--surface-muted)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)]"
      onClick={() => onChange(nextLanguage)}
      title={`Switch to ${nextLabel}`}
      type="button"
    >
      {label}
    </button>
  )
}

function getPageTitle(view: View, language: Language): string {
  const titleKeys: Record<View, string> = {
    home: "home",
    business: "businessTransactions",
    personal: "personalTransactions",
    add: "addTransaction",
    reports: "reports"
  }

  return translate(language, titleKeys[view])
}

function readCachedExpenses(userId: string): Expense[] {
  if (!userId) {
    return []
  }

  try {
    const encodedExpenses = window.localStorage.getItem(`${expenseCacheKey}:${userId}`)
    const expenses = encodedExpenses ? JSON.parse(encodedExpenses) : []
    return Array.isArray(expenses) ? expenses.filter(isExpense) : []
  } catch {
    return []
  }
}

function writeCachedExpenses(userId: string, expenses: ReadonlyArray<Expense>): void {
  if (!userId) {
    return
  }

  window.localStorage.setItem(`${expenseCacheKey}:${userId}`, JSON.stringify(expenses))
}

function readCachedUser(): User | null {
  try {
    const encodedUser = window.localStorage.getItem(userCacheKey)
    const user = encodedUser ? JSON.parse(encodedUser) : null
    return isUser(user) ? user : null
  } catch {
    return null
  }
}

function writeCachedUser(user: User): void {
  window.localStorage.setItem(userCacheKey, JSON.stringify(user))
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== "object") {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.email === "string"
  )
}

function isExpense(value: unknown): value is Expense {
  if (!value || typeof value !== "object") {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    (record.type === "business" || record.type === "personal") &&
    (record.kind === "expense" || record.kind === "income") &&
    typeof record.amount === "number" &&
    typeof record.paidByUserId === "string" &&
    typeof record.ownerUserId === "string" &&
    typeof record.date === "string" &&
    typeof record.note === "string"
  )
}
