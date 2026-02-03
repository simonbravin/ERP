'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatCurrency, formatNumber } from '@/lib/format-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, ChevronDown, Calculator } from 'lucide-react'
import { APUEditorDialog } from './apu-editor-dialog'
import { calculateBudgetLine } from '@/lib/budget-calculations'
import { RESOURCE_TYPES } from '@/lib/constants/budget'
import type { BudgetLineRow } from './budget-line-table'

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

type BudgetLineRowWithResources = BudgetLineRow & {
  resources?: Array<{
    id: string
    resourceType: string
    description: string
    unit: string
    quantity: number
    unitCost: number
    totalCost: number
    attributes?: unknown
  }>
}

type BudgetTreeTableProps = {
  wbsTree: WbsTreeNode[]
  lines: BudgetLineRowWithResources[]
  versionId: string
  canEdit: boolean
  onDelete?: (lineId: string) => void
}

function toNum(v: { toNumber?: () => number } | number | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : (v as { toNumber: () => number }).toNumber?.() ?? 0
}

function lineUnitPrice(line: BudgetLineRowWithResources): number {
  const qty = toNum(line.quantity)
  const directTotal = toNum(line.directCostTotal)
  const unitDirect = qty > 0 ? directTotal / qty : 0
  const oh = toNum(line.overheadPct) ?? 0
  const fin = toNum(line.financialPct) ?? 0
  const prof = toNum(line.profitPct) ?? 0
  const tax = toNum(line.taxPct) ?? 21
  const calc = calculateBudgetLine(unitDirect, oh, fin, prof, tax)
  return Number(calc.totalPrice)
}

export function BudgetTreeTable({
  wbsTree,
  lines,
  versionId,
  canEdit,
  onDelete,
}: BudgetTreeTableProps) {
  const t = useTranslations('budget')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(wbsTree.map((n) => n.id)))
  const [editingAPU, setEditingAPU] = useState<string | null>(null)

  const linesByWbsId = new Map<string, BudgetLineRowWithResources[]>()
  for (const line of lines) {
    const wbsId = line.wbsNode.id
    if (!linesByWbsId.has(wbsId)) linesByWbsId.set(wbsId, [])
    linesByWbsId.get(wbsId)!.push(line)
  }

  function toggleNode(nodeId: string) {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  function calculateNodeTotal(node: WbsTreeNode): number {
    const nodeLines = linesByWbsId.get(node.id) ?? []
    let sum = nodeLines.reduce((s, line) => s + toNum(line.directCostTotal), 0)
    for (const child of node.children) {
      sum += calculateNodeTotal(child)
    }
    return sum
  }

  function renderNode(node: WbsTreeNode, level: number = 0): React.ReactNode[] {
    const isExpanded = expandedNodes.has(node.id)
    const nodeLines = linesByWbsId.get(node.id) ?? []
    const hasChildren = node.children.length > 0 || nodeLines.length > 0
    const total = calculateNodeTotal(node)

    const out: React.ReactNode[] = []

    out.push(
      <TableRow key={`wbs-${node.id}`} className="bg-muted/50 font-medium hover:bg-muted/70">
        <TableCell style={{ paddingLeft: `${level * 24 + 16}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button
                type="button"
                onClick={() => toggleNode(node.id)}
                className="rounded p-1 hover:bg-muted"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            <span className="font-mono text-xs text-muted-foreground">{node.code}</span>
            <span className="text-foreground">{node.name}</span>
          </div>
        </TableCell>
        <TableCell />
        <TableCell />
        <TableCell />
        {canEdit && <><TableCell /><TableCell /></>}
        <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
        {canEdit && <TableCell />}
      </TableRow>
    )

    if (isExpanded && nodeLines.length > 0) {
      for (const line of nodeLines) {
        const resources = line.resources ?? []
        const materialsTotal = resources
          .filter((r: { resourceType: string }) => r.resourceType === RESOURCE_TYPES.MATERIAL)
          .reduce((s: number, r: { quantity: number; unitCost: number }) => s + r.quantity * r.unitCost, 0)
        const laborTotal = resources
          .filter((r: { resourceType: string }) => r.resourceType === RESOURCE_TYPES.LABOR)
          .reduce((s: number, r: { quantity: number; unitCost: number }) => s + r.quantity * r.unitCost, 0)
        const equipmentTotal = resources
          .filter((r: { resourceType: string }) => r.resourceType === RESOURCE_TYPES.EQUIPMENT || r.resourceType === 'SUBCONTRACT')
          .reduce((s: number, r: { quantity: number; unitCost: number }) => s + r.quantity * r.unitCost, 0)
        const hasAPU = resources.length > 0
        const unitPrice = lineUnitPrice(line)

        out.push(
          <TableRow key={line.id} className="hover:bg-muted/30">
            <TableCell style={{ paddingLeft: `${(level + 1) * 24 + 16}px` }}>
              <span className="text-sm text-muted-foreground">{line.description}</span>
            </TableCell>
            <TableCell className="text-sm">{line.unit}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {formatNumber(toNum(line.quantity))}
            </TableCell>
            {canEdit && (
              <TableCell className="text-right text-sm tabular-nums">
                <div className="space-y-1">
                  <div className="text-blue-600 dark:text-blue-400">Mat: {formatCurrency(materialsTotal)}</div>
                  <div className="text-green-600 dark:text-green-400">MO: {formatCurrency(laborTotal)}</div>
                  <div className="text-orange-600 dark:text-orange-400">{t('equipment', { defaultValue: 'Equipo' })}: {formatCurrency(equipmentTotal)}</div>
                </div>
              </TableCell>
            )}
            {canEdit && (
              <>
                <TableCell className="text-right text-sm tabular-nums">
                  {(toNum(line.overheadPct) ?? 0).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {(toNum(line.profitPct) ?? 0).toFixed(1)}%
                </TableCell>
              </>
            )}
            <TableCell className="text-right text-sm font-medium tabular-nums">
              {formatCurrency(unitPrice)}
            </TableCell>
            <TableCell className="text-right text-sm font-semibold tabular-nums">
              {formatCurrency(toNum(line.directCostTotal))}
            </TableCell>
            {canEdit && (
              <TableCell>
                <Button
                  variant={hasAPU ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditingAPU(line.id)}
                >
                  <Calculator className="mr-1 h-4 w-4" />
                  APU
                  {hasAPU && (
                    <Badge variant="outline" className="ml-2">
                      {resources.length}
                    </Badge>
                  )}
                </Button>
              </TableCell>
            )}
          </TableRow>
        )
      }
    }

    if (isExpanded && node.children.length > 0) {
      for (const child of node.children) {
        out.push(...renderNode(child, level + 1))
      }
    }

    return out
  }

  const grandTotal = wbsTree.reduce((sum, node) => sum + calculateNodeTotal(node), 0)

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">{t('description')}</TableHead>
              <TableHead className="w-[80px]">{t('unit')}</TableHead>
              <TableHead className="w-[100px] text-right">{t('quantity')}</TableHead>
              {canEdit && (
                <>
                  <TableHead className="w-[180px] text-right">
                    {t('directCostBreakdown', { defaultValue: 'Desglose directo' })}
                  </TableHead>
                  <TableHead className="w-[80px] text-right">{t('overhead')}</TableHead>
                  <TableHead className="w-[80px] text-right">{t('profit')}</TableHead>
                </>
              )}
              <TableHead className="w-[120px] text-right">{t('unitPrice')}</TableHead>
              <TableHead className="w-[140px] text-right">{t('total')}</TableHead>
              {canEdit && <TableHead className="w-[120px]">{t('apu', { defaultValue: 'APU' })}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {wbsTree.map((node) => renderNode(node))}
            <TableRow className="border-t-2 border-border bg-muted font-bold">
              <TableCell colSpan={canEdit ? 7 : 4} className="text-right">
                {t('grandTotal')}:
              </TableCell>
              <TableCell className="text-right text-lg">{formatCurrency(grandTotal)}</TableCell>
              {canEdit && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {editingAPU && (
        <APUEditorDialog
          budgetLineId={editingAPU}
          versionId={versionId}
          onClose={() => setEditingAPU(null)}
        />
      )}
    </>
  )
}
