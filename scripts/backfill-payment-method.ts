import { getMongoConnection } from "../lib/server/mongodb.ts"

const DEFAULT_WORKSPACE_ID = "family-business"

const { client, db } = await getMongoConnection()

try {
  const result = await db.collection("expenses").updateMany(
    {
      workspaceId: DEFAULT_WORKSPACE_ID,
      type: "business",
      paymentMethod: { $exists: false }
    },
    {
      $set: {
        paymentMethod: "cash",
        updatedAt: new Date()
      }
    }
  )

  console.log(`Backfilled ${result.modifiedCount} business expenses with paymentMethod=cash.`)
} finally {
  await client.close()
}
