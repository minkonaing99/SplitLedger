import { NextResponse } from "next/server"
import { getMongoConnection } from "@/lib/server/mongodb"
import { validateTrustedOrigin } from "@/lib/server/security"

const SMOKE_TEST_WORKSPACE_ID = "health-smoke-test"

export async function GET() {
  try {
    const { db } = await getMongoConnection()
    await db.command({ ping: 1 })

    return NextResponse.json({
      ok: true,
      database: db.databaseName
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to connect to MongoDB."
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const originError = validateTrustedOrigin(request)

  if (originError) {
    return originError
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        ok: false,
        error: "Database smoke test is disabled in production."
      },
      { status: 403 }
    )
  }

  const smokeId = `smoke-${crypto.randomUUID()}`

  try {
    const { db } = await getMongoConnection()
    const collection = db.collection("expenses")
    const now = new Date()

    await collection.insertOne({
      id: smokeId,
      workspaceId: SMOKE_TEST_WORKSPACE_ID,
      type: "business",
      kind: "expense",
      amount: 1,
      paidByUserId: "health-check",
      ownerUserId: "health-check",
      date: now.toISOString().slice(0, 10),
      note: "Temporary database smoke test",
      createdAt: now,
      updatedAt: now
    })

    const inserted = await collection.findOne({ id: smokeId })
    const deleteResult = await collection.deleteOne({ id: smokeId })

    return NextResponse.json({
      ok: Boolean(inserted) && deleteResult.deletedCount === 1,
      database: db.databaseName,
      checks: {
        ping: true,
        insert: Boolean(inserted),
        delete: deleteResult.deletedCount === 1
      }
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to run database smoke test."
      },
      { status: 500 }
    )
  }
}
