import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { SessionStore } from './types.js'

export function generateSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  return { token, tokenHash }
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(
  store: SessionStore,
  userId: string,
  ttlMs: number,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const { token, tokenHash } = generateSessionToken()
  const expiresAt = new Date(now.getTime() + ttlMs)
  await store.create({ id: randomUUID(), userId, tokenHash, expiresAt })
  return { token, expiresAt }
}
