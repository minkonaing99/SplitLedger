import { mkdir, writeFile, unlink } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "data")

export async function GET() {
  try {
    await mkdir(DATA_DIR, { recursive: true })
    return NextResponse.json({ ok: true, storage: "json", dataDir: DATA_DIR })
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to access data directory." },
      { status: 500 }
    )
  }
}

export async function POST() {
  const testFile = join(DATA_DIR, `smoke-test-${Date.now()}.tmp`)
  try {
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(testFile, "ok", "utf-8")
    await unlink(testFile)
    return NextResponse.json({ ok: true, checks: { write: true, delete: true } })
  } catch {
    return NextResponse.json(
      { ok: false, error: "Data directory is not writable." },
      { status: 500 }
    )
  }
}
