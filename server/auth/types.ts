export interface User {
  id: string
  nimiqAddress: string
  publicKeyHex: string
  displayName: string
  createdAt: Date
  updatedAt: Date
}

export interface Challenge {
  id: string
  walletAddress: string
  nonceHash: string
  message: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

export interface Session {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
  createdAt: Date
}

export interface ChallengeStore {
  create(challenge: Omit<Challenge, 'createdAt'>): Promise<void>
  consume(id: string, now: Date): Promise<Challenge | null>
}

export interface SessionStore {
  create(session: Omit<Session, 'createdAt' | 'revokedAt'>): Promise<void>
  findByTokenHash(tokenHash: string, now: Date): Promise<Session | null>
  revoke(id: string, now: Date): Promise<void>
}

export interface UserStore {
  upsertByAddress(input: {
    nimiqAddress: string
    publicKeyHex: string
    defaultDisplayName: string
  }): Promise<{ user: User; created: boolean }>
  findById(id: string): Promise<User | null>
  updateDisplayName(id: string, displayName: string): Promise<User | null>
}

export interface Stores {
  challenges: ChallengeStore
  sessions: SessionStore
  users: UserStore
}
