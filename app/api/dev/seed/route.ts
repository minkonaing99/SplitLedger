import { NextResponse } from "next/server"
import { initialExpenses } from "@/lib/mock-data"
import { ensureAuthIndexes, upsertUser } from "@/lib/server/auth-repository"
import { ensureExpenseIndexes } from "@/lib/server/expense-repository"
import { ensureMonthlyCloseIndexes } from "@/lib/server/monthly-close-repository"
import { getMysqlPool } from "@/lib/server/mysql"
import { hashPassword } from "@/lib/server/passwords"
import { validateTrustedOrigin } from "@/lib/server/security"
import type { ResultSetHeader } from "mysql2/promise"

const WORKSPACE_ID = "family-business"
const seedUsersEnvName = "SPLITLEDGER_SEED_USERS"
const legacyUserIds = ["aurora", "brother"]
const legacyUserIdMap = {
  aurora: "t_khant_naing",
  brother: "htet_myat_naing"
} as const

interface SeedUser {
  id: string
  name: string
  email: string
  password: string
}

export async function POST(request: Request) {
  const originError = validateTrustedOrigin(request)

  if (originError) {
    return originError
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed route is disabled in production." }, { status: 403 })
  }

  await ensureAuthIndexes()
  await ensureExpenseIndexes()
  await ensureMonthlyCloseIndexes()
  const seededUsers = await seedUsers()
  const migratedExpenseUsers = await migrateLegacyExpenseUsers()
  const removedLegacyUsers = await removeLegacyUsers()
  const updatedExpenses = await backfillExpenseKinds()
  const insertedExpenses = await seedExpenses()

  return NextResponse.json({
    ok: true,
    users: seededUsers,
    migratedExpenseUsers,
    removedLegacyUsers,
    updatedExpenses,
    insertedExpenses
  })
}

async function seedUsers(): Promise<number> {
  const users = readSeedUsers()

  await Promise.all(
    users.map(async (user) => {
      await upsertUser({
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: await hashPassword(user.password)
      })
    })
  )

  return users.length
}

function readSeedUsers(): SeedUser[] {
  const encodedUsers = process.env[seedUsersEnvName]

  if (!encodedUsers) {
    throw new Error(`${seedUsersEnvName} is required for seeding users.`)
  }

  const parsed = JSON.parse(encodedUsers) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error(`${seedUsersEnvName} must be a JSON array.`)
  }

  return parsed.map(readSeedUser)
}

function readSeedUser(value: unknown): SeedUser {
  if (!value || typeof value !== "object") {
    throw new Error(`${seedUsersEnvName} contains an invalid user.`)
  }

  const record = value as Record<string, unknown>
  const id = readRequiredString(record, "id")
  const name = readRequiredString(record, "name")
  const email = readRequiredString(record, "email")
  const password = readRequiredString(record, "password")

  if (password.length < 12) {
    throw new Error(`Seed user ${id} must have a password with at least 12 characters.`)
  }

  return { id, name, email, password }
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key]

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${seedUsersEnvName} user field "${key}" is required.`)
  }

  return value.trim()
}

async function seedExpenses(): Promise<number> {
  const pool = await getMysqlPool()
  const now = new Date()
  let inserted = 0

  for (const expense of initialExpenses) {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO expenses
         (id, workspace_id, type, kind, payment_method,
          transfer_from_payment_method, transfer_to_payment_method,
          amount, paid_by_user_id, owner_user_id, date, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         type = VALUES(type), kind = VALUES(kind),
         payment_method = VALUES(payment_method),
         amount = VALUES(amount), paid_by_user_id = VALUES(paid_by_user_id),
         owner_user_id = VALUES(owner_user_id), date = VALUES(date),
         note = VALUES(note), updated_at = VALUES(updated_at)`,
      [
        expense.id, WORKSPACE_ID, expense.type, expense.kind ?? "expense",
        expense.paymentMethod ?? null, null, null,
        expense.amount, expense.paidByUserId, expense.ownerUserId,
        expense.date, expense.note, now, now
      ]
    )

    if (result.affectedRows === 1) {
      inserted++
    }
  }

  return inserted
}

async function migrateLegacyExpenseUsers(): Promise<number> {
  const pool = await getMysqlPool()
  let modifiedCount = 0

  for (const [legacyUserId, nextUserId] of Object.entries(legacyUserIdMap)) {
    const [r1] = await pool.execute<ResultSetHeader>(
      "UPDATE expenses SET paid_by_user_id = ? WHERE paid_by_user_id = ?",
      [nextUserId, legacyUserId]
    )
    const [r2] = await pool.execute<ResultSetHeader>(
      "UPDATE expenses SET owner_user_id = ? WHERE owner_user_id = ?",
      [nextUserId, legacyUserId]
    )
    modifiedCount += r1.affectedRows + r2.affectedRows
  }

  return modifiedCount
}

async function removeLegacyUsers(): Promise<number> {
  const pool = await getMysqlPool()
  const placeholders = legacyUserIds.map(() => "?").join(", ")
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM users WHERE id IN (${placeholders})`,
    legacyUserIds
  )
  return result.affectedRows
}

async function backfillExpenseKinds(): Promise<number> {
  const pool = await getMysqlPool()
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE expenses SET kind = 'expense', updated_at = NOW() WHERE kind IS NULL"
  )
  return result.affectedRows
}
