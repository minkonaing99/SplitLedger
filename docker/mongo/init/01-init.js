const databaseName = process.env.MONGO_INITDB_DATABASE || "splitledger"
const appUsername = process.env.MONGO_APP_USERNAME
const appPassword = process.env.MONGO_APP_PASSWORD
const database = db.getSiblingDB(databaseName)

if (appUsername && appPassword) {
  database.createUser({
    user: appUsername,
    pwd: appPassword,
    roles: [
      {
        role: "readWrite",
        db: databaseName
      }
    ]
  })
}

database.createCollection("expenses", {
  validator: {
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
        id: {
          bsonType: "string"
        },
        workspaceId: {
          bsonType: "string"
        },
        type: {
          enum: ["business", "personal"]
        },
        kind: {
          enum: ["expense", "income", "transfer"]
        },
        paymentMethod: {
          enum: ["cash", "kpay"]
        },
        transferFromPaymentMethod: {
          enum: ["cash", "kpay"]
        },
        transferToPaymentMethod: {
          enum: ["cash", "kpay"]
        },
        amount: {
          bsonType: ["double", "int", "long", "decimal"]
        },
        paidByUserId: {
          bsonType: "string"
        },
        ownerUserId: {
          bsonType: "string"
        },
        date: {
          bsonType: "string"
        },
        note: {
          bsonType: "string"
        },
        createdAt: {
          bsonType: "date"
        },
        updatedAt: {
          bsonType: "date"
        }
      }
    }
  }
})

database.expenses.createIndex({ workspaceId: 1, type: 1, date: -1 })
database.expenses.createIndex({ workspaceId: 1, type: 1, kind: 1, date: -1 })
database.expenses.createIndex({ workspaceId: 1, type: 1, paymentMethod: 1, date: -1 })
database.expenses.createIndex({ workspaceId: 1, ownerUserId: 1, type: 1, date: -1 })
database.expenses.createIndex({ id: 1 }, { unique: true })

database.createCollection("monthlyCloses")
database.monthlyCloses.createIndex({ workspaceId: 1, monthKey: 1 }, { unique: true })

database.createCollection("expenseAudits")
database.expenseAudits.createIndex({ workspaceId: 1, expenseId: 1, createdAt: -1 })
database.expenseAudits.createIndex({ workspaceId: 1, actorUserId: 1, createdAt: -1 })

database.createCollection("users")
database.users.createIndex({ id: 1 }, { unique: true })
database.users.createIndex({ email: 1 }, { unique: true })

database.createCollection("sessions")
database.sessions.createIndex({ tokenHash: 1 }, { unique: true })
database.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })

database.createCollection("loginAttempts")
database.loginAttempts.createIndex({ key: 1, createdAt: -1 })
database.loginAttempts.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })
