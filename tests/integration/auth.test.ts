import { createServer, type Server } from 'node:http'
import { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { KeyPair, Signature } from '@nimiq/core'
import { createApp } from '../../server/app'
import { createMemoryStores } from '../../server/auth/repositoryMemory'
import { nimiqSignedMessageHash } from '../../server/auth/messagePrefix'
import { loadConfig } from '../../server/config'
import type { Stores } from '../../server/auth/types'

const config = loadConfig({ NODE_ENV: 'test', APP_ORIGIN: 'http://localhost.test' })
let server: Server
let stores: Stores
let baseUrl: string

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: config.appOrigin, ...headers },
    body: JSON.stringify(body),
  })
}

beforeAll(async () => {
  stores = createMemoryStores()
  const app = createApp(config, stores)
  server = createServer((req, res) => void app.handle(req, res))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${addr.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
})

function signFor(kp: InstanceType<typeof KeyPair>, message: string) {
  const hash = nimiqSignedMessageHash(message)
  const sig = kp.sign(hash)
  return { publicKey: kp.publicKey.toHex(), signature: sig.toHex() }
}

async function requestChallenge(address: string) {
  const res = await post('/api/v1/auth/challenge', { address })
  expect(res.status).toBe(200)
  const json = (await res.json()) as { data: { challengeId: string; message: string; expiresAt: string } }
  return json.data
}

describe('POST /api/v1/auth/verify', () => {
  it('authenticates a correct signature and sets an HttpOnly session cookie', async () => {
    const kp = KeyPair.generate()
    const address = kp.publicKey.toAddress().toUserFriendlyAddress()
    const challenge = await requestChallenge(address)
    const { publicKey, signature } = signFor(kp, challenge.message)
    const res = await post('/api/v1/auth/verify', {
      challengeId: challenge.challengeId,
      address,
      publicKey,
      signature,
    })
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/SameSite=Lax/i)
    expect(setCookie).toMatch(/Path=\//i)
    const json = (await res.json()) as { data: { user: { firstRun: boolean; nimiqAddress: string } } }
    expect(json.data.user.firstRun).toBe(true)
    expect(json.data.user.nimiqAddress).toBe(address)
  })

  it('rejects a wrong signature and creates no session', async () => {
    const kp = KeyPair.generate()
    const address = kp.publicKey.toAddress().toUserFriendlyAddress()
    const challenge = await requestChallenge(address)
    const res = await post('/api/v1/auth/verify', {
      challengeId: challenge.challengeId,
      address,
      publicKey: kp.publicKey.toHex(),
      signature: Signature.fromHex('00'.repeat(64)).toHex(),
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('rejects a correct signature paired with a different claimed wallet', async () => {
    const signer = KeyPair.generate()
    const claimed = KeyPair.generate()
    const claimedAddress = claimed.publicKey.toAddress().toUserFriendlyAddress()
    const challenge = await requestChallenge(claimedAddress)
    const { signature } = signFor(signer, challenge.message)
    const res = await post('/api/v1/auth/verify', {
      challengeId: challenge.challengeId,
      address: claimedAddress,
      publicKey: signer.publicKey.toHex(), // key that actually signed
      signature,
    })
    expect(res.status).toBe(401)
  })

  it('rejects an expired challenge', async () => {
    const kp = KeyPair.generate()
    const address = kp.publicKey.toAddress().toUserFriendlyAddress()
    const challenge = await requestChallenge(address)
    // Force expiry by direct store manipulation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: Map<string, any> = (stores.challenges as any).rows
    const row = rows.get(challenge.challengeId)
    rows.set(challenge.challengeId, { ...row, expiresAt: new Date(Date.now() - 1_000) })
    const { publicKey, signature } = signFor(kp, challenge.message)
    const res = await post('/api/v1/auth/verify', {
      challengeId: challenge.challengeId,
      address,
      publicKey,
      signature,
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toMatch(/CHALLENGE_EXPIRED|CHALLENGE_INVALID/)
  })

  it('rejects a replayed challenge', async () => {
    const kp = KeyPair.generate()
    const address = kp.publicKey.toAddress().toUserFriendlyAddress()
    const challenge = await requestChallenge(address)
    const { publicKey, signature } = signFor(kp, challenge.message)
    const payload = { challengeId: challenge.challengeId, address, publicKey, signature }
    const first = await post('/api/v1/auth/verify', payload)
    expect(first.status).toBe(200)
    const replay = await post('/api/v1/auth/verify', payload)
    expect(replay.status).toBe(401)
    const body = (await replay.json()) as { error: { code: string } }
    expect(body.error.code).toBe('CHALLENGE_REPLAYED')
  })

  it('rejects malformed verify payloads without creating any session', async () => {
    // Represents the "permission rejection creates no session" invariant: no
    // successful /verify call means no session can exist. A permission-denied
    // client never reaches /verify; asserting the endpoint is closed to
    // ill-formed input covers the server side of that invariant.
    const res = await post('/api/v1/auth/verify', { challengeId: 'nope', address: 'not-a-nimiq-addr', publicKey: 'x', signature: 'y' })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.headers.get('set-cookie')).toBeNull()
  })
})

describe('session lifecycle', () => {
  it('supports /me and /logout with the issued cookie', async () => {
    const kp = KeyPair.generate()
    const address = kp.publicKey.toAddress().toUserFriendlyAddress()
    const challenge = await requestChallenge(address)
    const { publicKey, signature } = signFor(kp, challenge.message)
    const verifyRes = await post('/api/v1/auth/verify', {
      challengeId: challenge.challengeId,
      address,
      publicKey,
      signature,
    })
    const setCookie = verifyRes.headers.get('set-cookie') ?? ''
    const cookieValue = setCookie.split(';')[0]

    const meRes = await fetch(baseUrl + '/api/v1/me', { headers: { Cookie: cookieValue } })
    expect(meRes.status).toBe(200)

    const logoutRes = await fetch(baseUrl + '/api/v1/auth/logout', {
      method: 'POST',
      headers: { Cookie: cookieValue, Origin: config.appOrigin },
    })
    expect(logoutRes.status).toBe(200)

    const meAfter = await fetch(baseUrl + '/api/v1/me', { headers: { Cookie: cookieValue } })
    expect(meAfter.status).toBe(401)
  })
})
