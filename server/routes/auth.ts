import { auditAuth } from '../auth/audit.js'
import { issueChallenge } from '../auth/challenge.js'
import { createSession, hashSessionToken } from '../auth/session.js'
import { verifyNimiqSignedMessage } from '../auth/verifySignature.js'
import type { AppConfig } from '../config.js'
import { serializeCookie } from '../http/cookies.js'
import type { RateLimiter } from '../http/rateLimit.js'
import { appError, type Handler, type JsonResponse, type RequestContext } from '../http/router.js'
import type { Stores } from '../auth/types.js'

export interface AuthDeps {
  config: AppConfig
  stores: Stores
  ipIssueLimiter: RateLimiter
  addressIssueLimiter: RateLimiter
  ipVerifyLimiter: RateLimiter
  addressVerifyLimiter: RateLimiter
}

const NIMIQ_ADDR_RE = /^NQ\d{2}(?:[ ]?[0-9A-Z]{4}){8}$/

function requireString(obj: Record<string, unknown>, key: string, max: number): string {
  const v = obj[key]
  if (typeof v !== 'string' || v.length === 0 || v.length > max) {
    throw appError(400, 'INVALID_BODY', `Field "${key}" is required.`)
  }
  return v
}

function normalizeAddress(input: string): string {
  const stripped = input.replace(/\s+/g, '').toUpperCase()
  return stripped.replace(/(.{4})/g, '$1 ').trim()
}

function checkLimit(limiter: RateLimiter, key: string, ctx: RequestContext, address?: string): void {
  const hit = limiter.hit(key)
  if (!hit.ok) {
    auditAuth('auth.rate_limited', { requestId: ctx.requestId, ip: ctx.ip, address })
    throw appError(429, 'RATE_LIMITED', 'Too many auth requests. Try again shortly.', {
      'Retry-After': String(Math.ceil(hit.retryAfterMs / 1000)),
    })
  }
}

function truncateDisplayName(address: string): string {
  const stripped = address.replace(/\s+/g, '')
  return `${stripped.slice(0, 6)}…${stripped.slice(-4)}`
}

export function buildAuthRoutes(deps: AuthDeps): Record<string, Handler> {
  const { config, stores } = deps

  const challenge: Handler = async (ctx) => {
    const body = (ctx.bodyJson ?? {}) as Record<string, unknown>
    const rawAddress = requireString(body, 'address', 64)
    const address = normalizeAddress(rawAddress)
    if (!NIMIQ_ADDR_RE.test(address)) {
      throw appError(400, 'INVALID_ADDRESS', 'Address is not a valid Nimiq address.')
    }
    checkLimit(deps.ipIssueLimiter, `ip:${ctx.ip}`, ctx, address)
    checkLimit(deps.addressIssueLimiter, `addr:${address}`, ctx, address)
    const issued = await issueChallenge(stores.challenges, {
      address,
      origin: config.appOrigin,
      ttlMs: config.challengeTtlMs,
    })
    auditAuth('auth.challenge.issued', { requestId: ctx.requestId, ip: ctx.ip, address })
    return {
      status: 200,
      body: {
        data: {
          challengeId: issued.challengeId,
          message: issued.message,
          expiresAt: issued.expiresAt.toISOString(),
        },
      },
    }
  }

  const verify: Handler = async (ctx) => {
    const body = (ctx.bodyJson ?? {}) as Record<string, unknown>
    const challengeId = requireString(body, 'challengeId', 64)
    const rawAddress = requireString(body, 'address', 64)
    const publicKeyHex = requireString(body, 'publicKey', 256).toLowerCase()
    const signatureHex = requireString(body, 'signature', 512).toLowerCase()
    const address = normalizeAddress(rawAddress)

    checkLimit(deps.ipVerifyLimiter, `ip:${ctx.ip}`, ctx, address)
    checkLimit(deps.addressVerifyLimiter, `addr:${address}`, ctx, address)

    const now = new Date()
    const consumed = await stores.challenges.consume(challengeId, now)
    if (!consumed) {
      auditAuth('auth.verify.rejected', { requestId: ctx.requestId, ip: ctx.ip, address, reason: 'challenge_missing' })
      throw appError(401, 'CHALLENGE_INVALID', 'Challenge not found.')
    }
    if (consumed.usedAt && consumed.usedAt.getTime() !== now.getTime()) {
      auditAuth('auth.verify.rejected', { requestId: ctx.requestId, ip: ctx.ip, address, reason: 'challenge_replayed' })
      throw appError(401, 'CHALLENGE_REPLAYED', 'Challenge already used.')
    }
    if (consumed.expiresAt.getTime() <= now.getTime()) {
      auditAuth('auth.verify.rejected', { requestId: ctx.requestId, ip: ctx.ip, address, reason: 'challenge_expired' })
      throw appError(401, 'CHALLENGE_EXPIRED', 'Challenge expired.')
    }
    if (normalizeAddress(consumed.walletAddress) !== address) {
      auditAuth('auth.verify.rejected', { requestId: ctx.requestId, ip: ctx.ip, address, reason: 'address_mismatch' })
      throw appError(401, 'ADDRESS_MISMATCH', 'Address does not match challenge.')
    }

    const result = verifyNimiqSignedMessage({
      message: consumed.message,
      address,
      publicKeyHex,
      signatureHex,
    })
    if (!result.ok) {
      auditAuth('auth.verify.rejected', {
        requestId: ctx.requestId,
        ip: ctx.ip,
        address,
        reason: result.reason,
      })
      throw appError(401, 'SIGNATURE_INVALID', 'Signature verification failed.')
    }

    const { user, created } = await stores.users.upsertByAddress({
      nimiqAddress: result.normalizedAddress,
      publicKeyHex,
      defaultDisplayName: truncateDisplayName(result.normalizedAddress),
    })

    const { token, expiresAt } = await createSession(stores.sessions, user.id, config.sessionTtlMs, now)
    auditAuth('auth.verify.success', {
      requestId: ctx.requestId,
      ip: ctx.ip,
      address,
      userId: user.id,
      reason: created ? 'first_run' : 'returning',
    })
    const cookie = serializeCookie(config.cookieName, token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'Lax',
      path: '/',
      maxAgeSeconds: Math.floor(config.sessionTtlMs / 1000),
      expires: expiresAt,
    })
    return {
      status: 200,
      headers: { 'Set-Cookie': cookie },
      body: {
        data: {
          user: {
            id: user.id,
            nimiqAddress: user.nimiqAddress,
            displayName: user.displayName,
            createdAt: user.createdAt.toISOString(),
            firstRun: created,
          },
        },
      },
    }
  }

  const logout: Handler = async (ctx) => {
    const token = ctx.cookies[config.cookieName]
    if (token) {
      const tokenHash = hashSessionToken(token)
      const session = await stores.sessions.findByTokenHash(tokenHash, new Date())
      if (session) {
        await stores.sessions.revoke(session.id, new Date())
        auditAuth('auth.logout', {
          requestId: ctx.requestId,
          ip: ctx.ip,
          userId: session.userId,
        })
      }
    }
    const cleared = serializeCookie(config.cookieName, '', {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'Lax',
      path: '/',
      maxAgeSeconds: 0,
    })
    const response: JsonResponse = {
      status: 200,
      headers: { 'Set-Cookie': cleared },
      body: { data: { ok: true } },
    }
    return response
  }

  return { challenge, verify, logout }
}
