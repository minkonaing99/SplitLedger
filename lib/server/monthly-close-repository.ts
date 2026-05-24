import type { RowDataPacket, ResultSetHeader } from "mysql2/promise"
import { getMysqlPool } from "@/lib/server/mysql"
import type { MonthlyClose, MonthlyCloseSnapshot } from "@/lib/types"

const DEFAULT_WORKSPACE_ID = "family-business"

interface MonthlyCloseRow extends RowDataPacket {
  id: string
  workspace_id: string
  month_key: string
  cash_opening_balance: number
  kpay_opening_balance: number
  cash_closing_balance: number
  kpay_closing_balance: number
  income_total: number
  expense_total: number
  transfer_total: number
  transaction_count: number
  closed_by_user_id: string
  closed_at: Date
  updated_at: Date
}

export async function listMonthlyCloses(): Promise<MonthlyClose[]> {
  const pool = await getMysqlPool()
  const [rows] = await pool.execute<MonthlyCloseRow[]>(
    "SELECT * FROM monthly_closes WHERE workspace_id = ? ORDER BY month_key DESC",
    [DEFAULT_WORKSPACE_ID]
  )
  return rows.map(toMonthlyClose)
}

export async function upsertMonthlyClose({
  closedByUserId,
  snapshot
}: {
  closedByUserId: string
  snapshot: MonthlyCloseSnapshot
}): Promise<MonthlyClose> {
  const pool = await getMysqlPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const now = new Date()
    const newId = crypto.randomUUID()

    await connection.execute<ResultSetHeader>(
      `INSERT INTO monthly_closes
         (id, workspace_id, month_key, cash_opening_balance, kpay_opening_balance,
          cash_closing_balance, kpay_closing_balance, income_total, expense_total,
          transfer_total, transaction_count, closed_by_user_id, closed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cash_opening_balance = VALUES(cash_opening_balance),
         kpay_opening_balance = VALUES(kpay_opening_balance),
         cash_closing_balance = VALUES(cash_closing_balance),
         kpay_closing_balance = VALUES(kpay_closing_balance),
         income_total         = VALUES(income_total),
         expense_total        = VALUES(expense_total),
         transfer_total       = VALUES(transfer_total),
         transaction_count    = VALUES(transaction_count),
         closed_by_user_id    = VALUES(closed_by_user_id),
         closed_at            = VALUES(closed_at),
         updated_at           = VALUES(updated_at)`,
      [
        newId, DEFAULT_WORKSPACE_ID, snapshot.monthKey,
        snapshot.cashOpeningBalance, snapshot.kpayOpeningBalance,
        snapshot.cashClosingBalance, snapshot.kpayClosingBalance,
        snapshot.incomeTotal, snapshot.expenseTotal, snapshot.transferTotal,
        snapshot.transactionCount, closedByUserId, now, now
      ]
    )

    const [rows] = await connection.execute<MonthlyCloseRow[]>(
      "SELECT * FROM monthly_closes WHERE workspace_id = ? AND month_key = ?",
      [DEFAULT_WORKSPACE_ID, snapshot.monthKey]
    )

    await connection.commit()

    if (!rows[0]) {
      throw new Error("Unable to close month.")
    }

    return toMonthlyClose(rows[0])
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function ensureMonthlyCloseIndexes(): Promise<void> {
  // Indexes are managed by schema migrations in lib/server/db/migrations.ts
}

function toMonthlyClose(row: MonthlyCloseRow): MonthlyClose {
  return {
    id: row.id,
    monthKey: row.month_key,
    cashOpeningBalance: row.cash_opening_balance,
    kpayOpeningBalance: row.kpay_opening_balance,
    cashClosingBalance: row.cash_closing_balance,
    kpayClosingBalance: row.kpay_closing_balance,
    incomeTotal: row.income_total,
    expenseTotal: row.expense_total,
    transferTotal: row.transfer_total,
    transactionCount: row.transaction_count,
    closedByUserId: row.closed_by_user_id,
    closedAt: row.closed_at.toISOString()
  }
}
