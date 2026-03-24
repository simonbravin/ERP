export const BILLING_PROVIDER = 'PADDLE' as const

export const BILLING_REMINDER_CATEGORY = {
  TRIAL_ENDING: 'BILLING_TRIAL_ENDING',
  PAYMENT_FAILED: 'BILLING_PAYMENT_FAILED',
  READ_ONLY: 'BILLING_READ_ONLY',
} as const

export const BILLING_GRACE_PERIOD_DAYS = 5

export const BILLING_ALLOWED_IN_READ_ONLY = new Set<string>([
  'billing.createCheckout',
  'billing.cancelAtPeriodEnd',
  'billing.reactivate',
  'billing.validatePromo',
  'support.contact',
  'exports.request',
])
