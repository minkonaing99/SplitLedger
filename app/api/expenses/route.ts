import { NextResponse } from "next/server"
import { insertExpense, listVisibleExpenses } from "@/lib/server/expense-repository"
import { requireCurrentUser } from "@/lib/server/api"
import { validateTrustedOrigin } from "@/lib/server/security"
import type { ExpenseType, PaymentMethod, TransactionKind } from "@/lib/types"

export async function GET() {
  const auth = await requireCurrentUser()

  if (!auth.ok) {
    return auth.response
  }

  const expenses = await listVisibleExpenses(auth.user.id)
  return NextResponse.json({ expenses })
}

export async function POST(request: Request) {
  const originError = validateTrustedOrigin(request)

  if (originError) {
    return originError
  }

  const auth = await requireCurrentUser()

  if (!auth.ok) {
    return auth.response
  }

  const body = await readJson(request)
  const amount = readAmount(body)
  const type = readExpenseType(body)
  const kind = readTransactionKind(body, type)
  const paymentMethod = readPaymentMethod(body, type)
  const transferFromPaymentMethod = readTransferPaymentMethod(body, "transferFromPaymentMethod")
  const transferToPaymentMethod = readTransferPaymentMethod(body, "transferToPaymentMethod")
  const date = readDate(body)
  const note = readNote(body)

  if (!amount || !date || !note) {
    return NextResponse.json({ error: "Amount, date, and note are required." }, { status: 400 })
  }

  if (kind === "transfer" && transferFromPaymentMethod === transferToPaymentMethod) {
    return NextResponse.json({ error: "Transfer accounts must be different." }, { status: 400 })
  }

  const expense = await insertExpense({
    type,
    kind,
    paymentMethod,
    transferFromPaymentMethod: kind === "transfer" ? transferFromPaymentMethod : undefined,
    transferToPaymentMethod: kind === "transfer" ? transferToPaymentMethod : undefined,
    amount,
    paidByUserId: auth.user.id,
    ownerUserId: auth.user.id,
    date,
    note
  })

  return NextResponse.json({ expense }, { status: 201 })
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function readAmount(value: unknown): number {
  const amount = readNumber(value, "amount")
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

function readExpenseType(value: unknown): ExpenseType {
  return readString(value, "type") === "personal" ? "personal" : "business"
}

function readTransactionKind(value: unknown, type: ExpenseType): TransactionKind {
  if (type === "business" && readString(value, "kind") === "transfer") {
    return "transfer"
  }

  return readString(value, "kind") === "income" ? "income" : "expense"
}

function readPaymentMethod(value: unknown, type: ExpenseType): PaymentMethod | undefined {
  if (type !== "business") {
    return undefined
  }

  if (readString(value, "kind") === "transfer") {
    return undefined
  }

  return readPaymentMethodValue(readString(value, "paymentMethod"))
}

function readTransferPaymentMethod(value: unknown, key: string): PaymentMethod {
  return readPaymentMethodValue(readString(value, key))
}

function readPaymentMethodValue(value: string): PaymentMethod {
  return value === "kpay" ? "kpay" : "cash"
}

function readDate(value: unknown): string {
  const date = readString(value, "date")
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ""
}

function readNote(value: unknown): string {
  return readString(value, "note").slice(0, 160)
}

function readNumber(value: unknown, key: string): number {
  if (!value || typeof value !== "object" || !(key in value)) {
    return 0
  }

  return Number((value as Record<string, unknown>)[key])
}

function readString(value: unknown, key: string): string {
  if (!value || typeof value !== "object" || !(key in value)) {
    return ""
  }

  const field = (value as Record<string, unknown>)[key]
  return typeof field === "string" ? field.trim() : ""
}
