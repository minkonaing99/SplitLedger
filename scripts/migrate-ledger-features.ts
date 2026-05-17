import { MongoClient, ServerApiVersion } from "mongodb"

const DEFAULT_WORKSPACE_ID = "family-business"

const expenseValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "id",
      "workspaceId",
      "type",
      "kind",
      "amount",
      "paidByUserId",
      "ownerUserId",
      "date",
      "note",
      "createdAt",
      "updatedAt"
    ],
    properties: {
      id: { bsonType: "string" },
      workspaceId: { bsonType: "string" },
      type: { enum: ["business", "personal"] },
      kind: { enum: ["expense", "income", "transfer"] },
      paymentMethod: { enum: ["cash", "kpay"] },
      transferFromPaymentMethod: { enum: ["cash", "kpay"] },
      transferToPaymentMethod: { enum: ["cash", "kpay"] },
      amount: { bsonType: ["double", "int", "long", "decimal"] },
      paidByUserId: { bsonType: "string" },
      ownerUserId: { bsonType: "string" },
      date: { bsonType: "string" },
      note: { bsonType: "string" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" }
    }
  }
}

const databaseName = process.env.MONGODB_DB ?? "splitledger"
const client = new MongoClient(getMaintenanceUri(), {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})
await client.connect()
const db = client.db(databaseName)

try {
  await ensureExpensesCollection()
  await ensureExpenseIndexes()
  await ensureMonthlyCloseCollection()
  await ensureMonthlyCloseIndexes()

  const result = await db.collection("expenses").updateMany(
    {
      workspaceId: DEFAULT_WORKSPACE_ID,
      type: "business",
      kind: { $ne: "transfer" },
      paymentMethod: { $exists: false }
    },
    {
      $set: {
        paymentMethod: "cash",
        updatedAt: new Date()
      }
    }
  )

  console.log(`Updated expenses validator and backfilled ${result.modifiedCount} business expenses.`)
} finally {
  await client.close()
}

async function ensureMonthlyCloseCollection(): Promise<void> {
  const collections = await db
    .listCollections({ name: "monthlyCloses" }, { nameOnly: true })
    .toArray()

  if (collections.length === 0) {
    await db.createCollection("monthlyCloses")
  }
}

async function ensureExpenseIndexes(): Promise<void> {
  const collection = db.collection("expenses")

  await Promise.all([
    collection.createIndex({ workspaceId: 1, type: 1, date: -1 }),
    collection.createIndex({ workspaceId: 1, type: 1, kind: 1, date: -1 }),
    collection.createIndex({ workspaceId: 1, type: 1, paymentMethod: 1, date: -1 }),
    collection.createIndex({ workspaceId: 1, ownerUserId: 1, type: 1, date: -1 }),
    collection.createIndex({ id: 1 }, { unique: true })
  ])
}

async function ensureMonthlyCloseIndexes(): Promise<void> {
  await db.collection("monthlyCloses").createIndex(
    { workspaceId: 1, monthKey: 1 },
    { unique: true }
  )
}

async function ensureExpensesCollection(): Promise<void> {
  const collections = await db
    .listCollections({ name: "expenses" }, { nameOnly: true })
    .toArray()

  if (collections.length === 0) {
    await db.createCollection("expenses", {
      validationLevel: "moderate",
      validator: expenseValidator
    })
    return
  }

  await db.command({
    collMod: "expenses",
    validationLevel: "moderate",
    validator: expenseValidator
  })
}

function getMaintenanceUri(): string {
  const username = process.env.MONGO_ROOT_USERNAME
  const password = process.env.MONGO_ROOT_PASSWORD

  if (!username || !password) {
    throw new Error("MONGO_ROOT_USERNAME and MONGO_ROOT_PASSWORD are required for migration.")
  }

  const host = getMongoHost()
  return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}/admin?authSource=admin`
}

function getMongoHost(): string {
  const portBind = process.env.MONGO_PORT_BIND

  if (!portBind) {
    return "localhost:27017"
  }

  return portBind.replace(/^0\.0\.0\.0:/, "127.0.0.1:")
}
