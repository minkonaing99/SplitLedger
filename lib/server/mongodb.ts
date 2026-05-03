import { Db, MongoClient, ServerApiVersion } from "mongodb"

interface MongoConnection {
  client: MongoClient
  db: Db
}

const globalForMongo = globalThis as typeof globalThis & {
  mongoConnection?: Promise<MongoConnection>
}

export async function getMongoConnection(): Promise<MongoConnection> {
  if (!globalForMongo.mongoConnection) {
    globalForMongo.mongoConnection = createMongoConnection()
  }

  return globalForMongo.mongoConnection
}

async function createMongoConnection(): Promise<MongoConnection> {
  const uri = process.env.MONGODB_URI
  const databaseName = process.env.MONGODB_DB ?? "splitledger"

  if (!uri) {
    throw new Error("MONGODB_URI is required.")
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  })

  await client.connect()

  return {
    client,
    db: client.db(databaseName)
  }
}
