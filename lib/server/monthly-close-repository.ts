import type { Collection, WithId } from "mongodb"
import { getMongoConnection } from "@/lib/server/mongodb"
import type { MonthlyClose, MonthlyCloseSnapshot } from "@/lib/types"

const DEFAULT_WORKSPACE_ID = "family-business"

interface MonthlyCloseDocument extends Omit<MonthlyClose, "closedAt"> {
  workspaceId: string
  closedAt: Date
  updatedAt: Date
}

export async function listMonthlyCloses(): Promise<MonthlyClose[]> {
  const collection = await getMonthlyClosesCollection()
  const documents = await collection
    .find({ workspaceId: DEFAULT_WORKSPACE_ID })
    .sort({ monthKey: -1 })
    .toArray()

  return documents.map(toMonthlyClose)
}

export async function upsertMonthlyClose({
  closedByUserId,
  snapshot
}: {
  closedByUserId: string
  snapshot: MonthlyCloseSnapshot
}): Promise<MonthlyClose> {
  const collection = await getMonthlyClosesCollection()
  const now = new Date()
  const id = crypto.randomUUID()

  const result = await collection.findOneAndUpdate(
    {
      monthKey: snapshot.monthKey,
      workspaceId: DEFAULT_WORKSPACE_ID
    },
    {
      $set: {
        ...snapshot,
        closedAt: now,
        closedByUserId,
        updatedAt: now
      },
      $setOnInsert: {
        id,
        workspaceId: DEFAULT_WORKSPACE_ID
      }
    },
    {
      returnDocument: "after",
      upsert: true
    }
  )

  if (!result) {
    throw new Error("Unable to close month.")
  }

  return toMonthlyClose(result)
}

export async function ensureMonthlyCloseIndexes(): Promise<void> {
  const collection = await getMonthlyClosesCollection()

  await collection.createIndex(
    { workspaceId: 1, monthKey: 1 },
    { unique: true }
  )
}

async function getMonthlyClosesCollection(): Promise<Collection<MonthlyCloseDocument>> {
  const { db } = await getMongoConnection()
  return db.collection<MonthlyCloseDocument>("monthlyCloses")
}

function toMonthlyClose(document: WithId<MonthlyCloseDocument>): MonthlyClose {
  return {
    id: document.id,
    monthKey: document.monthKey,
    cashOpeningBalance: document.cashOpeningBalance,
    kpayOpeningBalance: document.kpayOpeningBalance,
    cashClosingBalance: document.cashClosingBalance,
    kpayClosingBalance: document.kpayClosingBalance,
    incomeTotal: document.incomeTotal,
    expenseTotal: document.expenseTotal,
    transferTotal: document.transferTotal,
    transactionCount: document.transactionCount,
    closedByUserId: document.closedByUserId,
    closedAt: document.closedAt.toISOString()
  }
}
