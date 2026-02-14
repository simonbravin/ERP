'use client'

import React, { useState, useTransition } from 'react'
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
import { ChevronDown, ChevronRight, Plus, Trash2, Calculator } from 'lucide-react'
import { AddWbsNodeDialog, type WbsTemplateForLibrary } from './add-wbs-node-dialog'
import { APUEditorDialog } from './apu-editor-dialog'
import { deleteWbsNodeWithRenumber, deleteWbsNodeCascade } from '@/app/actions/wbs'
import type { BudgetTreeNode } from './budget-tree-table-admin'

interface BudgetLinesCompactTableProps {
  data: BudgetTreeNode[]
  versionId: string
  projectId: string
  canEdit: boolean
  markupMode: string
  wbsTemplates?: WbsTemplateForLibrary[]
  /** Filtra por código WBS o descripción (partida). Vacío = sin filtrar */
  searchQuery?: string
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

export function BudgetLinesCompactTable({
  data,
  versionId,
  projectId,
  canEdit,
  markupMode,
  wbsTemplates = [],
  searchQuery = '',
}: BudgetLinesCompactTableProps) {
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

  function calculateNodeTotal(node: BudgetTreeNode): number {
    const linesTotal = node.lines.reduce(
      (sum, line) => sum + Number(line.directCostTotal),
      0
    )
    const childrenTotal = node.children.reduce(
      (sum, child) => sum + calculateNodeTotal(child),
      0
    )
    return linesTotal + childrenTotal
  }

  function renderNode(node: BudgetTreeNode, level: number = 0): React.ReactNode {
    const isExpanded = expandedNodes.has(node.wbsNode.id)
    const hasChildren = node.children.length > 0 || node.lines.length > 0
    const nodeTotal = calculateNodeTotal(node)

    const bgColors = ['bg-muted/30', 'bg-muted/50', 'bg-muted/70', 'bg-muted/80']
    const bgColor = bgColors[Math.min(level, bgColors.length - 1)] ?? 'bg-muted/30'

    return (
      <React.Fragment key={node.wbsNode.id}>
        <TableRow className={`${bgColor} h-8 hover:bg-muted/50`}>
          <TableCell
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            className="px-2 py-1"
          >
            <div className="flex items-center gap-1">
              {hasChildren && (
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
              <span className="font-mono text-[10px] text-muted-foreground">
                {node.wbsNode.code}
              </span>
              <span className="text-xs font-medium text-foreground">
                {node.wbsNode.name}
              </span>
            </div>
          </TableCell>
          <TableCell className="px-2 py-1" />
          <TableCell className="px-2 py-1" />
          <TableCell className="px-2 py-1 text-right">
            <span className="font-mono text-xs font-semibold tabular-nums">
              {formatCurrency(nodeTotal)}
            </span>
          </TableCell>
          <TableCell className="px-2 py-1">
            {canEdit && (
              <div className="flex items-center gap-1">
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
                  className="h-6 w-6 p-0"
                >
                  <Plus className="h-3 w-3 text-primary" />
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
        </TableRow>

        {isExpanded &&
          node.lines.map((line) => {
            const hasAPU = line.resources.length > 0
            return (
              <TableRow key={line.id} className="h-8 hover:bg-muted/50">
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
                <TableCell className="px-2 py-1 text-right">
                  <span className="font-mono text-xs font-semibold tabular-nums">
                    {formatCurrency(Number(line.directCostTotal))}
                  </span>
                </TableCell>
                <TableCell className="px-2 py-1">
                  {canEdit && (
                    <Button
                      variant={hasAPU ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditingAPU(line.id)}
                      className="h-6 text-[10px]"
                    >
                      <Calculator className="mr-1 h-3 w-3" />
                      APU
                      {hasAPU && (
                        <span className="ml-1 rounded bg-primary/20 px-1 text-[10px]">
                          {line.resources.length}
                        </span>
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}

        {isExpanded && node.children.map((child) => renderNode(child, level + 1))}
      </React.Fragment>
    )
  }

  const grandTotal = filteredData.reduce((sum, node) => sum + calculateNodeTotal(node), 0)

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        {canEdit && (
          <Button onClick={() => handleAddClick(null)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            {t('addPhase')}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow className="h-8">
              <TableHead className="px-2 py-1 text-xs text-foreground">
                {t('item')}
              </TableHead>
              <TableHead className="w-[60px] px-2 py-1 text-xs text-foreground">
                {t('unit')}
              </TableHead>
              <TableHead className="w-[80px] px-2 py-1 text-right text-xs text-foreground">
                {t('quantity')}
              </TableHead>
              <TableHead className="w-[120px] px-2 py-1 text-right text-xs text-foreground">
                {t('total')}
              </TableHead>
              <TableHead className="w-[100px] px-2 py-1 text-xs text-foreground">
                {tCommon('actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {searchQuery.trim() ? t('noResultsFound') : t('noBudgetLinesYet')}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filteredData.map((node) => (
                  <React.Fragment key={node.wbsNode.id}>
                    {renderNode(node)}
                  </React.Fragment>
                ))}
                <TableRow className="h-8 border-t-2 border-border bg-muted font-bold">
                  <TableCell colSpan={3} className="px-2 py-1 text-right text-xs">
                    {t('grandTotal')}:
                  </TableCell>
                  <TableCell className="px-2 py-1 text-right text-sm">
                    {formatCurrency(grandTotal)}
                  </TableCell>
                  <TableCell className="px-2 py-1" />
                </TableRow>
              </>
            )}
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
