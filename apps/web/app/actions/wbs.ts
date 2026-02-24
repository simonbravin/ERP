"use server";

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { requireRole } from '@/lib/rbac'
import { getAuthContext } from '@/lib/auth-helpers'
import { assertProjectAccess, canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import { publishOutboxEvent, type PrismaTransaction } from '@/lib/events/event-publisher'
import {
  createWBSItemSchema,
  updateWBSItemSchema,
  wbsNodeSchema,
} from '@repo/validators'
import type { CreateWBSItemInput, UpdateWBSItemInput } from '@repo/validators'
import {
  generateWBSCode,
  isAllowedChildType,
  depthOfType,
  MAX_DEPTH,
  type WbsType,
} from '@/lib/wbs-utils'

function ensureProjectInOrg(projectId: string, orgId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true },
  })
}

/** Get next sequence among siblings (same parentId). */
async function getNextSiblingSequence(projectId: string, parentId: string | null): Promise<number> {
  const siblings = await prisma.wbsNode.findMany({
    where: { projectId, parentId, active: true },
    select: { code: true },
    orderBy: { sortOrder: 'asc' },
  })
  if (siblings.length === 0) return 1
  const lastCode = siblings[siblings.length - 1].code
  const parts = lastCode.split('.')
  const lastSegment = parseInt(parts[parts.length - 1], 10)
  return Number.isNaN(lastSegment) ? 1 : lastSegment + 1
}

/** Prevent circular ref: ensure parentId is not self and not a descendant of self. */
async function ensureNoCircular(
  tx: PrismaTransaction,
  nodeId: string,
  newParentId: string | null
): Promise<void> {
  if (!newParentId) return
  if (newParentId === nodeId) throw new Error('Parent cannot be the same node.')
  let currentId: string | null = newParentId
  const seen = new Set<string>([nodeId])
  while (currentId) {
    if (seen.has(currentId)) throw new Error('Circular reference in WBS hierarchy.')
    seen.add(currentId)
    const row: { parentId: string | null } | null = await tx.wbsNode.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    })
    currentId = row?.parentId ?? null
  }
}

/** Recalculate codes for node and all descendants (by sortOrder). */
async function recalculateCodes(
  tx: PrismaTransaction,
  nodeId: string,
  newParentCode: string | null
): Promise<void> {
  const node = await tx.wbsNode.findUnique({
    where: { id: nodeId },
    select: { id: true, code: true, sortOrder: true },
  })
  if (!node) return
  const children = await tx.wbsNode.findMany({
    where: { parentId: nodeId, active: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  })
  let seq = 1
  for (const child of children) {
    const newCode = generateWBSCode(newParentCode, seq)
    await tx.wbsNode.update({
      where: { id: child.id },
      data: { code: newCode },
    })
    await recalculateCodes(tx, child.id, newCode)
    seq++
  }
}

export type WbsNodeWithChildren = {
  id: string
  code: string
  name: string
  category: string
  parentId: string | null
  description: string | null
  unit: string | null
  quantity: Prisma.Decimal | null
  sortOrder: number
  active: boolean
  createdAt: Date
  updatedAt: Date
  children: WbsNodeWithChildren[]
}

export async function listProjectWBS(projectId: string): Promise<WbsNodeWithChildren[] | null> {
  const { org } = await getAuthContext()
  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return null

  const flat = await prisma.wbsNode.findMany({
    where: { projectId, active: true },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      parentId: true,
      description: true,
      unit: true,
      quantity: true,
      sortOrder: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const byParent = new Map<string | null, typeof flat>()
  for (const row of flat) {
    const key = row.parentId ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(row)
  }

  function toTree(parentKey: string | null): WbsNodeWithChildren[] {
    const list = byParent.get(parentKey) ?? []
    return list.map((n) => ({
      ...n,
      quantity: n.quantity,
      children: toTree(n.id),
    }))
  }

  return toTree(null)
}

export type WbsCostResult = {
  estimatedTotal: number
  actualTotal: number
  variance: number
  varianceStatus: 'under' | 'on_track' | 'over'
}

/** Aggregate estimated (BudgetLine.directCostTotal) and actual (FinanceLine.lineTotal) for a WBS node. */
export async function calculateWBSCosts(wbsId: string): Promise<WbsCostResult | null> {
  const { org } = await getAuthContext()
  const node = await prisma.wbsNode.findFirst({
    where: { id: wbsId, orgId: org.orgId },
    select: { id: true, projectId: true },
  })
  if (!node) return null
  try {
    await assertProjectAccess(node.projectId, org)
  } catch {
    return null
  }

  const [budgetAgg, financeAgg] = await Promise.all([
    prisma.budgetLine.aggregate({
      where: { wbsNodeId: wbsId },
      _sum: { directCostTotal: true },
    }),
    prisma.financeLine
      .aggregate({
        where: {
          wbsNodeId: wbsId,
          transaction: { status: { in: ['APPROVED', 'PAID'] }, deleted: false },
        },
        _sum: { lineTotal: true },
      })
      .then((r) => r as { _sum: { lineTotal: unknown } })
      .catch(() => ({ _sum: { lineTotal: null } })),
  ])

  const estimatedTotal = Number(budgetAgg._sum.directCostTotal ?? 0)
  const actualTotal = Number((financeAgg._sum?.lineTotal ?? 0))
  const variance = actualTotal - estimatedTotal
  let varianceStatus: 'under' | 'on_track' | 'over' = 'on_track'
  if (estimatedTotal > 0) {
    if (variance < 0) varianceStatus = 'under'
    else if (variance > 0) varianceStatus = 'over'
  }

  return { estimatedTotal, actualTotal, variance, varianceStatus }
}

/** Costs per WBS node for a project (for list/tree display). */
export async function getProjectWBSCostsMap(
  projectId: string
): Promise<Record<string, WbsCostResult> | null> {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return null
  }
  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return null

  const nodeIds = await prisma.wbsNode.findMany({
    where: { projectId, orgId: org.orgId, active: true },
    select: { id: true },
  })
  const ids = nodeIds.map((n) => n.id)
  if (ids.length === 0) return {}

  const [budgetSums, financeSums] = await Promise.all([
    prisma.budgetLine.groupBy({
      by: ['wbsNodeId'],
      where: { wbsNodeId: { in: ids } },
      _sum: { directCostTotal: true },
    }),
    prisma.financeLine
      .groupBy({
        by: ['wbsNodeId'],
        where: {
          wbsNodeId: { in: ids },
          transaction: { status: { in: ['APPROVED', 'PAID'] }, deleted: false },
        },
        _sum: { lineTotal: true },
      })
      .then((r) => r as { wbsNodeId: string; _sum: { lineTotal: unknown } }[])
      .catch(() => []),
  ])

  const estimatedByNode = new Map<string, number>()
  for (const row of budgetSums) {
    estimatedByNode.set(row.wbsNodeId, Number(row._sum.directCostTotal ?? 0))
  }
  const actualByNode = new Map<string, number>()
  for (const row of financeSums as { wbsNodeId: string; _sum: { lineTotal: unknown } }[]) {
    actualByNode.set(row.wbsNodeId, Number(row._sum?.lineTotal ?? 0))
  }

  const result: Record<string, WbsCostResult> = {}
  for (const id of ids) {
    const estimatedTotal = estimatedByNode.get(id) ?? 0
    const actualTotal = actualByNode.get(id) ?? 0
    const variance = actualTotal - estimatedTotal
    let varianceStatus: 'under' | 'on_track' | 'over' = 'on_track'
    if (estimatedTotal > 0) {
      if (variance < 0) varianceStatus = 'under'
      else if (variance > 0) varianceStatus = 'over'
    }
    result[id] = { estimatedTotal, actualTotal, variance, varianceStatus }
  }

  return result
}

export async function createWBSItem(projectId: string, data: CreateWBSItemInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return { error: { _form: ['Project not found'] } }
  try {
    const access = await assertProjectAccess(projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { error: { _form: ['No tenés permiso para editar el WBS de este proyecto'] } }
    }
  } catch (e) {
    return { error: { _form: [e instanceof Error ? e.message : 'Acceso denegado'] } }
  }

  const parsed = createWBSItemSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const { parentId, type, name, description, estimatedDuration, unit } = parsed.data

  let parentCode: string | null = null
  let parentType: WbsType | null = null
  if (parentId) {
    const parent = await prisma.wbsNode.findFirst({
      where: { id: parentId, projectId, orgId: org.orgId, active: true },
      select: { code: true, category: true },
    })
    if (!parent) return { error: { parentId: ['Parent must be in the same project.'] } }
    parentCode = parent.code
    parentType = parent.category as WbsType
    if (!isAllowedChildType(parentType, type as WbsType)) {
      return {
        error: {
          type: [
            `Invalid type under ${parentType}: only ${parentType === 'PHASE' ? 'ACTIVITY' : 'TASK'} allowed.`,
          ],
        },
      }
    } // ✅ AGREGADO: Cierre del if
    const parentDepth = depthOfType(parentType)
    if (parentDepth + 1 > MAX_DEPTH) {
      return { error: { type: ['Maximum WBS depth exceeded.'] } }
    }
  } else {
    if (type !== 'PHASE') {
      return { error: { type: ['Root WBS items must be type PHASE.'] } }
    }
  }

  const sequence = await getNextSiblingSequence(projectId, parentId ?? null)
  const code = generateWBSCode(parentCode, sequence)

  await prisma.$transaction(async (tx) => {
    const maxSort = await tx.wbsNode.aggregate({
      where: { projectId, parentId: parentId ?? null, active: true },
      _max: { sortOrder: true },
    })
    const node = await tx.wbsNode.create({
      data: {
        orgId: org.orgId,
        projectId,
        parentId: parentId ?? undefined,
        code,
        name,
        category: type,
        description: description ?? undefined,
        unit: unit ?? undefined,
        quantity: estimatedDuration != null ? new Prisma.Decimal(estimatedDuration) : undefined,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        active: true,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'WBS_NODE.CREATED',
      entityType: 'WbsNode',
      entityId: node.id,
      payload: { projectId, code: node.code, name: node.name, category: node.category },
    })
  })

  revalidatePath(`/projects/${projectId}/wbs`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function updateWBSItem(
  id: string,
  projectId: string,
  data: UpdateWBSItemInput
) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return { error: { _form: ['Project not found'] } }
  try {
    const access = await assertProjectAccess(projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { error: { _form: ['No tenés permiso para editar el WBS de este proyecto'] } }
    }
  } catch (e) {
    return { error: { _form: [e instanceof Error ? e.message : 'Acceso denegado'] } }
  }

  const existing = await prisma.wbsNode.findFirst({
    where: { id, projectId, orgId: org.orgId, active: true },
    include: { parent: true },
  })
  if (!existing) return { error: { _form: ['WBS item not found'] } }

  const parsed = updateWBSItemSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const payload = parsed.data
  const newParentId = payload.parentId !== undefined ? payload.parentId : existing.parentId
  const newType = (payload.type ?? existing.category) as WbsType

  if (newParentId) {
    const parent = await prisma.wbsNode.findFirst({
      where: { id: newParentId, projectId, orgId: org.orgId, active: true },
      select: { code: true, category: true },
    })
    if (!parent) return { error: { parentId: ['Parent must be in the same project.'] } }
    if (!isAllowedChildType(parent.category as WbsType, newType)) {
      return { error: { type: ['Invalid type for this parent.'] } }
    }
  } else if (newType !== 'PHASE') {
    return { error: { type: ['Root items must be PHASE.'] } }
  }

  await prisma.$transaction(async (tx: PrismaTransaction) => {
    if (newParentId !== existing.parentId) {
      await ensureNoCircular(tx, id, newParentId)
      const newParentCode = newParentId
        ? (await tx.wbsNode.findUnique({ where: { id: newParentId }, select: { code: true } }))?.code ?? null
        : null
      const newSequence = await getNextSiblingSequence(projectId, newParentId)
      const newCode = generateWBSCode(newParentCode, newSequence)
      await tx.wbsNode.update({
        where: { id },
        data: {
          ...buildUpdateData(payload, existing),
          parentId: newParentId ?? undefined,
          code: newCode,
        },
      })
      await recalculateCodes(tx, id, newCode)
    } else {
      await tx.wbsNode.update({
        where: { id },
        data: buildUpdateData(payload, existing),
      })
    }
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'WBS_NODE.UPDATED',
      entityType: 'WbsNode',
      entityId: id,
      payload: { projectId },
    })
  })

  revalidatePath(`/projects/${projectId}/wbs`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

/** Reorder siblings: set sortOrder by index for each node id (same parent). */
export async function reorderWBSItems(
  projectId: string,
  parentId: string | null,
  orderedNodeIds: string[]
): Promise<{ error?: string } | { success: true }> {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return { error: 'Project not found' }
  try {
    const access = await assertProjectAccess(projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { error: 'No tenés permiso para editar el WBS de este proyecto' }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  const nodes = await prisma.wbsNode.findMany({
    where: {
      id: { in: orderedNodeIds },
      projectId,
      parentId: parentId ?? null,
      orgId: org.orgId,
      active: true,
    },
    select: { id: true },
  })
  if (nodes.length !== orderedNodeIds.length) return { error: 'Invalid nodes or parent' }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedNodeIds.length; i++) {
      await tx.wbsNode.update({
        where: { id: orderedNodeIds[i] },
        data: { sortOrder: i },
      })
    }
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'WBS_NODE.REORDERED',
      entityType: 'WbsNode',
      entityId: projectId,
      payload: { projectId, nodeIds: orderedNodeIds },
    })
  })

  revalidatePath(`/projects/${projectId}/wbs`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

function buildUpdateData(
  payload: UpdateWBSItemInput,
  existing: { category: string; quantity: Prisma.Decimal | null }
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (payload.name !== undefined) data.name = payload.name
  if (payload.description !== undefined) data.description = payload.description
  if (payload.type !== undefined) data.category = payload.type
  if (payload.unit !== undefined) data.unit = payload.unit
  if (payload.estimatedDuration !== undefined) {
    data.quantity = payload.estimatedDuration != null ? new Prisma.Decimal(payload.estimatedDuration) : null
  }
  return data
}

/** Soft delete node and all descendants. */
export async function deleteWBSItem(id: string, projectId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) throw new Error('Project not found')
  try {
    const access = await assertProjectAccess(projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      throw new Error('No tenés permiso para editar el WBS de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const node = await prisma.wbsNode.findFirst({
    where: { id, projectId, orgId: org.orgId, active: true },
    select: { id: true },
  })
  if (!node) throw new Error('WBS item not found')

  async function softDeleteRecursive(tx: any, nodeId: string) {
    const children = await tx.wbsNode.findMany({
      where: { parentId: nodeId, active: true },
      select: { id: true },
    })
    for (const c of children) await softDeleteRecursive(tx, c.id)
    await tx.wbsNode.update({
      where: { id: nodeId },
      data: { active: false },
    })
  }

  await prisma.$transaction(async (tx) => {
    await softDeleteRecursive(tx, id)
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'WBS_NODE.DELETED',
      entityType: 'WbsNode',
      entityId: id,
      payload: { projectId },
    })
  })

  revalidatePath(`/projects/${projectId}/wbs`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

/** Create WBS node (prompt 24 - accepts code from user) */
export async function createWbsNode(data: {
  projectId: string
  parentId: string | null
  code: string
  name: string
  category: string
  unit: string
  quantity: number
  description?: string
}) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')

  try {
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, orgId: org.orgId },
    })
    if (!project) return { success: false, error: 'Proyecto no encontrado' }
    const access = await assertProjectAccess(data.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { success: false, error: 'No tenés permiso para editar el WBS de este proyecto' }
    }

    const existing = await prisma.wbsNode.findFirst({
      where: {
        projectId: data.projectId,
        code: data.code,
        active: true,
      },
    })
    if (existing) return { success: false, error: 'Ya existe un nodo con ese código' }

    await prisma.$transaction(async (tx) => {
      const node = await tx.wbsNode.create({
        data: {
          orgId: org.orgId,
          projectId: data.projectId,
          parentId: data.parentId,
          code: data.code,
          name: data.name,
          category: data.category,
          unit: data.unit,
          quantity: new Prisma.Decimal(data.quantity),
          description: data.description || null,
          active: true,
        },
      })
      await publishOutboxEvent(tx, {
        orgId: org.orgId,
        eventType: 'WBS_NODE.CREATED',
        entityType: 'WbsNode',
        entityId: node.id,
        payload: { projectId: data.projectId, code: node.code, name: node.name },
      })
    })
    revalidatePath(`/projects/${data.projectId}/wbs`)
    return { success: true }
  } catch (error) {
    console.error('Error creating WBS node:', error)
    return { success: false, error: 'Error al crear el nodo' }
  }
}

/** Update WBS node */
export async function updateWbsNode(
  nodeId: string,
  data: {
    code: string
    name: string
    category: string
    unit: string
    quantity: number
    description?: string
  }
) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')

  try {
    const node = await prisma.wbsNode.findFirst({
      where: { id: nodeId, orgId: org.orgId },
    })
    if (!node) return { success: false, error: 'Nodo no encontrado' }
    const access = await assertProjectAccess(node.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { success: false, error: 'No tenés permiso para editar el WBS de este proyecto' }
    }

    const existing = await prisma.wbsNode.findFirst({
      where: {
        projectId: node.projectId,
        code: data.code,
        active: true,
        NOT: { id: nodeId },
      },
    })
    if (existing) return { success: false, error: 'Ya existe un nodo con ese código' }

    await prisma.$transaction(async (tx) => {
      await tx.wbsNode.update({
        where: { id: nodeId },
        data: {
          code: data.code,
          name: data.name,
          category: data.category,
          unit: data.unit,
          quantity: new Prisma.Decimal(data.quantity),
          description: data.description || null,
        },
      })
      await publishOutboxEvent(tx, {
        orgId: org.orgId,
        eventType: 'WBS_NODE.UPDATED',
        entityType: 'WbsNode',
        entityId: nodeId,
        payload: { projectId: node.projectId },
      })
    })
    revalidatePath(`/projects/${node.projectId}/wbs`)
    return { success: true }
  } catch (error) {
    console.error('Error updating WBS node:', error)
    return { success: false, error: 'Error al actualizar el nodo' }
  }
}

/** Delete WBS node (no children allowed) */
export async function deleteWbsNode(nodeId: string) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')

  try {
    const node = await prisma.wbsNode.findFirst({
      where: { id: nodeId, orgId: org.orgId },
      include: { children: { where: { active: true } } },
    })
    if (!node) return { success: false, error: 'Nodo no encontrado' }
    const access = await assertProjectAccess(node.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { success: false, error: 'No tenés permiso para editar el WBS de este proyecto' }
    }
    if (node.children.length > 0) {
      return {
        success: false,
        error:
          'No se puede eliminar un nodo que tiene elementos hijos. Elimina primero los hijos.',
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.wbsNode.update({
        where: { id: nodeId },
        data: { active: false },
      })
      await publishOutboxEvent(tx, {
        orgId: org.orgId,
        eventType: 'WBS_NODE.DELETED',
        entityType: 'WbsNode',
        entityId: nodeId,
        payload: { projectId: node.projectId },
      })
    })
    revalidatePath(`/projects/${node.projectId}/wbs`)
    return { success: true }
  } catch (error) {
    console.error('Error deleting WBS node:', error)
    return { success: false, error: 'Error al eliminar el nodo' }
  }
}

/** Reorder WBS node by sortOrder */
export async function reorderWbsNode(nodeId: string, newSortOrder: number) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')

  try {
    const node = await prisma.wbsNode.findFirst({
      where: { id: nodeId, orgId: org.orgId },
    })
    if (!node) return { success: false, error: 'Nodo no encontrado' }
    const access = await assertProjectAccess(node.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { success: false, error: 'No tenés permiso para editar el WBS de este proyecto' }
    }
    await prisma.$transaction(async (tx) => {
      await tx.wbsNode.update({
        where: { id: nodeId },
        data: { sortOrder: newSortOrder },
      })
      await publishOutboxEvent(tx, {
        orgId: org.orgId,
        eventType: 'WBS_NODE.REORDERED',
        entityType: 'WbsNode',
        entityId: nodeId,
        payload: { projectId: node.projectId, sortOrder: newSortOrder },
      })
    })
    revalidatePath(`/projects/${node.projectId}/wbs`)
    return { success: true }
  } catch (error) {
    console.error('Error reordering WBS node:', error)
    return { success: false, error: 'Error al reordenar el nodo' }
  }
}

// --- PROMPT 24.7: Add/delete WBS with auto code and renumbering ---

/** Infer WBS category from code depth. */
function inferCategoryFromCode(code: string): string {
  const level = code.split('.').length - 1
  if (level === 0) return 'PHASE'
  if (level === 1) return 'TASK'
  return 'BUDGET_ITEM'
}

/** Map template category to WbsNode category. */
function mapTemplateCategory(cat: string): string {
  if (['PHASE', 'TASK', 'ZONE', 'MILESTONE'].includes(cat)) return cat
  if (cat === 'SUBTASK' || cat === 'ITEM') return 'BUDGET_ITEM'
  return 'BUDGET_ITEM'
}

/** Calculate next WBS code for a new node under parentId (null = root). */
async function calculateNextCode(
  projectId: string,
  parentId: string | null
): Promise<string> {
  if (!parentId) {
    const lastRoot = await prisma.wbsNode.findFirst({
      where: { projectId, parentId: null, active: true },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    if (!lastRoot) return '1'
    const lastNum = parseInt(lastRoot.code, 10)
    return String(Number.isNaN(lastNum) ? 1 : lastNum + 1)
  }

  const parent = await prisma.wbsNode.findUnique({
    where: { id: parentId },
    select: { code: true },
  })
  if (!parent) throw new Error('Parent not found')

  const siblings = await prisma.wbsNode.findMany({
    where: { projectId, parentId, active: true },
    orderBy: { code: 'asc' },
    select: { code: true },
  })
  if (siblings.length === 0) return `${parent.code}.1`
  const lastCode = siblings[siblings.length - 1].code
  const parts = lastCode.split('.')
  const lastNum = parseInt(parts[parts.length - 1], 10)
  const nextNum = Number.isNaN(lastNum) ? 1 : lastNum + 1
  parts[parts.length - 1] = String(nextNum)
  return parts.join('.')
}

/** Root WBS templates for the "library" in Add phase dialog (from all project templates). */
export async function listWbsTemplatesForLibrary(): Promise<
  Array<{ id: string; name: string; code: string; unit: string; hasResources: boolean }>
> {
  await getAuthContext()
  const rows = await prisma.wbsTemplate.findMany({
    where: { parentId: null },
    select: {
      id: true,
      name: true,
      code: true,
      unit: true,
      _count: { select: { resourceTemplates: true } },
    },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    unit: r.unit ?? 'un',
    hasResources: (r._count?.resourceTemplates ?? 0) > 0,
  }))
}

async function ensureBudgetLineForVersion(
  projectId: string,
  budgetVersionId: string,
  wbsNodeId: string,
  description: string,
  unit: string,
  orgId: string
): Promise<{ error?: string }> {
  const version = await prisma.budgetVersion.findFirst({
    where: { id: budgetVersionId, orgId, projectId },
    select: {
      id: true,
      projectId: true,
      status: true,
      globalOverheadPct: true,
      globalFinancialPct: true,
      globalProfitPct: true,
      globalTaxPct: true,
    },
  })
  if (!version) return { error: 'Budget version not found' }
  if (version.status !== 'DRAFT') return { error: 'Cannot add line to locked or approved version' }
  const maxSort = await prisma.budgetLine.aggregate({
    where: { budgetVersionId },
    _max: { sortOrder: true },
  })
  await prisma.$transaction(async (tx) => {
    const line = await tx.budgetLine.create({
      data: {
        orgId,
        budgetVersionId,
        wbsNodeId,
        description,
        unit,
        quantity: new Prisma.Decimal(1),
        directCostTotal: new Prisma.Decimal(0),
        salePriceTotal: new Prisma.Decimal(0),
        overheadPct: version.globalOverheadPct,
        indirectCostPct: new Prisma.Decimal(0),
        financialPct: version.globalFinancialPct,
        profitPct: version.globalProfitPct,
        taxPct: version.globalTaxPct,
        retentionPct: new Prisma.Decimal(0),
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    })
    await publishOutboxEvent(tx, {
      orgId,
      eventType: 'BUDGET_LINE.CREATED',
      entityType: 'BudgetLine',
      entityId: line.id,
      payload: { budgetVersionId, projectId },
    })
  })
  return {}
}

/**
 * Add WBS node from template or custom data with auto code.
 * When budgetVersionId is provided (e.g. from budget page), also creates a BudgetLine for that version.
 */
export async function addWbsNode(data: {
  projectId: string
  parentId: string | null
  templateId?: string
  budgetVersionId?: string
  customData?: {
    name: string
    unit: string
    description?: string
  }
}) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const project = await ensureProjectInOrg(data.projectId, org.orgId)
  if (!project) return { success: false, error: 'Project not found' }
  try {
    const access = await assertProjectAccess(data.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { success: false, error: 'No tenés permiso para editar el WBS de este proyecto' }
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  try {
    const newCode = await calculateNextCode(data.projectId, data.parentId)
    const category = inferCategoryFromCode(newCode)

    if (data.templateId) {
      const template = await prisma.wbsTemplate.findUnique({
        where: { id: data.templateId },
        include: { resourceTemplates: true },
      })
      if (!template) return { success: false, error: 'Template not found' }

      const node = await prisma.$transaction(async (tx) => {
        const created = await tx.wbsNode.create({
          data: {
            orgId: org.orgId,
            projectId: data.projectId,
            parentId: data.parentId,
            code: newCode,
            name: template.name,
            category: mapTemplateCategory(template.category),
            unit: template.unit ?? 'un',
            quantity: template.defaultQuantity ?? new Prisma.Decimal(1),
            description: template.description ?? null,
            active: true,
          },
        })
        await publishOutboxEvent(tx, {
          orgId: org.orgId,
          eventType: 'WBS_NODE.CREATED',
          entityType: 'WbsNode',
          entityId: created.id,
          payload: { projectId: data.projectId, code: created.code, name: created.name },
        })
        return created
      })
      if (data.budgetVersionId) {
        const created = await ensureBudgetLineForVersion(
          data.projectId,
          data.budgetVersionId,
          node.id,
          node.name,
          node.unit,
          org.orgId
        )
        if (created?.error) return { success: false, error: created.error }
      }
      revalidatePath(`/projects/${data.projectId}/wbs`)
      revalidatePath(`/projects/${data.projectId}`)
      if (data.budgetVersionId) {
        revalidatePath(`/projects/${data.projectId}/budget/${data.budgetVersionId}`)
      }
      return { success: true, nodeId: node.id }
    }

    if (data.customData) {
      const node = await prisma.$transaction(async (tx) => {
        const created = await tx.wbsNode.create({
          data: {
            orgId: org.orgId,
            projectId: data.projectId,
            parentId: data.parentId,
            code: newCode,
            name: data.customData!.name,
            category,
            unit: data.customData!.unit,
            quantity: new Prisma.Decimal(1),
            description: data.customData!.description ?? null,
            active: true,
          },
        })
        await publishOutboxEvent(tx, {
          orgId: org.orgId,
          eventType: 'WBS_NODE.CREATED',
          entityType: 'WbsNode',
          entityId: created.id,
          payload: { projectId: data.projectId, code: created.code, name: created.name },
        })
        return created
      })
      if (data.budgetVersionId) {
        const created = await ensureBudgetLineForVersion(
          data.projectId,
          data.budgetVersionId,
          node.id,
          node.name,
          node.unit,
          org.orgId
        )
        if (created?.error) return { success: false, error: created.error }
      }
      revalidatePath(`/projects/${data.projectId}/wbs`)
      revalidatePath(`/projects/${data.projectId}`)
      if (data.budgetVersionId) {
        revalidatePath(`/projects/${data.projectId}/budget/${data.budgetVersionId}`)
      }
      return { success: true, nodeId: node.id }
    }

    return { success: false, error: 'Debe proporcionar templateId o customData' }
  } catch (error) {
    console.error('Error adding WBS node:', error)
    return { success: false, error: 'Error al agregar tarea' }
  }
}

/** Decrement last segment of a code (e.g. 01.02.03 -> 01.02.02). */
function decrementCode(code: string): string {
  const parts = code.split('.')
  const lastPart = parseInt(parts[parts.length - 1], 10)
  parts[parts.length - 1] = String(Math.max(1, lastPart - 1)).padStart(2, '0')
  return parts.join('.')
}

/** Renumber all children of a node under new parent code. */
async function renumberChildren(
  txOrPrisma: PrismaTransaction | typeof prisma,
  nodeId: string,
  newParentCode: string
): Promise<void> {
  const children = await txOrPrisma.wbsNode.findMany({
    where: { parentId: nodeId, active: true },
    orderBy: { code: 'asc' },
  })
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const childNum = String(i + 1).padStart(2, '0')
    const newCode = `${newParentCode}.${childNum}`
    await txOrPrisma.wbsNode.update({
      where: { id: child.id },
      data: { code: newCode },
    })
    await renumberChildren(txOrPrisma, child.id, newCode)
  }
}

/** Get all descendant node ids. */
async function getAllDescendants(nodeId: string): Promise<{ id: string }[]> {
  const children = await prisma.wbsNode.findMany({
    where: { parentId: nodeId, active: true },
    select: { id: true },
  })
  let descendants = [...children]
  for (const child of children) {
    const childDescendants = await getAllDescendants(child.id)
    descendants = [...descendants, ...childDescendants]
  }
  return descendants
}

/**
 * Delete WBS node (no children) and renumber following siblings.
 */
export async function deleteWbsNodeWithRenumber(nodeId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  try {
    const node = await prisma.wbsNode.findFirst({
      where: { id: nodeId, orgId: org.orgId },
      select: {
        id: true,
        code: true,
        parentId: true,
        projectId: true,
        _count: { select: { children: true } },
      },
    })
    if (!node) return { success: false, error: 'Node not found' }
    const access = await assertProjectAccess(node.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { success: false, error: 'No tenés permiso para editar el WBS de este proyecto' }
    }

    const childrenCount = node._count.children ?? 0
    if (childrenCount > 0) {
      return {
        success: false,
        error: `Esta tarea tiene ${childrenCount} subtareas. Elimínalas primero o confirma eliminación en cascada.`,
        hasChildren: true,
        childrenCount,
      }
    }

    const siblings = await prisma.wbsNode.findMany({
      where: {
        projectId: node.projectId,
        parentId: node.parentId,
        active: true,
        code: { gt: node.code },
      },
      orderBy: { code: 'asc' },
    })

    await prisma.$transaction(async (tx) => {
      await tx.budgetLine.deleteMany({ where: { wbsNodeId: nodeId } })
      await tx.wbsNode.delete({ where: { id: nodeId } })
      for (const sibling of siblings) {
        const newCode = decrementCode(sibling.code)
        await tx.wbsNode.update({
          where: { id: sibling.id },
          data: { code: newCode },
        })
        await renumberChildren(tx, sibling.id, newCode)
      }
      await publishOutboxEvent(tx, {
        orgId: org.orgId,
        eventType: 'WBS_NODE.DELETED',
        entityType: 'WbsNode',
        entityId: nodeId,
        payload: { projectId: node.projectId },
      })
    })

    revalidatePath(`/projects/${node.projectId}/wbs`)
    revalidatePath(`/projects/${node.projectId}`)
    return { success: true }
  } catch (error) {
    console.error('Error deleting WBS node:', error)
    return { success: false, error: 'Error al eliminar tarea' }
  }
}

/**
 * Delete WBS node and all descendants (cascade).
 */
export async function deleteWbsNodeCascade(nodeId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  try {
    const node = await prisma.wbsNode.findFirst({
      where: { id: nodeId, orgId: org.orgId },
      select: { id: true, code: true, parentId: true, projectId: true },
    })
    if (!node) return { success: false, error: 'Node not found' }
    const access = await assertProjectAccess(node.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { success: false, error: 'No tenés permiso para editar el WBS de este proyecto' }
    }

    const descendants = await getAllDescendants(nodeId)
    const idsToDelete = [...descendants.map((d) => d.id), nodeId]

    await prisma.$transaction(async (tx) => {
      await tx.budgetLine.deleteMany({
        where: { wbsNodeId: { in: idsToDelete } },
      })
      await tx.wbsNode.deleteMany({
        where: { id: { in: idsToDelete } },
      })
      await publishOutboxEvent(tx, {
        orgId: org.orgId,
        eventType: 'WBS_NODE.DELETED',
        entityType: 'WbsNode',
        entityId: nodeId,
        payload: { projectId: node.projectId, cascadeIds: idsToDelete },
      })
    })

    const siblings = await prisma.wbsNode.findMany({
      where: {
        projectId: node.projectId,
        parentId: node.parentId,
        active: true,
        code: { gt: node.code },
      },
      orderBy: { code: 'asc' },
    })

    for (const sibling of siblings) {
      const newCode = decrementCode(sibling.code)
      await prisma.wbsNode.update({
        where: { id: sibling.id },
        data: { code: newCode },
      })
      await renumberChildren(prisma, sibling.id, newCode)
    }

    revalidatePath(`/projects/${node.projectId}/wbs`)
    revalidatePath(`/projects/${node.projectId}`)
    return { success: true, deletedCount: idsToDelete.length }
  } catch (error) {
    console.error('Error deleting WBS cascade:', error)
    return { success: false, error: 'Error al eliminar' }
  }
}