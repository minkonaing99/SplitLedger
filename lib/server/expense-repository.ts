import type { RowDataPacket, ResultSetHeader } from "mysql2/promise"
import {
  buildAccessibleExpenseWhere,
  buildVisibleExpenseWhere
} from "@/lib/server/expense-access"
import { getMysqlPool } from "@/lib/server/mysql"
import type {
  Expense,
  ExpenseInput,
  ExpenseType,
  PaymentMethod,
  TransactionKind
} from "@/lib/types"

const DEFAULT_WORKSPACE_ID = "family-business"

interface ExpenseRow extends RowDataPacket {
  id: string
  workspace_id: string
  type: ExpenseType
  kind: TransactionKind
  payment_method: PaymentMethod | null
  transfer_from_payment_method: PaymentMethod | null
  transfer_to_payment_method: PaymentMethod | null
  amount: number
  paid_by_user_id: string
  owner_user_id: string
  date: string
  note: string
  created_at: Date
  updated_at: Date
}

export async function listVisibleExpenses(userId: string): Promise<Expense[]> {
  const pool = await getMysqlPool()
  const { clause, params } = buildVisibleExpenseWhere(userId)
  const [rows] = await pool.execute<ExpenseRow[]>(
    `SELECT * FROM expenses
     WHERE workspace_id = ? AND ${clause}
     ORDER BY date DESC, created_at DESC`,
    [DEFAULT_WORKSPACE_ID, ...params]
  )
  return rows.map(toExpense)
}

export async function listBusinessExpenses(): Promise<Expense[]> {
  const pool = await getMysqlPool()
  const [rows] = await pool.execute<ExpenseRow[]>(
    `SELECT * FROM expenses
     WHERE workspace_id = ? AND type = 'business'
     ORDER BY date DESC, created_at DESC`,
    [DEFAULT_WORKSPACE_ID]
  )
  return rows.map(toExpense)
}

export async function insertExpense(input: ExpenseInput): Promise<Expense> {
  const pool = await getMysqlPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const now = new Date()
    const expense: Expense = { ...input, id: crypto.randomUUID() }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO expenses
         (id, workspace_id, type, kind, payment_method,
          transfer_from_payment_method, transfer_to_payment_method,
          amount, paid_by_user_id, owner_user_id, date, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expense.id, DEFAULT_WORKSPACE_ID, expense.type, expense.kind,
        expense.paymentMethod ?? null,
        expense.transferFromPaymentMethod ?? null,
        expense.transferToPaymentMethod ?? null,
        expense.amount, expense.paidByUserId, expense.ownerUserId,
        expense.date, expense.note, now, now
      ]
    )

    await connection.execute<ResultSetHeader>(
      `INSERT INTO expense_audits
         (id, workspace_id, expense_id, action, actor_user_id, expense_json, created_at)
       VALUES (?, ?, ?, 'create', ?, ?, ?)`,
      [crypto.randomUUID(), DEFAULT_WORKSPACE_ID, expense.id, input.paidByUserId, JSON.stringify(expense), now]
    )

    await connection.commit()
    return expense
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function deleteExpense(expenseId: string, userId: string): Promise<boolean> {
  const pool = await getMysqlPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const { clause, params } = buildAccessibleExpenseWhere(expenseId, userId)

    const [rows] = await connection.execute<ExpenseRow[]>(
      `SELECT * FROM expenses WHERE workspace_id = ? AND ${clause}`,
      [DEFAULT_WORKSPACE_ID, ...params]
    )

    const row = rows[0]
    if (!row) {
      await connection.rollback()
      return false
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `DELETE FROM expenses WHERE workspace_id = ? AND ${clause}`,
      [DEFAULT_WORKSPACE_ID, ...params]
    )

    if (result.affectedRows === 1) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO expense_audits
           (id, workspace_id, expense_id, action, actor_user_id, expense_json, created_at)
         VALUES (?, ?, ?, 'delete', ?, ?, ?)`,
        [crypto.randomUUID(), DEFAULT_WORKSPACE_ID, expenseId, userId, JSON.stringify(toExpense(row)), new Date()]
      )
    }

    await connection.commit()
    return result.affectedRows === 1
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function ensureExpenseIndexes(): Promise<void> {
  // Indexes are managed by schema migrations in lib/server/db/migrations.ts
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    type: row.type,
    kind: row.kind,
    paymentMethod: row.payment_method ?? undefined,
    transferFromPaymentMethod: row.transfer_from_payment_method ?? undefined,
    transferToPaymentMethod: row.transfer_to_payment_method ?? undefined,
    amount: row.amount,
    paidByUserId: row.paid_by_user_id,
    ownerUserId: row.owner_user_id,
    date: row.date,
    note: row.note
  }
}
