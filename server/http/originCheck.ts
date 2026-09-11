import { appError, type RequestContext } from './router.js'

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function assertOrigin(ctx: RequestContext, allowedOrigin: string): void {
  if (!STATE_CHANGING.has(ctx.method)) return
  const origin = ctx.origin
  if (!origin) {
    throw appError(403, 'ORIGIN_MISSING', 'Missing Origin header on state-changing request.')
  }
  if (normalizeOrigin(origin) !== normalizeOrigin(allowedOrigin)) {
    throw appError(403, 'ORIGIN_REJECTED', 'Origin not allowed for this endpoint.')
  }
}

function normalizeOrigin(origin: string): string {
  try {
    const u = new URL(origin)
    return `${u.protocol}//${u.host}`
  } catch {
    return origin
  }
}
