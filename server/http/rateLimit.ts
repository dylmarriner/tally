// ponytail: in-memory fixed-window rate limiter. Single-process only.
// Upgrade to Redis (or a shared store) when the API runs multi-node.
interface Bucket {
  windowStart: number
  count: number
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = 60_000,
  ) {}

  hit(key: string, now: number = Date.now()): { ok: boolean; retryAfterMs: number } {
    const bucket = this.buckets.get(key)
    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { windowStart: now, count: 1 })
      return { ok: true, retryAfterMs: 0 }
    }
    bucket.count += 1
    if (bucket.count > this.limit) {
      return { ok: false, retryAfterMs: this.windowMs - (now - bucket.windowStart) }
    }
    return { ok: true, retryAfterMs: 0 }
  }

  reset(): void {
    this.buckets.clear()
  }
}
