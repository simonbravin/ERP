'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { BudgetClientView } from './budget-client-view'
import { BudgetSummarySheet } from './budget-summary-sheet'
import { Eye, EyeOff } from 'lucide-react'
import type { BudgetTreeNode } from './budget-tree-table-admin'

interface SummaryLine {
  code: string
  description: string
  unit: string
  quantity: number
  unitPrice: number
  total: number
  overheadPct: number
  financialPct: number
  profitPct: number
  taxPct: number
}

interface BudgetSummaryTabClientProps {
  summaryData: SummaryLine[]
  treeData: BudgetTreeNode[]
  projectTotalSale: number
  markups: {
    overheadPct: number
    financialPct: number
    profitPct: number
    taxPct: number
  }
  canSeeAdmin: boolean
}

export function BudgetSummaryTabClient({
  summaryData,
  treeData,
  projectTotalSale,
  markups,
  canSeeAdmin,
}: BudgetSummaryTabClientProps) {
  const t = useTranslations('budget')
  const [viewMode, setViewMode] = useState<'admin' | 'client'>('admin')

  return (
    <div className="space-y-8">
      {canSeeAdmin && (
        <div className="flex items-center justify-end gap-2 rounded-lg border border-border bg-card p-3">
          <span className="text-sm text-muted-foreground">{t('viewModeTitle')}:</span>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-1">
            <Button
              type="button"
              variant={viewMode === 'admin' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setViewMode('admin')}
            >
              <Eye className="mr-1 h-3 w-3" />
              {t('viewModeAdmin')}
            </Button>
            <Button
              type="button"
              variant={viewMode === 'client' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setViewMode('client')}
            >
              <EyeOff className="mr-1 h-3 w-3" />
              {t('viewModeClient')}
            </Button>
          </div>
        </div>
      )}

      {summaryData.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noSummaryLinesInVersion')}</p>
      ) : canSeeAdmin && viewMode === 'admin' ? (
        <BudgetSummarySheet
          data={summaryData}
          projectTotal={projectTotalSale}
          markups={markups}
        />
      ) : (
        <BudgetClientView
          data={treeData}
          projectTotal={projectTotalSale}
          globalMarkups={markups}
        />
      )}
    </div>
  )
}
