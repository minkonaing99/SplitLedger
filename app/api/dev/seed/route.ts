import { NextResponse } from "next/server"
import { demoCredentials, initialExpenses, users } from "@/lib/mock-data"
import { ensureAuthIndexes, upsertUser } from "@/lib/server/auth-repository"
import { ensureExpenseIndexes } from "@/lib/server/expense-repository"
import { getMongoConnection } from "@/lib/server/mongodb"
import { hashPassword } from "@/lib/server/passwords"

const WORKSPACE_ID = "family-business"

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed route is disabled in production." }, { status: 403 })
  }

  await ensureAuthIndexes()
  await ensureExpenseIndexes()
  await seedUsers()
  const updatedExpenses = await backfillExpenseKinds()
  const insertedExpenses = await seedExpenses()

  return NextResponse.json({
    ok: true,
    users: users.length,
    updatedExpenses,
    insertedExpenses
  })
}

async function seedUsers(): Promise<void> {
  await Promise.all(
    demoCredentials.map(async (credential) => {
      const user = users.find((item) => item.id === credential.userId)

      if (!user) {
        return
      }

      await upsertUser({
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: await hashPassword(credential.password)
      })
    })
  )
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
        $setOnInsert: {
          ...expense,
          kind: expense.kind ?? "expense",
          workspaceId: WORKSPACE_ID,
          createdAt: now,
          updatedAt: now
        }
      },
      { upsert: true }
    )

    inserted += result.upsertedCount
  }

  return inserted
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
