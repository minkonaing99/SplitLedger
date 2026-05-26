import { readDb, updateDb } from "@/lib/server/json-db"
import type { MonthlyClose, MonthlyCloseSnapshot } from "@/lib/types"

const DEFAULT_WORKSPACE_ID = "family-business"

interface MonthlyCloseRecord extends MonthlyClose {
  workspaceId: string
  updatedAt: string
}

export async function listMonthlyCloses(): Promise<MonthlyClose[]> {
  const all = await readDb<MonthlyCloseRecord>("monthly-closes.json")
  return all
    .filter(m => m.workspaceId === DEFAULT_WORKSPACE_ID)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    .map(toMonthlyClose)
}

export async function upsertMonthlyClose({
  closedByUserId,
  snapshot
}: {
  closedByUserId: string
  snapshot: MonthlyCloseSnapshot
}): Promise<MonthlyClose> {
  let result: MonthlyClose | undefined

  await updateDb<MonthlyCloseRecord>("monthly-closes.json", records => {
    const now = new Date().toISOString()
    const existing = records.find(
      r => r.workspaceId === DEFAULT_WORKSPACE_ID && r.monthKey === snapshot.monthKey
    )

    const record: MonthlyCloseRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      workspaceId: DEFAULT_WORKSPACE_ID,
      monthKey: snapshot.monthKey,
      cashOpeningBalance: snapshot.cashOpeningBalance,
      kpayOpeningBalance: snapshot.kpayOpeningBalance,
      cashClosingBalance: snapshot.cashClosingBalance,
      kpayClosingBalance: snapshot.kpayClosingBalance,
      incomeTotal: snapshot.incomeTotal,
      expenseTotal: snapshot.expenseTotal,
      transferTotal: snapshot.transferTotal,
      transactionCount: snapshot.transactionCount,
      closedByUserId,
      closedAt: existing?.closedAt ?? now,
      updatedAt: now
    }

    result = toMonthlyClose(record)

    if (existing) {
      return records.map(r =>
        r.workspaceId === DEFAULT_WORKSPACE_ID && r.monthKey === snapshot.monthKey ? record : r
      )
    }

    return [...records, record]
  })

  if (!result) throw new Error("Unable to close month.")
  return result
}

export async function ensureMonthlyCloseIndexes(): Promise<void> {}

function toMonthlyClose(record: MonthlyCloseRecord): MonthlyClose {
  return {
    id: record.id,
    monthKey: record.monthKey,
    cashOpeningBalance: record.cashOpeningBalance,
    kpayOpeningBalance: record.kpayOpeningBalance,
    cashClosingBalance: record.cashClosingBalance,
    kpayClosingBalance: record.kpayClosingBalance,
    incomeTotal: record.incomeTotal,
    expenseTotal: record.expenseTotal,
    transferTotal: record.transferTotal,
    transactionCount: record.transactionCount,
    closedByUserId: record.closedByUserId,
    closedAt: record.closedAt
  }
}
