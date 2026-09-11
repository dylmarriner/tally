import { init, type NimiqProvider, type SignatureResult, type ErrorResponse } from '@nimiq/mini-app-sdk'

export type ProviderState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'unsupported'
  | 'permission-denied'
  | 'failed'

export interface ProviderStatus {
  state: ProviderState
  message: string
}

let cachedProvider: NimiqProvider | null = null

function isError<T>(value: T | ErrorResponse): value is ErrorResponse {
  return typeof value === 'object' && value !== null && 'error' in value
}

function classifyError(err: ErrorResponse['error']): ProviderState {
  const type = (err.type || '').toLowerCase()
  if (/(denied|rejected|cancel|permission)/.test(type)) return 'permission-denied'
  return 'failed'
}

export async function initializeProvider(): Promise<ProviderStatus> {
  try {
    cachedProvider = await init({ timeout: 10_000 })
    return { state: 'ready', message: 'Nimiq Pay is ready.' }
  } catch {
    cachedProvider = null
    return {
      state: 'unsupported',
      message:
        'Open Tally inside Nimiq Pay to connect a wallet. You can still explore the app here.',
    }
  }
}

export function getProvider(): NimiqProvider | null {
  return cachedProvider
}

export interface ListAccountsResult {
  status: 'ok' | 'permission-denied' | 'failed'
  addresses: string[]
  message?: string
}

export async function listAccounts(): Promise<ListAccountsResult> {
  const provider = cachedProvider
  if (!provider) return { status: 'failed', addresses: [], message: 'Provider not initialized.' }
  try {
    const result = await provider.listAccounts()
    if (isError(result)) {
      const state = classifyError(result.error)
      return {
        status: state === 'permission-denied' ? 'permission-denied' : 'failed',
        addresses: [],
        message: result.error.message,
      }
    }
    return { status: 'ok', addresses: result }
  } catch (err) {
    return {
      status: 'failed',
      addresses: [],
      message: err instanceof Error ? err.message : 'Failed to list accounts.',
    }
  }
}

export interface SignResult {
  status: 'ok' | 'permission-denied' | 'failed'
  publicKey?: string
  signature?: string
  message?: string
}

export async function signMessage(text: string): Promise<SignResult> {
  const provider = cachedProvider
  if (!provider) return { status: 'failed', message: 'Provider not initialized.' }
  try {
    const result = (await provider.sign(text)) as SignatureResult | ErrorResponse
    if (isError(result)) {
      const state = classifyError(result.error)
      return {
        status: state === 'permission-denied' ? 'permission-denied' : 'failed',
        message: result.error.message,
      }
    }
    return { status: 'ok', publicKey: result.publicKey, signature: result.signature }
  } catch (err) {
    return {
      status: 'failed',
      message: err instanceof Error ? err.message : 'Failed to sign message.',
    }
  }
}
