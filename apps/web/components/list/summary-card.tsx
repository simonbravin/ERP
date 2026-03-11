'use client'

import type { LucideIcon } from 'lucide-react'

export interface SummaryCardProps {
  /** Optional icon shown before the label. */
  icon?: LucideIcon
  /** Short label (e.g. "Saldo a pagar:", "Total items"). */
  label: string
  /** Main value (number, currency string, or any React node). */
  value: React.ReactNode
  /** Optional action (e.g. Link "Ver proyección de caja", or Button). */
  action?: React.ReactNode
  className?: string
}

/**
 * Standard block for list summary/KPI above tables. Same look as AP/AR project "Saldo a pagar" / "Saldo a cobrar" bars.
 * Use for totals, key metrics, and optional link to related view.
 */
export function SummaryCard({ icon: Icon, label, value, action, className }: SummaryCardProps) {
  return (
    <div
      className={
        className
          ? `flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 ${className}`
          : 'flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3'
      }
    >
      <div className="flex items-center gap-2">
        {Icon != null && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="tabular-nums font-semibold text-foreground">{value}</span>
      </div>
      {action != null && <div className="flex items-center">{action}</div>}
    </div>
  )
}
