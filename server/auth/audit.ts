// ponytail: structured stdout audit events. Upgrade to a persisted
// activity_events table when compliance/query requirements arrive.
export type AuthAuditEvent =
  | 'auth.challenge.issued'
  | 'auth.verify.success'
  | 'auth.verify.rejected'
  | 'auth.logout'
  | 'auth.rate_limited'
  | 'auth.origin_rejected'

export interface AuthAuditFields {
  requestId: string
  ip: string
  address?: string
  userId?: string
  reason?: string
}

export function auditAuth(event: AuthAuditEvent, fields: AuthAuditFields): void {
  const payload = {
    at: new Date().toISOString(),
    kind: 'audit',
    event,
    ...fields,
  }
  process.stdout.write(JSON.stringify(payload) + '\n')
}
