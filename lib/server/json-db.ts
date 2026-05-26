import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "data")

// Serialize writes per file to prevent interleaved async operations
const queue = new Map<string, Promise<void>>()

function enqueue(filename: string, task: () => Promise<void>): Promise<void> {
  const prev = queue.get(filename) ?? Promise.resolve()
  const next = prev.then(task, task)
  queue.set(filename, next.then(() => {}, () => {}))
  return next
}

export async function readDb<T>(filename: string): Promise<T[]> {
  try {
    const raw = await readFile(join(DATA_DIR, filename), "utf-8")
    return JSON.parse(raw) as T[]
  } catch {
    return []
  }
}

export async function updateDb<T>(
  filename: string,
  fn: (data: T[]) => T[]
): Promise<void> {
  return enqueue(filename, async () => {
    const data = await readDb<T>(filename)
    const updated = fn(data)
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(join(DATA_DIR, filename), JSON.stringify(updated, null, 2), "utf-8")
  })
}
