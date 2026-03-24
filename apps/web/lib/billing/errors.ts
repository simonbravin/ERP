import type { BillingAccessMode, BillingAccessReasonCode } from '@/lib/billing/types'

export class BillingWriteForbiddenError extends Error {
  readonly code = 'BILLING_READ_ONLY' as const
  readonly accessMode: BillingAccessMode
  readonly reasonCode: BillingAccessReasonCode

  constructor(
    message: string,
    accessMode: BillingAccessMode,
    reasonCode: BillingAccessReasonCode
  ) {
    super(message)
    this.name = 'BillingWriteForbiddenError'
    this.accessMode = accessMode
    this.reasonCode = reasonCode
  }
}

export function isBillingWriteBlocked(err: unknown): err is BillingWriteForbiddenError {
  return err instanceof BillingWriteForbiddenError
}

/** Use on the client when server actions may throw or return a serialized/plain error. */
export function extractBillingBlockedMessage(err: unknown): string | null {
  if (isBillingWriteBlocked(err)) return err.message
  if (err instanceof Error && err.message.includes('read-only mode due to billing')) {
    return err.message
  }
  if (err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 'BILLING_READ_ONLY') {
    const m = (err as { message?: unknown }).message
    return typeof m === 'string' ? m : 'Your organization is in read-only mode due to billing.'
  }
  return null
}
