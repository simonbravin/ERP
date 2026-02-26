'use client'

import React, { Fragment, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatCurrency, formatCurrencyForDisplay, formatNumber } from '@/lib/format-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Plus, Trash2, Calculator, GripVertical } from 'lucide-react'
import { AddWbsNodeDialog, type WbsTemplateForLibrary } from './add-wbs-node-dialog'
import { APUEditorDialog } from './apu-editor-dialog'
import { deleteWbsNodeWithRenumber, deleteWbsNodeCascade } from '@/app/actions/wbs'
import { createBudgetLine } from '@/app/actions/budget'
import type { BudgetTreeNode } from './budget-tree-table-admin'

interface BudgetLinesCompactTableProps {
  data: BudgetTreeNode[]
  versionId: string
  projectId: string
  canEdit: boolean
  markupMode: string
  wbsTemplates?: WbsTemplateForLibrary[]
  searchQuery?: string
  /** 'totals' = una columna Total; 'breakdown' = Materiales, MO, Equipos, Total */
  columnView?: 'totals' | 'breakdown'
  /** When set, enables drag-and-drop reorder; called with (parentId, orderedWbsNodeIds) */
  onReorder?: (parentId: string | null, orderedWbsNodeIds: string[]) => Promise<void>
  /** Hide Actions column (e.g. Planilla Final read-only) */
  hideActions?: boolean
}

/** Filtra el árbol: se incluye un nodo si coincide código/nombre/descripción o si algún hijo coincide */
function filterTreeBySearch(nodes: BudgetTreeNode[], query: string): BudgetTreeNode[] {
  if (!query.trim()) return nodes
  const q = query.trim().toLowerCase()
  return nodes
    .map((node) => {
      const codeMatch = node.wbsNode.code?.toLowerCase().includes(q)
      const nameMatch = node.wbsNode.name?.toLowerCase().includes(q)
      const lineMatch = node.lines.some((l) =>
        String(l.description ?? '').toLowerCase().includes(q)
      )
      const matches = codeMatch || nameMatch || lineMatch
      const filteredChildren = filterTreeBySearch(node.children, query)
      if (matches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        }
      }
      return null
    })
    .filter((n): n is BudgetTreeNode => n != null)
}

/** Returns parent WBS id for nodeId, or undefined if not found. Root nodes get null as parent. */
function getParentId(nodes: BudgetTreeNode[], nodeId: string, parentId: string | null = null): string | null | undefined {
  for (const n of nodes) {
    if (n.wbsNode.id === nodeId) return parentId
    const found = getParentId(n.children, nodeId, n.wbsNode.id)
    if (found !== undefined) return found
  }
  return undefined
}

function getSiblingIds(nodes: BudgetTreeNode[], parentId: string | null): string[] {
  if (parentId === null) return nodes.map((n) => n.wbsNode.id)
  for (const n of nodes) {
    if (n.wbsNode.id === parentId) return n.children.map((c) => c.wbsNode.id)
    const ids = getSiblingIds(n.children, parentId)
    if (ids.length > 0) return ids
  }
  return []
}

function SortableBudgetRow({
  id,
  canDrag,
  displayLabel,
  className,
  children,
}: {
  id: string
  canDrag: boolean
  /** WBS code to show in Nº column (e.g. 1, 1.1, 1.1.1) */
  displayLabel?: string
  className?: string
  children: React.ReactNode
}) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <TableRow ref={setNodeRef} style={style} className={className}>
      <TableCell className="min-w-[5rem] w-[5rem] px-2 py-1 font-mono text-xs text-muted-foreground tabular-nums">
        <div className="flex items-center gap-1.5">
          {canDrag ? (
            <span
              className="inline-flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
              {...listeners}
              {...attributes}
              title="Arrastrar para reordenar"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="w-6 shrink-0" aria-hidden />
          )}
          <span className="min-w-[2rem] flex-1 text-right">
            {displayLabel != null && displayLabel !== '' ? displayLabel : '—'}
          </span>
        </div>
      </TableCell>
      {children}
    </TableRow>
  )
}

export function BudgetLinesCompactTable({
  data,
  versionId,
  projectId,
  canEdit,
  markupMode,
  wbsTemplates = [],
  searchQuery = '',
  columnView = 'totals',
  onReorder,
  hideActions = false,
}: BudgetLinesCompactTableProps) {
  const showBreakdown = columnView === 'breakdown'
  const canDrag = Boolean(canEdit && onReorder && !hideActions)

  function lineResourceSums(line: { resources: Array<{ resourceType: string; quantity: number; unitCost: number }> }) {
    let material = 0, labor = 0, equipment = 0
    for (const r of line.resources ?? []) {
      const tot = Number(r.quantity) * Number(r.unitCost)
      if (r.resourceType === 'MATERIAL') material += tot
      else if (r.resourceType === 'LABOR') labor += tot
      else if (r.resourceType === 'EQUIPMENT') equipment += tot
    }
    return { material, labor, equipment }
  }

  function nodeResourceSums(n: BudgetTreeNode): { material: number; labor: number; equipment: number } {
    let material = 0, labor = 0, equipment = 0
    for (const line of n.lines) {
      const s = lineResourceSums(line)
      material += s.material
      labor += s.labor
      equipment += s.equipment
    }
    for (const child of n.children) {
      const s = nodeResourceSums(child)
      material += s.material
      labor += s.labor
      equipment += s.equipment
    }
    return { material, labor, equipment }
  }
  const t = useTranslations('budget')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const filteredData = React.useMemo(
    () => filterTreeBySearch(data, searchQuery),
    [data, searchQuery]
  )

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [editingAPU, setEditingAPU] = useState<string | null>(null)

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addDialogParent, setAddDialogParent] = useState<{
    id: string | null
    code?: string
    name?: string
  }>({ id: null })

  const [deleteConfirm, setDeleteConfirm] = useState<{
    nodeId: string
    code: string
    name: string
    hasChildren: boolean
    childrenCount?: number
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!onReorder || !over || active.id === over.id) return
    const parentIdResult = getParentId(data, String(active.id))
    if (parentIdResult === undefined) return
    const parentId = parentIdResult ?? null
    const siblingIds = getSiblingIds(data, parentId)
    const oldIndex = siblingIds.indexOf(String(active.id))
    const newIndex = siblingIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(siblingIds, oldIndex, newIndex)
    await onReorder(parentId, newOrder)
    router.refresh()
  }

  function toggleNode(nodeId: string) {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  function handleAddClick(parentId: string | null, code?: string, name?: string) {
    setAddDialogParent({ id: parentId, code, name })
    setShowAddDialog(true)
  }

  function handleDeleteClick(nodeId: string, code: string, name: string) {
    const node = findNode(data, nodeId)
    const hasChildren = node ? node.children.length > 0 : false
    setDeleteConfirm({
      nodeId,
      code,
      name,
      hasChildren,
      childrenCount: hasChildren ? node?.children.length : 0,
    })
  }

  function findNode(nodes: BudgetTreeNode[], id: string): BudgetTreeNode | null {
    for (const n of nodes) {
      if (n.wbsNode.id === id) return n
      const found = findNode(n.children, id)
      if (found) return found
    }
    return null
  }

  function confirmDelete(cascade: boolean = false) {
    if (!deleteConfirm) return

    startTransition(async () => {
      try {
        const result = cascade
          ? await deleteWbsNodeCascade(deleteConfirm.nodeId)
          : await deleteWbsNodeWithRenumber(deleteConfirm.nodeId)

        if (result.success) {
          toast.success(t('nodeDeleted'), {
            description: cascade
              ? t('nodeDeletedCascadeDesc', { count: (result as { deletedCount?: number }).deletedCount ?? 0 })
              : t('nodeDeletedDesc'),
          })
          setDeleteConfirm(null)
          router.refresh()
        } else {
          const err = result as { hasChildren?: boolean; childrenCount?: number; error?: string }
          if (err.hasChildren) {
            setDeleteConfirm({
              ...deleteConfirm,
              hasChildren: true,
              childrenCount: err.childrenCount ?? deleteConfirm.childrenCount,
            })
          } else {
            toast.error(t('error'), {
              description: err.error ?? t('deleteNodeError'),
            })
            setDeleteConfirm(null)
          }
        }
      } catch {
        toast.error(t('error'), { description: t('deleteNodeError') })
        setDeleteConfirm(null)
      }
    })
  }

  /** Roll-up: parents show only sum of children; leaves show lines total. */
  function calculateNodeTotal(node: BudgetTreeNode): number {
    const linesTotal = node.lines.reduce(
      (sum, line) => sum + Number(line.directCostTotal),
      0
    )
    const childrenTotal = node.children.reduce(
      (sum, child) => sum + calculateNodeTotal(child),
      0
    )
    if (node.children.length > 0) return childrenTotal
    return linesTotal
  }

  function calculateNodeActualTotal(node: BudgetTreeNode): number {
    const linesTotal = node.lines.reduce(
      (sum, line) => sum + Number(line.actualCostTotal ?? 0),
      0
    )
    const childrenTotal = node.children.reduce(
      (sum, child) => sum + calculateNodeActualTotal(child),
      0
    )
    if (node.children.length > 0) return childrenTotal
    return linesTotal
  }

  /** First budget line in this node or in any descendant; for showing APU on phase rows with no direct lines. */
  function getFirstLineInNode(node: BudgetTreeNode): BudgetTreeNode['lines'][number] | null {
    if (node.lines[0]) return node.lines[0]
    for (const child of node.children) {
      const found = getFirstLineInNode(child)
      if (found) return found
    }
    return null
  }

  /** displayLabel = wbsNode.code for Nº column (e.g. 1, 1.1, 1.1.1) */
  function renderNode(node: BudgetTreeNode, level: number = 0, displayLabel?: string): React.ReactNode {
    const isExpanded = expandedNodes.has(node.wbsNode.id)
    const singleLinePhase = node.lines.length === 1 && node.children.length === 0
    const hasChildren = node.children.length > 0 || node.lines.length > 0
    const showChevron = hasChildren && !singleLinePhase
    const nodeTotal = calculateNodeTotal(node)

    const bgColors = ['bg-muted/30', 'bg-muted/50', 'bg-muted/70', 'bg-muted/80']
    const bgColor = bgColors[Math.min(level, bgColors.length - 1)] ?? 'bg-muted/30'

    if (singleLinePhase) {
      const line = node.lines[0]
      const hasAPU = line.resources.length > 0
      const sums = lineResourceSums(line)
      const itemAndRest = (
        <>
          <TableCell
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            className="px-2 py-1"
          >
            <span className="text-xs font-medium text-foreground">
              {node.wbsNode.name}
            </span>
          </TableCell>
          <TableCell className="px-2 py-1">
            <span className="font-mono text-[10px] text-muted-foreground">
              {line.unit}
            </span>
          </TableCell>
          <TableCell className="px-2 py-1 text-right">
            <span className="font-mono text-xs tabular-nums">
              {formatNumber(Number(line.quantity))}
            </span>
          </TableCell>
          {showBreakdown && (
            <>
              <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                {formatCurrency(sums.material)}
              </TableCell>
              <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                {formatCurrency(sums.labor)}
              </TableCell>
              <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                {formatCurrency(sums.equipment)}
              </TableCell>
            </>
          )}
          <TableCell className="erp-table-cell-currency px-2 py-1">
            <span className="font-mono text-xs font-semibold tabular-nums">
              {formatCurrency(Number(line.directCostTotal))}
            </span>
          </TableCell>
          <TableCell className="erp-table-cell-currency px-2 py-1 text-muted-foreground">
            <span className="font-mono text-xs tabular-nums">
              {formatCurrency(Number(line.actualCostTotal ?? 0))}
            </span>
          </TableCell>
          {!hideActions && (
            <TableCell className="px-2 py-1 min-w-[160px] shrink-0">
              {canEdit && (
                <div className="flex items-center gap-1 flex-nowrap overflow-visible">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleAddClick(
                        node.wbsNode.id,
                        node.wbsNode.code,
                        node.wbsNode.name
                      )
                    }
                    className="h-6 w-6 shrink-0 p-0"
                    title={t('addPhase')}
                  >
                    <Plus className="h-3 w-3 text-primary" />
                  </Button>
                  <Button
                    variant={hasAPU ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEditingAPU(line.id)}
                    className="h-6 shrink-0 text-[10px]"
                    title="APU - Análisis de precios unitarios"
                  >
                    <Calculator className="mr-1 h-3 w-3" />
                    APU
                    {hasAPU && (
                      <span className="ml-1 rounded bg-primary/20 px-1 text-[10px]">
                        {line.resources.length}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleDeleteClick(
                        node.wbsNode.id,
                        node.wbsNode.code,
                        node.wbsNode.name
                      )
                    }
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              )}
            </TableCell>
          )}
        </>
      )
      if (canDrag) {
        return (
          <SortableBudgetRow key={node.wbsNode.id} id={node.wbsNode.id} canDrag displayLabel={displayLabel ?? node.wbsNode.code} className={`${bgColor} h-8 hover:bg-muted/50`}>
            {itemAndRest}
          </SortableBudgetRow>
        )
      }
      const code = (displayLabel ?? node.wbsNode.code) || ''
      return (
        <TableRow key={node.wbsNode.id} className={`${bgColor} h-8 hover:bg-muted/50`}>
          <TableCell className="min-w-[5rem] w-[5rem] px-2 py-1 font-mono text-xs text-muted-foreground tabular-nums">
            <div className="flex items-center gap-1.5">
              <span className="w-6 shrink-0" aria-hidden />
              <span className="min-w-[2rem] flex-1 text-right">{code || '—'}</span>
            </div>
          </TableCell>
          {itemAndRest}
        </TableRow>
      )
    }

    const firstLineForApu = getFirstLineInNode(node)
    // APU only on leaf nodes (roll-up: parents get total from children, no partida on parent)
    const showApuOnPhase = canEdit && node.children.length === 0
    async function handlePhaseApuClick() {
      if (node.children.length > 0) return // no partida on parents
      if (firstLineForApu) {
        setEditingAPU(firstLineForApu.id)
        return
      }
      const result = await createBudgetLine(versionId, {
        wbsNodeId: node.wbsNode.id,
        description: node.wbsNode.name || node.wbsNode.code,
        unit: 'un',
        quantity: 1,
        unitCost: 0,
      })
      if (result && 'lineId' in result) {
        setEditingAPU(result.lineId)
        router.refresh()
      } else if (result && 'error' in result) {
        toast.error(t('error'), { description: typeof result.error === 'object' ? Object.values(result.error).flat().join(', ') : String(result.error) })
      }
    }

    const nonDragRow = (() => {
      const code = (displayLabel ?? node.wbsNode.code) || ''
      return (
        <TableRow key={node.wbsNode.id} className={`${bgColor} h-8 hover:bg-muted/50`}>
          <TableCell className="min-w-[5rem] w-[5rem] px-2 py-1 font-mono text-xs text-muted-foreground tabular-nums">
            <div className="flex items-center gap-1.5">
              <span className="w-6 shrink-0" aria-hidden />
              <span className="min-w-[2rem] flex-1 text-right">{code || '—'}</span>
            </div>
          </TableCell>
          <TableCell
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            className="px-2 py-1"
          >
            <div className="flex items-center gap-1">
              {showChevron && (
                <button
                  type="button"
                  onClick={() => toggleNode(node.wbsNode.id)}
                  className="rounded p-0.5 hover:bg-muted"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              )}
              <span className="text-xs font-medium text-foreground">
                {node.wbsNode.name}
              </span>
            </div>
          </TableCell>
          <TableCell className="px-2 py-1" />
          <TableCell className="px-2 py-1" />
          {showBreakdown && (() => {
            const sums = nodeResourceSums(node)
            return (
              <>
                <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                  {formatCurrency(sums.material)}
                </TableCell>
                <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                  {formatCurrency(sums.labor)}
                </TableCell>
                <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                  {formatCurrency(sums.equipment)}
                </TableCell>
              </>
            )
          })()}
          <TableCell className="erp-table-cell-currency px-2 py-1">
            <span className="font-mono text-xs font-semibold">
              {formatCurrencyForDisplay(nodeTotal)}
            </span>
          </TableCell>
          <TableCell className="erp-table-cell-currency px-2 py-1 text-muted-foreground">
            <span className="font-mono text-xs tabular-nums">
              {formatCurrency(calculateNodeActualTotal(node))}
            </span>
          </TableCell>
          {!hideActions && (
            <TableCell className="px-2 py-1 min-w-[160px] shrink-0">
              {canEdit && (
                <div className="flex items-center gap-1 flex-nowrap overflow-visible">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleAddClick(
                        node.wbsNode.id,
                        node.wbsNode.code,
                        node.wbsNode.name
                      )
                    }
                    className="h-6 w-6 shrink-0 p-0"
                    title={t('addPhase')}
                  >
                    <Plus className="h-3 w-3 text-primary" />
                  </Button>
                  {showApuOnPhase && (
                    <Button
                      variant={firstLineForApu?.resources.length ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePhaseApuClick()}
                      className="h-6 shrink-0 text-[10px]"
                      title="APU - Análisis de precios unitarios"
                    >
                      <Calculator className="mr-1 h-3 w-3" />
                      APU
                      {firstLineForApu?.resources.length ? (
                        <span className="ml-1 rounded bg-primary/20 px-1 text-[10px]">
                          {firstLineForApu.resources.length}
                        </span>
                      ) : null}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleDeleteClick(
                        node.wbsNode.id,
                        node.wbsNode.code,
                        node.wbsNode.name
                      )
                    }
                    className="h-6 w-6 shrink-0 p-0"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              )}
            </TableCell>
          )}
        </TableRow>
      )
    })()

    return React.createElement(
      Fragment,
      { key: node.wbsNode.id },
      canDrag ? (
          <SortableBudgetRow id={node.wbsNode.id} canDrag displayLabel={displayLabel ?? node.wbsNode.code} className={`${bgColor} h-8 hover:bg-muted/50`}>
            <TableCell
              style={{ paddingLeft: `${level * 16 + 8}px` }}
              className="px-2 py-1"
            >
              <div className="flex items-center gap-1">
                {showChevron && (
                  <button
                    type="button"
                    onClick={() => toggleNode(node.wbsNode.id)}
                    className="rounded p-0.5 hover:bg-muted"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                )}
                <span className="text-xs font-medium text-foreground">
                  {node.wbsNode.name}
                </span>
              </div>
            </TableCell>
            <TableCell className="px-2 py-1" />
            <TableCell className="px-2 py-1" />
            {showBreakdown && (() => {
              const sums = nodeResourceSums(node)
              return (
                <>
                  <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                    {formatCurrency(sums.material)}
                  </TableCell>
                  <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                    {formatCurrency(sums.labor)}
                  </TableCell>
                  <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                    {formatCurrency(sums.equipment)}
                  </TableCell>
                </>
              )
            })()}
            <TableCell className="erp-table-cell-currency px-2 py-1">
              <span className="font-mono text-xs font-semibold">
                {formatCurrencyForDisplay(nodeTotal)}
              </span>
            </TableCell>
            <TableCell className="erp-table-cell-currency px-2 py-1 text-muted-foreground">
              <span className="font-mono text-xs tabular-nums">
                {formatCurrency(calculateNodeActualTotal(node))}
              </span>
            </TableCell>
            {!hideActions && (
              <TableCell className="px-2 py-1 min-w-[160px] shrink-0">
                {canEdit && (
                  <div className="flex items-center gap-1 flex-nowrap overflow-visible">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleAddClick(
                          node.wbsNode.id,
                          node.wbsNode.code,
                          node.wbsNode.name
                        )
                      }
                      className="h-6 w-6 shrink-0 p-0"
                      title={t('addPhase')}
                    >
                      <Plus className="h-3 w-3 text-primary" />
                    </Button>
                    {showApuOnPhase && (
                      <Button
                        variant={firstLineForApu?.resources.length ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePhaseApuClick()}
                        className="h-6 shrink-0 text-[10px]"
                        title="APU - Análisis de precios unitarios"
                      >
                        <Calculator className="mr-1 h-3 w-3" />
                        APU
                        {firstLineForApu?.resources.length ? (
                          <span className="ml-1 rounded bg-primary/20 px-1 text-[10px]">
                            {firstLineForApu.resources.length}
                          </span>
                        ) : null}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleDeleteClick(
                          node.wbsNode.id,
                          node.wbsNode.code,
                          node.wbsNode.name
                        )
                      }
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                )}
              </TableCell>
            )}
          </SortableBudgetRow>
        ) : nonDragRow,
        // Roll-up: do not show partida rows on parents; only phase row + children
        isExpanded &&
          node.children.length === 0 &&
          node.lines.map((line) => {
            const hasAPU = line.resources.length > 0
            const sums = lineResourceSums(line)
            return (
              <TableRow key={line.id} className="h-8 hover:bg-muted/50">
                <TableCell className="min-w-[5rem] w-[5rem] px-2 py-1 text-center text-muted-foreground">—</TableCell>
                <TableCell
                  style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
                  className="px-2 py-1"
                >
                  <span className="text-xs text-muted-foreground">{line.description}</span>
                </TableCell>
                <TableCell className="px-2 py-1">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {line.unit}
                  </span>
                </TableCell>
                <TableCell className="px-2 py-1 text-right">
                  <span className="font-mono text-xs tabular-nums">
                    {formatNumber(Number(line.quantity))}
                  </span>
                </TableCell>
                {showBreakdown && (
                  <>
                    <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                      {formatCurrency(sums.material)}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                      {formatCurrency(sums.labor)}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                      {formatCurrency(sums.equipment)}
                    </TableCell>
                  </>
                )}
                <TableCell className="px-2 py-1 text-right">
                  <span className="font-mono text-xs font-semibold tabular-nums">
                    {formatCurrency(Number(line.directCostTotal))}
                  </span>
                </TableCell>
                <TableCell className="px-2 py-1 text-right text-muted-foreground">
                  <span className="font-mono text-xs tabular-nums">
                    {formatCurrency(Number(line.actualCostTotal ?? 0))}
                  </span>
                </TableCell>
                {!hideActions && (
                  <TableCell className="px-2 py-1 min-w-[160px] shrink-0">
                    {canEdit && (
                      <div className="flex items-center gap-1 flex-nowrap overflow-visible">
                        <Button
                          variant={hasAPU ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEditingAPU(line.id)}
                          className="h-6 shrink-0 text-[10px]"
                          title="APU - Análisis de precios unitarios"
                        >
                          <Calculator className="mr-1 h-3 w-3" />
                          APU
                          {hasAPU && (
                            <span className="ml-1 rounded bg-primary/20 px-1 text-[10px]">
                              {line.resources.length}
                            </span>
                          )}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            )
          }),
        isExpanded && node.children.length > 0 && (
          <SortableContext
            items={node.children.map((c) => c.wbsNode.id)}
            strategy={verticalListSortingStrategy}
          >
            {node.children.map((child) => renderNode(child, level + 1, child.wbsNode.code))}
          </SortableContext>
        )
    )
  }

  const grandTotal = filteredData.reduce((sum, node) => sum + calculateNodeTotal(node), 0)
  const grandActualTotal = filteredData.reduce((sum, node) => sum + calculateNodeActualTotal(node), 0)

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow className="h-8">
              <TableHead className="min-w-[5rem] w-[5rem] px-2 py-1 text-left text-xs text-foreground">
                {t('rowNumber')}
              </TableHead>
              <TableHead className="px-2 py-1 text-xs text-foreground">
                {t('item')}
              </TableHead>
              <TableHead className="w-[60px] px-2 py-1 text-xs text-foreground">
                {t('unit')}
              </TableHead>
              <TableHead className="w-[80px] px-2 py-1 text-right text-xs text-foreground">
                {t('quantity')}
              </TableHead>
              {showBreakdown && (
                <>
                  <TableHead className="w-[100px] px-2 py-1 text-right text-xs text-foreground">
                    Materiales
                  </TableHead>
                  <TableHead className="w-[100px] px-2 py-1 text-right text-xs text-foreground">
                    Mano de obra
                  </TableHead>
                  <TableHead className="w-[100px] px-2 py-1 text-right text-xs text-foreground">
                    Equipos
                  </TableHead>
                </>
              )}
              <TableHead className="w-[120px] px-2 py-1 text-right text-xs text-foreground">
                {t('total')}
              </TableHead>
              <TableHead className="w-[120px] px-2 py-1 text-right text-xs text-foreground text-muted-foreground">
                {t('actualCost')}
              </TableHead>
              {!hideActions && (
                <TableHead className="min-w-[160px] w-[160px] shrink-0 px-2 py-1 text-xs text-foreground">
                  <div className="flex items-center justify-end gap-1 flex-nowrap">
                    <span>{tCommon('actions')}</span>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddClick(null)}
                        className="h-6 w-6 shrink-0 p-0"
                        title={t('addPhase')}
                      >
                        <Plus className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    )}
                  </div>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showBreakdown ? (hideActions ? 9 : 10) : (hideActions ? 6 : 7)} className="py-8 text-center text-muted-foreground">
                  {searchQuery.trim() ? t('noResultsFound') : t('noBudgetLinesYet')}
                </TableCell>
              </TableRow>
            ) : (
              <SortableContext
                items={filteredData.map((n) => n.wbsNode.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredData.map((node, i) => (
                  <Fragment key={node.wbsNode.id}>
                    {renderNode(node, 0, node.wbsNode.code)}
                  </Fragment>
                ))}
                <TableRow className="h-8 border-t-2 border-border bg-muted font-bold">
                  <TableCell colSpan={4} className="px-2 py-1 text-right text-xs">
                    {t('grandTotal')}:
                  </TableCell>
                  {showBreakdown && (
                    <>
                      <TableCell className="px-2 py-1" />
                      <TableCell className="px-2 py-1" />
                      <TableCell className="px-2 py-1" />
                    </>
                  )}
                  <TableCell className="erp-table-cell-currency px-2 py-1 text-sm">
                    {formatCurrencyForDisplay(grandTotal)}
                  </TableCell>
                  <TableCell className="erp-table-cell-currency px-2 py-1 text-sm text-muted-foreground">
                    {formatCurrencyForDisplay(grandActualTotal)}
                  </TableCell>
                  {!hideActions && <TableCell className="px-2 py-1" />}
                </TableRow>
              </SortableContext>
            )}
          </TableBody>
        </Table>
      </div>
      </DndContext>

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

      <AddWbsNodeDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        projectId={projectId}
        parentId={addDialogParent.id}
        parentCode={addDialogParent.code}
        parentName={addDialogParent.name}
        budgetVersionId={versionId}
        wbsTemplates={wbsTemplates}
      />

      {deleteConfirm && (
        <AlertDialog
          open={!!deleteConfirm}
          onOpenChange={(open) => !open && setDeleteConfirm(null)}
        >
          <AlertDialogContent className="max-w-xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteConfirm.hasChildren ? (
                  <div className="space-y-2">
                    <p>
                      {t('confirmDeleteWithChildrenDesc', {
                        code: deleteConfirm.code,
                        name: deleteConfirm.name,
                        count: deleteConfirm.childrenCount ?? 0,
                      })}
                    </p>
                    <p className="font-semibold text-red-600">
                      {t('confirmDeleteCascadeWarning')}
                    </p>
                  </div>
                ) : (
                  <p>
                    {t('confirmDeleteDesc', {
                      code: deleteConfirm.code,
                      name: deleteConfirm.name,
                    })}
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>
                {tCommon('cancel')}
              </AlertDialogCancel>
              {deleteConfirm.hasChildren ? (
                <>
                  <AlertDialogAction
                    onClick={() => confirmDelete(false)}
                    disabled={isPending}
                    className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  >
                    {t('deleteChildrenFirst')}
                  </AlertDialogAction>
                  <AlertDialogAction
                    onClick={() => confirmDelete(true)}
                    disabled={isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {t('deleteAll')}
                  </AlertDialogAction>
                </>
              ) : (
                <AlertDialogAction
                  onClick={() => confirmDelete(false)}
                  disabled={isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {tCommon('delete')}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
