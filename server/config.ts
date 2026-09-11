export interface AppConfig {
  appOrigin: string
  cookieName: string
  cookieSecure: boolean
  sessionTtlMs: number
  challengeTtlMs: number
  challengeIssueRateLimit: { perMinutePerIp: number; perMinutePerAddress: number }
  verifyRateLimit: { perMinutePerIp: number; perMinutePerAddress: number }
  nodeEnv: 'development' | 'production' | 'test'
}

const FIVE_MIN = 5 * 60 * 1000
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (env.NODE_ENV ?? 'development') as AppConfig['nodeEnv']
  const isProd = nodeEnv === 'production'
  const appOrigin = env.APP_ORIGIN ?? 'http://localhost:5173'
  return {
    appOrigin,
    // __Host- prefix requires Secure + Path=/ + no Domain; only safe in HTTPS.
    cookieName: isProd ? '__Host-tally_session' : 'tally_session',
    cookieSecure: isProd,
    sessionTtlMs: SEVEN_DAYS,
    challengeTtlMs: FIVE_MIN,
    challengeIssueRateLimit: { perMinutePerIp: 20, perMinutePerAddress: 10 },
    verifyRateLimit: { perMinutePerIp: 30, perMinutePerAddress: 10 },
    nodeEnv,
  }
}
