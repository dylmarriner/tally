import { reactive } from 'vue'
import { api, type ApiError, type AuthUser } from '../../lib/api'
import { listAccounts, signMessage } from '../../lib/nimiq-provider'

export type ConnectPhase =
  | 'idle'
  | 'requesting-accounts'
  | 'awaiting-signature'
  | 'verifying'
  | 'awaiting-display-name'
  | 'signed-in'
  | 'error'

interface SessionState {
  user: AuthUser | null
  phase: ConnectPhase
  error: string | null
  candidateAddresses: string[]
}

export const session = reactive<SessionState>({
  user: null,
  phase: 'idle',
  error: null,
  candidateAddresses: [],
})

function toMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as ApiError).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return fallback
}

export async function refreshCurrentUser(): Promise<void> {
  try {
    const { user } = await api.me()
    session.user = user
    session.phase = 'signed-in'
    session.error = null
  } catch (err) {
    const status = (err as ApiError | undefined)?.status
    if (status === 401) {
      session.user = null
      session.phase = 'idle'
      session.error = null
      return
    }
    session.error = toMessage(err, 'Could not load current session.')
    session.phase = 'error'
  }
}

export async function beginConnect(): Promise<void> {
  session.error = null
  session.phase = 'requesting-accounts'
  const accounts = await listAccounts()
  if (accounts.status !== 'ok' || accounts.addresses.length === 0) {
    session.phase = accounts.status === 'permission-denied' ? 'idle' : 'error'
    if (accounts.status === 'permission-denied') {
      session.error = 'Permission was denied in Nimiq Pay. You can try again.'
    } else {
      session.error = accounts.message ?? 'Could not read wallet accounts.'
    }
    return
  }
  session.candidateAddresses = accounts.addresses
  if (accounts.addresses.length === 1) {
    await completeConnect(accounts.addresses[0])
  } else {
    session.phase = 'awaiting-signature'
  }
}

export async function completeConnect(address: string): Promise<void> {
  session.error = null
  session.phase = 'awaiting-signature'
  try {
    const issued = await api.challenge(address)
    const signed = await signMessage(issued.message)
    if (signed.status !== 'ok' || !signed.publicKey || !signed.signature) {
      session.phase = signed.status === 'permission-denied' ? 'idle' : 'error'
      if (signed.status === 'permission-denied') {
        session.error = 'You cancelled the signature in Nimiq Pay.'
      } else {
        session.error = signed.message ?? 'Signing failed.'
      }
      return
    }
    session.phase = 'verifying'
    const verified = await api.verify({
      challengeId: issued.challengeId,
      address,
      publicKey: signed.publicKey,
      signature: signed.signature,
    })
    session.user = verified.user
    session.phase = verified.user.firstRun ? 'awaiting-display-name' : 'signed-in'
  } catch (err) {
    session.error = toMessage(err, 'Sign-in failed.')
    session.phase = 'error'
  }
}

export async function setDisplayName(displayName: string): Promise<void> {
  try {
    const { user } = await api.updateMe(displayName)
    session.user = user
    session.phase = 'signed-in'
    session.error = null
  } catch (err) {
    session.error = toMessage(err, 'Could not update display name.')
  }
}

export async function signOut(): Promise<void> {
  try {
    await api.logout()
  } catch {
    // Non-fatal: clear local session anyway.
  }
  session.user = null
  session.phase = 'idle'
  session.candidateAddresses = []
  session.error = null
}
