import { hashSessionToken } from '../auth/session.js'
import type { Stores, User } from '../auth/types.js'
import type { AppConfig } from '../config.js'
import { appError, type Handler } from '../http/router.js'

function requireDisplayName(input: unknown): string {
  if (typeof input !== 'string') {
    throw appError(400, 'INVALID_BODY', 'displayName must be a string.')
  }
  const trimmed = input.trim()
  if (trimmed.length < 1 || trimmed.length > 40) {
    throw appError(400, 'INVALID_DISPLAY_NAME', 'Display name must be 1–40 characters.')
  }
  return trimmed
}

async function loadUser(cookies: Record<string, string>, cookieName: string, stores: Stores): Promise<User> {
  const token = cookies[cookieName]
  if (!token) throw appError(401, 'NOT_AUTHENTICATED', 'Sign in required.')
  const session = await stores.sessions.findByTokenHash(hashSessionToken(token), new Date())
  if (!session) throw appError(401, 'NOT_AUTHENTICATED', 'Sign in required.')
  const user = await stores.users.findById(session.userId)
  if (!user) throw appError(401, 'NOT_AUTHENTICATED', 'Sign in required.')
  return user
}

function serializeUser(user: User): Record<string, unknown> {
  return {
    id: user.id,
    nimiqAddress: user.nimiqAddress,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

export function buildMeRoutes(config: AppConfig, stores: Stores): Record<string, Handler> {
  const get: Handler = async (ctx) => {
    const user = await loadUser(ctx.cookies, config.cookieName, stores)
    return { status: 200, body: { data: { user: serializeUser(user) } } }
  }
  const patch: Handler = async (ctx) => {
    const user = await loadUser(ctx.cookies, config.cookieName, stores)
    const body = (ctx.bodyJson ?? {}) as Record<string, unknown>
    const displayName = requireDisplayName(body.displayName)
    const updated = await stores.users.updateDisplayName(user.id, displayName)
    if (!updated) throw appError(404, 'USER_NOT_FOUND', 'User no longer exists.')
    return { status: 200, body: { data: { user: serializeUser(updated) } } }
  }
  return { get, patch }
}
