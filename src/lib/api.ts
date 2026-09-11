export interface ApiError {
  code: string
  message: string
  requestId?: string
  status: number
}

export interface AuthUser {
  id: string
  nimiqAddress: string
  displayName: string
  createdAt: string
  updatedAt?: string
  firstRun?: boolean
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let json: unknown = null
  const text = await res.text()
  if (text.length > 0) {
    try {
      json = JSON.parse(text)
    } catch {
      throw <ApiError>{ code: 'BAD_RESPONSE', message: 'Server returned invalid JSON.', status: res.status }
    }
  }
  if (!res.ok) {
    const err = (json as { error?: Partial<ApiError> } | null)?.error
    throw <ApiError>{
      code: err?.code ?? 'HTTP_ERROR',
      message: err?.message ?? `Request failed (${res.status}).`,
      requestId: err?.requestId,
      status: res.status,
    }
  }
  return ((json as { data?: T } | null)?.data ?? (json as T)) as T
}

export const api = {
  challenge: (address: string) =>
    request<{ challengeId: string; message: string; expiresAt: string }>(
      'POST',
      '/api/v1/auth/challenge',
      { address },
    ),
  verify: (payload: { challengeId: string; address: string; publicKey: string; signature: string }) =>
    request<{ user: AuthUser }>('POST', '/api/v1/auth/verify', payload),
  logout: () => request<{ ok: boolean }>('POST', '/api/v1/auth/logout'),
  me: () => request<{ user: AuthUser }>('GET', '/api/v1/me'),
  updateMe: (displayName: string) =>
    request<{ user: AuthUser }>('PATCH', '/api/v1/me', { displayName }),
}
