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
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import type { BudgetLineRow } from './budget-line-table'

type WbsTreeNode = {
  id: string
  code: string
  name: string
  category: string
  parentId: string | null
  unit: string | null
  quantity: unknown
  children: WbsTreeNode[]
}

type ComputeSheetHierarchicalProps = {
  wbsTree: WbsTreeNode[]
  lines: BudgetLineRow[]
  canEdit?: boolean
  onDelete?: (lineId: string) => void
}

function toNum(v: { toNumber: () => number } | number | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : (v as { toNumber: () => number }).toNumber()
}

export function ComputeSheetHierarchical({
  wbsTree,
  lines,
  canEdit = false,
  onDelete,
}: ComputeSheetHierarchicalProps) {
  const t = useTranslations('budget')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(wbsTree.map((n) => n.id)))

  const linesByWbsId = new Map<string, BudgetLineRow>()
  for (const line of lines) {
    linesByWbsId.set(line.wbsNode.id, line)
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderNode(node: WbsTreeNode, depth: number): React.ReactNode[] {
    const nodes: React.ReactNode[] = []
    const hasChildren = node.children.length > 0
    const line = linesByWbsId.get(node.id)
    const isHeader = hasChildren && !line

    if (isHeader) {
      const isExpanded = expandedIds.has(node.id)

      function sumDescendantLines(n: WbsTreeNode): number {
        const line = linesByWbsId.get(n.id)
        let s = line
          ? (line.salePriceTotal != null ? toNum(line.salePriceTotal) : toNum(line.directCostTotal))
          : 0
        for (const c of n.children) s += sumDescendantLines(c)
        return s
      }
      const phaseTotal = sumDescendantLines(node)

      nodes.push(
        <TableRow
          key={node.id}
          className="bg-muted/50 hover:bg-muted/70 font-medium"
        >
          <TableCell
            className="font-mono font-semibold"
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            <button
              type="button"
              onClick={() => toggleExpand(node.id)}
              className="mr-1 inline-flex items-center rounded p-0.5 hover:bg-muted"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {node.code}. {node.name}
          </TableCell>
          <TableCell>—</TableCell>
          <TableCell className="text-right">—</TableCell>
          <TableCell className="text-right">0.0%</TableCell>
          <TableCell className="text-right font-mono font-semibold">
            {formatCurrency(phaseTotal)}
          </TableCell>
          {canEdit && <TableCell className="w-10" />}
        </TableRow>
      )

      if (isExpanded) {
        for (const child of node.children) {
          nodes.push(...renderNode(child, depth + 1))
        }
      }
    } else if (line) {
      const qty = toNum(line.quantity)
      const total = line.salePriceTotal != null ? toNum(line.salePriceTotal) : toNum(line.directCostTotal)
      const unitPrice = qty > 0 ? total / qty : 0

      nodes.push(
        <TableRow key={line.id} className="hover:bg-muted/30">
          <TableCell
            className="font-mono text-sm"
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            {node.code} {node.name}
          </TableCell>
          <TableCell>{line.unit}</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatNumber(qty)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatCurrency(unitPrice)}
          </TableCell>
          <TableCell className="text-right font-mono font-medium tabular-nums">
            {formatCurrency(total)}
          </TableCell>
          {canEdit && onDelete && (
            <TableCell className="w-10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDelete(line.id)}
                title={t('delete', { defaultValue: 'Eliminar' })}
              >
                <X className="h-4 w-4" />
              </Button>
            </TableCell>
          )}
        </TableRow>
      )
    }
    return nodes
  }

  const allRows = wbsTree.flatMap((n) => renderNode(n, 0))
  const grandTotal = lines.reduce((sum, l) => {
    const total = l.salePriceTotal != null ? toNum(l.salePriceTotal) : toNum(l.directCostTotal)
    return sum + total
  }, 0)

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
            <TableHead className="min-w-[280px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t('task', { defaultValue: 'TAREA' })}
            </TableHead>
            <TableHead className="w-[80px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t('unit')}
            </TableHead>
            <TableHead className="w-[100px] text-right font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t('quantity')}
            </TableHead>
            <TableHead className="w-[120px] text-right font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t('unitPrice', { defaultValue: 'P.U.' })}
            </TableHead>
            <TableHead className="w-[140px] text-right font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t('total')}
            </TableHead>
            {canEdit && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {allRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 6 : 5} className="py-12 text-center text-muted-foreground">
                {t('noBudgetLinesYet')}
              </TableCell>
            </TableRow>
          ) : (
            allRows
          )}
        </TableBody>
        <tfoot>
          <TableRow className="border-t-2 border-slate-300 bg-slate-100 font-bold dark:border-slate-600 dark:bg-slate-800">
            <TableCell colSpan={canEdit ? 4 : 3} className="text-right">
              {t('grandTotal', { defaultValue: 'TOTAL GENERAL' })}:
            </TableCell>
            <TableCell className="text-right text-lg tabular-nums">
              {formatCurrency(grandTotal)}
            </TableCell>
            {canEdit && <TableCell />}
          </TableRow>
        </tfoot>
      </Table>
    </div>
  )
}
