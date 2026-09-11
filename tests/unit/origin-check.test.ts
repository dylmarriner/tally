import { describe, expect, it } from 'vitest'
import { assertOrigin } from '../../server/http/originCheck'
import type { RequestContext } from '../../server/http/router'

function ctx(overrides: Partial<RequestContext>): RequestContext {
  return {
    method: 'POST',
    path: '/api/v1/auth/challenge',
    requestId: 'req',
    ip: '127.0.0.1',
    origin: null,
    cookies: {},
    headers: {},
    bodyText: '',
    bodyJson: null,
    ...overrides,
  }
}

describe('assertOrigin', () => {
  const allowed = 'https://tally.example'

  it('accepts GET requests without an Origin header', () => {
    expect(() => assertOrigin(ctx({ method: 'GET', origin: null }), allowed)).not.toThrow()
  })

  it('rejects state-changing requests with a missing Origin', () => {
    expect(() => assertOrigin(ctx({ method: 'POST', origin: null }), allowed)).toThrow(/ORIGIN_MISSING/)
  })

  it('rejects state-changing requests with a mismatched Origin', () => {
    expect(() =>
      assertOrigin(ctx({ method: 'POST', origin: 'https://evil.example' }), allowed),
    ).toThrow(/ORIGIN_REJECTED/)
  })

  it('accepts a matching Origin', () => {
    expect(() =>
      assertOrigin(ctx({ method: 'POST', origin: 'https://tally.example' }), allowed),
    ).not.toThrow()
  })
})
