import { getMongoConnection } from "../lib/server/mongodb.ts"
import { ensureExpenseIndexes } from "../lib/server/expense-repository.ts"
import { ensureMonthlyCloseIndexes } from "../lib/server/monthly-close-repository.ts"

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

const { client, db } = await getMongoConnection()

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
