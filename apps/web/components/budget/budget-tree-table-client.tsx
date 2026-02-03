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
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { BudgetTreeNode } from './budget-tree-table-admin'

interface BudgetTreeTableClientProps {
  data: BudgetTreeNode[]
  versionId: string
}

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return Number(v) || 0
}

export function BudgetTreeTableClient({ data, versionId }: BudgetTreeTableClientProps) {
  const t = useTranslations('budget')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

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

  function renderNode(node: BudgetTreeNode, level: number = 0): React.ReactNode[] {
    const isExpanded = expandedNodes.has(node.wbsNode.id)
    const hasChildren = node.children.length > 0 || node.lines.length > 0
    const nodeTotal = calculateNodeTotal(node)

    const bgClass =
      level === 0 ? 'bg-slate-50 dark:bg-slate-900/50' : level === 1 ? 'bg-slate-100/80 dark:bg-slate-800/50' : 'bg-slate-150 dark:bg-slate-800/30'

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
        <TableCell className="text-right">
          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(nodeTotal)}
          </span>
        </TableCell>
      </TableRow>
    )

    if (isExpanded && node.lines.length > 0) {
      for (const line of node.lines) {
        const lineTotal = toNum(line.directCostTotal)
        out.push(
          <TableRow key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <TableCell style={{ paddingLeft: `${(level + 1) * 24 + 16}px` }}>
              <span className="text-sm text-slate-700 dark:text-slate-300">{line.description}</span>
            </TableCell>
            <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
              {formatNumber(toNum(line.quantity))} {line.unit}
            </TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(lineTotal)}
              </span>
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
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-slate-800 dark:bg-slate-900">
          <TableRow className="border-slate-600 hover:bg-slate-800 dark:hover:bg-slate-900">
            <TableHead className="w-[400px] text-white">{t('item', { defaultValue: 'Item' })}</TableHead>
            <TableHead className="w-[120px] text-white">{t('quantity')}</TableHead>
            <TableHead className="w-[140px] text-right text-white">{t('total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((node) => renderNode(node))}
          <TableRow className="border-t-2 border-border bg-muted font-bold">
            <TableCell colSpan={2} className="text-right">
              {t('grandTotal')}:
            </TableCell>
            <TableCell className="text-right text-lg">{formatCurrency(grandTotal)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
