'use client'

import { useTranslations } from 'next-intl'

const CHANGE_TYPE_KEYS: Record<string, string> = {
  SCOPE: 'changeTypeScope',
  TIME: 'changeTypeTime',
  COST: 'changeTypeCost',
  OTHER: 'changeTypeOther',
}

export function ChangeTypeLabel({ type }: { type: string }) {
  const t = useTranslations('changeOrders')
  const key = CHANGE_TYPE_KEYS[type]
  return <span>{key ? t(key) : type}</span>
}
