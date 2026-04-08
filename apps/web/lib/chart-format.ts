/**
 * Axis and tooltip helpers for charts. Prefer Intl over manual k/M suffixes
 * so values like 10_000_000 never become "10000k".
 */

import { getCurrencySymbol } from '@/lib/format-utils'

export type ChartCurrencyFormatOptions = {
  locale?: string
  currency?: string
}

/**
 * Compact currency for Y-axis ticks, e.g. $1K, $1,5M (es-AR) or $1M (en).
 */
export function formatChartAxisCurrency(
  value: number,
  options?: ChartCurrencyFormatOptions
): string {
  const locale = options?.locale ?? 'es-AR'
  const currency = options?.currency ?? 'ARS'

  if (!Number.isFinite(value)) {
    return `${getCurrencySymbol(currency)}0`
  }

  if (value === 0) {
    return `${getCurrencySymbol(currency)}0`
  }

  try {
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: 'short',
      style: 'currency',
      currency,
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    const sign = value < 0 ? '−' : ''
    const abs = Math.abs(value)
    const compact = new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(abs)
    return `${sign}${getCurrencySymbol(currency)}${compact}`
  }
}
