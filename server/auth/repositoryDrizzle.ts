import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from '../db/client.js'
import { authChallenges, sessions, users } from '../db/schema.js'
import type {
  Challenge,
  ChallengeStore,
  Session,
  SessionStore,
  Stores,
  User,
  UserStore,
} from './types.js'

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    nimiqAddress: row.nimiqAddress,
    publicKeyHex: row.publicKeyHex,
    displayName: row.displayName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function createDrizzleStores(db: Db): Stores {
  const challenges: ChallengeStore = {
    async create(input: Omit<Challenge, 'createdAt'>) {
      await db.insert(authChallenges).values({
        id: input.id,
        walletAddress: input.walletAddress,
        nonceHash: input.nonceHash,
        message: input.message,
        expiresAt: input.expiresAt,
        usedAt: input.usedAt,
      })
    },
    async consume(id: string, now: Date): Promise<Challenge | null> {
      // Atomically mark used only if unused and unexpired; then read row.
      const consumed = await db
        .update(authChallenges)
        .set({ usedAt: now })
        .where(
          and(
            eq(authChallenges.id, id),
            isNull(authChallenges.usedAt),
            sql`${authChallenges.expiresAt} > ${now}`,
          ),
        )
        .returning()
      if (consumed.length > 0) return consumed[0] as Challenge
      const found = await db.select().from(authChallenges).where(eq(authChallenges.id, id)).limit(1)
      if (found.length === 0) return null
      return found[0] as Challenge
    },
  }

  const sessionStore: SessionStore = {
    async create(input: Omit<Session, 'createdAt' | 'revokedAt'>) {
      await db.insert(sessions).values({
        id: input.id,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      })
    },
    async findByTokenHash(tokenHash: string, now: Date): Promise<Session | null> {
      const rows = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.tokenHash, tokenHash),
            isNull(sessions.revokedAt),
            sql`${sessions.expiresAt} > ${now}`,
          ),
        )
        .limit(1)
      return rows.length > 0 ? (rows[0] as Session) : null
    },
    async revoke(id: string, now: Date) {
      await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, id))
    },
  }

  const userStore: UserStore = {
    async upsertByAddress(input) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.nimiqAddress, input.nimiqAddress))
        .limit(1)
      if (existing.length > 0) {
        const updated = await db
          .update(users)
          .set({ publicKeyHex: input.publicKeyHex, updatedAt: new Date() })
          .where(eq(users.id, existing[0].id))
          .returning()
        return { user: toUser(updated[0]), created: false }
      }
      const inserted = await db
        .insert(users)
        .values({
          nimiqAddress: input.nimiqAddress,
          publicKeyHex: input.publicKeyHex,
          displayName: input.defaultDisplayName,
        })
        .returning()
      return { user: toUser(inserted[0]), created: true }
    },
    async findById(id: string) {
      const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
      return rows.length > 0 ? toUser(rows[0]) : null
    },
    async updateDisplayName(id: string, displayName: string) {
      const rows = await db
        .update(users)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning()
      return rows.length > 0 ? toUser(rows[0]) : null
    },
  }

  return { challenges, sessions: sessionStore, users: userStore }
}
