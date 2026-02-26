'use client'

import { useState, Fragment } from 'react'
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
import { ChevronDown, ChevronRight } from 'lucide-react'

interface BudgetTreeNode {
  wbsNode: {
    id: string
    code: string
    name: string
    category: string
  }
  lines: Array<{
    id: string
    description: string
    unit: string
    quantity: number
    directCostTotal: number
    overheadPct: number
    financialPct: number
    profitPct: number
    taxPct: number
  }>
  children: BudgetTreeNode[]
}

interface BudgetClientViewProps {
  data: BudgetTreeNode[]
  projectTotal: number
}

export function BudgetClientView({ data, projectTotal }: BudgetClientViewProps) {
  const t = useTranslations('budget')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  function toggleNode(nodeId: string) {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  /**
   * Precio de venta: GG sobre costo directo → Subtotal 1; GF y Beneficio sobre Subtotal 1 → Subtotal 2; IVA sobre Subtotal 2 → Total
   */
  function calculateSalePrice(line: (BudgetTreeNode['lines'][0])): number {
    const directUnitCost =
      Number(line.directCostTotal) / Number(line.quantity)
    const sub1 = directUnitCost * (1 + Number(line.overheadPct) / 100)
    const sub2 = sub1 * (1 + Number(line.financialPct) / 100 + Number(line.profitPct) / 100)
    return sub2 * (1 + Number(line.taxPct) / 100)
  }

  /** Roll-up: parents show only sum of children; leaves show lines total. */
  function calculateNodeTotal(node: BudgetTreeNode): number {
    const linesTotal = node.lines.reduce((sum, line) => {
      const salePrice = calculateSalePrice(line)
      return sum + salePrice * Number(line.quantity)
    }, 0)

    const childrenTotal = node.children.reduce(
      (sum, child) => sum + calculateNodeTotal(child),
      0
    )

    if (node.children.length > 0) return childrenTotal
    return linesTotal
  }

  function renderNode(node: BudgetTreeNode, level: number = 0) {
    const isExpanded = expandedNodes.has(node.wbsNode.id)
    const hasChildren =
      node.children.length > 0 || node.lines.length > 0
    const nodeTotal = calculateNodeTotal(node)
    const incidencePct =
      projectTotal > 0 ? (nodeTotal / projectTotal) * 100 : 0

    const bgColors = [
      'bg-muted/30',
      'bg-muted/50',
      'bg-muted/50',
      'bg-muted/70',
    ]
    const bgColor = bgColors[Math.min(level, bgColors.length - 1)]

    return (
      <>
        {/* WBS Node Row */}
        <TableRow className={`${bgColor} h-9 hover:bg-muted/50`}>
          <TableCell
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            className="py-1 px-2"
          >
            <div className="flex items-center gap-1">
              {hasChildren && (
                <button
                  type="button"
                  onClick={() => toggleNode(node.wbsNode.id)}
                  className="rounded p-0.5 hover:bg-slate-300"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              )}
              <span className="font-mono text-[10px] text-muted-foreground">
                {node.wbsNode.code}
              </span>
              <span className="text-xs font-medium text-foreground">
                {node.wbsNode.name}
              </span>
            </div>
          </TableCell>
          <TableCell className="py-1 px-2" />
          <TableCell className="py-1 px-2" />
          <TableCell className="py-1 px-2" />
          <TableCell className="py-1 px-2 text-right">
            <span className="font-mono text-xs font-semibold tabular-nums text-blue-700">
              {formatCurrency(nodeTotal)}
            </span>
          </TableCell>
          <TableCell className="py-1 px-2 text-right">
            <span className="font-mono text-[10px] tabular-nums text-slate-600">
              {incidencePct.toFixed(2)}%
            </span>
          </TableCell>
        </TableRow>

        {/* Budget Lines: only on leaf nodes (roll-up, no partida rows under parents) */}
        {isExpanded &&
          node.children.length === 0 &&
          node.lines.map((line) => {
            const salePrice = calculateSalePrice(line)
            const totalSale = salePrice * Number(line.quantity)
            const lineIncidencePct =
              projectTotal > 0 ? (totalSale / projectTotal) * 100 : 0

            return (
              <TableRow key={line.id} className="h-9 hover:bg-muted/50">
                <TableCell
                  style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
                  className="py-1 px-2"
                >
                  <span className="text-xs text-slate-700">
                    {line.description}
                  </span>
                </TableCell>

                <TableCell className="py-1 px-2">
                  <span className="font-mono text-[10px] text-slate-600">
                    {line.unit}
                  </span>
                </TableCell>

                <TableCell className="py-1 px-2 text-right">
                  <span className="font-mono text-xs tabular-nums">
                    {formatNumber(Number(line.quantity))}
                  </span>
                </TableCell>

                <TableCell className="py-1 px-2 text-right">
                  <span className="font-mono text-xs tabular-nums text-slate-700">
                    {formatCurrency(salePrice)}
                  </span>
                </TableCell>

                <TableCell className="py-1 px-2 text-right">
                  <span className="font-mono text-xs font-semibold tabular-nums text-blue-700">
                    {formatCurrency(totalSale)}
                  </span>
                </TableCell>

                <TableCell className="py-1 px-2 text-right">
                  <span className="font-mono text-[10px] tabular-nums text-slate-600">
                    {lineIncidencePct.toFixed(2)}%
                  </span>
                </TableCell>
              </TableRow>
            )
          })}

        {/* Children */}
        {isExpanded &&
          node.children.map((child) => (
            <Fragment key={child.wbsNode.id}>
              {renderNode(child, level + 1)}
            </Fragment>
          ))}
      </>
    )
  }

  const grandTotal = data.reduce(
    (sum, node) => sum + calculateNodeTotal(node),
    0
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-table-head">
          <TableRow className="h-9">
            <TableHead className="text-foreground text-xs py-1 px-2">
              {t('item')}
            </TableHead>
            <TableHead className="text-foreground text-xs py-1 px-2 w-[60px]">
              {t('unit')}
            </TableHead>
            <TableHead className="text-foreground text-xs py-1 px-2 text-right w-[80px]">
              {t('quantity')}
            </TableHead>
            <TableHead className="text-foreground text-xs py-1 px-2 text-right w-[100px]">
              {t('unitPrice')}
            </TableHead>
            <TableHead className="text-foreground text-xs py-1 px-2 text-right w-[120px]">
              {t('total')}
            </TableHead>
            <TableHead className="text-foreground text-xs py-1 px-2 text-right w-[70px]">
              {t('incidence')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((node) => (
            <Fragment key={node.wbsNode.id}>
              {renderNode(node)}
            </Fragment>
          ))}

          {/* Grand Total */}
          <TableRow className="h-9 border-t-2 border-border bg-muted font-bold">
            <TableCell colSpan={4} className="text-right text-sm py-1 px-2 text-foreground">
              {t('totalSale')}:
            </TableCell>
            <TableCell className="text-right text-base py-1 px-2">
              <span className="font-mono tabular-nums text-primary">
                {formatCurrency(grandTotal)}
              </span>
            </TableCell>
            <TableCell className="text-right text-xs py-1 px-2">
              100.00%
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
