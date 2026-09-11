import { describe, expect, it } from 'vitest'
import { RateLimiter } from '../../server/http/rateLimit'

describe('RateLimiter', () => {
  it('allows up to the limit within the window and rejects the next hit', () => {
    const rl = new RateLimiter(3, 1000)
    const t = 1_000_000
    expect(rl.hit('k', t).ok).toBe(true)
    expect(rl.hit('k', t + 100).ok).toBe(true)
    expect(rl.hit('k', t + 200).ok).toBe(true)
    const blocked = rl.hit('k', t + 300)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets when the window advances', () => {
    const rl = new RateLimiter(1, 1000)
    const t = 1_000_000
    expect(rl.hit('k', t).ok).toBe(true)
    expect(rl.hit('k', t + 500).ok).toBe(false)
    expect(rl.hit('k', t + 1_500).ok).toBe(true)
  })
})
