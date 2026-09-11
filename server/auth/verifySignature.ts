import { PublicKey, Signature } from '@nimiq/core'
import { nimiqSignedMessageHash } from './messagePrefix.js'

export interface VerifyInput {
  message: string
  address: string
  publicKeyHex: string
  signatureHex: string
}

export type VerifyResult =
  | { ok: true; normalizedAddress: string }
  | { ok: false; reason: 'address_mismatch' | 'bad_signature' | 'malformed' }

const HEX_RE = /^[0-9a-fA-F]+$/
const NIMIQ_ADDR_RE = /^NQ\d{2}(?:[ ]?[0-9A-Z]{4}){8}$/

function normalizeAddress(input: string): string {
  const stripped = input.replace(/\s+/g, '').toUpperCase()
  return stripped.replace(/(.{4})/g, '$1 ').trim()
}

export function verifyNimiqSignedMessage(input: VerifyInput): VerifyResult {
  const { message, address, publicKeyHex, signatureHex } = input
  if (!HEX_RE.test(publicKeyHex) || !HEX_RE.test(signatureHex)) {
    return { ok: false, reason: 'malformed' }
  }
  const normalized = normalizeAddress(address)
  if (!NIMIQ_ADDR_RE.test(normalized)) {
    return { ok: false, reason: 'malformed' }
  }

  let publicKey: PublicKey
  let signature: Signature
  try {
    publicKey = PublicKey.fromHex(publicKeyHex)
    signature = Signature.fromHex(signatureHex)
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  const derived = publicKey.toAddress().toUserFriendlyAddress()
  if (normalizeAddress(derived) !== normalized) {
    return { ok: false, reason: 'address_mismatch' }
  }

  const hash = nimiqSignedMessageHash(message)
  const ok = publicKey.verify(signature, hash)
  return ok ? { ok: true, normalizedAddress: normalized } : { ok: false, reason: 'bad_signature' }
}
