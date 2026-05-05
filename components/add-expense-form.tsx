"use client"

import { useState } from "react"
import { translate, type Language } from "@/lib/i18n"
import type { ExpenseInput, ExpenseType, TransactionKind, User } from "@/lib/types"

interface AddExpenseFormProps {
  currentUserId: string
  fixedType?: ExpenseType
  isOnline: boolean
  language: Language
  users: ReadonlyArray<User>
  onAddExpense: (input: ExpenseInput) => Promise<void>
}

export function AddExpenseForm({
  currentUserId,
  fixedType,
  isOnline,
  language,
  users,
  onAddExpense
}: AddExpenseFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    if (!isOnline) {
      setError(translate(language, "offlineReadOnly"))
      return
    }

    const type = fixedType ?? readExpenseType(formData)
    const kind = readTransactionKind(formData)

    try {
      setIsSubmitting(true)
      setError(null)
      await onAddExpense({
        type,
        kind,
        amount: readAmount(formData),
        paidByUserId: currentUserId,
        ownerUserId: currentUserId,
        date: readString(formData, "date", new Date().toISOString().slice(0, 10)),
        note: readString(formData, "note", "Untitled expense")
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to add expense.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form action={handleSubmit} autoComplete="off" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          <span>{translate(language, "amount")}</span>
          <input
            autoComplete="off"
            className="h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 outline-none focus:border-[var(--business)]"
            disabled={!isOnline}
            min="0"
            name="amount"
            placeholder="0.00"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>{translate(language, "type")}</span>
          {fixedType ? (
            <div className="flex h-11 items-center rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-sm capitalize text-[var(--muted)]">
              {fixedType}
            </div>
          ) : (
            <select
              autoComplete="off"
              className="h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 outline-none focus:border-[var(--business)]"
              disabled={!isOnline}
              name="type"
            >
              <option value="business">{translate(language, "business")}</option>
              <option value="personal">{translate(language, "personal")}</option>
            </select>
          )}
        </label>
      </div>
      <label className="block space-y-1 text-sm font-medium">
        <span>{translate(language, "category")}</span>
        <select
          autoComplete="off"
          className="h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 outline-none focus:border-[var(--business)]"
          disabled={!isOnline}
          name="kind"
        >
          <option value="expense">{translate(language, "expenses")}</option>
          <option value="income">{translate(language, "income")}</option>
        </select>
      </label>
      <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted)]">
        {fixedType === "business"
          ? translate(language, "sharedLedger")
          : `Personal entries are private to ${getUserName(users, currentUserId)}.`}
      </div>
      <label className="block space-y-1 text-sm font-medium">
        <span>{translate(language, "date")}</span>
        <input
          autoComplete="off"
          className="h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 outline-none focus:border-[var(--business)]"
          disabled={!isOnline}
          defaultValue={new Date().toISOString().slice(0, 10)}
          name="date"
          required
          type="date"
        />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span>{translate(language, "note")}</span>
        <textarea
          autoComplete="off"
          className="min-h-24 w-full resize-none rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 outline-none focus:border-[var(--business)]"
          disabled={!isOnline}
          name="note"
          placeholder={translate(language, "transactionNotePlaceholder")}
          required
        />
      </label>
      {!isOnline ? (
        <div className="rounded-md bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--muted)]">
          {translate(language, "offlineReadOnly")}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
          {error}
        </div>
      ) : null}
      <button
        className="h-11 w-full rounded-md bg-[var(--text)] px-4 text-sm font-semibold text-[var(--surface)] hover:opacity-90 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting || !isOnline}
        type="submit"
      >
        {isSubmitting ? translate(language, "saving") : translate(language, "saveTransaction")}
      </button>
    </form>
  )
}

function readAmount(formData: FormData): number {
  const value = Number(formData.get("amount"))
  return Number.isFinite(value) ? value : 0
}

function readExpenseType(formData: FormData): ExpenseType {
  return formData.get("type") === "personal" ? "personal" : "business"
}

function readTransactionKind(formData: FormData): TransactionKind {
  return formData.get("kind") === "income" ? "income" : "expense"
}

function readString(formData: FormData, key: string, fallback: string): string {
  const value = formData.get(key)
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
}

function getUserName(users: ReadonlyArray<User>, userId: string): string {
  return users.find((user) => user.id === userId)?.name ?? "Current account"
}
