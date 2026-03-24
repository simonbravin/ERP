'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createBillingCheckoutAction } from '@/app/actions/billing'
import { toastBillingBlockedIfNeeded } from '@/lib/billing/client-toast'

export type SubscriptionPlanOption = {
  id: string
  code: string
  name: string
  description: string | null
  prices: Array<{
    id: string
    interval: string
    currency: string
    unitAmount: number
    paddlePriceId: string
  }>
}

type Props = {
  plans: SubscriptionPlanOption[]
}

function formatPrice(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

export function SubscriptionPlansCheckout({ plans }: Props) {
  const locale = useLocale()
  const t = useTranslations('billing')
  const [selectedKey, setSelectedKey] = useState<string>(() => {
    const first = plans[0]?.prices[0]
    return first ? `${plans[0].id}:${first.id}` : ''
  })
  const [loading, setLoading] = useState(false)

  const pairs = useMemo(() => {
    const out: { planId: string; priceId: string; label: string }[] = []
    for (const p of plans) {
      for (const pr of p.prices) {
        out.push({
          planId: p.id,
          priceId: pr.id,
          label: `${p.name} — ${formatPrice(pr.unitAmount, pr.currency)} / ${pr.interval}`,
        })
      }
    }
    return out
  }, [plans])

  async function startCheckout() {
    const pair = pairs.find((x) => `${x.planId}:${x.priceId}` === selectedKey)
    if (!pair) {
      toastBillingBlockedIfNeeded(null, t('toastSelectPlanPrice'))
      return
    }
    setLoading(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const res = await createBillingCheckoutAction({
        billingPlanPriceId: pair.priceId,
        successUrl: `${origin}/${locale}/settings/subscription?checkout=success`,
        cancelUrl: `${origin}/${locale}/settings/subscription?checkout=cancel`,
      })
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl
        return
      }
      toastBillingBlockedIfNeeded(null, t('toastCheckoutMissingUrl'))
    } catch (e) {
      toastBillingBlockedIfNeeded(
        e,
        e instanceof Error ? e.message : t('toastCheckoutError'),
        t('toastReadOnly')
      )
    } finally {
      setLoading(false)
    }
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('availablePlans')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t('noPlansConfigured')}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('choosePlan')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <label className="text-sm text-muted-foreground">{t('planPriceLabel')}</label>
          <Select value={selectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {pairs.map((x) => (
                <SelectItem key={`${x.planId}:${x.priceId}`} value={`${x.planId}:${x.priceId}`}>
                  {x.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" disabled={loading || !selectedKey} onClick={() => void startCheckout()}>
          {loading ? t('opening') : t('goToCheckout')}
        </Button>
      </CardContent>
    </Card>
  )
}
