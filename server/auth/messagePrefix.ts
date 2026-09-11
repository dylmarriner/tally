import { createHash } from 'node:crypto'

// Nimiq Hub / Keyguard signed-message convention:
// hash = sha256("\x16Nimiq Signed Message:\n" + messageByteLength + messageBytes)
// See @nimiq/hub-api SignedMessage.prepareSigningPayload.
const PREFIX = '\x16Nimiq Signed Message:\n'

export function nimiqSignedMessageHash(message: string): Uint8Array {
  const messageBytes = new TextEncoder().encode(message)
  const prefixBytes = new TextEncoder().encode(PREFIX + messageBytes.length)
  const combined = new Uint8Array(prefixBytes.length + messageBytes.length)
  combined.set(prefixBytes, 0)
  combined.set(messageBytes, prefixBytes.length)
  return new Uint8Array(createHash('sha256').update(combined).digest())
}
