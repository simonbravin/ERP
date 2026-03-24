import crypto from 'crypto'
import type {
  BillingProviderClient,
  ProviderSubscriptionSummary,
  WebhookVerificationResult,
} from '@/lib/billing/providers/provider.interface'
import type { CheckoutRequest, CheckoutResponse } from '@/lib/billing/types'

const PADDLE_BASE_URLS = {
  sandbox: 'https://sandbox-api.paddle.com',
  production: 'https://api.paddle.com',
} as const

function getPaddleConfig() {
  const apiKey = process.env.PADDLE_API_KEY?.trim()
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET?.trim()
  const env = (process.env.PADDLE_ENV?.trim() || 'sandbox').toLowerCase()
  const mode = env === 'production' ? 'production' : 'sandbox'
  if (!apiKey) throw new Error('Missing PADDLE_API_KEY')
  return {
    apiKey,
    webhookSecret: webhookSecret ?? '',
    baseUrl: PADDLE_BASE_URLS[mode],
  }
}

async function paddleFetch<T>(path: string, init: RequestInit): Promise<T> {
  const cfg = getPaddleConfig()
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Paddle API error (${res.status}): ${text}`)
  }
  return (await res.json()) as T
}

export class PaddleBillingClient implements BillingProviderClient {
  async createCheckout(input: CheckoutRequest): Promise<CheckoutResponse> {
    type PaddleCheckoutResponse = { data?: { id?: string; url?: string } }
    const payload = {
      custom_data: {
        org_id: input.orgId,
        billing_plan_price_id: input.billingPlanPriceId,
      },
      success_url: input.successUrl,
      // quantity stays at 1 subscription seat at this phase.
      items: [{ price_id: input.billingPlanPriceId, quantity: 1 }],
      ...(input.promoCode ? { discount_code: input.promoCode } : {}),
      ...(input.trialDays && input.trialDays > 0 ? { trial_period: { interval: 'day', frequency: input.trialDays } } : {}),
    }
    const response = await paddleFetch<PaddleCheckoutResponse>('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const checkoutUrl = response.data?.url ?? ''
    if (!checkoutUrl) {
      throw new Error('Paddle checkout URL missing in response')
    }
    return {
      checkoutUrl,
      providerCheckoutId: response.data?.id,
    }
  }

  async cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<void> {
    await paddleFetch(`/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        scheduled_change: { action: 'cancel', effective_at: 'next_billing_period' },
      }),
    })
  }

  async reactivateSubscription(subscriptionId: string): Promise<void> {
    await paddleFetch(`/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        scheduled_change: null,
      }),
    })
  }

  async getSubscription(subscriptionId: string): Promise<ProviderSubscriptionSummary> {
    type PaddleSubResponse = {
      data?: {
        id: string
        status: string
        customer_id?: string
        next_billed_at?: string | null
        current_billing_period?: { starts_at?: string; ends_at?: string }
        scheduled_change?: { action?: string } | null
      }
    }
    const response = await paddleFetch<PaddleSubResponse>(`/subscriptions/${subscriptionId}`, {
      method: 'GET',
    })
    const data = response.data
    if (!data?.id) throw new Error('Paddle subscription not found')
    return {
      id: data.id,
      status: data.status,
      customerId: data.customer_id,
      nextBilledAt: data.next_billed_at ?? null,
      currentPeriodStart: data.current_billing_period?.starts_at ?? null,
      currentPeriodEnd: data.current_billing_period?.ends_at ?? null,
      cancelAtPeriodEnd: data.scheduled_change?.action === 'cancel',
    }
  }

  async getCustomerPortalUrl(customerId: string): Promise<string> {
    // Paddle does not expose a generic hosted customer portal URL equivalent in all setups.
    // We keep this explicit for future wiring and avoid scattering assumptions.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? ''
    if (!customerId) return appUrl
    return `${appUrl.replace(/\/$/, '')}/settings/subscription`
  }

  async verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<WebhookVerificationResult> {
    const cfg = getPaddleConfig()
    if (!cfg.webhookSecret || !signatureHeader) return { valid: false }
    const parsed = Object.fromEntries(
      signatureHeader
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const [k, v] = part.split('=')
          return [k, v]
        })
    )
    const ts = parsed.ts
    const h1 = parsed.h1
    const computedRaw = crypto.createHmac('sha256', cfg.webhookSecret).update(rawBody).digest('hex')
    const computedTs = ts
      ? crypto.createHmac('sha256', cfg.webhookSecret).update(`${ts}:${rawBody}`).digest('hex')
      : null

    const valid =
      signatureHeader === computedRaw ||
      (h1 != null && (h1 === computedRaw || (computedTs != null && h1 === computedTs)))

    return { valid, signatureHash: computedTs ?? computedRaw }
  }
}
