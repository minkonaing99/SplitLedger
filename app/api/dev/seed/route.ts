import { NextResponse } from "next/server"
import { initialExpenses } from "@/lib/mock-data"
import { ensureAuthIndexes, upsertUser } from "@/lib/server/auth-repository"
import { ensureExpenseIndexes } from "@/lib/server/expense-repository"
import { getMongoConnection } from "@/lib/server/mongodb"
import { hashPassword } from "@/lib/server/passwords"
import { validateTrustedOrigin } from "@/lib/server/security"

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
  const seedUsers = readSeedUsers()

  await Promise.all(
    seedUsers.map(async (user) => {
      await upsertUser({
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: await hashPassword(user.password)
      })
    })
  )

  return seedUsers.length
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
  const { db } = await getMongoConnection()
  const collection = db.collection("expenses")
  const now = new Date()
  let inserted = 0

  for (const expense of initialExpenses) {
    const result = await collection.updateOne(
      { id: expense.id },
      {
        $set: {
          ...expense,
          kind: expense.kind ?? "expense",
          workspaceId: WORKSPACE_ID,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now,
        }
      },
      { upsert: true }
    )

    inserted += result.upsertedCount
  }

  return inserted
}

async function migrateLegacyExpenseUsers(): Promise<number> {
  const { db } = await getMongoConnection()
  let modifiedCount = 0

  for (const [legacyUserId, nextUserId] of Object.entries(legacyUserIdMap)) {
    const paidByResult = await db
      .collection("expenses")
      .updateMany({ paidByUserId: legacyUserId }, { $set: { paidByUserId: nextUserId } })
    const ownerResult = await db
      .collection("expenses")
      .updateMany({ ownerUserId: legacyUserId }, { $set: { ownerUserId: nextUserId } })

    modifiedCount += paidByResult.modifiedCount + ownerResult.modifiedCount
  }

  return modifiedCount
}

async function removeLegacyUsers(): Promise<number> {
  const { db } = await getMongoConnection()
  const usersResult = await db.collection("users").deleteMany({ id: { $in: legacyUserIds } })
  await db.collection("sessions").deleteMany({ userId: { $in: legacyUserIds } })

  return usersResult.deletedCount
}

async function backfillExpenseKinds(): Promise<number> {
  const { db } = await getMongoConnection()
  const result = await db.collection("expenses").updateMany(
    {
      kind: { $exists: false }
    },
    {
      $set: {
        kind: "expense",
        updatedAt: new Date()
      }
    }
  )

  return result.modifiedCount
}
