import { prisma } from '@repo/database'
import { PaddleBillingClient } from '@/lib/billing/providers/paddle.client'
import type { BillingStateDto, CheckoutRequest } from '@/lib/billing/types'
import { getOrganizationBillingAccess } from '@/lib/billing/services/access-policy'
import { validatePromoCodeForOrganization } from '@/lib/billing/services/promo-validation'

const provider = new PaddleBillingClient()

export async function createCheckoutForOrganization(input: CheckoutRequest) {
  const planPrice = await prisma.billingPlanPrice.findUnique({
    where: { id: input.billingPlanPriceId },
    include: { plan: true },
  })
  if (!planPrice || !planPrice.active || !planPrice.plan.active) {
    throw new Error('Invalid plan selection')
  }
  if (!planPrice.paddlePriceId) {
    throw new Error('Selected plan is not linked to a Paddle price')
  }

  if (input.promoCode) {
    const promo = await validatePromoCodeForOrganization({
      orgId: input.orgId,
      code: input.promoCode,
      billingPlanId: planPrice.billingPlanId,
    })
    if (!promo.valid) throw new Error(`Promo code invalid: ${promo.code}`)
  }

  return provider.createCheckout({
    ...input,
    // provider expects the external Paddle price id for checkout items.
    billingPlanPriceId: planPrice.paddlePriceId,
    trialDays: input.trialDays ?? planPrice.plan.trialDaysDefault,
  })
}

export async function cancelAtPeriodEnd(orgId: string) {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { orgId },
    select: { paddleSubscriptionId: true },
  })
  if (!subscription?.paddleSubscriptionId) throw new Error('No active Paddle subscription')
  await provider.cancelSubscriptionAtPeriodEnd(subscription.paddleSubscriptionId)
}

export async function reactivateSubscription(orgId: string) {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { orgId },
    select: { paddleSubscriptionId: true },
  })
  if (!subscription?.paddleSubscriptionId) throw new Error('No Paddle subscription found')
  await provider.reactivateSubscription(subscription.paddleSubscriptionId)
}

export async function getCurrentBillingState(orgId: string): Promise<BillingStateDto> {
  const [subscription, access] = await Promise.all([
    prisma.organizationSubscription.findUnique({
      where: { orgId },
      include: { billingPlan: true },
    }),
    getOrganizationBillingAccess(orgId),
  ])

  return {
    planCode: subscription?.billingPlan.code ?? null,
    planName: subscription?.billingPlan.name ?? null,
    status: subscription?.status ?? null,
    interval: subscription?.interval ?? null,
    trialEnd: subscription?.trialEnd ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    nextBillingAt: subscription?.nextBillingAt ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    accessMode: access.accessMode,
    reasonCode: access.reasonCode,
  }
}
