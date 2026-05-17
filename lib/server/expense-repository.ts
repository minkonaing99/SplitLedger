import type { Collection, WithId } from "mongodb"
import {
  buildAccessibleExpenseFilter,
  buildVisibleExpenseFilter
} from "@/lib/server/expense-access"
import { getMongoConnection } from "@/lib/server/mongodb"
import type {
  Expense,
  ExpenseInput,
  ExpenseType,
  PaymentMethod,
  TransactionKind
} from "@/lib/types"

const DEFAULT_WORKSPACE_ID = "family-business"

interface ExpenseDocument {
  id: string
  workspaceId: string
  type: ExpenseType
  kind?: TransactionKind
  paymentMethod?: PaymentMethod
  transferFromPaymentMethod?: PaymentMethod
  transferToPaymentMethod?: PaymentMethod
  amount: number
  paidByUserId: string
  ownerUserId: string
  date: string
  note: string
  createdAt: Date
  updatedAt: Date
}

interface ExpenseAuditDocument {
  id: string
  action: "create" | "delete"
  actorUserId: string
  expense: Expense
  expenseId: string
  workspaceId: string
  createdAt: Date
}

export async function listVisibleExpenses(userId: string): Promise<Expense[]> {
  const collection = await getExpensesCollection()
  const documents = await collection
    .find({
      workspaceId: DEFAULT_WORKSPACE_ID,
      ...buildVisibleExpenseFilter(userId)
    })
    .sort({ date: -1, createdAt: -1 })
    .toArray()

  return documents.map(toExpense)
}

export async function listBusinessExpenses(): Promise<Expense[]> {
  const collection = await getExpensesCollection()
  const documents = await collection
    .find({ workspaceId: DEFAULT_WORKSPACE_ID, type: "business" })
    .sort({ date: -1, createdAt: -1 })
    .toArray()

  return documents.map(toExpense)
}

export async function insertExpense(input: ExpenseInput): Promise<Expense> {
  const collection = await getExpensesCollection()
  const now = new Date()
  const expense: Expense = {
    ...input,
    id: crypto.randomUUID()
  }

  await collection.insertOne({
    ...expense,
    workspaceId: DEFAULT_WORKSPACE_ID,
    createdAt: now,
    updatedAt: now
  })
  await insertExpenseAudit({
    action: "create",
    actorUserId: input.paidByUserId,
    expense
  })

  return expense
}

export async function deleteExpense(expenseId: string, userId: string): Promise<boolean> {
  const collection = await getExpensesCollection()
  const expense = await collection.findOne({
    workspaceId: DEFAULT_WORKSPACE_ID,
    ...buildAccessibleExpenseFilter(expenseId, userId)
  })

  if (!expense) {
    return false
  }

  const result = await collection.deleteOne({
    workspaceId: DEFAULT_WORKSPACE_ID,
    ...buildAccessibleExpenseFilter(expenseId, userId)
  })

  if (result.deletedCount === 1) {
    await insertExpenseAudit({
      action: "delete",
      actorUserId: userId,
      expense: toExpense(expense)
    })
  }

  return result.deletedCount === 1
}

export async function ensureExpenseIndexes(): Promise<void> {
  const collection = await getExpensesCollection()

  await Promise.all([
    collection.createIndex({ workspaceId: 1, type: 1, date: -1 }),
    collection.createIndex({ workspaceId: 1, type: 1, kind: 1, date: -1 }),
    collection.createIndex({ workspaceId: 1, type: 1, paymentMethod: 1, date: -1 }),
    collection.createIndex({ workspaceId: 1, ownerUserId: 1, type: 1, date: -1 }),
    collection.createIndex({ id: 1 }, { unique: true }),
    ensureExpenseAuditIndexes()
  ])
}

async function getExpensesCollection(): Promise<Collection<ExpenseDocument>> {
  const { db } = await getMongoConnection()
  return db.collection<ExpenseDocument>("expenses")
}

function toExpense(document: WithId<ExpenseDocument>): Expense {
  return {
    id: document.id,
    type: document.type,
    kind: document.kind ?? "expense",
    paymentMethod: document.type === "business" ? document.paymentMethod ?? "cash" : undefined,
    transferFromPaymentMethod: document.transferFromPaymentMethod,
    transferToPaymentMethod: document.transferToPaymentMethod,
    amount: document.amount,
    paidByUserId: document.paidByUserId,
    ownerUserId: document.ownerUserId,
    date: document.date,
    note: document.note
  }
}

async function insertExpenseAudit(input: {
  action: ExpenseAuditDocument["action"]
  actorUserId: string
  expense: Expense
}): Promise<void> {
  const collection = await getExpenseAuditsCollection()

  await collection.insertOne({
    id: crypto.randomUUID(),
    action: input.action,
    actorUserId: input.actorUserId,
    expense: input.expense,
    expenseId: input.expense.id,
    workspaceId: DEFAULT_WORKSPACE_ID,
    createdAt: new Date()
  })
}

async function ensureExpenseAuditIndexes(): Promise<void> {
  const collection = await getExpenseAuditsCollection()

  await Promise.all([
    collection.createIndex({ workspaceId: 1, expenseId: 1, createdAt: -1 }),
    collection.createIndex({ workspaceId: 1, actorUserId: 1, createdAt: -1 })
  ])
}

async function getExpenseAuditsCollection(): Promise<Collection<ExpenseAuditDocument>> {
  const { db } = await getMongoConnection()
  return db.collection<ExpenseAuditDocument>("expenseAudits")
}
