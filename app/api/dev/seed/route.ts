import { NextResponse } from "next/server"
import { initialExpenses } from "@/lib/mock-data"
import { ensureAuthIndexes, upsertUser } from "@/lib/server/auth-repository"
import { ensureExpenseIndexes } from "@/lib/server/expense-repository"
import { updateDb } from "@/lib/server/json-db"
import { ensureMonthlyCloseIndexes } from "@/lib/server/monthly-close-repository"
import { hashPassword } from "@/lib/server/passwords"
import { validateTrustedOrigin } from "@/lib/server/security"
import type { Expense } from "@/lib/types"

const WORKSPACE_ID = "family-business"
const seedUsersEnvName = "SPLITLEDGER_SEED_USERS"
const legacyUserIds = ["aurora", "brother"]
const legacyUserIdMap: Record<string, string> = {
  aurora: "t_khant_naing",
  brother: "htet_myat_naing"
}

interface SeedUser {
  id: string
  name: string
  email: string
  password: string
}

interface ExpenseRecord extends Expense {
  workspaceId: string
  createdAt: string
  updatedAt: string
}

interface UserRecord {
  id: string
  name: string
  email: string
  passwordHash: string
  createdAt: string
  updatedAt: string
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

async function seedExpenses(): Promise<number> {
  const now = new Date().toISOString()
  let inserted = 0

  await updateDb<ExpenseRecord>("expenses.json", existing => {
    const existingIds = new Set(existing.map(e => e.id))
    const toAdd: ExpenseRecord[] = []

    for (const expense of initialExpenses) {
      if (!existingIds.has(expense.id)) {
        toAdd.push({
          ...expense,
          kind: expense.kind ?? "expense",
          workspaceId: WORKSPACE_ID,
          createdAt: now,
          updatedAt: now
        })
        inserted++
      }
    }

    return [...existing, ...toAdd]
  })

  return inserted
}

async function migrateLegacyExpenseUsers(): Promise<number> {
  let modifiedCount = 0

  await updateDb<ExpenseRecord>("expenses.json", expenses => {
    return expenses.map(expense => {
      const newPaidBy = legacyUserIdMap[expense.paidByUserId]
      const newOwner = legacyUserIdMap[expense.ownerUserId]

      if (!newPaidBy && !newOwner) return expense

      if (newPaidBy) modifiedCount++
      if (newOwner) modifiedCount++

      return {
        ...expense,
        paidByUserId: newPaidBy ?? expense.paidByUserId,
        ownerUserId: newOwner ?? expense.ownerUserId
      }
    })
  })

  return modifiedCount
}

async function removeLegacyUsers(): Promise<number> {
  let removed = 0
  const ids = new Set(legacyUserIds)

  await updateDb<UserRecord>("users.json", users => {
    const filtered = users.filter(u => !ids.has(u.id))
    removed = users.length - filtered.length
    return filtered
  })

  return removed
}

async function backfillExpenseKinds(): Promise<number> {
  let updated = 0

  await updateDb<ExpenseRecord>("expenses.json", expenses =>
    expenses.map(expense => {
      if (expense.kind) return expense
      updated++
      return { ...expense, kind: "expense" }
    })
  )

  return updated
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
