import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

export type Db = NodePgDatabase<typeof schema>

let cached: { pool: pg.Pool; db: Db } | null = null

export function getDb(databaseUrl: string): { pool: pg.Pool; db: Db } {
  if (cached) return cached
  const pool = new pg.Pool({ connectionString: databaseUrl })
  const db = drizzle(pool, { schema })
  cached = { pool, db }
  return cached
}
