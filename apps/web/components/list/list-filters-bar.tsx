'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export interface ListFiltersBarProps {
  children: React.ReactNode
  /** Callback when "Aplicar" is clicked. If not provided, no Apply button is shown (e.g. when filters auto-apply). */
  onApply?: () => void
  /** Callback when "Limpiar" is clicked. If not provided, no Clear button is shown. */
  onClear?: () => void
  /** When true, show loading state on the Apply button. */
  isPending?: boolean
  /** Optional class for the container. */
  className?: string
}

/**
 * Standard container for list filters. Use the same look & feel across all list pages (finance, reports, documents, etc.).
 * Renders a card with label "Filtros" (i18n common.filters) and slots for Selects/Inputs; optional Apply and Clear buttons.
 */
export function ListFiltersBar({
  children,
  onApply,
  onClear,
  isPending = false,
  className,
}: ListFiltersBarProps) {
  const t = useTranslations('common')

  return (
    <div
      className={
        className
          ? `flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 ${className}`
          : 'flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3'
      }
    >
      <span className="text-sm font-medium text-foreground">{t('filters')}</span>
      {children}
      {onApply != null && (
        <Button
          type="button"
          variant="secondary"
          onClick={onApply}
          disabled={isPending}
        >
          {isPending ? t('loading') : t('apply')}
        </Button>
      )}
      {onClear != null && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={isPending}
        >
          {t('clear')}
        </Button>
      )}
    </div>
  )
}
