import { prisma } from '@repo/database'

export type PromoValidationResult =
  | { valid: true; promoCodeId: string; code: string }
  | { valid: false; code: 'NOT_FOUND' | 'INACTIVE' | 'EXPIRED' | 'MAX_USES_EXCEEDED' | 'PLAN_NOT_ALLOWED' }

export async function validatePromoCodeForOrganization(params: {
  orgId: string
  code: string
  billingPlanId?: string | null
}): Promise<PromoValidationResult> {
  const promo = await prisma.promoCode.findUnique({
    where: { code: params.code.trim().toUpperCase() },
    include: { restrictions: true },
  })
  if (!promo) return { valid: false, code: 'NOT_FOUND' }
  if (!promo.active) return { valid: false, code: 'INACTIVE' }
  const now = new Date()
  if ((promo.validFrom && now < promo.validFrom) || (promo.validUntil && now > promo.validUntil)) {
    return { valid: false, code: 'EXPIRED' }
  }
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { valid: false, code: 'MAX_USES_EXCEEDED' }
  }
  if (params.billingPlanId && promo.restrictions.length > 0) {
    const allowed = promo.restrictions.some((r) => r.billingPlanId === params.billingPlanId)
    if (!allowed) return { valid: false, code: 'PLAN_NOT_ALLOWED' }
  }
  return { valid: true, promoCodeId: promo.id, code: promo.code }
}
