import { randomUUID } from 'node:crypto'
import type {
  Challenge,
  ChallengeStore,
  Session,
  SessionStore,
  Stores,
  User,
  UserStore,
} from './types.js'

class MemoryChallengeStore implements ChallengeStore {
  private readonly rows = new Map<string, Challenge>()
  async create(input: Omit<Challenge, 'createdAt'>): Promise<void> {
    this.rows.set(input.id, { ...input, createdAt: new Date() })
  }
  async consume(id: string, now: Date): Promise<Challenge | null> {
    const row = this.rows.get(id)
    if (!row) return null
    if (row.usedAt) return { ...row }
    if (row.expiresAt.getTime() <= now.getTime()) return { ...row }
    const consumed = { ...row, usedAt: now }
    this.rows.set(id, consumed)
    return consumed
  }
}

class MemorySessionStore implements SessionStore {
  private readonly rows = new Map<string, Session>()
  private readonly byHash = new Map<string, string>()
  async create(input: Omit<Session, 'createdAt' | 'revokedAt'>): Promise<void> {
    const row: Session = { ...input, createdAt: new Date(), revokedAt: null }
    this.rows.set(row.id, row)
    this.byHash.set(row.tokenHash, row.id)
  }
  async findByTokenHash(tokenHash: string, now: Date): Promise<Session | null> {
    const id = this.byHash.get(tokenHash)
    if (!id) return null
    const row = this.rows.get(id)
    if (!row) return null
    if (row.revokedAt) return null
    if (row.expiresAt.getTime() <= now.getTime()) return null
    return { ...row }
  }
  async revoke(id: string, now: Date): Promise<void> {
    const row = this.rows.get(id)
    if (!row) return
    this.rows.set(id, { ...row, revokedAt: now })
  }
}

class MemoryUserStore implements UserStore {
  private readonly byId = new Map<string, User>()
  private readonly byAddress = new Map<string, string>()
  async upsertByAddress(input: {
    nimiqAddress: string
    publicKeyHex: string
    defaultDisplayName: string
  }): Promise<{ user: User; created: boolean }> {
    const existingId = this.byAddress.get(input.nimiqAddress)
    if (existingId) {
      const existing = this.byId.get(existingId)!
      const updated: User = { ...existing, publicKeyHex: input.publicKeyHex, updatedAt: new Date() }
      this.byId.set(existingId, updated)
      return { user: { ...updated }, created: false }
    }
    const now = new Date()
    const user: User = {
      id: randomUUID(),
      nimiqAddress: input.nimiqAddress,
      publicKeyHex: input.publicKeyHex,
      displayName: input.defaultDisplayName,
      createdAt: now,
      updatedAt: now,
    }
    this.byId.set(user.id, user)
    this.byAddress.set(user.nimiqAddress, user.id)
    return { user: { ...user }, created: true }
  }
  async findById(id: string): Promise<User | null> {
    const row = this.byId.get(id)
    return row ? { ...row } : null
  }
  async updateDisplayName(id: string, displayName: string): Promise<User | null> {
    const row = this.byId.get(id)
    if (!row) return null
    const updated: User = { ...row, displayName, updatedAt: new Date() }
    this.byId.set(id, updated)
    return { ...updated }
  }
}

export function createMemoryStores(): Stores {
  return {
    challenges: new MemoryChallengeStore(),
    sessions: new MemorySessionStore(),
    users: new MemoryUserStore(),
  }
}
