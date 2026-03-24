import type { BillingInterval, BillingSubscriptionStatus } from '@repo/database'

export type BillingAccessMode = 'FULL' | 'READ_ONLY'

export type BillingAccessReasonCode =
  | 'ACTIVE'
  | 'TRIAL_ACTIVE'
  | 'PAST_DUE_GRACE'
  | 'UNPAID'
  | 'EXPIRED'
  | 'CANCELED'
  | 'PAUSED'
  | 'MANUAL_ACTIVE'
  | 'MANUAL_LOCKED'
  | 'NO_SUBSCRIPTION'
  | 'ORG_BLOCKED'
  | 'LEGACY_GRANDFATHERED'
  | 'LEGACY_TRIAL'
  | 'LEGACY_ACTIVE'
  | 'LEGACY_SUSPENDED'
  | 'LEGACY_CANCELLED'

export type BillingAccessState = {
  accessMode: BillingAccessMode
  writeAllowed: boolean
  reasonCode: BillingAccessReasonCode
  effectiveUntil: Date | null
  status: BillingSubscriptionStatus | null
}

export type CheckoutRequest = {
  orgId: string
  billingPlanPriceId: string
  successUrl: string
  cancelUrl: string
  trialDays?: number
  promoCode?: string
}

export type CheckoutResponse = {
  checkoutUrl: string
  providerCheckoutId?: string
}

export type BillingStateDto = {
  planCode: string | null
  planName: string | null
  status: BillingSubscriptionStatus | null
  interval: BillingInterval | null
  trialEnd: Date | null
  currentPeriodEnd: Date | null
  nextBillingAt: Date | null
  cancelAtPeriodEnd: boolean
  accessMode: BillingAccessMode
  reasonCode: BillingAccessReasonCode
}

export type BillingMutationBlockedError = {
  code: 'BILLING_READ_ONLY'
  message: string
  accessMode: BillingAccessMode
  reasonCode: BillingAccessReasonCode
}
