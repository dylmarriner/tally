import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { ChallengeStore } from './types.js'

export interface IssueChallengeInput {
  address: string
  origin: string
  ttlMs: number
  now?: Date
}

export interface IssuedChallenge {
  challengeId: string
  message: string
  expiresAt: Date
}

export async function issueChallenge(
  store: ChallengeStore,
  input: IssueChallengeInput,
): Promise<IssuedChallenge> {
  const now = input.now ?? new Date()
  const expiresAt = new Date(now.getTime() + input.ttlMs)
  const challengeId = randomUUID()
  const nonce = randomBytes(24).toString('base64url')
  const nonceHash = createHash('sha256').update(nonce).digest('hex')
  const domain = safeDomain(input.origin)
  const message = [
    'Tally sign-in',
    `Domain: ${domain}`,
    `Address: ${input.address}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt.toISOString()}`,
  ].join('\n')
  await store.create({
    id: challengeId,
    walletAddress: input.address,
    nonceHash,
    message,
    expiresAt,
    usedAt: null,
  })
  return { challengeId, message, expiresAt }
}

function safeDomain(origin: string): string {
  try {
    return new URL(origin).host
  } catch {
    return origin
  }
}
