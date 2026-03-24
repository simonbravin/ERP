'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/database'
import { revalidatePath } from 'next/cache'

async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user?.isSuperAdmin) {
    throw new Error('Unauthorized: Super Admin access required')
  }
  return session.user
}

function revalidateSuperAdminBilling(orgId?: string) {
  revalidatePath('/super-admin/billing')
  if (orgId) {
    revalidatePath(`/super-admin/organizations/${orgId}/billing`)
  }
}

export async function adminListOrganizationsBillingAction(filters?: {
  status?: string
  planCode?: string
  query?: string
}) {
  await requireSuperAdmin()
  return prisma.organization.findMany({
    where: {
      ...(filters?.query
        ? {
            OR: [
              { name: { contains: filters.query, mode: 'insensitive' } },
              { slug: { contains: filters.query, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filters?.status === 'NO_SUBSCRIPTION'
        ? { organizationSubscriptions: { none: {} } }
        : filters?.status
          ? { organizationSubscriptions: { some: { status: filters.status as never } } }
          : {}),
      ...(filters?.planCode ? { organizationSubscriptions: { some: { billingPlan: { code: filters.planCode } } } } : {}),
    },
    include: {
      organizationSubscriptions: {
        include: {
          billingPlan: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

export async function adminExtendTrialAction(orgId: string, newTrialEnd: Date, reason?: string) {
  const user = await requireSuperAdmin()
  await prisma.$transaction(async (tx) => {
    const subscription = await tx.organizationSubscription.findUnique({ where: { orgId } })
    if (!subscription) throw new Error('Subscription not found')
    await tx.organizationSubscription.update({
      where: { id: subscription.id },
      data: { trialEnd: newTrialEnd, status: 'TRIALING' },
    })
    await tx.manualBillingOverride.create({
      data: {
        orgId,
        mode: 'TRIAL_EXTENSION',
        reason: reason ?? 'Trial extension by superadmin',
        createdByUserId: user.id,
        endsAt: newTrialEnd,
      },
    })
    await tx.superAdminLog.create({
      data: {
        superAdminId: user.id,
        superAdminEmail: user.email ?? '',
        action: 'BILLING_TRIAL_EXTENDED',
        targetType: 'ORGANIZATION',
        targetId: orgId,
        details: { newTrialEnd: newTrialEnd.toISOString(), reason },
      },
    })
  })
  revalidateSuperAdminBilling(orgId)
  return { success: true }
}

export async function adminSetManualBillingOverrideAction(input: {
  orgId: string
  mode: 'MANUAL_ACTIVE' | 'MANUAL_LOCK' | 'ENTERPRISE_BYPASS'
  active: boolean
  reason?: string
  endsAt?: Date
}) {
  const user = await requireSuperAdmin()
  if (input.active) {
    await prisma.manualBillingOverride.create({
      data: {
        orgId: input.orgId,
        mode: input.mode,
        reason: input.reason,
        createdByUserId: user.id,
        endsAt: input.endsAt ?? null,
      },
    })
  } else {
    await prisma.manualBillingOverride.updateMany({
      where: { orgId: input.orgId, mode: input.mode, active: true },
      data: { active: false },
    })
  }
  revalidateSuperAdminBilling(input.orgId)
  return { success: true }
}

export async function adminRevokeManualOverrideAction(overrideId: string) {
  await requireSuperAdmin()
  const row = await prisma.manualBillingOverride.findUnique({ where: { id: overrideId } })
  if (!row) throw new Error('Override not found')
  await prisma.manualBillingOverride.update({
    where: { id: overrideId },
    data: { active: false },
  })
  revalidateSuperAdminBilling(row.orgId)
  return { success: true }
}

export async function adminAssignCustomPlanAction(input: {
  orgId: string
  billingPlanId: string
  interval?: 'MONTHLY' | 'YEARLY'
}) {
  await requireSuperAdmin()
  await prisma.organizationSubscription.update({
    where: { orgId: input.orgId },
    data: {
      billingPlanId: input.billingPlanId,
      interval: input.interval ?? 'MONTHLY',
    },
  })
  revalidateSuperAdminBilling(input.orgId)
  return { success: true }
}

export async function adminResyncSubscriptionAction(orgId: string) {
  await requireSuperAdmin()
  const subscription = await prisma.organizationSubscription.findUnique({ where: { orgId } })
  if (!subscription) throw new Error('Organization subscription not found')
  return { success: true, subscriptionId: subscription.id, paddleSubscriptionId: subscription.paddleSubscriptionId }
}

export async function adminCreatePromoCodeAction(input: {
  code: string
  discountType: 'PERCENTAGE' | 'FIXED'
  amount: string
  maxUses?: number
  firstCycleOnly?: boolean
  validFrom?: Date
  validUntil?: Date
}) {
  await requireSuperAdmin()
  const promo = await prisma.promoCode.create({
    data: {
      code: input.code.trim().toUpperCase(),
      discountType: input.discountType,
      amount: input.amount as never,
      maxUses: input.maxUses ?? null,
      firstCycleOnly: input.firstCycleOnly ?? false,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
    },
  })
  revalidatePath('/super-admin/billing')
  return { success: true, promo }
}

export async function adminUpdatePromoCodeAction(
  promoCodeId: string,
  input: {
    active?: boolean
    maxUses?: number | null
    validFrom?: Date | null
    validUntil?: Date | null
  }
) {
  await requireSuperAdmin()
  const promo = await prisma.promoCode.update({
    where: { id: promoCodeId },
    data: input,
  })
  revalidatePath('/super-admin/billing')
  return { success: true, promo }
}

export async function adminDeactivatePromoCodeAction(promoCodeId: string) {
  await requireSuperAdmin()
  await prisma.promoCode.update({ where: { id: promoCodeId }, data: { active: false } })
  revalidatePath('/super-admin/billing')
  return { success: true }
}

export async function adminListPromoCodesAction() {
  await requireSuperAdmin()
  return prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    take: 150,
  })
}

export async function adminListRecentBillingEventsAction(limit: number = 80) {
  await requireSuperAdmin()
  return prisma.billingEventLog.findMany({
    orderBy: { receivedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      eventType: true,
      status: true,
      receivedAt: true,
      orgId: true,
      errorMessage: true,
      organization: { select: { name: true, slug: true } },
    },
  })
}

export async function adminCreatePromoFromFormAction(formData: FormData): Promise<void> {
  const code = String(formData.get('code') ?? '').trim()
  if (!code) throw new Error('Promo code is required')
  const discountType = String(formData.get('discountType') ?? 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED'
  const amount = String(formData.get('amount') ?? '0').trim() || '0'
  const maxUsesRaw = formData.get('maxUses')
  const maxUses =
    maxUsesRaw != null && String(maxUsesRaw).trim() !== ''
      ? parseInt(String(maxUsesRaw), 10)
      : undefined
  await adminCreatePromoCodeAction({
    code,
    discountType,
    amount,
    maxUses: maxUses != null && Number.isFinite(maxUses) ? maxUses : undefined,
  })
}

export async function adminDeactivatePromoFromFormAction(formData: FormData): Promise<void> {
  const id = String(formData.get('promoId') ?? '').trim()
  if (!id) throw new Error('Missing promo')
  await adminDeactivatePromoCodeAction(id)
}

export async function adminGetOrganizationBillingSnapshotAction(orgId: string) {
  await requireSuperAdmin()
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      isBlocked: true,
      blockedReason: true,
    },
  })
  if (!org) return null

  const [subscription, events, overrides, documents, statusHistory] = await Promise.all([
    prisma.organizationSubscription.findUnique({
      where: { orgId },
      include: {
        billingPlan: true,
        billingCustomer: { select: { id: true, provider: true, paddleCustomerId: true } },
      },
    }),
    prisma.billingEventLog.findMany({
      where: { orgId },
      orderBy: { receivedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        eventId: true,
        eventType: true,
        status: true,
        receivedAt: true,
        errorMessage: true,
      },
    }),
    prisma.manualBillingOverride.findMany({
      where: { orgId, active: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    prisma.billingDocument.findMany({
      where: { orgId },
      orderBy: { issuedAt: 'desc' },
      take: 15,
      select: {
        id: true,
        documentType: true,
        status: true,
        total: true,
        currency: true,
        issuedAt: true,
      },
    }),
    prisma.subscriptionStatusHistory.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        reason: true,
        source: true,
        createdAt: true,
      },
    }),
  ])

  return { org, subscription, events, overrides, documents, statusHistory }
}
