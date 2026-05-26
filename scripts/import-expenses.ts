import { readFileSync } from "node:fs"
import mysql from "mysql2/promise"

const INPUT_FILE = process.argv[2]

if (!INPUT_FILE) {
  console.error("Usage: npx tsx scripts/import-expenses.ts <path-to-expenses.json>")
  process.exit(1)
}
const WORKSPACE_ID = "family-business"

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: parseInt(process.env.MYSQL_PORT ?? "3306", 10),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 5,
  timezone: "+00:00"
})

function resolvePaymentMethod(note: string, type: string, kind: string): string | null {
  if (type !== "business" || kind === "transfer") return null
  return /kpay/i.test(note) ? "kpay" : "cash"
}

const lines = readFileSync(INPUT_FILE, "utf8")
  .split("\n")
  .filter(line => line.trim().length > 0)

let inserted = 0
let skipped = 0

for (const line of lines) {
  const doc = JSON.parse(line) as {
    id: string
    type: string
    kind?: string
    amount: number
    paidByUserId: string
    ownerUserId: string
    date: string
    note: string
    createdAt: { $date: string }
    updatedAt: { $date: string }
  }

  const kind = doc.kind ?? "expense"
  const paymentMethod = resolvePaymentMethod(doc.note, doc.type, kind)
  const createdAt = new Date(doc.createdAt.$date)
  const updatedAt = new Date(doc.updatedAt.$date)

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO expenses
       (id, workspace_id, type, kind, payment_method,
        transfer_from_payment_method, transfer_to_payment_method,
        amount, paid_by_user_id, owner_user_id, date, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       type             = VALUES(type),
       kind             = VALUES(kind),
       payment_method   = VALUES(payment_method),
       amount           = VALUES(amount),
       paid_by_user_id  = VALUES(paid_by_user_id),
       owner_user_id    = VALUES(owner_user_id),
       date             = VALUES(date),
       note             = VALUES(note),
       updated_at       = VALUES(updated_at)`,
    [
      doc.id, WORKSPACE_ID, doc.type, kind, paymentMethod,
      doc.amount, doc.paidByUserId, doc.ownerUserId,
      doc.date, doc.note, createdAt, updatedAt
    ]
  )

  if (result.affectedRows === 1) {
    inserted++
    const pm = paymentMethod ? ` [${paymentMethod}]` : ""
    console.log(`  + ${doc.date} ${doc.type}/${doc.kind} ${doc.amount.toLocaleString()} — ${doc.note}${pm}`)
  } else {
    skipped++
  }
}

await pool.end()
console.log(`\nDone: ${inserted} inserted, ${skipped} already existed.`)
