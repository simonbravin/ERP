/**
 * Creates OrganizationSubscription + BillingCustomer for orgs that only have legacy
 * Organization.subscription_* fields. Idempotent: skips orgs that already have a subscription row.
 *
 * Run: pnpm exec tsx src/backfill-billing-from-legacy.ts
 * Prod: dotenv -e .env.production.local -- tsx src/backfill-billing-from-legacy.ts
 */
import { prisma } from './client'
import type { BillingInterval, BillingSubscriptionStatus } from '@prisma/client'

function mapLegacyStatus(raw: string): BillingSubscriptionStatus {
  const s = raw.trim().toUpperCase()
  if (s === 'ACTIVE') return 'ACTIVE'
  if (s === 'SUSPENDED') return 'PAUSED'
  if (s === 'CANCELLED' || s === 'CANCELED') return 'CANCELED'
  if (s === 'TRIAL' || s === 'TRIALING') return 'TRIALING'
  return 'TRIALING'
}

async function resolveBillingPlanId(orgPlan: string | null): Promise<string> {
  const code = (orgPlan?.trim() || 'LEGACY_IMPORTED').toUpperCase()
  const existing = await prisma.billingPlan.findUnique({ where: { code } })
  if (existing) return existing.id

  const fallback = await prisma.billingPlan.findUnique({ where: { code: 'LEGACY_IMPORTED' } })
  if (fallback) return fallback.id

  const created = await prisma.billingPlan.create({
    data: {
      code: 'LEGACY_IMPORTED',
      name: 'Imported legacy plan',
      description: 'Auto-created by backfill-billing-from-legacy; replace with Paddle-linked plans when live.',
      active: true,
      isCustom: true,
      trialDaysDefault: 0,
    },
  })
  return created.id
}

async function main() {
  const orgs = await prisma.organization.findMany({
    where: {
      organizationSubscriptions: { none: {} },
    },
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      subscriptionStartDate: true,
      subscriptionEndDate: true,
    },
  })

  console.log(`Found ${orgs.length} organizations without OrganizationSubscription`)

  let done = 0
  for (const org of orgs) {
    const billingPlanId = await resolveBillingPlanId(org.subscriptionPlan)
    const status = mapLegacyStatus(org.subscriptionStatus)
    const interval: BillingInterval = 'MONTHLY'

    await prisma.$transaction(async (tx) => {
      const customer = await tx.billingCustomer.create({
        data: {
          orgId: org.id,
          provider: 'PADDLE',
          paddleCustomerId: `legacy-import-${org.id}`,
          displayName: org.name,
        },
      })

      const subscription = await tx.organizationSubscription.create({
        data: {
          orgId: org.id,
          billingCustomerId: customer.id,
          billingPlanId,
          provider: 'PADDLE',
          status,
          interval,
          trialStart: org.subscriptionStartDate,
          trialEnd: status === 'TRIALING' ? org.subscriptionEndDate : null,
          currentPeriodStart: org.subscriptionStartDate,
          currentPeriodEnd: org.subscriptionEndDate,
          nextBillingAt: org.subscriptionEndDate,
          metadata: {
            source: 'backfill-billing-from-legacy',
            legacySubscriptionStatus: org.subscriptionStatus,
          } as object,
        },
      })

      await tx.subscriptionStatusHistory.create({
        data: {
          orgId: org.id,
          subscriptionId: subscription.id,
          fromStatus: undefined,
          toStatus: status,
          reason: 'Backfill from Organization legacy subscription fields',
          source: 'BACKFILL',
        },
      })
    })

    done += 1
    if (done % 50 === 0) console.log(`Processed ${done}/${orgs.length}`)
  }

  console.log(`Backfill complete: ${done} organizations`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
