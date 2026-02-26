'use client'

/**
 * Legacy: only used by BudgetVersionTabs, which is not used by any route.
 * The version page uses BudgetVersionTabsWithSearch + BudgetLinesCompactTable instead.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMessageBus } from '@/hooks/use-message-bus'
import { BudgetLineForm } from './budget-line-form'
import { BudgetLineTable, type BudgetLineRow } from './budget-line-table'
import { BudgetTreeTable } from './budget-tree-table'
import { Button } from '@/components/ui/button'
import { createBudgetLine, deleteBudgetLine, importLinesFromVersion } from '@/app/actions/budget'
import { formatCurrency } from '@/lib/format-utils'
import type { CreateBudgetLineInput } from '@repo/validators'

type WbsOption = { id: string; code: string; name: string }
type VersionOption = { id: string; versionCode: string }
type WbsTreeNode = {
  id: string
  code: string
  name: string
  category: string
  parentId: string | null
  unit: string | null
  quantity: number
  children: WbsTreeNode[]
}

type BudgetLinesClientProps = {
  projectId: string
  versionId: string
  version: { status: string; versionCode: string }
  lines: BudgetLineRow[]
  wbsTree?: WbsTreeNode[]
  versionTotal: number
  wbsOptions: WbsOption[]
  otherVersions: VersionOption[]
  canEdit: boolean
  canViewAdmin?: boolean
  defaultIndirectPct?: number
  onDelete?: (lineId: string) => void
}

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(
  versionCode: string,
  lines: BudgetLineRow[]
) {
  const headers = ['WBS Code', 'WBS Name', 'Description', 'Quantity', 'Unit', 'Unit Cost', 'Total']
  const rows = lines.map((line) => {
    const qty = typeof line.quantity === 'number' ? line.quantity : 0
    const total = typeof line.directCostTotal === 'number' ? line.directCostTotal : 0
    const unitCost = qty > 0 ? total / qty : 0
    return [
      line.wbsNode.code,
      line.wbsNode.name,
      line.description,
      String(qty),
      line.unit,
      unitCost.toFixed(2),
      total.toFixed(2),
    ].map(escapeCsv)
  })
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `budget-${versionCode}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function BudgetLinesClient({
  projectId,
  versionId,
  version,
  lines,
  wbsTree,
  versionTotal,
  wbsOptions,
  otherVersions,
  canEdit,
  canViewAdmin = false,
  defaultIndirectPct,
  onDelete,
}: BudgetLinesClientProps) {
  const router = useRouter()
  const [importingFrom, setImportingFrom] = useState<string | null>(null)
  const t = useTranslations('budget')

  useMessageBus('BUDGET_LINE.CREATED', () => router.refresh())
  useMessageBus('BUDGET_LINE.UPDATED', () => router.refresh())
  useMessageBus('BUDGET_LINE.DELETED', () => router.refresh())
  useMessageBus('BUDGET_RESOURCE.ADDED', () => router.refresh())
  useMessageBus('BUDGET_VERSION.APPROVED', () => router.refresh())
  useMessageBus('FINANCE_TRANSACTION.CREATED', () => router.refresh())

  async function handleAddLine(data: CreateBudgetLineInput) {
    const result = await createBudgetLine(versionId, data)
    if (result && 'error' in result) return result
    router.refresh()
    return { success: true }
  }

  async function handleDeleteLine(lineId: string) {
    if (!confirm(t('confirmDeleteLine'))) return
    await deleteBudgetLine(lineId)
    router.refresh()
  }

  async function handleImportFrom(sourceVersionId: string) {
    setImportingFrom(sourceVersionId)
    const result = await importLinesFromVersion(versionId, sourceVersionId)
    setImportingFrom(null)
    if (result && 'error' in result) {
      alert(result.error)
      return
    }
    router.refresh()
  }

  function handleExport() {
    downloadCsv(version.versionCode, lines)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <BudgetLineForm
              versionId={versionId}
              wbsOptions={wbsOptions}
              defaultIndirectPct={defaultIndirectPct}
              onSubmit={handleAddLine}
            />
            {otherVersions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('importFrom')}:</span>
                <select
                  className="rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm text-foreground"
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    if (id) handleImportFrom(id)
                    e.target.value = ''
                  }}
                  disabled={!!importingFrom}
                >
                  <option value="">{t('previousVersion')}</option>
                  {otherVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.versionCode}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-9 px-3 text-sm"
          onClick={handleExport}
        >
          {t('exportCsv')}
        </Button>
      </div>
      {wbsTree && wbsTree.length > 0 ? (
        <>
          <BudgetTreeTable
            wbsTree={wbsTree}
            lines={lines}
            versionId={versionId}
            canEdit={canEdit}
            onDelete={onDelete ?? handleDeleteLine}
          />
          <div className="border-t border-border bg-muted/30 px-3 py-2 text-right font-medium tabular-nums text-foreground">
            {t('versionTotal')}: {formatCurrency(versionTotal)}
          </div>
        </>
      ) : (
        <BudgetLineTable
          lines={lines}
          versionTotal={versionTotal}
          canEdit={canEdit}
          canViewAdmin={canViewAdmin}
          onDelete={handleDeleteLine}
        />
      )}
    </div>
  )
}
