import { describe, expect, it } from 'vitest'
import { generateSessionToken, hashSessionToken } from '../../server/auth/session'

describe('session tokens', () => {
  it('generates high-entropy opaque tokens with a stable sha256 hash', () => {
    const a = generateSessionToken()
    const b = generateSessionToken()
    expect(a.token).not.toEqual(b.token)
    expect(a.token.length).toBeGreaterThanOrEqual(40)
    expect(hashSessionToken(a.token)).toBe(a.tokenHash)
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
