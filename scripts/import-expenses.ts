import { readFileSync, existsSync } from "node:fs"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"

const INPUT_FILE = process.argv[2]

if (!INPUT_FILE) {
  console.error("Usage: npx tsx scripts/import-expenses.ts <path-to-expenses.json>")
  process.exit(1)
}

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "data")
const EXPENSES_FILE = join(DATA_DIR, "expenses.json")
const WORKSPACE_ID = "family-business"

function resolvePaymentMethod(note: string, type: string, kind: string): string | null {
  if (type !== "business" || kind === "transfer") return null
  return /kpay/i.test(note) ? "kpay" : "cash"
}

const lines = readFileSync(INPUT_FILE, "utf8")
  .split("\n")
  .filter(line => line.trim().length > 0)

await mkdir(DATA_DIR, { recursive: true })

const existing: unknown[] = existsSync(EXPENSES_FILE)
  ? (JSON.parse(await readFile(EXPENSES_FILE, "utf-8")) as unknown[])
  : []

const existingIds = new Set((existing as { id: string }[]).map(e => e.id))
const toInsert: unknown[] = []
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

  if (existingIds.has(doc.id)) {
    skipped++
    continue
  }

  const kind = doc.kind ?? "expense"
  const paymentMethod = resolvePaymentMethod(doc.note, doc.type, kind)

  toInsert.push({
    id: doc.id,
    workspaceId: WORKSPACE_ID,
    type: doc.type,
    kind,
    paymentMethod,
    transferFromPaymentMethod: null,
    transferToPaymentMethod: null,
    amount: doc.amount,
    paidByUserId: doc.paidByUserId,
    ownerUserId: doc.ownerUserId,
    date: doc.date,
    note: doc.note,
    createdAt: new Date(doc.createdAt.$date).toISOString(),
    updatedAt: new Date(doc.updatedAt.$date).toISOString()
  })

  const pm = paymentMethod ? ` [${paymentMethod}]` : ""
  console.log(`  + ${doc.date} ${doc.type}/${kind} ${doc.amount.toLocaleString()} — ${doc.note}${pm}`)
}

await writeFile(EXPENSES_FILE, JSON.stringify([...existing, ...toInsert], null, 2), "utf-8")
console.log(`\nDone: ${toInsert.length} inserted, ${skipped} already existed.`)
