'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { BudgetTreeTableAdmin } from './budget-tree-table-admin'
import { BudgetTreeTableClient } from './budget-tree-table-client'
import { BudgetTotalsFooter } from './budget-totals-footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Eye, EyeOff } from 'lucide-react'
import { RESOURCE_TYPES } from '@/lib/constants/budget'
import type { BudgetTreeNode } from './budget-tree-table-admin'

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return Number(v) || 0
}

interface BudgetVersionViewProps {
  version: {
    id: string
    status: string
    overheadPct?: number
    financialPct?: number
    profitPct?: number
    taxPct?: number
  }
  treeData: BudgetTreeNode[]
  canEdit: boolean
  userRole: string
}

export function BudgetVersionView({
  version,
  treeData,
  canEdit,
  userRole,
}: BudgetVersionViewProps) {
  const t = useTranslations('budget')

  const canSeeAdminMode = ['ADMIN', 'OWNER'].includes(userRole)
  const [viewMode, setViewMode] = useState<'admin' | 'client'>(canSeeAdminMode ? 'admin' : 'client')

  function calculateTotals() {
    let directCostTotal = 0
    let materialsTotal = 0
    let laborTotal = 0
    let equipmentTotal = 0

    function sumNode(node: BudgetTreeNode) {
      node.lines.forEach((line) => {
        directCostTotal += toNum(line.directCostTotal)
        ;(line.resources ?? []).forEach((r) => {
          const amount = toNum(r.quantity) * toNum(r.unitCost)
          if (r.resourceType === RESOURCE_TYPES.MATERIAL) materialsTotal += amount
          else if (r.resourceType === RESOURCE_TYPES.LABOR) laborTotal += amount
          else if (r.resourceType === RESOURCE_TYPES.EQUIPMENT || r.resourceType === 'SUBCONTRACT') equipmentTotal += amount
        })
      })
      node.children.forEach(sumNode)
    }

    treeData.forEach(sumNode)
    return { directCostTotal, materialsTotal, laborTotal, equipmentTotal }
  }

  const totals = calculateTotals()
  const overheadPct = version.overheadPct != null ? toNum(version.overheadPct) : 15
  const financialPct = version.financialPct != null ? toNum(version.financialPct) : 5
  const profitPct = version.profitPct != null ? toNum(version.profitPct) : 20
  const taxPct = version.taxPct != null ? toNum(version.taxPct) : 21

  return (
    <div className="space-y-6">
      {canSeeAdminMode && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium text-slate-900 dark:text-slate-100">
                {t('viewModeTitle', { defaultValue: 'Modo de Visualización' })}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {viewMode === 'admin'
                  ? t('viewModeAdminDesc', { defaultValue: 'Muestra desglose completo de costos y márgenes' })
                  : t('viewModeClientDesc', { defaultValue: 'Muestra solo precios de venta finales' })}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-1">
              <Button
                variant={viewMode === 'admin' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('admin')}
              >
                <Eye className="mr-2 h-4 w-4" />
                {t('viewModeAdmin', { defaultValue: 'Vista Administrador' })}
              </Button>
              <Button
                variant={viewMode === 'client' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('client')}
              >
                <EyeOff className="mr-2 h-4 w-4" />
                {t('viewModeClient', { defaultValue: 'Vista Cliente' })}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'admin' ? (
        <BudgetTreeTableAdmin
          data={treeData}
          versionId={version.id}
          canEdit={canEdit}
          projectTotal={totals.directCostTotal || 1}
        />
      ) : (
        <BudgetTreeTableClient data={treeData} versionId={version.id} />
      )}

      {viewMode === 'admin' && (
        <BudgetTotalsFooter
          directCostTotal={totals.directCostTotal}
          materialsTotal={totals.materialsTotal}
          laborTotal={totals.laborTotal}
          equipmentTotal={totals.equipmentTotal}
          overheadPct={overheadPct}
          financialPct={financialPct}
          profitPct={profitPct}
          taxPct={taxPct}
        />
      )}
    </div>
  )
}
