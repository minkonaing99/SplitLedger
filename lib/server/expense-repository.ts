import { canAccessExpense } from "@/lib/server/expense-access"
import { readDb, updateDb } from "@/lib/server/json-db"
import type { Expense, ExpenseInput } from "@/lib/types"

const DEFAULT_WORKSPACE_ID = "family-business"

interface ExpenseRecord extends Expense {
  workspaceId: string
  createdAt: string
  updatedAt: string
}

interface AuditRecord {
  id: string
  workspaceId: string
  expenseId: string
  action: "create" | "delete"
  actorUserId: string
  expenseJson: string
  createdAt: string
}

export async function listVisibleExpenses(userId: string): Promise<Expense[]> {
  const all = await readDb<ExpenseRecord>("expenses.json")
  return all
    .filter(e => e.workspaceId === DEFAULT_WORKSPACE_ID && canAccessExpense(e, userId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map(toExpense)
}

export async function listBusinessExpenses(): Promise<Expense[]> {
  const all = await readDb<ExpenseRecord>("expenses.json")
  return all
    .filter(e => e.workspaceId === DEFAULT_WORKSPACE_ID && e.type === "business")
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map(toExpense)
}

export async function insertExpense(input: ExpenseInput): Promise<Expense> {
  const expense: Expense = { ...input, id: crypto.randomUUID() }
  const now = new Date().toISOString()
  const record: ExpenseRecord = { ...expense, workspaceId: DEFAULT_WORKSPACE_ID, createdAt: now, updatedAt: now }
  const audit: AuditRecord = {
    id: crypto.randomUUID(),
    workspaceId: DEFAULT_WORKSPACE_ID,
    expenseId: expense.id,
    action: "create",
    actorUserId: input.paidByUserId,
    expenseJson: JSON.stringify(expense),
    createdAt: now
  }

  await Promise.all([
    updateDb<ExpenseRecord>("expenses.json", all => [...all, record]),
    updateDb<AuditRecord>("expense-audits.json", all => [...all, audit])
  ])

  return expense
}

export async function deleteExpense(expenseId: string, userId: string): Promise<boolean> {
  const all = await readDb<ExpenseRecord>("expenses.json")
  const record = all.find(
    e => e.workspaceId === DEFAULT_WORKSPACE_ID && e.id === expenseId && canAccessExpense(e, userId)
  )
  if (!record) return false

  const now = new Date().toISOString()
  const audit: AuditRecord = {
    id: crypto.randomUUID(),
    workspaceId: DEFAULT_WORKSPACE_ID,
    expenseId,
    action: "delete",
    actorUserId: userId,
    expenseJson: JSON.stringify(toExpense(record)),
    createdAt: now
  }

  await Promise.all([
    updateDb<ExpenseRecord>("expenses.json", records => records.filter(e => e.id !== expenseId)),
    updateDb<AuditRecord>("expense-audits.json", records => [...records, audit])
  ])

  return true
}

export async function ensureExpenseIndexes(): Promise<void> {}

function toExpense(record: ExpenseRecord): Expense {
  return {
    id: record.id,
    type: record.type,
    kind: record.kind,
    paymentMethod: record.paymentMethod,
    transferFromPaymentMethod: record.transferFromPaymentMethod,
    transferToPaymentMethod: record.transferToPaymentMethod,
    amount: record.amount,
    paidByUserId: record.paidByUserId,
    ownerUserId: record.ownerUserId,
    date: record.date,
    note: record.note
  }
}
