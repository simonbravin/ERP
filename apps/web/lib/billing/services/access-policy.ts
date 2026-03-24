import { prisma } from '@repo/database'
import { BILLING_GRACE_PERIOD_DAYS } from '@/lib/billing/constants'
import { isBillingEnforcementEnabled } from '@/lib/billing/config'
import { accessFromLegacyOrganization } from '@/lib/billing/legacy-access'
import type { BillingAccessState } from '@/lib/billing/types'

export async function getOrganizationBillingAccess(orgId: string): Promise<BillingAccessState> {
  const enforcement = isBillingEnforcementEnabled()

  const [org, subscription, overrides] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        isBlocked: true,
        subscriptionStatus: true,
        subscriptionEndDate: true,
      },
    }),
    prisma.organizationSubscription.findUnique({
      where: { orgId },
      select: {
        status: true,
        trialEnd: true,
        currentPeriodEnd: true,
        graceUntil: true,
      },
    }),
    prisma.manualBillingOverride.findMany({
      where: {
        orgId,
        active: true,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  if (org?.isBlocked) {
    return { accessMode: 'READ_ONLY', writeAllowed: false, reasonCode: 'ORG_BLOCKED', effectiveUntil: null, status: null }
  }

  const hasManualLock = overrides.some((o) => o.mode === 'MANUAL_LOCK')
  if (hasManualLock) {
    return { accessMode: 'READ_ONLY', writeAllowed: false, reasonCode: 'MANUAL_LOCKED', effectiveUntil: null, status: subscription?.status ?? null }
  }
  const hasManualActive = overrides.some((o) => o.mode === 'MANUAL_ACTIVE' || o.mode === 'ENTERPRISE_BYPASS')
  if (hasManualActive) {
    return { accessMode: 'FULL', writeAllowed: true, reasonCode: 'MANUAL_ACTIVE', effectiveUntil: null, status: subscription?.status ?? null }
  }

  if (!subscription) {
    if (!enforcement) {
      if (!org) {
        return { accessMode: 'FULL', writeAllowed: true, reasonCode: 'LEGACY_GRANDFATHERED', effectiveUntil: null, status: null }
      }
      return accessFromLegacyOrganization({
        subscriptionStatus: org.subscriptionStatus,
        subscriptionEndDate: org.subscriptionEndDate,
      })
    }
    return { accessMode: 'READ_ONLY', writeAllowed: false, reasonCode: 'NO_SUBSCRIPTION', effectiveUntil: null, status: null }
  }

  const now = new Date()
  switch (subscription.status) {
    case 'ACTIVE':
      return { accessMode: 'FULL', writeAllowed: true, reasonCode: 'ACTIVE', effectiveUntil: subscription.currentPeriodEnd, status: subscription.status }
    case 'TRIALING': {
      if (subscription.trialEnd && now > subscription.trialEnd) {
        return { accessMode: 'READ_ONLY', writeAllowed: false, reasonCode: 'EXPIRED', effectiveUntil: subscription.trialEnd, status: subscription.status }
      }
      return { accessMode: 'FULL', writeAllowed: true, reasonCode: 'TRIAL_ACTIVE', effectiveUntil: subscription.trialEnd, status: subscription.status }
    }
    case 'PAST_DUE': {
      const graceUntil = subscription.graceUntil ?? new Date(now.getTime() + BILLING_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
      if (now > graceUntil) {
        return { accessMode: 'READ_ONLY', writeAllowed: false, reasonCode: 'UNPAID', effectiveUntil: graceUntil, status: subscription.status }
      }
      return { accessMode: 'FULL', writeAllowed: true, reasonCode: 'PAST_DUE_GRACE', effectiveUntil: graceUntil, status: subscription.status }
    }
    case 'UNPAID':
      return { accessMode: 'READ_ONLY', writeAllowed: false, reasonCode: 'UNPAID', effectiveUntil: subscription.currentPeriodEnd, status: subscription.status }
    case 'PAUSED':
      return { accessMode: 'READ_ONLY', writeAllowed: false, reasonCode: 'PAUSED', effectiveUntil: subscription.currentPeriodEnd, status: subscription.status }
    case 'CANCELED':
      return { accessMode: 'READ_ONLY', writeAllowed: false, reasonCode: 'CANCELED', effectiveUntil: subscription.currentPeriodEnd, status: subscription.status }
    case 'EXPIRED':
    default:
      return { accessMode: 'READ_ONLY', writeAllowed: false, reasonCode: 'EXPIRED', effectiveUntil: subscription.currentPeriodEnd, status: subscription.status }
  }
}
