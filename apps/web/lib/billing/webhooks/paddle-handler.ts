import { prisma } from '@repo/database'
import { mapPaddleEventType } from '@/lib/billing/webhooks/paddle-event-map'
import { syncSubscriptionFromWebhook, getStringMetadata } from '@/lib/billing/services/subscription-sync'

type PaddleWebhookEvent = {
  event_id: string
  event_type: string
  data?: Record<string, unknown>
}

function getDataString(data: Record<string, unknown> | undefined, key: string): string | null {
  if (!data) return null
  const value = data[key]
  return typeof value === 'string' ? value : null
}

export async function handlePaddleWebhookEvent(event: PaddleWebhookEvent, signatureHash?: string) {
  const mapped = mapPaddleEventType(event.event_type)
  if (mapped === 'ignored') {
    await prisma.billingEventLog.update({
      where: { eventId: event.event_id },
      data: { status: 'IGNORED', processedAt: new Date(), signatureHash },
    })
    return
  }

  const data = event.data ?? {}
  const customData = (data.custom_data ?? null) as Record<string, unknown> | null
  const metadata = (data.metadata ?? null) as Record<string, unknown> | null
  const orgId = getDataString(customData ?? undefined, 'org_id')
    ?? getDataString(data, 'org_id')
    ?? getStringMetadata(metadata as never, 'org_id')

  if (!orgId) {
    await prisma.billingEventLog.update({
      where: { eventId: event.event_id },
      data: {
        status: 'FAILED',
        processAttempts: { increment: 1 },
        errorMessage: 'Missing org_id metadata',
        signatureHash,
      },
    })
    return
  }

  const paddleSubscriptionId = getDataString(data, 'id') ?? getDataString(data, 'subscription_id') ?? ''
  if (!paddleSubscriptionId) {
    await prisma.billingEventLog.update({
      where: { eventId: event.event_id },
      data: {
        orgId,
        status: 'FAILED',
        processAttempts: { increment: 1 },
        errorMessage: 'Missing paddle subscription id',
        signatureHash,
      },
    })
    return
  }
  const paddleCustomerId = getDataString(data, 'customer_id') ?? undefined
  const paddleStatus = getDataString(data, 'status') ?? 'active'
  const nextBilledAtRaw = getDataString(data, 'next_billed_at')
  const billingPlanPriceExternalId = getDataString(customData ?? undefined, 'billing_plan_price_id')

  let billingPlanId: string | null = null
  if (billingPlanPriceExternalId) {
    const price = await prisma.billingPlanPrice.findUnique({
      where: { paddlePriceId: billingPlanPriceExternalId },
      select: { billingPlanId: true },
    })
    billingPlanId = price?.billingPlanId ?? null
  }
  if (!billingPlanId) {
    const fallbackPlan = await prisma.billingPlan.findFirst({
      where: { active: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!fallbackPlan) throw new Error('No active billing plan found for webhook sync')
    billingPlanId = fallbackPlan.id
  }

  const subscription = await syncSubscriptionFromWebhook({
    orgId,
    paddleSubscriptionId,
    paddleCustomerId,
    paddleStatus,
    nextBillingAt: nextBilledAtRaw ? new Date(nextBilledAtRaw) : null,
    billingPlanId,
  })

  await prisma.billingEventLog.update({
    where: { eventId: event.event_id },
    data: {
      orgId,
      subscriptionId: subscription.id,
      status: 'PROCESSED',
      processAttempts: { increment: 1 },
      processedAt: new Date(),
      signatureHash,
      errorMessage: null,
    },
  })
}
