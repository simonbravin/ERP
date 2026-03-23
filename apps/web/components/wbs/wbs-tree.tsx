'use client'

import { useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { WbsSortableRow } from './wbs-sortable-row'
import { WbsItem, type WbsItemRow } from './wbs-item'
import type { WbsCostResult } from '@/app/actions/wbs'

function getParentId(roots: WbsItemRow[], nodeId: string): string | null {
  for (const r of roots) {
    if (r.id === nodeId) return null
    const found = findParentIn(r, nodeId)
    if (found !== undefined) return found
  }
  return null
}

function findParentIn(node: WbsItemRow, id: string): string | undefined {
  if (node.children.some((c) => c.id === id)) return node.id
  for (const c of node.children) {
    const x = findParentIn(c, id)
    if (x !== undefined) return x
  }
  return undefined
}

function getSiblingIds(roots: WbsItemRow[], parentId: string | null): string[] {
  if (parentId === null) return roots.map((r) => r.id)
  const node = findNode(roots, parentId)
  return node ? node.children.map((c) => c.id) : []
}

function findNode(nodes: WbsItemRow[], id: string): WbsItemRow | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

type WbsTreeProps = {
  roots: WbsItemRow[]
  costMap: Record<string, WbsCostResult>
  canEdit: boolean
  onEdit: (node: WbsItemRow) => void
  onDelete: (node: WbsItemRow) => void
  onAddChild: (parent: WbsItemRow) => void
  onReorder: (parentId: string | null, orderedIds: string[]) => Promise<void>
  onInlineUpdate?: (nodeId: string, data: { name?: string; estimatedDuration?: number | null }) => void
  isPending?: boolean
}

export function WbsTree({
  roots,
  costMap,
  canEdit,
  onEdit,
  onDelete,
  onAddChild,
  onReorder,
  onInlineUpdate,
  isPending: _isPending,
}: WbsTreeProps) {
  const draggingParentIdRef = useRef<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  function handleDragStart(event: { active: { id: unknown } }) {
    draggingParentIdRef.current = getParentId(roots, String(event.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    draggingParentIdRef.current = null
    if (!over || active.id === over.id) return
    const parentId = getParentId(roots, String(active.id))
    const siblingIds = getSiblingIds(roots, parentId)
    const oldIndex = siblingIds.indexOf(String(active.id))
    const newIndex = siblingIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(siblingIds, oldIndex, newIndex)
    await onReorder(parentId, newOrder)
  }

  function renderSortableChildren(children: WbsItemRow[], depth: number, parentCode: string) {
    return (
      <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {children.map((node) => (
          <WbsSortableRow
            key={node.id}
            node={node}
            depth={depth}
            costMap={costMap}
            parentCode={parentCode}
            canEdit={canEdit}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            onInlineUpdate={onInlineUpdate}
            renderChildren={(grandchildren) =>
              renderSortableChildren(grandchildren, depth + 1, node.code)
            }
          />
        ))}
      </SortableContext>
    )
  }

  return (
    <div className="erp-card relative overflow-hidden">
      <div className="grid grid-cols-12 gap-2 border-b border-border bg-muted px-2 py-2 text-xs font-medium text-muted-foreground">
        <span className="col-span-2">Code</span>
        <span className="col-span-3">Name</span>
        <span className="col-span-2">Type</span>
        <span className="col-span-1">Parent</span>
        <span className="col-span-2 text-right">Actual cost</span>
        <span className="col-span-1">Variance</span>
        {canEdit && <span className="col-span-1" />}
      </div>
      {roots.length === 0 ? (
        <div className="px-4 py-8 text-center text-muted-foreground">
          No WBS items yet. Add a root item to get started.
        </div>
      ) : canEdit ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={roots.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            {roots.map((node) => (
              <WbsSortableRow
                key={node.id}
                node={node}
                depth={0}
                costMap={costMap}
                parentCode={null}
                canEdit={canEdit}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onInlineUpdate={onInlineUpdate}
                renderChildren={(children) =>
                  renderSortableChildren(children, 1, node.code)
                }
              />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        roots.map((node) => (
          <WbsItem
            key={node.id}
            node={node}
            depth={0}
            costMap={costMap}
            parentCode={null}
            canEdit={false}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            onInlineUpdate={onInlineUpdate}
          />
        ))
      )}
    </div>
  )
}
