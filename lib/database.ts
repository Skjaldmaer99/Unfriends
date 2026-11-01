import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "../db/schema"

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("DATABASE_URL is not configured.")
    this.name = "DatabaseConfigurationError"
  }
}

type ApplicationDatabase = NodePgDatabase<typeof schema>
type DatabaseGlobals = typeof globalThis & {
  __unfriendsPool?: Pool
  __unfriendsDatabase?: ApplicationDatabase
}

const databaseGlobals = globalThis as DatabaseGlobals

export function getDatabase(): ApplicationDatabase {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new DatabaseConfigurationError()
  }

  databaseGlobals.__unfriendsPool ??= new Pool({
    connectionString,
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  })
  databaseGlobals.__unfriendsDatabase ??= drizzle(
    databaseGlobals.__unfriendsPool,
    {
      schema,
    }
  )

  return databaseGlobals.__unfriendsDatabase
}

export async function closeDatabase(): Promise<void> {
  if (databaseGlobals.__unfriendsPool) {
    await databaseGlobals.__unfriendsPool.end()
    delete databaseGlobals.__unfriendsPool
    delete databaseGlobals.__unfriendsDatabase
  }
}
