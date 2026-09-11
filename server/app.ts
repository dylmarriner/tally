import type { IncomingMessage, ServerResponse } from 'node:http'
import { auditAuth } from './auth/audit.js'
import type { Stores } from './auth/types.js'
import type { AppConfig } from './config.js'
import { assertOrigin } from './http/originCheck.js'
import { RateLimiter } from './http/rateLimit.js'
import {
  Router,
  buildContext,
  errorResponse,
  isAppError,
  writeJson,
  type Handler,
  type RequestContext,
} from './http/router.js'
import { buildAuthRoutes } from './routes/auth.js'
import { buildMeRoutes } from './routes/me.js'

export interface App {
  handle(req: IncomingMessage, res: ServerResponse): Promise<void>
}

export function createApp(config: AppConfig, stores: Stores): App {
  const authDeps = {
    config,
    stores,
    ipIssueLimiter: new RateLimiter(config.challengeIssueRateLimit.perMinutePerIp),
    addressIssueLimiter: new RateLimiter(config.challengeIssueRateLimit.perMinutePerAddress),
    ipVerifyLimiter: new RateLimiter(config.verifyRateLimit.perMinutePerIp),
    addressVerifyLimiter: new RateLimiter(config.verifyRateLimit.perMinutePerAddress),
  }

  const auth = buildAuthRoutes(authDeps)
  const me = buildMeRoutes(config, stores)

  const router = new Router()
    .add('POST', '/api/v1/auth/challenge', auth.challenge)
    .add('POST', '/api/v1/auth/verify', auth.verify)
    .add('POST', '/api/v1/auth/logout', auth.logout)
    .add('GET', '/api/v1/me', me.get)
    .add('PATCH', '/api/v1/me', me.patch)
    .add('GET', '/api/v1/health', () => ({ status: 200, body: { data: { ok: true } } }))

  const notFound: Handler = () => ({
    status: 404,
    body: { error: { code: 'NOT_FOUND', message: 'Route not found.' } },
  })

  return {
    async handle(req: IncomingMessage, res: ServerResponse) {
      let ctx: RequestContext | null = null
      try {
        ctx = await buildContext(req)
        const handler = router.match(ctx.method, ctx.path) ?? notFound
        try {
          assertOrigin(ctx, config.appOrigin)
        } catch (err) {
          if (isAppError(err) && err.code.startsWith('ORIGIN_')) {
            auditAuth('auth.origin_rejected', {
              requestId: ctx.requestId,
              ip: ctx.ip,
              reason: err.code,
            })
          }
          throw err
        }
        const response = await handler(ctx)
        writeJson(res, response, ctx.requestId)
      } catch (err) {
        const requestId = ctx?.requestId ?? 'unknown'
        if (isAppError(err)) {
          writeJson(res, errorResponse(err, requestId), requestId)
          return
        }
        const message = err instanceof Error ? err.message : 'Unknown error'
        // Log but do not leak internals to client.
        process.stderr.write(
          JSON.stringify({ at: new Date().toISOString(), kind: 'error', requestId, message }) + '\n',
        )
        writeJson(
          res,
          {
            status: 500,
            body: { error: { code: 'INTERNAL', message: 'Internal server error.', requestId } },
          },
          requestId,
        )
      }
    },
  }
}
