'use server'

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { requireRole, hasMinimumRole } from '@/lib/rbac'
import { getAuthContext } from '@/lib/auth-helpers'
import { assertProjectAccess, canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import { type PrismaTransaction } from '@/lib/events/event-publisher'
import { publishOutboxEvent } from '@/lib/events/event-publisher'
import {
  createChangeOrderSchema,
  updateChangeOrderSchema,
  createChangeOrderLineSchema,
  updateChangeOrderLineSchema,
  BUDGET_IMPACT_TYPE,
} from '@repo/validators'
import type {
  CreateChangeOrderInput,
  UpdateChangeOrderInput,
  CreateChangeOrderLineInput,
  UpdateChangeOrderLineInput,
} from '@repo/validators'

function ensureProjectInOrg(projectId: string, orgId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true, projectNumber: true },
  })
}

function generateCONumber(projectNumber: string, sequence: number): string {
  return `CO-${projectNumber}-${sequence.toString().padStart(3, '0')}`
}

async function getNextCONumber(projectId: string): Promise<number> {
  const co = await prisma.changeOrder.findMany({
    where: { projectId },
    select: { number: true },
    orderBy: { number: 'desc' },
    take: 1,
  })
  return (co[0]?.number ?? 0) + 1
}

function isEditableCO(status: string): boolean {
  return status === 'DRAFT' || status === 'CHANGES_REQUESTED'
}

export type ListChangeOrdersFilters = { status?: string }

export async function listChangeOrders(projectId: string, filters: ListChangeOrdersFilters = {}) {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return null
  }
  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return null

  const where: { projectId: string; orgId: string; status?: string } = {
    projectId,
    orgId: org.orgId,
  }
  if (filters.status) where.status = filters.status

  const orders = await prisma.changeOrder.findMany({
    where,
    orderBy: { number: 'desc' },
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      budgetImpactType: true,
      costImpact: true,
      timeImpactDays: true,
      requestDate: true,
      requestedByOrgMemberId: true,
      requestedBy: { select: { user: { select: { fullName: true } } } },
    },
  })
  return orders.map((o) => ({
    ...o,
    costImpact: Number(o.costImpact),
    displayNumber: generateCONumber(
      (project as { projectNumber: string }).projectNumber,
      o.number
    ),
  }))
}

export async function getChangeOrder(coId: string) {
  const { org } = await getAuthContext()
  const co = await prisma.changeOrder.findFirst({
    where: { id: coId, orgId: org.orgId },
    include: {
      project: { select: { id: true, name: true, projectNumber: true } },
      requestedBy: { select: { user: { select: { fullName: true, email: true } } } },
      approvedBy: { select: { user: { select: { fullName: true } } } },
      budgetVersion: { select: { id: true, versionCode: true } },
      lines: {
        orderBy: { sortOrder: 'asc' },
        include: { wbsNode: { select: { id: true, code: true, name: true } } },
      },
      approvals: {
        orderBy: { createdAt: 'desc' },
        include: { orgMember: { select: { user: { select: { fullName: true } } } } },
      },
    },
  })
  if (!co) return null
  try {
    await assertProjectAccess(co.projectId, org)
  } catch {
    return null
  }
  return {
    ...co,
    costImpact: Number(co.costImpact),
    displayNumber: generateCONumber(co.project.projectNumber, co.number),
  }
}

export async function createChangeOrder(projectId: string, data: CreateChangeOrderInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return { error: { _form: ['Project not found'] } }
  try {
    const access = await assertProjectAccess(projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.OVERVIEW)) {
      return { error: { _form: ['No tenés permiso para editar órdenes de cambio de este proyecto'] } }
    }
  } catch (e) {
    return { error: { _form: [e instanceof Error ? e.message : 'Acceso denegado'] } }
  }

  const parsed = createChangeOrderSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const number = await getNextCONumber(projectId)
  const budgetImpactType =
    parsed.data.budgetImpactType && BUDGET_IMPACT_TYPE.includes(parsed.data.budgetImpactType as (typeof BUDGET_IMPACT_TYPE)[number])
      ? parsed.data.budgetImpactType
      : 'DEVIATION'
  const costImpact = new Prisma.Decimal(parsed.data.costImpact ?? 0)
  const requestDate = parsed.data.requestDate ?? new Date()
  const implementedDate = parsed.data.implementedDate ?? undefined

  const co = await prisma.$transaction(async (tx) => {
    const created = await tx.changeOrder.create({
      data: {
        orgId: org.orgId,
        projectId,
        number,
        title: parsed.data.title,
        status: 'DRAFT',
        changeType: parsed.data.changeType,
        budgetImpactType,
        reason: parsed.data.reason,
        justification: parsed.data.justification ?? undefined,
        costImpact,
        timeImpactDays: parsed.data.timeImpactDays ?? 0,
        requestDate,
        implementedDate,
        requestedByOrgMemberId: org.memberId,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'CHANGE_ORDER.CREATED',
      entityType: 'ChangeOrder',
      entityId: created.id,
      payload: { projectId, number: created.number, title: created.title },
    })
    return created
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/change-orders`)
  revalidatePath(`/projects/${projectId}/change-orders/${co.id}`)
  revalidatePath(`/projects/${projectId}/change-orders/${co.id}/edit`)
  return { success: true, changeOrderId: co.id }
}

async function recalcChangeOrderCostImpact(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], coId: string) {
  const agg = await tx.changeOrderLine.aggregate({
    where: { changeOrderId: coId },
    _sum: { deltaCost: true },
  })
  const total = Number(agg._sum.deltaCost ?? 0)
  await tx.changeOrder.update({
    where: { id: coId },
    data: { costImpact: new Prisma.Decimal(total) },
  })
}

export async function createChangeOrderLine(coId: string, data: CreateChangeOrderLineInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const co = await prisma.changeOrder.findFirst({
    where: { id: coId, orgId: org.orgId },
    select: { id: true, projectId: true, status: true },
  })
  if (!co) return { error: { _form: ['Change order not found'] } }
  if (!isEditableCO(co.status)) {
    return { error: { _form: ['Cannot add lines to this change order.'] } }
  }
  try {
    const access = await assertProjectAccess(co.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.OVERVIEW)) {
      return { error: { _form: ['No tenés permiso para editar órdenes de cambio de este proyecto'] } }
    }
  } catch (e) {
    return { error: { _form: [e instanceof Error ? e.message : 'Acceso denegado'] } }
  }

  const parsed = createChangeOrderLineSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const wbsNode = await prisma.wbsNode.findFirst({
    where: { id: parsed.data.wbsNodeId, projectId: co.projectId, orgId: org.orgId, active: true },
    select: { id: true },
  })
  if (!wbsNode) return { error: { wbsNodeId: ['WBS item must belong to this project.'] } }

  const maxSort = await prisma.changeOrderLine.aggregate({
    where: { changeOrderId: coId },
    _max: { sortOrder: true },
  })
  const deltaCost = new Prisma.Decimal(parsed.data.deltaCost)
  const newQty = parsed.data.newQty != null ? new Prisma.Decimal(parsed.data.newQty) : null
  const newUnitCost = parsed.data.newUnitCost != null ? new Prisma.Decimal(parsed.data.newUnitCost) : null
  const newTotalCost = parsed.data.deltaCost

  await prisma.$transaction(async (tx) => {
    await tx.changeOrderLine.create({
      data: {
        orgId: org.orgId,
        changeOrderId: coId,
        wbsNodeId: parsed.data.wbsNodeId,
        changeType: parsed.data.changeType,
        justification: parsed.data.justification,
        newQty,
        newUnitCost,
        originalTotalCost: null,
        newTotalCost: new Prisma.Decimal(newTotalCost),
        deltaCost,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    })
    await recalcChangeOrderCostImpact(tx, coId)
  })

  const co2 = await prisma.changeOrder.findFirst({ where: { id: coId }, select: { projectId: true } })
  if (co2) {
    revalidatePath(`/projects/${co2.projectId}`)
    revalidatePath(`/projects/${co2.projectId}/change-orders`)
    revalidatePath(`/projects/${co2.projectId}/change-orders/${coId}`)
    revalidatePath(`/projects/${co2.projectId}/change-orders/${coId}/edit`)
  }
  return { success: true }
}

export async function updateChangeOrderLine(lineId: string, data: UpdateChangeOrderLineInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const line = await prisma.changeOrderLine.findFirst({
    where: { id: lineId, orgId: org.orgId },
    include: { changeOrder: { select: { id: true, projectId: true, status: true } } },
  })
  if (!line) return { error: { _form: ['Line not found'] } }
  if (!isEditableCO(line.changeOrder.status)) {
    return { error: { _form: ['Cannot edit this change order.'] } }
  }
  try {
    const access = await assertProjectAccess(line.changeOrder.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.OVERVIEW)) {
      return { error: { _form: ['No tenés permiso para editar órdenes de cambio de este proyecto'] } }
    }
  } catch (e) {
    return { error: { _form: [e instanceof Error ? e.message : 'Acceso denegado'] } }
  }

  const parsed = updateChangeOrderLineSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const payload: Record<string, unknown> = {}
  if (parsed.data.justification !== undefined) payload.justification = parsed.data.justification
  if (parsed.data.deltaCost !== undefined) payload.deltaCost = new Prisma.Decimal(parsed.data.deltaCost)
  if (parsed.data.newQty !== undefined) payload.newQty = parsed.data.newQty != null ? new Prisma.Decimal(parsed.data.newQty) : null
  if (parsed.data.newUnitCost !== undefined) payload.newUnitCost = parsed.data.newUnitCost != null ? new Prisma.Decimal(parsed.data.newUnitCost) : null
  if (parsed.data.deltaCost !== undefined) payload.newTotalCost = new Prisma.Decimal(parsed.data.deltaCost)

  await prisma.$transaction(async (tx) => {
    await tx.changeOrderLine.update({ where: { id: lineId }, data: payload })
    await recalcChangeOrderCostImpact(tx, line.changeOrder.id)
  })

  revalidatePath(`/projects/${line.changeOrder.projectId}`)
  revalidatePath(`/projects/${line.changeOrder.projectId}/change-orders`)
  revalidatePath(`/projects/${line.changeOrder.projectId}/change-orders/${line.changeOrder.id}`)
  revalidatePath(`/projects/${line.changeOrder.projectId}/change-orders/${line.changeOrder.id}/edit`)
  return { success: true }
}

export async function deleteChangeOrderLine(lineId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const line = await prisma.changeOrderLine.findFirst({
    where: { id: lineId, orgId: org.orgId },
    include: { changeOrder: { select: { id: true, projectId: true, status: true } } },
  })
  if (!line) throw new Error('Line not found')
  if (!isEditableCO(line.changeOrder.status)) throw new Error('Cannot edit this change order.')
  try {
    const access = await assertProjectAccess(line.changeOrder.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.OVERVIEW)) {
      throw new Error('No tenés permiso para editar órdenes de cambio de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  await prisma.$transaction(async (tx) => {
    await tx.changeOrderLine.delete({ where: { id: lineId } })
    await recalcChangeOrderCostImpact(tx, line.changeOrder.id)
  })

  revalidatePath(`/projects/${line.changeOrder.projectId}`)
  revalidatePath(`/projects/${line.changeOrder.projectId}/change-orders`)
  revalidatePath(`/projects/${line.changeOrder.projectId}/change-orders/${line.changeOrder.id}`)
  revalidatePath(`/projects/${line.changeOrder.projectId}/change-orders/${line.changeOrder.id}/edit`)
  return { success: true }
}

export type ChangeOrderLineInput = {
  wbsNodeId: string
  changeType: 'ADD' | 'MODIFY' | 'DELETE'
  justification: string
  deltaCost: number
}

/** Update change order header and replace all lines (for form submit with lines). */
export async function updateChangeOrderWithLines(
  coId: string,
  data: UpdateChangeOrderInput,
  lines: ChangeOrderLineInput[]
) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const co = await prisma.changeOrder.findFirst({
    where: { id: coId, orgId: org.orgId },
    select: { id: true, projectId: true, status: true },
  })
  if (!co) return { error: { _form: ['Change order not found'] } }
  if (!isEditableCO(co.status)) return { error: { _form: ['Cannot edit this change order.'] } }
  try {
    const access = await assertProjectAccess(co.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.OVERVIEW)) {
      return { error: { _form: ['No tenés permiso para editar órdenes de cambio de este proyecto'] } }
    }
  } catch (e) {
    return { error: { _form: [e instanceof Error ? e.message : 'Acceso denegado'] } }
  }

  const parsed = updateChangeOrderSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const raw = data as Record<string, unknown>
  const budgetImpactValue = (parsed.data.budgetImpactType ?? raw.budgetImpactType) as string | undefined
  const validBudgetImpact =
    typeof budgetImpactValue === 'string' && BUDGET_IMPACT_TYPE.includes(budgetImpactValue as (typeof BUDGET_IMPACT_TYPE)[number])
      ? budgetImpactValue
      : undefined

  const headerPayload: Prisma.ChangeOrderUpdateInput = {}
  if (parsed.data.title !== undefined) headerPayload.title = parsed.data.title
  if (parsed.data.reason !== undefined) headerPayload.reason = parsed.data.reason
  if (parsed.data.justification !== undefined) headerPayload.justification = parsed.data.justification
  if (parsed.data.changeType !== undefined) headerPayload.changeType = parsed.data.changeType
  if (validBudgetImpact !== undefined) headerPayload.budgetImpactType = validBudgetImpact
  if (parsed.data.costImpact !== undefined) headerPayload.costImpact = new Prisma.Decimal(parsed.data.costImpact)
  if (parsed.data.timeImpactDays !== undefined) headerPayload.timeImpactDays = parsed.data.timeImpactDays
  if (parsed.data.requestDate !== undefined) headerPayload.requestDate = parsed.data.requestDate
  if (parsed.data.implementedDate !== undefined) headerPayload.implementedDate = parsed.data.implementedDate
  if (parsed.data.partyId !== undefined) headerPayload.partyId = parsed.data.partyId

  await prisma.$transaction(async (tx) => {
    await tx.changeOrder.update({ where: { id: coId }, data: headerPayload })
    await tx.changeOrderLine.deleteMany({ where: { changeOrderId: coId } })
    let sortOrder = 0
    for (const line of lines) {
      const wbsNode = await tx.wbsNode.findFirst({
        where: { id: line.wbsNodeId, projectId: co.projectId, orgId: org.orgId, active: true },
        select: { id: true },
      })
      if (!wbsNode) continue
      await tx.changeOrderLine.create({
        data: {
          orgId: org.orgId,
          changeOrderId: coId,
          wbsNodeId: line.wbsNodeId,
          changeType: line.changeType,
          justification: line.justification,
          deltaCost: new Prisma.Decimal(line.deltaCost),
          sortOrder: sortOrder++,
        },
      })
    }
    await recalcChangeOrderCostImpact(tx, coId)
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'CHANGE_ORDER.UPDATED',
      entityType: 'ChangeOrder',
      entityId: coId,
      payload: { projectId: co.projectId, updatedFields: [...Object.keys(headerPayload), 'lines'] },
    })
  })

  revalidatePath(`/projects/${co.projectId}`)
  revalidatePath(`/projects/${co.projectId}/change-orders`)
  revalidatePath(`/projects/${co.projectId}/change-orders/${coId}`)
  revalidatePath(`/projects/${co.projectId}/change-orders/${coId}/edit`)
  return { success: true }
}

export async function updateChangeOrder(coId: string, data: UpdateChangeOrderInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const co = await prisma.changeOrder.findFirst({
    where: { id: coId, orgId: org.orgId },
    select: { id: true, projectId: true, status: true },
  })
  if (!co) return { error: { _form: ['Change order not found'] } }
  if (!isEditableCO(co.status)) {
    return { error: { _form: ['Cannot edit this change order.'] } }
  }
  try {
    const access = await assertProjectAccess(co.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.OVERVIEW)) {
      return { error: { _form: ['No tenés permiso para editar órdenes de cambio de este proyecto'] } }
    }
  } catch (e) {
    return { error: { _form: [e instanceof Error ? e.message : 'Acceso denegado'] } }
  }

  const parsed = updateChangeOrderSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const raw = data as Record<string, unknown>
  const budgetImpactValue =
    (parsed.data.budgetImpactType ?? raw.budgetImpactType) as string | undefined
  const validBudgetImpact =
    typeof budgetImpactValue === 'string' && BUDGET_IMPACT_TYPE.includes(budgetImpactValue as (typeof BUDGET_IMPACT_TYPE)[number])
      ? budgetImpactValue
      : undefined

  const payload: Prisma.ChangeOrderUpdateInput = {}
  if (parsed.data.title !== undefined) payload.title = parsed.data.title
  if (parsed.data.reason !== undefined) payload.reason = parsed.data.reason
  if (parsed.data.justification !== undefined) payload.justification = parsed.data.justification
  if (parsed.data.changeType !== undefined) payload.changeType = parsed.data.changeType
  if (validBudgetImpact !== undefined) payload.budgetImpactType = validBudgetImpact
  if (parsed.data.status !== undefined) payload.status = parsed.data.status
  if (parsed.data.costImpact !== undefined) payload.costImpact = new Prisma.Decimal(parsed.data.costImpact)
  if (parsed.data.timeImpactDays !== undefined) payload.timeImpactDays = parsed.data.timeImpactDays
  if (parsed.data.requestDate !== undefined) payload.requestDate = parsed.data.requestDate
  if (parsed.data.approvedDate !== undefined) payload.approvedDate = parsed.data.approvedDate
  if (parsed.data.implementedDate !== undefined) payload.implementedDate = parsed.data.implementedDate
  if (parsed.data.partyId !== undefined) payload.partyId = parsed.data.partyId

  await prisma.$transaction(async (tx) => {
    await tx.changeOrder.update({ where: { id: coId }, data: payload })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'CHANGE_ORDER.UPDATED',
      entityType: 'ChangeOrder',
      entityId: coId,
      payload: { projectId: co.projectId, updatedFields: Object.keys(payload) },
    })
  })

  revalidatePath(`/projects/${co.projectId}`)
  revalidatePath(`/projects/${co.projectId}/change-orders`)
  revalidatePath(`/projects/${co.projectId}/change-orders/${coId}`)
  revalidatePath(`/projects/${co.projectId}/change-orders/${coId}/edit`)
  return { success: true }
}

export async function submitForApproval(coId: string) {
  const { session, org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const co = await prisma.changeOrder.findFirst({
    where: { id: coId, orgId: org.orgId },
    select: { id: true, projectId: true, status: true, number: true, title: true },
  })
  if (!co) return { error: 'Change order not found' }
  if (co.status !== 'DRAFT' && co.status !== 'CHANGES_REQUESTED') {
    return { error: 'Only draft or changes-requested orders can be submitted.' }
  }
  try {
    const access = await assertProjectAccess(co.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.OVERVIEW)) {
      return { error: 'No tenés permiso para editar órdenes de cambio de este proyecto' }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  await prisma.changeOrder.update({
    where: { id: coId },
    data: { status: 'SUBMITTED' },
  })

  const admins = await prisma.orgMember.findMany({
    where: { orgId: org.orgId, active: true, role: { in: ['ADMIN', 'OWNER'] } },
    select: { userId: true },
  })
  const adminUserIds = admins.map((a) => a.userId).filter((id) => id !== session.user.id)
  if (adminUserIds.length > 0) {
    const { createInAppNotificationsForUsers } = await import('@/app/actions/notifications')
    await createInAppNotificationsForUsers(adminUserIds, {
      orgId: org.orgId,
      actorUserId: session.user.id,
      category: 'APPROVAL_REQUEST',
      title: 'Orden de cambio pendiente de aprobación',
      message: `Orden de cambio #${co.number}: ${co.title ?? 'Sin título'}`,
      metadata: { link: `/projects/${co.projectId}/change-orders/${coId}` },
    })
  }

  revalidatePath(`/projects/${co.projectId}/change-orders`)
  revalidatePath(`/projects/${co.projectId}/change-orders/${coId}`)
  return { success: true }
}


export async function approveChangeOrder(coId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const co = await prisma.changeOrder.findFirst({
    where: { id: coId, orgId: org.orgId },
    include: { lines: { include: { wbsNode: true } }, project: true },
  })
  if (!co) return { error: 'Change order not found' }
  if (co.status !== 'SUBMITTED') return { error: 'Only submitted change orders can be approved.' }
  try {
    const access = await assertProjectAccess(co.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.OVERVIEW)) {
      return { error: 'No tenés permiso para editar órdenes de cambio de este proyecto' }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  await prisma.$transaction(async (tx: PrismaTransaction) => {
    const latestVersion = await tx.budgetVersion.findFirst({
      where: { projectId: co.projectId },
      orderBy: { createdAt: 'desc' },
      include: { budgetLines: true },
    })

    const versionCode = await (async () => {
      const versions = await tx.budgetVersion.findMany({
        where: { projectId: co.projectId },
        select: { versionCode: true },
        orderBy: { versionCode: 'desc' },
        take: 1,
      })
      const last = versions[0]?.versionCode ?? 'V0'
      const num = parseInt(last.replace(/^V/i, ''), 10)
      return `V${Number.isNaN(num) ? 1 : num + 1}`
    })()

    const newVersion = await tx.budgetVersion.create({
      data: {
        orgId: org.orgId,
        projectId: co.projectId,
        versionCode,
        versionType: 'CHANGE_ORDER',
        status: 'DRAFT',
        notes: `Change order ${co.number}: ${co.title}`,
        createdByOrgMemberId: org.memberId,
      },
    })

    if (latestVersion?.budgetLines?.length) {
      await tx.budgetLine.createMany({
        data: latestVersion.budgetLines.map((l) => ({
          orgId: org.orgId,
          budgetVersionId: newVersion.id,
          wbsNodeId: l.wbsNodeId,
          resourceId: l.resourceId ?? undefined,
          description: l.description,
          unit: l.unit,
          quantity: l.quantity,
          directCostTotal: l.directCostTotal,
          salePriceTotal: l.salePriceTotal,
          indirectCostPct: l.indirectCostPct ?? 0,
          overheadPct: l.overheadPct,
          financialPct: l.financialPct,
          profitPct: l.profitPct,
          taxPct: l.taxPct,
          retentionPct: l.retentionPct,
          sortOrder: l.sortOrder,
        })),
      })
    }

    let sortOrder = 0
    for (const line of co.lines) {
      await tx.budgetLine.create({
        data: {
          orgId: org.orgId,
          budgetVersionId: newVersion.id,
          wbsNodeId: line.wbsNodeId,
          description: line.justification,
          unit: 'ea',
          quantity: new Prisma.Decimal(1),
          directCostTotal: line.deltaCost,
          salePriceTotal: line.deltaCost,
          indirectCostPct: new Prisma.Decimal(0),
          overheadPct: new Prisma.Decimal(0),
          financialPct: new Prisma.Decimal(0),
          profitPct: new Prisma.Decimal(0),
          taxPct: new Prisma.Decimal(0),
          retentionPct: new Prisma.Decimal(0),
          sortOrder: sortOrder++,
        },
      })
    }

    await tx.changeOrder.update({
      where: { id: coId },
      data: {
        status: 'APPROVED',
        budgetVersionId: newVersion.id,
        approvedByOrgMemberId: org.memberId,
        approvedDate: new Date(),
      },
    })

    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'CHANGE_ORDER.APPROVED',
      entityType: 'ChangeOrder',
      entityId: coId,
      payload: { projectId: co.projectId, changeOrderNumber: co.number, title: co.title },
    })

    await tx.changeOrderApproval.create({
      data: {
        changeOrderId: coId,
        orgMemberId: org.memberId,
        decision: 'APPROVED',
      },
    })

    const costImpact = Number(co.costImpact)
    const project = await tx.project.findUnique({
      where: { id: co.projectId },
      select: { totalBudget: true },
    })
    const currentTotal = project?.totalBudget != null ? Number(project.totalBudget) : 0
    await tx.project.update({
      where: { id: co.projectId },
      data: { totalBudget: new Prisma.Decimal(currentTotal + costImpact) },
    })
  })

  revalidatePath(`/projects/${co.projectId}/change-orders`)
  revalidatePath(`/projects/${co.projectId}/change-orders/${coId}`)
  revalidatePath(`/projects/${co.projectId}/budget`)
  return { success: true }
}

export async function rejectChangeOrder(coId: string, reason: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const co = await prisma.changeOrder.findFirst({
    where: { id: coId, orgId: org.orgId },
    select: { id: true, projectId: true, status: true },
  })
  if (!co) return { error: 'Change order not found' }
  if (co.status !== 'SUBMITTED') return { error: 'Only submitted change orders can be rejected.' }
  try {
    const access = await assertProjectAccess(co.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.OVERVIEW)) {
      return { error: 'No tenés permiso para editar órdenes de cambio de este proyecto' }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  await prisma.$transaction([
    prisma.changeOrder.update({
      where: { id: coId },
      data: { status: 'REJECTED', rejectionReason: reason },
    }),
    prisma.changeOrderApproval.create({
      data: {
        changeOrderId: coId,
        orgMemberId: org.memberId,
        decision: 'REJECTED',
        comment: reason,
      },
    }),
  ])

  revalidatePath(`/projects/${co.projectId}/change-orders`)
  revalidatePath(`/projects/${co.projectId}/change-orders/${coId}`)
  return { success: true }
}

export async function requestChanges(coId: string, feedback: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const co = await prisma.changeOrder.findFirst({
    where: { id: coId, orgId: org.orgId },
    select: { id: true, projectId: true, status: true },
  })
  if (!co) return { error: 'Change order not found' }
  if (co.status !== 'SUBMITTED') return { error: 'Only submitted change orders can be sent back.' }
  try {
    const access = await assertProjectAccess(co.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.OVERVIEW)) {
      return { error: 'No tenés permiso para editar órdenes de cambio de este proyecto' }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  await prisma.$transaction([
    prisma.changeOrder.update({
      where: { id: coId },
      data: { status: 'CHANGES_REQUESTED', feedbackRequested: feedback },
    }),
    prisma.changeOrderApproval.create({
      data: {
        changeOrderId: coId,
        orgMemberId: org.memberId,
        decision: 'CHANGES_REQUESTED',
        comment: feedback,
      },
    }),
  ])

  revalidatePath(`/projects/${co.projectId}/change-orders`)
  revalidatePath(`/projects/${co.projectId}/change-orders/${coId}`)
  return { success: true }
}
