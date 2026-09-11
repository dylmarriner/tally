import { init } from '@nimiq/mini-app-sdk'
export type ProviderState = 'initializing' | 'ready' | 'unsupported' | 'failed'
export interface ProviderStatus { state: ProviderState; message: string }
export async function initializeProvider(): Promise<ProviderStatus> {
  try {
    await init()
    return { state: 'ready', message: 'Nimiq Pay is ready.' }
  } catch {
    return { state: 'unsupported', message: 'Open Tally inside Nimiq Pay to connect a wallet. You can still explore the app here.' }
  }
}
