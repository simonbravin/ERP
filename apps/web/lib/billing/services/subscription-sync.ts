import { prisma, type BillingSubscriptionStatus, type Prisma } from '@repo/database'

function mapPaddleStatusToLocal(status: string): BillingSubscriptionStatus {
  const normalized = status.toLowerCase()
  if (normalized === 'active') return 'ACTIVE'
  if (normalized === 'trialing') return 'TRIALING'
  if (normalized === 'past_due') return 'PAST_DUE'
  if (normalized === 'paused') return 'PAUSED'
  if (normalized === 'canceled') return 'CANCELED'
  return 'UNPAID'
}

export async function syncSubscriptionFromWebhook(input: {
  orgId: string
  paddleSubscriptionId: string
  paddleCustomerId?: string
  paddleStatus: string
  nextBillingAt?: Date | null
  currentPeriodStart?: Date | null
  currentPeriodEnd?: Date | null
  cancelAtPeriodEnd?: boolean
  billingPlanId: string
}) {
  const nextStatus = mapPaddleStatusToLocal(input.paddleStatus)
  return prisma.$transaction(async (tx) => {
    const customer = await tx.billingCustomer.upsert({
      where: { orgId_provider: { orgId: input.orgId, provider: 'PADDLE' } },
      update: {
        paddleCustomerId: input.paddleCustomerId ?? undefined,
      },
      create: {
        orgId: input.orgId,
        provider: 'PADDLE',
        paddleCustomerId: input.paddleCustomerId ?? `pending-${input.orgId}`,
      },
    })

    const existing = await tx.organizationSubscription.findUnique({ where: { orgId: input.orgId } })
    const subscription = await tx.organizationSubscription.upsert({
      where: { orgId: input.orgId },
      update: {
        billingCustomerId: customer.id,
        billingPlanId: input.billingPlanId,
        status: nextStatus,
        paddleSubscriptionId: input.paddleSubscriptionId,
        paddleStatus: input.paddleStatus,
        nextBillingAt: input.nextBillingAt ?? null,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      },
      create: {
        orgId: input.orgId,
        billingCustomerId: customer.id,
        billingPlanId: input.billingPlanId,
        provider: 'PADDLE',
        status: nextStatus,
        paddleSubscriptionId: input.paddleSubscriptionId,
        paddleStatus: input.paddleStatus,
        nextBillingAt: input.nextBillingAt ?? null,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      },
    })

    await tx.subscriptionStatusHistory.create({
      data: {
        orgId: input.orgId,
        subscriptionId: subscription.id,
        fromStatus: existing?.status,
        toStatus: nextStatus,
        reason: `Paddle status: ${input.paddleStatus}`,
        source: 'WEBHOOK',
      },
    })

    await tx.organization.update({
      where: { id: input.orgId },
      data: {
        subscriptionStatus: nextStatus,
      },
    })

    return subscription
  })
}

export function getStringMetadata(data: Prisma.JsonValue | null | undefined, key: string): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const value = (data as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}
