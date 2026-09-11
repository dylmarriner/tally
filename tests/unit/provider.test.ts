import { describe, expect, it, vi } from 'vitest'
import { initializeProvider } from '../../src/lib/nimiq-provider'
vi.mock('@nimiq/mini-app-sdk', () => ({ init: vi.fn().mockRejectedValue(new Error('not in host')) }))
describe('provider initialization', () => { it('returns recoverable unsupported state', async () => { await expect(initializeProvider()).resolves.toEqual({ state: 'unsupported', message: expect.stringContaining('Nimiq Pay') }) }) })
