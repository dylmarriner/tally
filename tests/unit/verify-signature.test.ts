import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { KeyPair, Signature } from '@nimiq/core'
import { nimiqSignedMessageHash } from '../../server/auth/messagePrefix'
import { verifyNimiqSignedMessage } from '../../server/auth/verifySignature'

function signWithHubPrefix(kp: InstanceType<typeof KeyPair>, message: string) {
  const hash = nimiqSignedMessageHash(message)
  return kp.sign(hash)
}

describe('nimiqSignedMessageHash', () => {
  it('matches the Nimiq Hub / Keyguard sha256(prefix + length + msg) contract', () => {
    const msg = 'hello world'
    const bytes = new TextEncoder().encode(msg)
    const prefix = new TextEncoder().encode('\x16Nimiq Signed Message:\n' + bytes.length)
    const combined = new Uint8Array(prefix.length + bytes.length)
    combined.set(prefix, 0)
    combined.set(bytes, prefix.length)
    const expected = createHash('sha256').update(combined).digest('hex')
    expect(Buffer.from(nimiqSignedMessageHash(msg)).toString('hex')).toBe(expected)
  })
})

describe('verifyNimiqSignedMessage', () => {
  const message = 'Tally sign-in\nDomain: tally.example\nAddress: NQ..\nNonce: n\nExpires: t'

  it('accepts a correct signature and reports the normalized address', () => {
    const kp = KeyPair.generate()
    const sig = signWithHubPrefix(kp, message)
    const result = verifyNimiqSignedMessage({
      message,
      address: kp.publicKey.toAddress().toUserFriendlyAddress(),
      publicKeyHex: kp.publicKey.toHex(),
      signatureHex: sig.toHex(),
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.normalizedAddress).toMatch(/^NQ\d{2}(?: [0-9A-Z]{4}){8}$/)
    }
  })

  it('rejects a garbage signature', () => {
    const kp = KeyPair.generate()
    const bogusSig = Signature.fromHex('00'.repeat(64))
    const result = verifyNimiqSignedMessage({
      message,
      address: kp.publicKey.toAddress().toUserFriendlyAddress(),
      publicKeyHex: kp.publicKey.toHex(),
      signatureHex: bogusSig.toHex(),
    })
    expect(result).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects a valid signature from a different wallet than claimed', () => {
    const signer = KeyPair.generate()
    const claimed = KeyPair.generate()
    const sig = signWithHubPrefix(signer, message)
    const result = verifyNimiqSignedMessage({
      message,
      address: claimed.publicKey.toAddress().toUserFriendlyAddress(),
      publicKeyHex: signer.publicKey.toHex(), // key that actually signed
      signatureHex: sig.toHex(),
    })
    // Public key derives to signer's address, not the claimed one.
    expect(result).toEqual({ ok: false, reason: 'address_mismatch' })
  })

  it('rejects malformed hex inputs', () => {
    expect(
      verifyNimiqSignedMessage({
        message,
        address: 'NQ00 0000 0000 0000 0000 0000 0000 0000 0000',
        publicKeyHex: 'not-hex',
        signatureHex: 'not-hex',
      }),
    ).toEqual({ ok: false, reason: 'malformed' })
  })
})
