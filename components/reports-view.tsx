"use client"

import { useEffect, useMemo, useState } from "react"
import { SummaryCard } from "@/components/summary-card"
import {
  formatCompactCurrency,
  formatCurrency,
  formatDisplayDate,
  getBusinessPaymentMethod,
  getNetAmount,
  getTransferPaymentMethods,
  sumExpenseOutflow,
  sumIncome,
  sumNetAmount,
  sumNetAmountByPaymentMethod,
  sumTransfers,
  toDateKey
} from "@/lib/expenses"
import { translate, type Language } from "@/lib/i18n"
import type { Expense, MonthlyClose } from "@/lib/types"

interface ReportsViewProps {
  currentUserId: string
  expenses: ReadonlyArray<Expense>
  language: Language
}

interface DailyReportRow {
  date: string
  business: number
  income: number
  expenses: number
  personal: number
  total: number
  count: number
}

interface TopExpenseRow {
  id: string
  date: string
  note: string
  type: Expense["type"]
  kind: Expense["kind"]
  paymentMethod?: Expense["paymentMethod"]
  transferFromPaymentMethod?: Expense["transferFromPaymentMethod"]
  transferToPaymentMethod?: Expense["transferToPaymentMethod"]
  amount: number
}

export function ReportsView({ currentUserId, expenses, language }: ReportsViewProps) {
  const defaultRange = useMemo(() => getDefaultRange(), [])
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [monthlyCloses, setMonthlyCloses] = useState<MonthlyClose[]>([])
  const [closeError, setCloseError] = useState<string | null>(null)
  const [isClosingMonth, setIsClosingMonth] = useState(false)

  const report = useMemo(
    () => buildReport(expenses, currentUserId, startDate, endDate),
    [currentUserId, endDate, expenses, startDate]
  )
  const activeMonthKey = startDate.slice(0, 7)
  const activeMonthlyClose = monthlyCloses.find((close) => close.monthKey === activeMonthKey)

  useEffect(() => {
    void loadMonthlyCloses()
  }, [])

  async function loadMonthlyCloses() {
    try {
      const response = await fetch("/api/monthly-closes", { cache: "no-store" })
      const result = (await response.json()) as {
        error?: string
        monthlyCloses?: MonthlyClose[]
      }

      if (response.ok && result.monthlyCloses) {
        setMonthlyCloses(result.monthlyCloses)
      }
    } catch {
      setCloseError("Unable to load monthly closes.")
    }
  }

  async function handleCloseMonth() {
    setIsClosingMonth(true)
    setCloseError(null)

    try {
      const response = await fetch("/api/monthly-closes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ monthKey: activeMonthKey })
      })
      const result = (await response.json()) as {
        error?: string
        monthlyClose?: MonthlyClose
      }

      if (!response.ok || !result.monthlyClose) {
        setCloseError(result.error ?? "Unable to close month.")
        return
      }

      setMonthlyCloses((currentCloses) => [
        result.monthlyClose as MonthlyClose,
        ...currentCloses.filter((close) => close.monthKey !== activeMonthKey)
      ])
    } catch {
      setCloseError("Unable to close month.")
    } finally {
      setIsClosingMonth(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-xl">
            <h2 className="text-base font-semibold">{translate(language, "reports")}</h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-[var(--muted)]">
              {translate(language, "reportsDescription")}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[145px_145px_auto] sm:items-end">
            <DateField label={translate(language, "from")} onChange={setStartDate} value={startDate} />
            <DateField label={translate(language, "to")} onChange={setEndDate} value={endDate} />
            <button
              className="h-10 rounded-md bg-[var(--text)] px-3 text-sm font-semibold text-[var(--surface)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={report.filteredExpenses.length === 0}
              onClick={() => exportReportCsv(report.filteredExpenses)}
              type="button"
            >
              {translate(language, "exportCsv")}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          detail={`${report.businessCount} ${translate(language, "sharedRecords")}`}
          label={translate(language, "businessNet")}
          tone="business"
          value={formatCompactCurrency(report.businessTotal)}
        />
        <SummaryCard
          detail={`${report.incomeCount} ${translate(language, "income")} ${translate(language, "records")}`}
          label={translate(language, "income")}
          value={formatCompactCurrency(report.incomeTotal)}
        />
        <SummaryCard
          detail={`${report.expenseCount} ${translate(language, "expenses")} ${translate(language, "records")}`}
          label={translate(language, "expenses")}
          tone="personal"
          value={formatCompactCurrency(report.expenseTotal)}
        />
        <SummaryCard
          detail={`${report.personalCount} ${translate(language, "personal")} ${translate(language, "records")}`}
          label={translate(language, "personalNet")}
          tone="personal"
          value={formatCompactCurrency(report.personalTotal)}
        />
      </div>

      <ReportBreakdown
        cashTotal={report.cashTotal}
        expenseTotal={report.expenseTotal}
        incomeTotal={report.incomeTotal}
        kpayTotal={report.kpayTotal}
        language={language}
        transferTotal={report.transferTotal}
      />

      <MonthlyClosePanel
        closeError={closeError}
        isClosingMonth={isClosingMonth}
        language={language}
        monthKey={activeMonthKey}
        monthlyClose={activeMonthlyClose}
        onCloseMonth={handleCloseMonth}
      />

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">{translate(language, "dailyTrend")}</h2>
          <p className="text-sm text-[var(--muted)]">
            {report.filteredExpenses.length}{" "}
            {translate(language, report.filteredExpenses.length === 1 ? "record" : "records")}
          </p>
        </div>
        <DailyTrend language={language} rows={report.dailyRows} maxTotal={report.maxDailyTotal} />
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">{translate(language, "largestTransactions")}</h2>
          <p className="text-sm text-[var(--muted)]">{translate(language, "topFivePeriod")}</p>
        </div>
        <TopExpenses language={language} rows={report.topExpenses} />
      </section>
    </div>
  )
}

function DateField({
  label,
  onChange,
  value
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="space-y-1 text-xs font-semibold uppercase text-[var(--muted)]">
      <span>{label}</span>
      <input
        autoComplete="off"
        className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm font-medium normal-case text-[var(--text)] outline-none focus:border-[var(--business)]"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  )
}

function DailyTrend({
  language,
  maxTotal,
  rows
}: {
  language: Language
  maxTotal: number
  rows: ReadonlyArray<DailyReportRow>
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--line)] py-10 text-sm text-[var(--muted)]">
        <svg aria-hidden="true" className="size-8 opacity-40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 16v-5" />
          <path d="M12 16V8" />
          <path d="M16 16v-3" />
        </svg>
        {translate(language, "noReportData")}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b-2 border-[var(--line)] text-left text-xs font-semibold uppercase text-[var(--muted)]">
            <th className="py-2 pr-3">{translate(language, "date")}</th>
            <th className="px-3 py-2 text-right">{translate(language, "income")}</th>
            <th className="px-3 py-2 text-right">{translate(language, "expenses")}</th>
            <th className="px-3 py-2 text-right">{translate(language, "personalNet")}</th>
            <th className="px-3 py-2">{translate(language, "records")}</th>
            <th className="py-2 pl-3 text-right">{translate(language, "net")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-[var(--line)] last:border-b-0" key={row.date}>
              <td className="py-3 pr-3 font-medium">{formatDisplayDate(row.date)}</td>
              <td className="px-3 py-3 text-right text-[var(--success)]">
                {formatCompactCurrency(row.income)}
              </td>
              <td className="px-3 py-3 text-right">{formatCompactCurrency(row.expenses)}</td>
              <td className={getReportAmountClassName(row.personal)}>
                {formatCompactCurrency(row.personal)}
              </td>
              <td className="px-3 py-3">{row.count}</td>
              <td className="py-3 pl-3 text-right">
                <div className="flex min-w-40 items-center justify-end gap-3">
                  <div className="h-2.5 w-24 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className={`h-full rounded-full ${getBarToneClassName(row.total)}`}
                      style={{ width: `${getBarWidth(row.total, maxTotal)}%` }}
                    />
                  </div>
                  <span className="min-w-20 font-semibold">
                    {formatCompactCurrency(row.total)}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TopExpenses({
  language,
  rows
}: {
  language: Language
  rows: ReadonlyArray<TopExpenseRow>
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--line)] py-10 text-sm text-[var(--muted)]">
        <svg aria-hidden="true" className="size-8 opacity-40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v5" />
          <path d="M14 11v5" />
        </svg>
        {translate(language, "noTransactionsToRank")}
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--line)]">
      {rows.map((row) => (
        <div className="grid grid-cols-[1fr_auto] gap-3 py-3 first:pt-0 last:pb-0" key={row.id}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{row.note}</h3>
              <span className={getTypeClassName(row.type)}>{translate(language, row.type)}</span>
              <span className={getKindClassName(row.kind)}>{translate(language, row.kind)}</span>
              {row.type === "business" ? (
                <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
                  {getPaymentMethodLabel(row, language)}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{formatDisplayDate(row.date)}</p>
          </div>
          <div className={getAmountClassName(row.kind)}>
            {getAmountSign(row.kind)}
            {formatCompactCurrency(row.amount)}
          </div>
        </div>
      ))}
    </div>
  )
}

function ReportBreakdown({
  cashTotal,
  expenseTotal,
  incomeTotal,
  kpayTotal,
  language,
  transferTotal
}: {
  cashTotal: number
  expenseTotal: number
  incomeTotal: number
  kpayTotal: number
  language: Language
  transferTotal: number
}) {
  const movementMax = Math.max(incomeTotal, expenseTotal, transferTotal, 1)
  const paymentMax = Math.max(Math.abs(cashTotal), Math.abs(kpayTotal), 1)

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <BreakdownPanel title={translate(language, "reportSnapshot")}>
        <BreakdownBar
          label={translate(language, "income")}
          tone="success"
          value={incomeTotal}
          width={getBarWidth(incomeTotal, movementMax)}
        />
        <BreakdownBar
          label={translate(language, "expenses")}
          tone="danger"
          value={expenseTotal}
          width={getBarWidth(expenseTotal, movementMax)}
        />
        <BreakdownBar
          label={translate(language, "transfer")}
          tone="neutral"
          value={transferTotal}
          width={getBarWidth(transferTotal, movementMax)}
        />
      </BreakdownPanel>
      <BreakdownPanel title={translate(language, "cashKpayBalance")}>
        <BreakdownBar
          label={translate(language, "cash")}
          tone={cashTotal >= 0 ? "success" : "danger"}
          value={cashTotal}
          width={getBarWidth(cashTotal, paymentMax)}
        />
        <BreakdownBar
          label={translate(language, "kpay")}
          tone={kpayTotal >= 0 ? "success" : "danger"}
          value={kpayTotal}
          width={getBarWidth(kpayTotal, paymentMax)}
        />
      </BreakdownPanel>
    </section>
  )
}

function MonthlyClosePanel({
  closeError,
  isClosingMonth,
  language,
  monthKey,
  monthlyClose,
  onCloseMonth
}: {
  closeError: string | null
  isClosingMonth: boolean
  language: Language
  monthKey: string
  monthlyClose?: MonthlyClose
  onCloseMonth: () => void
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div>
          <h2 className="text-base font-semibold">{translate(language, "monthlyClose")}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {formatMonthLabel(monthKey, language)} - {translate(language, "monthlyCloseDescription")}
          </p>
        </div>
        <button
          className="h-10 rounded-md bg-[var(--text)] px-4 text-sm font-semibold text-[var(--surface)] hover:opacity-90 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isClosingMonth}
          onClick={onCloseMonth}
          type="button"
        >
          {isClosingMonth ? translate(language, "saving") : translate(language, "closeMonth")}
        </button>
      </div>
      {closeError ? (
        <div className="mb-4 rounded-md bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
          {closeError}
        </div>
      ) : null}
      {monthlyClose ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <CloseBalanceGroup
              cash={monthlyClose.cashOpeningBalance}
              kpay={monthlyClose.kpayOpeningBalance}
              label={translate(language, "openingBalance")}
            />
            <CloseBalanceGroup
              cash={monthlyClose.cashClosingBalance}
              kpay={monthlyClose.kpayClosingBalance}
              label={translate(language, "closingBalance")}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniCloseMetric label={translate(language, "income")} value={monthlyClose.incomeTotal} />
            <MiniCloseMetric label={translate(language, "expenses")} value={monthlyClose.expenseTotal} />
            <MiniCloseMetric label={translate(language, "transfer")} value={monthlyClose.transferTotal} />
          </div>
          <p className="text-xs text-[var(--muted)]">
            {translate(language, "closedAt")} {formatClosedAt(monthlyClose.closedAt)}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--line)] py-8 text-sm text-[var(--muted)]">
          <svg aria-hidden="true" className="size-7 opacity-40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
            <rect height="18" rx="2" width="18" x="3" y="4" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
          </svg>
          {translate(language, "noMonthlyClose")}
        </div>
      )}
    </section>
  )
}

function CloseBalanceGroup({
  cash,
  kpay,
  label
}: {
  cash: number
  kpay: number
  label: string
}) {
  return (
    <div className="rounded-md bg-[var(--surface-muted)] p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">{label}</div>
      <div className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>Cash</span>
          <span className="font-semibold">{formatCurrency(cash)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>KPay</span>
          <span className="font-semibold">{formatCurrency(kpay)}</span>
        </div>
      </div>
    </div>
  )
}

function MiniCloseMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-[var(--surface-muted)] p-3">
      <div className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-base font-semibold">{formatCompactCurrency(value)}</div>
    </div>
  )
}

function BreakdownPanel({
  children,
  title
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function BreakdownBar({
  label,
  tone,
  value,
  width
}: {
  label: string
  tone: "danger" | "neutral" | "success"
  value: number
  width: number
}) {
  const toneClassName = getBreakdownToneClassName(tone)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className={`font-semibold ${toneClassName.text}`}>
          {formatCompactCurrency(value)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div className={`h-full rounded-full ${toneClassName.bar}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function getBreakdownToneClassName(tone: "danger" | "neutral" | "success"): {
  bar: string
  text: string
} {
  if (tone === "success") {
    return { bar: "bg-[var(--success)]", text: "text-[var(--success)]" }
  }

  if (tone === "danger") {
    return { bar: "bg-[var(--danger)]", text: "text-[var(--danger)]" }
  }

  return { bar: "bg-[var(--business)]", text: "text-[var(--business)]" }
}

function buildReport(
  expenses: ReadonlyArray<Expense>,
  currentUserId: string,
  startDate: string,
  endDate: string
) {
  const filteredExpenses = expenses.filter(
    (expense) =>
      expense.date >= startDate &&
      expense.date <= endDate &&
      (expense.type === "business" ||
        (expense.type === "personal" && expense.ownerUserId === currentUserId))
  )
  const businessExpenses = filteredExpenses.filter((expense) => expense.type === "business")
  const incomeTransactions = filteredExpenses.filter((expense) => expense.kind === "income")
  const expenseTransactions = filteredExpenses.filter((expense) => expense.kind === "expense")
  const personalExpenses = filteredExpenses.filter((expense) => expense.type === "personal")
  const dailyRows = buildDailyRows(filteredExpenses)
  const total = sumNetAmount(filteredExpenses)

  return {
    filteredExpenses,
    dailyRows,
    businessTotal: sumNetAmount(businessExpenses),
    businessCount: businessExpenses.length,
    incomeTotal: sumIncome(incomeTransactions),
    incomeCount: incomeTransactions.length,
    expenseTotal: sumExpenseOutflow(expenseTransactions),
    expenseCount: expenseTransactions.length,
    transferTotal: sumTransfers(businessExpenses),
    personalTotal: sumNetAmount(personalExpenses),
    personalCount: personalExpenses.length,
    total,
    cashTotal: sumNetAmountByPaymentMethod(businessExpenses, "cash"),
    kpayTotal: sumNetAmountByPaymentMethod(businessExpenses, "kpay"),
    dailyAverage: dailyRows.length > 0 ? total / dailyRows.length : 0,
    maxDailyTotal: Math.max(...dailyRows.map((row) => Math.abs(row.total)), 0),
    topExpenses: filteredExpenses
      .slice()
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5)
  }
}

function buildDailyRows(expenses: ReadonlyArray<Expense>): DailyReportRow[] {
  const rows = new Map<string, DailyReportRow>()

  for (const expense of expenses) {
    const current = rows.get(expense.date) ?? {
      date: expense.date,
      business: 0,
      income: 0,
      expenses: 0,
      personal: 0,
      total: 0,
      count: 0
    }
    const next = {
      ...current,
      business:
        current.business +
        (expense.type === "business" ? getNetAmount(expense) : 0),
      income:
        current.income +
        (expense.type === "business" && expense.kind === "income" ? expense.amount : 0),
      expenses:
        current.expenses +
        (expense.type === "business" && expense.kind === "expense" ? expense.amount : 0),
      personal:
        current.personal +
        (expense.type === "personal" ? getNetAmount(expense) : 0),
      total: current.total + getNetAmount(expense),
      count: current.count + 1
    }

    rows.set(expense.date, next)
  }

  return Array.from(rows.values()).sort((left, right) => right.date.localeCompare(left.date))
}

function exportReportCsv(expenses: ReadonlyArray<Expense>) {
  const rows = [
    ["Date", "Note", "Amount Ks", "Kind", "Type", "Payment Method"],
    ...expenses.map((expense) => [
      expense.date,
      expense.note,
      String(expense.amount),
      expense.kind,
      expense.type,
      expense.type === "business" ? getPaymentMethodLabel(expense, "en") : ""
    ])
  ]
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = `splitledger-report-${toDateKey(new Date())}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function escapeCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function getDefaultRange(): { endDate: string; startDate: string } {
  const now = new Date()
  const endDate = toDateKey(now)
  const startDate = `${endDate.slice(0, 8)}01`

  return { endDate, startDate }
}

function getBarWidth(value: number, maxValue: number): number {
  if (maxValue <= 0) {
    return 0
  }

  return Math.max(8, Math.round((Math.abs(value) / maxValue) * 100))
}

function getBarToneClassName(value: number): string {
  return value >= 0 ? "bg-[var(--business)]" : "bg-[var(--danger)]"
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

  if (kind === "transfer") {
    return `${base} bg-[var(--business-soft)] text-[var(--business)]`
  }

  return `${base} bg-[var(--surface-muted)] text-[var(--muted)]`
}

function getAmountClassName(kind: Expense["kind"]): string {
  const color =
    kind === "income"
      ? "text-[var(--success)]"
      : kind === "transfer"
        ? "text-[var(--muted)]"
        : "text-[var(--text)]"
  return `text-right text-sm font-semibold ${color}`
}

function getAmountSign(kind: Expense["kind"]): string {
  if (kind === "transfer") {
    return ""
  }

  return kind === "income" ? "+" : "-"
}

function getPaymentMethodLabel(expense: TopExpenseRow | Expense, language: Language): string {
  if (expense.kind === "transfer") {
    const transfer = getTransferPaymentMethods(expense as Expense)
    return `${translate(language, transfer.from)} ${translate(language, "to")} ${translate(language, transfer.to)}`
  }

  return translate(language, expense.paymentMethod ?? getBusinessPaymentMethod(expense as Expense))
}

function formatMonthLabel(monthKey: string, language: Language): string {
  const date = new Date(`${monthKey}-01T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) {
    return monthKey
  }

  return new Intl.DateTimeFormat(language === "my" ? "my-MM" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date)
}

function formatClosedAt(closedAt: string): string {
  const date = new Date(closedAt)

  if (Number.isNaN(date.getTime())) {
    return closedAt
  }

  return date.toLocaleString()
}

function getReportAmountClassName(amount: number): string {
  const color = amount >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
  return `px-3 py-3 text-right ${color}`
}
