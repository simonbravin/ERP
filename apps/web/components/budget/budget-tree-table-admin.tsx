'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
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
import { Input } from '@/components/ui/input'
import { ChevronRight, ChevronDown, Calculator } from 'lucide-react'
import { APUEditorDialog } from './apu-editor-dialog'
import { updateBudgetLineQuantity } from '@/app/actions/budget'
import { toast } from 'sonner'
import { RESOURCE_TYPES } from '@/lib/constants/budget'

export interface BudgetTreeLineResource {
  id: string
  resourceType: string
  quantity: number
  unitCost: number
}

export interface BudgetTreeLine {
  id: string
  description: string
  unit: string
  quantity: number
  directCostTotal: number
  overheadPct: number
  financialPct: number
  profitPct: number
  taxPct: number
  resources: BudgetTreeLineResource[]
}

export interface BudgetTreeNode {
  wbsNode: {
    id: string
    code: string
    name: string
    category: string
  }
  lines: BudgetTreeLine[]
  children: BudgetTreeNode[]
}

interface BudgetTreeTableAdminProps {
  data: BudgetTreeNode[]
  versionId: string
  canEdit: boolean
  projectTotal: number
}

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'object' && v !== null && 'toNumber' in typeof (v as { toNumber?: () => number }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber()
  }
  return Number(v) || 0
}

export function BudgetTreeTableAdmin({
  data,
  versionId,
  canEdit,
  projectTotal,
}: BudgetTreeTableAdminProps) {
  const t = useTranslations('budget')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [editingAPU, setEditingAPU] = useState<string | null>(null)
  const [editingQuantity, setEditingQuantity] = useState<{ lineId: string; value: string } | null>(null)

  function toggleNode(nodeId: string) {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  function calculateNodeTotal(node: BudgetTreeNode): number {
    const linesTotal = node.lines.reduce((sum, line) => sum + toNum(line.directCostTotal), 0)
    const childrenTotal = node.children.reduce((sum, child) => sum + calculateNodeTotal(child), 0)
    return linesTotal + childrenTotal
  }

  function handleQuantityChange(lineId: string, newQuantity: string) {
    const quantity = parseFloat(newQuantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error(t('invalidQuantity', { defaultValue: 'Cantidad inválida' }))
      setEditingQuantity(null)
      return
    }
    startTransition(async () => {
      try {
        const result = await updateBudgetLineQuantity(lineId, quantity)
        if (result.success) {
          toast.success(t('quantityUpdated', { defaultValue: 'Cantidad actualizada' }))
          router.refresh()
        } else {
          toast.error(result.error ?? t('quantityUpdateError', { defaultValue: 'Error al actualizar cantidad' }))
        }
      } catch {
        toast.error(t('quantityUpdateError', { defaultValue: 'Error al actualizar cantidad' }))
      } finally {
        setEditingQuantity(null)
      }
    })
  }

  function renderNode(node: BudgetTreeNode, level: number = 0): React.ReactNode[] {
    const isExpanded = expandedNodes.has(node.wbsNode.id)
    const hasChildren = node.children.length > 0 || node.lines.length > 0
    const nodeTotal = calculateNodeTotal(node)
    const incidencePct = projectTotal > 0 ? (nodeTotal / projectTotal) * 100 : 0

    const bgClass =
      level === 0 ? 'bg-slate-50 dark:bg-slate-900/50' : level === 1 ? 'bg-slate-100/80 dark:bg-slate-800/50' : level === 2 ? 'bg-slate-150 dark:bg-slate-800/30' : 'bg-slate-200/60 dark:bg-slate-700/30'

    const out: React.ReactNode[] = []

    out.push(
      <TableRow key={`wbs-${node.wbsNode.id}`} className={`${bgClass} font-medium hover:opacity-90`}>
        <TableCell style={{ paddingLeft: `${level * 24 + 16}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button
                type="button"
                onClick={() => toggleNode(node.wbsNode.id)}
                className="rounded p-1 hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{node.wbsNode.code}</span>
            <span className="text-sm text-slate-900 dark:text-slate-100">{node.wbsNode.name}</span>
          </div>
        </TableCell>
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell className="text-right">
          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(nodeTotal)}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{incidencePct.toFixed(2)}%</span>
        </TableCell>
        <TableCell />
      </TableRow>
    )

    if (isExpanded && node.lines.length > 0) {
      for (const line of node.lines) {
        const resources = line.resources ?? []
        const materialsTotal = resources
          .filter((r) => r.resourceType === RESOURCE_TYPES.MATERIAL)
          .reduce((sum, r) => sum + toNum(r.quantity) * toNum(r.unitCost), 0)
        const laborTotal = resources
          .filter((r) => r.resourceType === RESOURCE_TYPES.LABOR)
          .reduce((sum, r) => sum + toNum(r.quantity) * toNum(r.unitCost), 0)
        const equipmentTotal = resources
          .filter((r) => r.resourceType === RESOURCE_TYPES.EQUIPMENT || r.resourceType === 'SUBCONTRACT')
          .reduce((sum, r) => sum + toNum(r.quantity) * toNum(r.unitCost), 0)
        const lineTotal = toNum(line.directCostTotal)
        const lineIncidencePct = projectTotal > 0 ? (lineTotal / projectTotal) * 100 : 0
        const hasAPU = resources.length > 0
        const isEditingThisQty = editingQuantity?.lineId === line.id

        out.push(
          <TableRow key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <TableCell style={{ paddingLeft: `${(level + 1) * 24 + 16}px` }}>
              <span className="text-sm text-slate-700 dark:text-slate-300">{line.description}</span>
            </TableCell>
            <TableCell>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{line.unit}</span>
            </TableCell>
            <TableCell className="text-right">
              {canEdit && isEditingThisQty ? (
                <Input
                  type="number"
                  step="0.01"
                  value={editingQuantity.value}
                  onChange={(e) => setEditingQuantity({ lineId: line.id, value: e.target.value })}
                  onBlur={() => editingQuantity && handleQuantityChange(line.id, editingQuantity.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      editingQuantity && handleQuantityChange(line.id, editingQuantity.value)
                    } else if (e.key === 'Escape') {
                      setEditingQuantity(null)
                    }
                  }}
                  autoFocus
                  className="h-7 w-20 text-right font-mono text-sm"
                  disabled={isPending}
                />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    canEdit && setEditingQuantity({ lineId: line.id, value: String(line.quantity) })
                  }
                  className={`font-mono text-sm tabular-nums ${canEdit ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                >
                  {formatNumber(toNum(line.quantity))}
                </button>
              )}
            </TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-sm tabular-nums text-blue-700 dark:text-blue-400">
                {materialsTotal > 0 ? formatCurrency(materialsTotal) : '–'}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-sm tabular-nums text-green-700 dark:text-green-400">
                {laborTotal > 0 ? formatCurrency(laborTotal) : '–'}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-sm tabular-nums text-orange-700 dark:text-orange-400">
                {equipmentTotal > 0 ? formatCurrency(equipmentTotal) : '–'}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(lineTotal)}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                {lineIncidencePct.toFixed(2)}%
              </span>
            </TableCell>
            <TableCell>
              {canEdit && (
                <Button
                  variant={hasAPU ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditingAPU(line.id)}
                  className="h-7"
                >
                  <Calculator className="mr-1 h-3 w-3" />
                  APU
                  {hasAPU && (
                    <span className="ml-1 rounded bg-white/20 px-1 text-xs">{resources.length}</span>
                  )}
                </Button>
              )}
            </TableCell>
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

  const grandTotal = data.reduce((sum, node) => sum + calculateNodeTotal(node), 0)

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-800 dark:bg-slate-900">
            <TableRow className="border-slate-600 hover:bg-slate-800 dark:hover:bg-slate-900">
              <TableHead className="w-[300px] text-white">{t('item', { defaultValue: 'Item' })}</TableHead>
              <TableHead className="w-[60px] text-white">{t('unit')}</TableHead>
              <TableHead className="w-[100px] text-right text-white">{t('quantity')}</TableHead>
              <TableHead className="w-[120px] text-right text-white">
                <span className="text-blue-300">💎 {t('material', { defaultValue: 'Material' })}</span>
              </TableHead>
              <TableHead className="w-[120px] text-right text-white">
                <span className="text-green-300">👷 {t('labor', { defaultValue: 'MO' })}</span>
              </TableHead>
              <TableHead className="w-[120px] text-right text-white">
                <span className="text-orange-300">🚜 {t('equipment', { defaultValue: 'Equipo' })}</span>
              </TableHead>
              <TableHead className="w-[140px] text-right text-white">{t('total')}</TableHead>
              <TableHead className="w-[80px] text-right text-white">
                {t('incidence', { defaultValue: 'Inc %' })}
              </TableHead>
              <TableHead className="w-[100px] text-white">{t('apu', { defaultValue: 'APU' })}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((node) => renderNode(node))}
            <TableRow className="border-t-2 border-border bg-muted font-bold">
              <TableCell colSpan={8} className="text-right">
                {t('grandTotal')}:
              </TableCell>
              <TableCell className="text-right text-lg">{formatCurrency(grandTotal)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {editingAPU && (
        <APUEditorDialog
          budgetLineId={editingAPU}
          versionId={versionId}
          onClose={() => {
            setEditingAPU(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
