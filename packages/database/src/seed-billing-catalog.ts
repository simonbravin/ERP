import { prisma } from './client'
import type { BillingInterval } from '@prisma/client'

/**
 * Upserts a global BillingPlan and BillingPlanPrice rows when env vars are set.
 * Without BILLING_SEED_PADDLE_PRICE_MONTHLY / BILLING_SEED_PADDLE_PRICE_YEARLY this no-ops.
 *
 * Use real Paddle price IDs from the Paddle dashboard (sandbox or live) matching PADDLE_ENV.
 */
export async function seedBillingCatalogFromEnv(): Promise<void> {
  const planCode = process.env.BILLING_SEED_PLAN_CODE ?? 'STANDARD'
  const planName = process.env.BILLING_SEED_PLAN_NAME ?? 'Standard'
  const monthlyPaddle = process.env.BILLING_SEED_PADDLE_PRICE_MONTHLY?.trim()
  const yearlyPaddle = process.env.BILLING_SEED_PADDLE_PRICE_YEARLY?.trim()
  const monthlyAmount = process.env.BILLING_SEED_AMOUNT_MONTHLY_USD ?? '29'
  const yearlyAmount = process.env.BILLING_SEED_AMOUNT_YEARLY_USD ?? '290'

  if (!monthlyPaddle && !yearlyPaddle) {
    console.log(
      'Seed billing catalog: skipped (set BILLING_SEED_PADDLE_PRICE_MONTHLY and/or BILLING_SEED_PADDLE_PRICE_YEARLY)'
    )
    return
  }

  const plan = await prisma.billingPlan.upsert({
    where: { code: planCode },
    create: {
      code: planCode,
      name: planName,
      description: 'Seeded from environment for Paddle checkout',
      active: true,
      trialDaysDefault: Number(process.env.BILLING_SEED_TRIAL_DAYS ?? '14'),
    },
    update: {
      name: planName,
      active: true,
    },
  })

  async function upsertPrice(interval: BillingInterval, paddleId: string | undefined, amountStr: string) {
    if (!paddleId) return
    await prisma.billingPlanPrice.upsert({
      where: {
        billingPlanId_interval_currency: {
          billingPlanId: plan.id,
          interval,
          currency: 'USD',
        },
      },
      create: {
        billingPlanId: plan.id,
        interval,
        currency: 'USD',
        unitAmount: amountStr,
        paddlePriceId: paddleId,
        active: true,
      },
      update: {
        unitAmount: amountStr,
        paddlePriceId: paddleId,
        active: true,
      },
    })
  }

  await upsertPrice('MONTHLY', monthlyPaddle, monthlyAmount)
  await upsertPrice('YEARLY', yearlyPaddle, yearlyAmount)

  console.log(`Seed billing catalog: plan "${planCode}" updated with Paddle price IDs`)
}
