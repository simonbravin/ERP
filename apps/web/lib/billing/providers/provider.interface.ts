import type { CheckoutRequest, CheckoutResponse } from '@/lib/billing/types'

export type ProviderSubscriptionSummary = {
  id: string
  status: string
  customerId?: string
  nextBilledAt?: string | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
}

export type WebhookVerificationResult = {
  valid: boolean
  signatureHash?: string
}

export interface BillingProviderClient {
  createCheckout(input: CheckoutRequest): Promise<CheckoutResponse>
  cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<void>
  reactivateSubscription(subscriptionId: string): Promise<void>
  getSubscription(subscriptionId: string): Promise<ProviderSubscriptionSummary>
  getCustomerPortalUrl(customerId: string): Promise<string>
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<WebhookVerificationResult>
}
