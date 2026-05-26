import mysql, { type Pool } from "mysql2/promise"
import { MIGRATIONS } from "@/lib/server/db/migrations"

const globalForMySQL = globalThis as typeof globalThis & {
  mysqlPool?: Pool
  mysqlMigrated?: boolean
}

export async function getMysqlPool(): Promise<Pool> {
  if (!globalForMySQL.mysqlPool) {
    globalForMySQL.mysqlPool = createPool()
  }

  if (!globalForMySQL.mysqlMigrated) {
    for (const sql of MIGRATIONS) {
      await globalForMySQL.mysqlPool.execute(sql)
    }
    globalForMySQL.mysqlMigrated = true
  }

  return globalForMySQL.mysqlPool
}

function createPool(): Pool {
  const user = process.env.MYSQL_USER
  const password = process.env.MYSQL_PASSWORD
  const database = process.env.MYSQL_DB
  const socketPath = process.env.MYSQL_SOCKET

  if (!user || !password || !database) {
    throw new Error("MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DB are required.")
  }

  const transport = socketPath
    ? { socketPath }
    : {
        host: process.env.MYSQL_HOST ?? "127.0.0.1",
        port: parseInt(process.env.MYSQL_PORT ?? "3306", 10)
      }

  return mysql.createPool({
    ...transport,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: "+00:00"
  })
}
