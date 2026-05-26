import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"
import { getMysqlPool } from "@/lib/server/mysql"
import { validateTrustedOrigin } from "@/lib/server/security"

const SMOKE_TEST_WORKSPACE_ID = "health-smoke-test"

export async function GET() {
  try {
    const pool = await getMysqlPool()
    await pool.execute("SELECT 1")

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to connect to the database." },
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

  const smokeId = crypto.randomUUID()

  try {
    const pool = await getMysqlPool()
    const now = new Date()

    await pool.execute(
      `INSERT INTO expenses
         (id, workspace_id, type, kind, amount, paid_by_user_id, owner_user_id, date, note, created_at, updated_at)
       VALUES (?, ?, 'business', 'expense', 1, 'health-check', 'health-check', ?, 'Temporary database smoke test', ?, ?)`,
      [smokeId, SMOKE_TEST_WORKSPACE_ID, now.toISOString().slice(0, 10), now, now]
    )

    interface SmokeRow extends RowDataPacket { id: string }
    const [rows] = await pool.execute<SmokeRow[]>(
      "SELECT id FROM expenses WHERE id = ?",
      [smokeId]
    )

    const [deleteResult] = await pool.execute<ResultSetHeader>(
      "DELETE FROM expenses WHERE id = ?",
      [smokeId]
    )

    return NextResponse.json({
      ok: Boolean(rows[0]) && deleteResult.affectedRows === 1,
      checks: {
        ping: true,
        insert: Boolean(rows[0]),
        delete: deleteResult.affectedRows === 1
      }
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to run database smoke test." },
      { status: 500 }
    )
  }
}
