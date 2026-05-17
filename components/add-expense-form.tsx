"use client"

import { useState } from "react"
import { formatCurrency } from "@/lib/expenses"
import { translate, type Language } from "@/lib/i18n"
import type {
  ExpenseInput,
  ExpenseType,
  PaymentMethod,
  TransactionKind,
  User
} from "@/lib/types"

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
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedType, setSelectedType] = useState<ExpenseType>(fixedType ?? "business")
  const [selectedKind, setSelectedKind] = useState<TransactionKind>("expense")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("cash")
  const [transferFromPaymentMethod, setTransferFromPaymentMethod] = useState<PaymentMethod>("cash")
  const [transferToPaymentMethod, setTransferToPaymentMethod] = useState<PaymentMethod>("kpay")

  async function handleSubmit(formData: FormData) {
    if (!isOnline) {
      setError(translate(language, "offlineReadOnly"))
      return
    }

    const type = fixedType ?? readExpenseType(formData)
    const kind = readTransactionKind(formData)
    const paymentMethod = type === "business" ? readPaymentMethod(formData) : undefined
    const transferFrom = readTransferPaymentMethod(formData, "transferFromPaymentMethod")
    const transferTo = readTransferPaymentMethod(formData, "transferToPaymentMethod")

    try {
      setIsSubmitting(true)
      setError(null)
      await onAddExpense({
        type,
        kind,
        paymentMethod: kind === "transfer" ? undefined : paymentMethod,
        transferFromPaymentMethod: kind === "transfer" ? transferFrom : undefined,
        transferToPaymentMethod: kind === "transfer" ? transferTo : undefined,
        amount: readAmount(formData),
        paidByUserId: currentUserId,
        ownerUserId: currentUserId,
        date: readString(formData, "date", new Date().toISOString().slice(0, 10)),
        note: readString(formData, "note", getFallbackNote(kind, transferFrom, transferTo, language))
      })
      setAmount("")
      setNote("")
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
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            required
            step="0.01"
            type="number"
            value={amount}
          />
        </label>
        <div className="space-y-1 text-sm font-medium">
          <div>{translate(language, "type")}</div>
          {fixedType ? (
            <div className="flex h-11 items-center rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-sm capitalize text-[var(--muted)]">
              {translate(language, fixedType)}
            </div>
          ) : (
            <SegmentedControl>
              <SegmentButton
                disabled={!isOnline}
                isActive={selectedType === "business"}
                label={translate(language, "business")}
                onClick={() => setSelectedType("business")}
              />
              <SegmentButton
                disabled={!isOnline}
                isActive={selectedType === "personal"}
                label={translate(language, "personal")}
                onClick={() => {
                  setSelectedType("personal")
                  if (selectedKind === "transfer") {
                    setSelectedKind("expense")
                  }
                }}
              />
            </SegmentedControl>
          )}
          <input name="type" type="hidden" value={selectedType} />
        </div>
      </div>
      <div className="space-y-1 text-sm font-medium">
        <div>{translate(language, "category")}</div>
        <SegmentedControl columns={selectedType === "business" ? 3 : 2}>
          <SegmentButton
            disabled={!isOnline}
            isActive={selectedKind === "expense"}
            label={translate(language, "expenses")}
            onClick={() => setSelectedKind("expense")}
          />
          <SegmentButton
            disabled={!isOnline}
            isActive={selectedKind === "income"}
            label={translate(language, "income")}
            onClick={() => setSelectedKind("income")}
          />
          {selectedType === "business" ? (
            <SegmentButton
              disabled={!isOnline}
              isActive={selectedKind === "transfer"}
              label={translate(language, "transfer")}
              onClick={() => setSelectedKind("transfer")}
            />
          ) : null}
        </SegmentedControl>
        <input name="kind" type="hidden" value={selectedKind} />
      </div>
      {selectedType === "business" && selectedKind === "transfer" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <PaymentMethodField
            disabled={!isOnline}
            label={translate(language, "transferFrom")}
            language={language}
            name="transferFromPaymentMethod"
            onChange={(nextPaymentMethod) => {
              setTransferFromPaymentMethod(nextPaymentMethod)
              if (nextPaymentMethod === transferToPaymentMethod) {
                setTransferToPaymentMethod(nextPaymentMethod === "cash" ? "kpay" : "cash")
              }
            }}
            value={transferFromPaymentMethod}
          />
          <PaymentMethodField
            disabled={!isOnline}
            label={translate(language, "transferTo")}
            language={language}
            name="transferToPaymentMethod"
            onChange={(nextPaymentMethod) => {
              setTransferToPaymentMethod(nextPaymentMethod)
              if (nextPaymentMethod === transferFromPaymentMethod) {
                setTransferFromPaymentMethod(nextPaymentMethod === "cash" ? "kpay" : "cash")
              }
            }}
            value={transferToPaymentMethod}
          />
        </div>
      ) : selectedType === "business" ? (
        <div className="space-y-1 text-sm font-medium">
          <div>{translate(language, "paymentMethod")}</div>
          <SegmentedControl>
            <SegmentButton
              disabled={!isOnline}
              isActive={selectedPaymentMethod === "cash"}
              label={translate(language, "cash")}
              onClick={() => setSelectedPaymentMethod("cash")}
            />
            <SegmentButton
              disabled={!isOnline}
              isActive={selectedPaymentMethod === "kpay"}
              label={translate(language, "kpay")}
              onClick={() => setSelectedPaymentMethod("kpay")}
            />
          </SegmentedControl>
          <input name="paymentMethod" type="hidden" value={selectedPaymentMethod} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {[50000, 100000, 2000000, 500000, 1000000].map((quickAmount) => (
          <button
            className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isOnline}
            key={quickAmount}
            onClick={() => setAmount(String(quickAmount))}
            type="button"
          >
            {formatCurrency(quickAmount)}
          </button>
        ))}
      </div>
      <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted)]">
        {selectedKind === "transfer"
          ? translate(language, "transferHint")
          : selectedType === "business"
            ? translate(language, "paymentMethodHint")
          : `${translate(language, "personalPrivacyHintPrefix")} ${getUserName(users, currentUserId)}.`}
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
          onChange={(event) => setNote(event.target.value)}
          placeholder={translate(language, "transactionNotePlaceholder")}
          value={note}
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

function SegmentedControl({
  children,
  columns = 2
}: {
  children: React.ReactNode
  columns?: 2 | 3
}) {
  return (
    <div className={`${columns === 3 ? "grid-cols-3" : "grid-cols-2"} grid rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-1`}>
      {children}
    </div>
  )
}

function PaymentMethodField({
  disabled,
  label,
  language,
  name,
  onChange,
  value
}: {
  disabled: boolean
  label: string
  language: Language
  name: string
  onChange: (paymentMethod: PaymentMethod) => void
  value: PaymentMethod
}) {
  return (
    <div className="space-y-1 text-sm font-medium">
      <div>{label}</div>
      <SegmentedControl>
        <SegmentButton
          disabled={disabled}
          isActive={value === "cash"}
          label={translate(language, "cash")}
          onClick={() => onChange("cash")}
        />
        <SegmentButton
          disabled={disabled}
          isActive={value === "kpay"}
          label={translate(language, "kpay")}
          onClick={() => onChange("kpay")}
        />
      </SegmentedControl>
      <input name={name} type="hidden" value={value} />
    </div>
  )
}

function SegmentButton({
  disabled,
  isActive,
  label,
  onClick
}: {
  disabled: boolean
  isActive: boolean
  label: string
  onClick: () => void
}) {
  const className = isActive
    ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
    : "text-[var(--muted)] hover:text-[var(--text)]"

  return (
    <button
      className={`h-9 rounded px-3 text-sm font-semibold transition-colors focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function readAmount(formData: FormData): number {
  const value = Number(formData.get("amount"))
  return Number.isFinite(value) ? value : 0
}

function readExpenseType(formData: FormData): ExpenseType {
  const value = formData.get("type")
  return readExpenseTypeFromValue(typeof value === "string" ? value : "")
}

function readExpenseTypeFromValue(value: string): ExpenseType {
  return value === "personal" ? "personal" : "business"
}

function readTransactionKind(formData: FormData): TransactionKind {
  const kind = formData.get("kind")

  if (kind === "transfer") {
    return "transfer"
  }

  return kind === "income" ? "income" : "expense"
}

function readPaymentMethod(formData: FormData): PaymentMethod {
  return formData.get("paymentMethod") === "kpay" ? "kpay" : "cash"
}

function readTransferPaymentMethod(formData: FormData, key: string): PaymentMethod {
  return formData.get(key) === "kpay" ? "kpay" : "cash"
}

function getFallbackNote(
  kind: TransactionKind,
  transferFrom: PaymentMethod,
  transferTo: PaymentMethod,
  language: Language
): string {
  if (kind === "transfer") {
    return `${translate(language, transferFrom)} ${translate(language, "to")} ${translate(language, transferTo)}`
  }

  return "Untitled expense"
}

function readString(formData: FormData, key: string, fallback: string): string {
  const value = formData.get(key)
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
}

function getUserName(users: ReadonlyArray<User>, userId: string): string {
  return users.find((user) => user.id === userId)?.name ?? "Current account"
}
