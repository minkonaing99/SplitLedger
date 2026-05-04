"use client"

import { useMemo, useState } from "react"
import { SummaryCard } from "@/components/summary-card"
import {
  formatCompactCurrency,
  formatCurrency,
  formatDisplayDate,
  sumExpenseOutflow,
  sumIncome,
  sumNetAmount,
  toDateKey
} from "@/lib/expenses"
import { translate, type Language } from "@/lib/i18n"
import type { Expense } from "@/lib/types"

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
  amount: number
}

export function ReportsView({ currentUserId, expenses, language }: ReportsViewProps) {
  const defaultRange = useMemo(() => getDefaultRange(), [])
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)

  const report = useMemo(
    () => buildReport(expenses, currentUserId, startDate, endDate),
    [currentUserId, endDate, expenses, startDate]
  )

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
          detail={`${report.businessCount} shared records`}
          label={translate(language, "businessNet")}
          tone="business"
          value={formatCompactCurrency(report.businessTotal)}
        />
        <SummaryCard
          detail={`${report.incomeCount} income records`}
          label={translate(language, "income")}
          value={formatCompactCurrency(report.incomeTotal)}
        />
        <SummaryCard
          detail={`${report.expenseCount} expense records`}
          label={translate(language, "expenses")}
          tone="personal"
          value={formatCompactCurrency(report.expenseTotal)}
        />
        <SummaryCard
          detail={`${report.personalCount} private records`}
          label={translate(language, "personalNet")}
          tone="personal"
          value={formatCompactCurrency(report.personalTotal)}
        />
      </div>

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
      <div className="rounded-lg border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">
        {translate(language, "noReportData")}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-[var(--line)] text-left text-xs font-semibold uppercase text-[var(--muted)]">
            <th className="py-2 pr-3">{translate(language, "date")}</th>
            <th className="px-3 py-2 text-right">{translate(language, "income")}</th>
            <th className="px-3 py-2 text-right">{translate(language, "expenses")}</th>
            <th className="px-3 py-2 text-right">{translate(language, "personalNet")}</th>
            <th className="px-3 py-2">{translate(language, "records")}</th>
            <th className="py-2 pl-3 text-right">Net</th>
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
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--business)]"
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
      <div className="rounded-lg border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">
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
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{formatDisplayDate(row.date)}</p>
          </div>
          <div className={getAmountClassName(row.kind)}>
            {row.kind === "income" ? "+" : "-"}
            {formatCompactCurrency(row.amount)}
          </div>
        </div>
      ))}
    </div>
  )
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
  const expenseTransactions = filteredExpenses.filter((expense) => expense.kind !== "income")
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
    personalTotal: sumNetAmount(personalExpenses),
    personalCount: personalExpenses.length,
    total,
    dailyAverage: dailyRows.length > 0 ? total / dailyRows.length : 0,
    maxDailyTotal: Math.max(...dailyRows.map((row) => row.total), 0),
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
        (expense.type === "business"
          ? expense.kind === "income"
            ? expense.amount
            : -expense.amount
          : 0),
      income:
        current.income +
        (expense.type === "business" && expense.kind === "income" ? expense.amount : 0),
      expenses:
        current.expenses +
        (expense.type === "business" && expense.kind !== "income" ? expense.amount : 0),
      personal:
        current.personal +
        (expense.type === "personal"
          ? expense.kind === "income"
            ? expense.amount
            : -expense.amount
          : 0),
      total: current.total + (expense.kind === "income" ? expense.amount : -expense.amount),
      count: current.count + 1
    }

    rows.set(expense.date, next)
  }

  return Array.from(rows.values()).sort((left, right) => right.date.localeCompare(left.date))
}

function exportReportCsv(expenses: ReadonlyArray<Expense>) {
  const rows = [
    ["Date", "Note", "Amount Ks", "Kind", "Type"],
    ...expenses.map((expense) => [
      expense.date,
      expense.note,
      String(expense.amount),
      expense.kind,
      expense.type
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

  return Math.max(8, Math.round((value / maxValue) * 100))
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

function getAmountClassName(kind: Expense["kind"]): string {
  const color = kind === "income" ? "text-[var(--success)]" : "text-[var(--text)]"
  return `text-right text-sm font-semibold ${color}`
}

function getReportAmountClassName(amount: number): string {
  const color = amount >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
  return `px-3 py-3 text-right ${color}`
}
