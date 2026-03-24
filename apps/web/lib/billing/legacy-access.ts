import type { BillingAccessState } from '@/lib/billing/types'
import type { BillingSubscriptionStatus } from '@repo/database'

type LegacyOrgFields = {
  subscriptionStatus: string
  subscriptionEndDate: Date | null
}

/**
 * Maps legacy Organization.subscription_status (TRIAL, ACTIVE, SUSPENDED, CANCELLED)
 * when billing enforcement is off or before OrganizationSubscription exists.
 */
export function accessFromLegacyOrganization(org: LegacyOrgFields): BillingAccessState {
  const status = org.subscriptionStatus.trim().toUpperCase()
  const now = new Date()
  const trialEnd = org.subscriptionEndDate

  if (status === 'SUSPENDED') {
    return {
      accessMode: 'READ_ONLY',
      writeAllowed: false,
      reasonCode: 'LEGACY_SUSPENDED',
      effectiveUntil: trialEnd,
      status: 'PAUSED' satisfies BillingSubscriptionStatus,
    }
  }
  if (status === 'CANCELLED') {
    return {
      accessMode: 'READ_ONLY',
      writeAllowed: false,
      reasonCode: 'LEGACY_CANCELLED',
      effectiveUntil: trialEnd,
      status: 'CANCELED' satisfies BillingSubscriptionStatus,
    }
  }
  if (status === 'ACTIVE') {
    return {
      accessMode: 'FULL',
      writeAllowed: true,
      reasonCode: 'LEGACY_ACTIVE',
      effectiveUntil: trialEnd,
      status: 'ACTIVE' satisfies BillingSubscriptionStatus,
    }
  }
  // TRIAL (default) and unknown → treat as trial window by subscriptionEndDate
  if (trialEnd && now > trialEnd) {
    return {
      accessMode: 'READ_ONLY',
      writeAllowed: false,
      reasonCode: 'EXPIRED',
      effectiveUntil: trialEnd,
      status: 'EXPIRED' satisfies BillingSubscriptionStatus,
    }
  }
  return {
    accessMode: 'FULL',
    writeAllowed: true,
    reasonCode: 'LEGACY_TRIAL',
    effectiveUntil: trialEnd,
    status: 'TRIALING' satisfies BillingSubscriptionStatus,
  }
}
