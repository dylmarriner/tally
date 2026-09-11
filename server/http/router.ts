import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { parseCookies } from './cookies.js'

export interface RequestContext {
  method: string
  path: string
  requestId: string
  ip: string
  origin: string | null
  cookies: Record<string, string>
  headers: IncomingMessage['headers']
  bodyText: string
  bodyJson: unknown
}

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extraHeaders?: Record<string, string | string[]>,
  ) {
    super(`${code}: ${message}`)
    this.name = 'AppError'
  }
}

export function isAppError(x: unknown): x is AppError {
  return x instanceof AppError
}

export function appError(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string | string[]>,
): AppError {
  return new AppError(status, code, message, headers)
}

export interface JsonResponse {
  status: number
  body: unknown
  headers?: Record<string, string | string[]>
}

export type Handler = (ctx: RequestContext) => Promise<JsonResponse> | JsonResponse

interface Route {
  method: string
  pattern: string
  handler: Handler
}

export class Router {
  private readonly routes: Route[] = []

  add(method: string, pattern: string, handler: Handler): this {
    this.routes.push({ method, pattern, handler })
    return this
  }

  match(method: string, path: string): Handler | null {
    for (const route of this.routes) {
      if (route.method === method && route.pattern === path) return route.handler
    }
    return null
  }
}

export async function readBody(req: IncomingMessage, maxBytes: number = 64 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(appError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export async function buildContext(req: IncomingMessage): Promise<RequestContext> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const forwarded = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
  const ip = forwarded || req.socket.remoteAddress || 'unknown'
  const bodyText = req.method === 'GET' || req.method === 'HEAD' ? '' : await readBody(req)
  let bodyJson: unknown = null
  if (bodyText.length > 0) {
    try {
      bodyJson = JSON.parse(bodyText)
    } catch {
      throw appError(400, 'MALFORMED_JSON', 'Request body was not valid JSON.')
    }
  }
  return {
    method: req.method ?? 'GET',
    path: url.pathname,
    requestId: (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
    ip,
    origin: (req.headers.origin as string | undefined) ?? null,
    cookies: parseCookies(req.headers.cookie as string | undefined),
    headers: req.headers,
    bodyText,
    bodyJson,
  }
}

export function writeJson(res: ServerResponse, response: JsonResponse, requestId: string): void {
  const headers: Record<string, string | string[]> = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Request-Id': requestId,
    ...(response.headers ?? {}),
  }
  res.writeHead(response.status, headers)
  res.end(JSON.stringify(response.body))
}

export function errorResponse(err: AppError, requestId: string): JsonResponse {
  return {
    status: err.status,
    body: {
      error: {
        code: err.code,
        message: err.message.replace(/^[^:]+:\s*/, ''),
        requestId,
      },
    },
    headers: err.extraHeaders,
  }
}
