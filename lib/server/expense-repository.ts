import type { Collection, WithId } from "mongodb"
import { getMongoConnection } from "@/lib/server/mongodb"
import type { Expense, ExpenseInput, ExpenseType, TransactionKind } from "@/lib/types"

const DEFAULT_WORKSPACE_ID = "family-business"

interface ExpenseDocument {
  id: string
  workspaceId: string
  type: ExpenseType
  kind?: TransactionKind
  amount: number
  paidByUserId: string
  ownerUserId: string
  date: string
  note: string
  createdAt: Date
  updatedAt: Date
}

export async function listVisibleExpenses(userId: string): Promise<Expense[]> {
  const collection = await getExpensesCollection()
  const documents = await collection
    .find({
      workspaceId: DEFAULT_WORKSPACE_ID,
      $or: [{ type: "business" }, { type: "personal", ownerUserId: userId }]
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

  return expense
}

export async function deleteExpense(expenseId: string, userId: string): Promise<boolean> {
  const collection = await getExpensesCollection()
  const result = await collection.deleteOne({
    id: expenseId,
    workspaceId: DEFAULT_WORKSPACE_ID,
    $or: [{ type: "business" }, { type: "personal", ownerUserId: userId }]
  })

  return result.deletedCount === 1
}

export async function ensureExpenseIndexes(): Promise<void> {
  const collection = await getExpensesCollection()

  await Promise.all([
    collection.createIndex({ workspaceId: 1, type: 1, date: -1 }),
    collection.createIndex({ workspaceId: 1, type: 1, kind: 1, date: -1 }),
    collection.createIndex({ workspaceId: 1, ownerUserId: 1, type: 1, date: -1 }),
    collection.createIndex({ id: 1 }, { unique: true })
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
    amount: document.amount,
    paidByUserId: document.paidByUserId,
    ownerUserId: document.ownerUserId,
    date: document.date,
    note: document.note
  }
}
