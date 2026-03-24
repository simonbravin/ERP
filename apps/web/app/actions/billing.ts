'use server'

import { prisma } from '@repo/database'
import { getAuthContext } from '@/lib/auth-helpers'
import { createCheckoutForOrganization, cancelAtPeriodEnd, reactivateSubscription, getCurrentBillingState } from '@/lib/billing/services/billing-orchestrator'
import { validatePromoCodeForOrganization } from '@/lib/billing/services/promo-validation'
import { assertBillingWriteAllowed } from '@/lib/billing/guards'
import { isBillingPromoValidationRateLimited } from '@/lib/billing/promo-rate-limit'
import { getRequestIp } from '@/lib/request-ip'

function assertOrgBillingAdmin(role: string) {
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw new Error('Unauthorized: billing admin role required')
  }
}

export async function createBillingCheckoutAction(input: {
  billingPlanPriceId: string
  successUrl: string
  cancelUrl: string
  promoCode?: string
}) {
  const { org } = await getAuthContext()
  assertOrgBillingAdmin(org.role)
  await assertBillingWriteAllowed(org.orgId, 'billing.createCheckout')
  return createCheckoutForOrganization({
    orgId: org.orgId,
    billingPlanPriceId: input.billingPlanPriceId,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    promoCode: input.promoCode,
  })
}

export async function validatePromoCodeAction(input: { code: string; billingPlanId?: string }) {
  const { org } = await getAuthContext()
  await assertBillingWriteAllowed(org.orgId, 'billing.validatePromo')
  const ip = await getRequestIp()
  if (isBillingPromoValidationRateLimited(org.orgId, ip)) {
    throw new Error('Too many promo checks. Please wait a minute and try again.')
  }
  return validatePromoCodeForOrganization({
    orgId: org.orgId,
    code: input.code,
    billingPlanId: input.billingPlanId,
  })
}

export async function cancelSubscriptionAtPeriodEndAction() {
  const { org } = await getAuthContext()
  assertOrgBillingAdmin(org.role)
  await assertBillingWriteAllowed(org.orgId, 'billing.cancelAtPeriodEnd')
  await cancelAtPeriodEnd(org.orgId)
  return { success: true }
}

export async function reactivateSubscriptionAction() {
  const { org } = await getAuthContext()
  assertOrgBillingAdmin(org.role)
  await assertBillingWriteAllowed(org.orgId, 'billing.reactivate')
  await reactivateSubscription(org.orgId)
  return { success: true }
}

export async function getCurrentBillingStateAction() {
  const { org } = await getAuthContext()
  return getCurrentBillingState(org.orgId)
}

export async function getBillingHistoryAction(limit: number = 20) {
  const { org } = await getAuthContext()
  const [documents, events] = await Promise.all([
    prisma.billingDocument.findMany({
      where: { orgId: org.orgId },
      orderBy: { issuedAt: 'desc' },
      take: limit,
    }),
    prisma.billingEventLog.findMany({
      where: { orgId: org.orgId },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        eventType: true,
        status: true,
        receivedAt: true,
      },
    }),
  ])
  return { documents, events }
}

/** Active catalog prices with Paddle IDs (global plans + org-specific if any). */
export async function listAvailableBillingPricesAction() {
  const { org } = await getAuthContext()
  assertOrgBillingAdmin(org.role)
  const plans = await prisma.billingPlan.findMany({
    where: {
      active: true,
      OR: [{ orgId: null }, { orgId: org.orgId }],
    },
    include: {
      prices: {
        where: {
          active: true,
          paddlePriceId: { not: null },
        },
        orderBy: [{ currency: 'asc' }, { interval: 'asc' }],
      },
    },
    orderBy: { name: 'asc' },
  })
  return plans
    .filter((p) => p.prices.length > 0)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      prices: p.prices.map((price) => ({
        id: price.id,
        interval: price.interval,
        currency: price.currency,
        unitAmount: Number(price.unitAmount),
        paddlePriceId: price.paddlePriceId as string,
      })),
    }))
}
