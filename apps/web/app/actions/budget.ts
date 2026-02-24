'use server'

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { requireRole } from '@/lib/rbac'
import { requirePermission, getAuthContext } from '@/lib/auth-helpers'
import {
  createBudgetVersionSchema,
  updateBudgetVersionSchema,
  createBudgetLineSchema,
  updateBudgetLineSchema,
} from '@repo/validators'
import type {
  CreateBudgetVersionInput,
  UpdateBudgetVersionInput,
  CreateBudgetLineInput,
  UpdateBudgetLineInput,
} from '@repo/validators'
import { calculateLineTotal, calculateBudgetLineTotal } from '@/lib/budget-utils'
import { calculateBudgetLine } from '@/lib/budget-calculations'
import { createAuditLog } from '@/lib/audit-log'
import { publishOutboxEvent } from '@/lib/events/event-publisher'
import { serializeForClient } from '@/lib/utils/serialization'
import { assertProjectAccess, canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'

function ensureProjectInOrg(projectId: string, orgId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true },
  })
}

export async function getOrgDefaultIndirectPct(): Promise<number> {
  const { org } = await getAuthContext()
  const profile = await prisma.orgProfile.findFirst({
    where: { orgId: org.orgId },
    select: { defaultIndirectCostPct: true },
  })
  return Number(profile?.defaultIndirectCostPct ?? 0)
}

async function getNextVersionCode(projectId: string): Promise<string> {
  const versions = await prisma.budgetVersion.findMany({
    where: { projectId },
    select: { versionCode: true },
    orderBy: { versionCode: 'desc' },
    take: 1,
  })
  const last = versions[0]?.versionCode ?? 'V0'
  const num = parseInt(last.replace(/^V/i, ''), 10)
  return `V${Number.isNaN(num) ? 1 : num + 1}`
}

function isEditableVersion(status: string): boolean {
  return status === 'DRAFT'
}

export async function listBudgetVersions(projectId: string) {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return null
  }

  const versions = await prisma.budgetVersion.findMany({
    where: { projectId, orgId: org.orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      versionCode: true,
      versionType: true,
      status: true,
      notes: true,
      createdAt: true,
      approvedAt: true,
      lockedAt: true,
      createdBy: { select: { user: { select: { fullName: true } } } },
      approvedBy: { select: { user: { select: { fullName: true } } } },
      _count: { select: { budgetLines: true } },
    },
  })

  const versionIds = versions.map((v) => v.id)
  const totals = await prisma.budgetLine.groupBy({
    by: ['budgetVersionId'],
    where: { budgetVersionId: { in: versionIds } },
    _sum: { salePriceTotal: true },
  })
  const totalByVersion = new Map(totals.map((t) => [t.budgetVersionId, Number(t._sum.salePriceTotal ?? 0)]))

  return versions.map((v) => ({
    ...v,
    totalCost: totalByVersion.get(v.id) ?? 0,
  }))
}

export async function getBudgetVersion(versionId: string) {
  const { org } = await getAuthContext()
  const version = await prisma.budgetVersion.findFirst({
    where: { id: versionId, orgId: org.orgId },
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { user: { select: { fullName: true } } } },
      approvedBy: { select: { user: { select: { fullName: true } } } },
    },
  })
  return version
}

export async function getVersionTotal(versionId: string): Promise<number> {
  const { org } = await getAuthContext()
  const version = await prisma.budgetVersion.findFirst({
    where: { id: versionId, orgId: org.orgId },
    select: { id: true },
  })
  if (!version) return 0
  const agg = await prisma.budgetLine.aggregate({
    where: { budgetVersionId: versionId },
    _sum: { salePriceTotal: true },
  })
  return Number(agg._sum.salePriceTotal ?? 0)
}

export async function createBudgetVersion(projectId: string, data: CreateBudgetVersionInput) {
  await requirePermission('BUDGET', 'create')
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')
  let projectRole: string | null
  try {
    const access = await assertProjectAccess(projectId, org)
    projectRole = access.projectRole
  } catch (e) {
    return { error: { _form: [e instanceof Error ? e.message : 'Proyecto no encontrado'] } }
  }
  if (!canEditProjectArea(projectRole, PROJECT_AREAS.BUDGET)) {
    return { error: { _form: ['No tenés permiso para editar el presupuesto de este proyecto'] } }
  }

  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return { error: { _form: ['Project not found'] } }

  const parsed = createBudgetVersionSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const versionCode = await getNextVersionCode(projectId)
  const version = await prisma.budgetVersion.create({
    data: {
      orgId: org.orgId,
      projectId,
      versionCode,
      versionType: parsed.data.versionType,
      status: 'DRAFT',
      notes: parsed.data.notes ?? undefined,
      createdByOrgMemberId: org.memberId,
    },
  })

  // Preload budget lines from WBS (template items)
  const wbsNodes = await prisma.wbsNode.findMany({
    where: {
      projectId,
      orgId: org.orgId,
      active: true,
      category: { in: ['BUDGET_ITEM', 'ITEM'] },
    },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    select: { id: true, code: true, name: true, unit: true, quantity: true },
  })

  const orgProfile = await prisma.orgProfile.findFirst({
    where: { orgId: org.orgId },
    select: { defaultIndirectCostPct: true },
  })
  const defaultIndirectPct = Number(orgProfile?.defaultIndirectCostPct ?? 0)

  for (let i = 0; i < wbsNodes.length; i++) {
    const node = wbsNodes[i]
    const qty = Number(node.quantity ?? 0)
    const { directCost, totalCost } = calculateBudgetLineTotal(qty, 0, defaultIndirectPct)
    await prisma.budgetLine.create({
      data: {
        orgId: org.orgId,
        budgetVersionId: version.id,
        wbsNodeId: node.id,
        description: node.name,
        unit: node.unit ?? 'un',
        quantity: new Prisma.Decimal(qty),
        directCostTotal: directCost,
        salePriceTotal: totalCost,
        overheadPct: 0,
        financialPct: 0,
        profitPct: 0,
        taxPct: 0,
        retentionPct: 0,
        sortOrder: i,
      },
    })
  }

  revalidatePath(`/projects/${projectId}/budget`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true, versionId: version.id }
}

export async function updateBudgetVersion(versionId: string, data: UpdateBudgetVersionInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const version = await prisma.budgetVersion.findFirst({
    where: { id: versionId, orgId: org.orgId },
    select: { id: true, projectId: true, status: true },
  })
  if (!version) return { error: { _form: ['Version not found'] } }
  try {
    const access = await assertProjectAccess(version.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { error: { _form: ['No tenés permiso para editar el presupuesto de este proyecto'] } }
    }
  } catch (e) {
    return { error: { _form: [e instanceof Error ? e.message : 'Acceso denegado'] } }
  }
  if (!isEditableVersion(version.status)) {
    return { error: { _form: ['Cannot edit BASELINE or APPROVED version.'] } }
  }

  const parsed = updateBudgetVersionSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const payload: Record<string, unknown> = {}
  if (parsed.data.versionType !== undefined) payload.versionType = parsed.data.versionType
  if (parsed.data.notes !== undefined) payload.notes = parsed.data.notes

  await prisma.budgetVersion.update({
    where: { id: versionId },
    data: payload,
  })

  revalidatePath(`/projects/${version.projectId}/budget`)
  revalidatePath(`/projects/${version.projectId}/budget/${versionId}`)
  return { success: true }
}

/** Set this version as BASELINE; unset previous baseline for the project. */
export async function setBudgetBaseline(versionId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const version = await prisma.budgetVersion.findFirst({
    where: { id: versionId, orgId: org.orgId },
    select: { id: true, projectId: true, status: true },
  })
  if (!version) return { error: 'Version not found' }
  try {
    const access = await assertProjectAccess(version.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { error: 'No tenés permiso para editar el presupuesto de este proyecto' }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  await prisma.$transaction([
    prisma.budgetVersion.updateMany({
      where: {
        projectId: version.projectId,
        versionType: 'BASELINE',
        id: { not: versionId },
      },
      data: { versionType: 'WORKING', status: 'DRAFT', lockedAt: null },
    }),
    prisma.budgetVersion.update({
      where: { id: versionId },
      data: {
        versionType: 'BASELINE',
        status: 'BASELINE',
        lockedAt: new Date(),
      },
    }),
  ])

  revalidatePath(`/projects/${version.projectId}/budget`)
  revalidatePath(`/projects/${version.projectId}/budget/${versionId}`)
  return { success: true }
}

/** Mark version as APPROVED (read-only). */
export async function approveBudgetVersion(versionId: string) {
  await requirePermission('BUDGET', 'approve')
  const { session, org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const version = await prisma.budgetVersion.findFirst({
    where: { id: versionId, orgId: org.orgId },
    select: { id: true, projectId: true, versionCode: true, createdByOrgMemberId: true },
  })
  if (!version) return { error: 'Version not found' }
  try {
    const access = await assertProjectAccess(version.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { error: 'No tenés permiso para editar el presupuesto de este proyecto' }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.budgetVersion.update({
      where: { id: versionId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByOrgMemberId: org.memberId,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'BUDGET_VERSION.APPROVED',
      entityType: 'BudgetVersion',
      entityId: versionId,
      payload: { projectId: version.projectId },
    })
  })

  if (version.createdByOrgMemberId && version.createdByOrgMemberId !== org.memberId) {
    const creator = await prisma.orgMember.findUnique({
      where: { id: version.createdByOrgMemberId },
      select: { userId: true },
    })
    if (creator) {
      const { createInAppNotification } = await import('@/app/actions/notifications')
      await createInAppNotification({
        orgId: org.orgId,
        userId: creator.userId,
        actorUserId: session.user.id,
        category: 'BUDGET_APPROVED',
        title: 'Presupuesto aprobado',
        message: `Versión ${version.versionCode} fue aprobada.`,
        metadata: { link: `/projects/${version.projectId}/budget/${versionId}` },
      })
    }
  }

  revalidatePath(`/projects/${version.projectId}/budget`)
  revalidatePath(`/projects/${version.projectId}/budget/${versionId}`)
  return { success: true }
}

/**
 * Cambiar estado de versión de presupuesto (DRAFT | BASELINE | APPROVED)
 */
export async function updateBudgetVersionStatus(
  versionId: string,
  newStatus: 'DRAFT' | 'BASELINE' | 'APPROVED'
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'ADMIN')

  try {
    const version = await prisma.budgetVersion.findFirst({
      where: { id: versionId, orgId: org.orgId },
      include: { project: { select: { id: true, name: true } } },
    })

    if (!version) {
      return { success: false, error: 'Version not found' }
    }
    try {
      const access = await assertProjectAccess(version.projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
        return { success: false, error: 'No tenés permiso para editar el presupuesto de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (version.status === 'APPROVED') {
      return { success: false, error: 'No se puede modificar una versión aprobada' }
    }

    if (newStatus === 'BASELINE') {
      const existingBaseline = await prisma.budgetVersion.findFirst({
        where: {
          projectId: version.projectId,
          status: 'BASELINE',
          id: { not: versionId },
        },
      })
      if (existingBaseline) {
        return {
          success: false,
          error: 'Ya existe una versión BASELINE. Debes quitarle ese estado primero.',
        }
      }
    }

    const oldStatus = version.status
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'APPROVED') {
      updates.approvedAt = new Date()
      updates.approvedByOrgMemberId = org.memberId
    }

    await prisma.budgetVersion.update({
      where: { id: versionId },
      data: updates,
    })

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'BudgetVersion',
      entityId: versionId,
      projectId: version.projectId,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
      description: `Estado de presupuesto cambiado de ${oldStatus} a ${newStatus} en proyecto "${version.project.name}"`,
    })

    revalidatePath(`/projects/${version.project.id}/budget`)
    revalidatePath(`/projects/${version.project.id}/budget/${versionId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating budget version status:', error)
    return { success: false, error: 'Error al actualizar estado' }
  }
}

/**
 * Cambiar modo de markups (SIMPLE | ADVANCED)
 */
export async function updateMarkupMode(
  versionId: string,
  mode: 'SIMPLE' | 'ADVANCED',
  applyGlobalsToAll?: boolean
) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  try {
    const version = await prisma.budgetVersion.findFirst({
      where: { id: versionId, orgId: org.orgId },
      select: {
        id: true,
        status: true,
        markupMode: true,
        projectId: true,
        project: { select: { id: true } },
        globalOverheadPct: true,
        globalFinancialPct: true,
        globalProfitPct: true,
        globalTaxPct: true,
      },
    })

    if (!version) {
      return { success: false, error: 'Version not found' }
    }
    try {
      const access = await assertProjectAccess(version.projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
        return { success: false, error: 'No tenés permiso para editar el presupuesto de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (version.status !== 'DRAFT') {
      return { success: false, error: 'Solo se puede editar en modo DRAFT' }
    }

    await prisma.budgetVersion.update({
      where: { id: versionId },
      data: { markupMode: mode },
    })

    if (mode === 'SIMPLE' && applyGlobalsToAll) {
      await prisma.budgetLine.updateMany({
        where: { budgetVersionId: versionId },
        data: {
          overheadPct: version.globalOverheadPct,
          financialPct: version.globalFinancialPct,
          profitPct: version.globalProfitPct,
          taxPct: version.globalTaxPct,
        },
      })
    }

    revalidatePath(`/projects/${version.project.id}/budget/${versionId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating markup mode:', error)
    return { success: false, error: 'Error al cambiar modo' }
  }
}

/**
 * Actualizar markups globales de la versión
 */
export async function updateGlobalMarkups(
  versionId: string,
  markups: {
    overheadPct: number
    financialPct: number
    profitPct: number
    taxPct: number
  },
  applyToAllLines?: boolean
) {
  const { session, org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  try {
    const version = await prisma.budgetVersion.findFirst({
      where: { id: versionId, orgId: org.orgId },
      select: {
        id: true,
        status: true,
        markupMode: true,
        projectId: true,
        versionCode: true,
        globalOverheadPct: true,
        globalFinancialPct: true,
        globalProfitPct: true,
        globalTaxPct: true,
        project: { select: { id: true, name: true } },
      },
    })

    if (!version) {
      return { success: false, error: 'Version not found' }
    }
    try {
      const access = await assertProjectAccess(version.projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
        return { success: false, error: 'No tenés permiso para editar el presupuesto de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (version.status !== 'DRAFT') {
      return { success: false, error: 'Solo se puede editar en modo DRAFT' }
    }

    const oldValues = {
      overheadPct: Number(version.globalOverheadPct),
      financialPct: Number(version.globalFinancialPct),
      profitPct: Number(version.globalProfitPct),
      taxPct: Number(version.globalTaxPct),
    }

    await prisma.budgetVersion.update({
      where: { id: versionId },
      data: {
        globalOverheadPct: new Prisma.Decimal(markups.overheadPct),
        globalFinancialPct: new Prisma.Decimal(markups.financialPct),
        globalProfitPct: new Prisma.Decimal(markups.profitPct),
        globalTaxPct: new Prisma.Decimal(markups.taxPct),
      },
    })

    const shouldApplyToLines = version.markupMode === 'SIMPLE' || applyToAllLines
    if (shouldApplyToLines) {
      await prisma.budgetLine.updateMany({
        where: { budgetVersionId: versionId },
        data: {
          overheadPct: new Prisma.Decimal(markups.overheadPct),
          financialPct: new Prisma.Decimal(markups.financialPct),
          profitPct: new Prisma.Decimal(markups.profitPct),
          taxPct: new Prisma.Decimal(markups.taxPct),
        },
      })
    }

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'BudgetVersion',
      entityId: versionId,
      projectId: version.projectId,
      oldValues,
      newValues: markups,
      description: `Márgenes actualizados en proyecto "${version.project.name}" - Versión ${version.versionCode}`,
    })

    revalidatePath(`/projects/${version.project.id}/budget/${versionId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating global markups:', error)
    return { success: false, error: 'Error al actualizar márgenes' }
  }
}

/**
 * Actualizar markup de una línea (solo modo ADVANCED)
 */
export async function updateLineMarkup(
  lineId: string,
  field: 'overheadPct' | 'financialPct' | 'profitPct' | 'taxPct',
  value: number
) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  try {
    const line = await prisma.budgetLine.findFirst({
      where: { id: lineId, orgId: org.orgId },
      include: {
        budgetVersion: {
          select: {
            status: true,
            markupMode: true,
            projectId: true,
          },
        },
      },
    })

    if (!line) {
      return { success: false, error: 'Line not found' }
    }
    try {
      const access = await assertProjectAccess(line.budgetVersion.projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
        return { success: false, error: 'No tenés permiso para editar el presupuesto de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (line.budgetVersion.status !== 'DRAFT') {
      return { success: false, error: 'Solo editable en DRAFT' }
    }

    if (line.budgetVersion.markupMode !== 'ADVANCED') {
      return {
        success: false,
        error: 'Solo editable en modo AVANZADO',
      }
    }

    if (value < 0 || value > 100) {
      return { success: false, error: 'El porcentaje debe estar entre 0 y 100' }
    }

    await prisma.budgetLine.update({
      where: { id: lineId },
      data: { [field]: new Prisma.Decimal(value) },
    })

    revalidatePath(`/projects/${line.budgetVersion.projectId}/budget`)
    revalidatePath(`/projects/${line.budgetVersion.projectId}/budget/${line.budgetVersionId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating line markup:', error)
    return { success: false, error: 'Error al actualizar margen' }
  }
}

export async function createBudgetLine(versionId: string, data: CreateBudgetLineInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const version = await prisma.budgetVersion.findFirst({
    where: { id: versionId, orgId: org.orgId },
    select: { id: true, projectId: true, status: true },
  })
  if (!version) return { error: { _form: ['Version not found'] } }
  try {
    const access = await assertProjectAccess(version.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { error: { _form: ['No tenés permiso para editar el presupuesto de este proyecto'] } }
    }
  } catch (e) {
    return { error: { _form: [e instanceof Error ? e.message : 'Acceso denegado'] } }
  }
  if (!isEditableVersion(version.status)) {
    return { error: { _form: ['Cannot add lines to locked/approved version.'] } }
  }

  const parsed = createBudgetLineSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const wbsNode = await prisma.wbsNode.findFirst({
    where: { id: parsed.data.wbsNodeId, projectId: version.projectId, orgId: org.orgId, active: true },
    select: { id: true },
  })
  if (!wbsNode) return { error: { wbsNodeId: ['WBS item must belong to this project.'] } }

  if (parsed.data.resourceId) {
    const resource = await prisma.resource.findFirst({
      where: { id: parsed.data.resourceId, orgId: org.orgId, active: true },
      select: { id: true },
    })
    if (!resource) return { error: { resourceId: ['Resource must belong to your organization.'] } }
  }

  const orgProfile = await prisma.orgProfile.findFirst({
    where: { orgId: org.orgId },
    select: { defaultIndirectCostPct: true },
  })
  const indirectPct = parsed.data.indirectCostPct ?? Number(orgProfile?.defaultIndirectCostPct ?? 0)
  const { directCost, totalCost } = calculateBudgetLineTotal(
    parsed.data.quantity,
    parsed.data.unitCost,
    indirectPct
  )
  const directCostTotal = directCost
  const maxSort = await prisma.budgetLine.aggregate({
    where: { budgetVersionId: versionId },
    _max: { sortOrder: true },
  })

  await prisma.$transaction(async (tx) => {
    const line = await tx.budgetLine.create({
      data: {
        orgId: org.orgId,
        budgetVersionId: versionId,
        wbsNodeId: parsed.data.wbsNodeId,
        description: parsed.data.description,
        unit: parsed.data.unit,
        quantity: new Prisma.Decimal(parsed.data.quantity),
        directCostTotal,
        salePriceTotal: totalCost,
        overheadPct: 0,
        financialPct: 0,
        profitPct: 0,
        taxPct: 0,
        retentionPct: 0,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'BUDGET_LINE.CREATED',
      entityType: 'BudgetLine',
      entityId: line.id,
      payload: { budgetVersionId: versionId, projectId: version.projectId },
    })
  })

  revalidatePath(`/projects/${version.projectId}/budget/${versionId}`)
  return { success: true }
}

export async function updateBudgetLine(lineId: string, data: UpdateBudgetLineInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const line = await prisma.budgetLine.findFirst({
    where: { id: lineId, orgId: org.orgId },
    include: { budgetVersion: { select: { id: true, projectId: true, status: true } } },
  })
  if (!line) return { error: { _form: ['Line not found'] } }
  try {
    const access = await assertProjectAccess(line.budgetVersion.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { error: { _form: ['No tenés permiso para editar el presupuesto de este proyecto'] } }
    }
  } catch (e) {
    return { error: { _form: [e instanceof Error ? e.message : 'Acceso denegado'] } }
  }
  if (!isEditableVersion(line.budgetVersion.status)) {
    return { error: { _form: ['Cannot edit lines in locked/approved version.'] } }
  }

  const parsed = updateBudgetLineSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const quantity = parsed.data.quantity ?? Number(line.quantity)
  const unitCost = parsed.data.unitCost ?? Number(line.directCostTotal) / (Number(line.quantity) || 1)
  const lineIndirect = (line as { indirectCostPct?: unknown }).indirectCostPct
  const indirectPct = parsed.data.indirectCostPct ?? (lineIndirect != null ? Number(lineIndirect) : 0)
  const { directCost, totalCost } = calculateBudgetLineTotal(quantity, unitCost, indirectPct)

  const hasMarginUpdates =
    parsed.data.overheadPct !== undefined ||
    parsed.data.financialPct !== undefined ||
    parsed.data.profitPct !== undefined ||
    parsed.data.taxPct !== undefined

  const overheadPct = parsed.data.overheadPct ?? Number(line.overheadPct ?? 0)
  const financialPct = parsed.data.financialPct ?? Number(line.financialPct ?? 0)
  const profitPct = parsed.data.profitPct ?? Number(line.profitPct ?? 0)
  const taxPct = parsed.data.taxPct ?? Number(line.taxPct ?? 0)

  const hasCostUpdates =
    parsed.data.quantity !== undefined ||
    parsed.data.unitCost !== undefined ||
    parsed.data.indirectCostPct !== undefined

  const directCostForSale = Number(hasCostUpdates ? directCost : line.directCostTotal)
  const qtyForSale = Number(quantity)
  const unitDirectForSale = qtyForSale > 0 ? directCostForSale / qtyForSale : 0
  const saleCalc = calculateBudgetLine(unitDirectForSale, overheadPct, financialPct, profitPct, taxPct)
  const salePriceTotal = hasMarginUpdates
    ? new Prisma.Decimal(Number(saleCalc.totalPrice) * qtyForSale)
    : totalCost

  await prisma.$transaction(async (tx) => {
    await tx.budgetLine.update({
      where: { id: lineId },
      data: {
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.unit !== undefined && { unit: parsed.data.unit }),
        ...(parsed.data.quantity !== undefined && { quantity: new Prisma.Decimal(parsed.data.quantity) }),
        ...(parsed.data.indirectCostPct !== undefined && { indirectCostPct: new Prisma.Decimal(parsed.data.indirectCostPct) }),
        ...(parsed.data.overheadPct !== undefined && { overheadPct: new Prisma.Decimal(parsed.data.overheadPct) }),
        ...(parsed.data.financialPct !== undefined && { financialPct: new Prisma.Decimal(parsed.data.financialPct) }),
        ...(parsed.data.profitPct !== undefined && { profitPct: new Prisma.Decimal(parsed.data.profitPct) }),
        ...(parsed.data.taxPct !== undefined && { taxPct: new Prisma.Decimal(parsed.data.taxPct) }),
        ...(hasCostUpdates && { directCostTotal: directCost }),
        salePriceTotal,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'BUDGET_LINE.UPDATED',
      entityType: 'BudgetLine',
      entityId: lineId,
      payload: { budgetVersionId: line.budgetVersionId, projectId: line.budgetVersion.projectId },
    })
  })

  revalidatePath(`/projects/${line.budgetVersion.projectId}/budget/${line.budgetVersionId}`)
  return { success: true }
}

export async function deleteBudgetLine(lineId: string) {
  await requirePermission('BUDGET', 'delete')
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const line = await prisma.budgetLine.findFirst({
    where: { id: lineId, orgId: org.orgId },
    include: { budgetVersion: { select: { id: true, projectId: true, status: true } } },
  })
  if (!line) throw new Error('Line not found')
  try {
    const access = await assertProjectAccess(line.budgetVersion.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      throw new Error('No tenés permiso para editar el presupuesto de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }
  if (!isEditableVersion(line.budgetVersion.status)) {
    throw new Error('Cannot delete lines in locked/approved version.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.budgetLine.delete({ where: { id: lineId } })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'BUDGET_LINE.DELETED',
      entityType: 'BudgetLine',
      entityId: lineId,
      payload: { budgetVersionId: line.budgetVersionId, projectId: line.budgetVersion.projectId },
    })
  })

  revalidatePath(`/projects/${line.budgetVersion.projectId}/budget/${line.budgetVersionId}`)
  return { success: true }
}

/** Copy a budget version and all its lines (new versionCode, new ids). */
export async function copyBudgetVersion(sourceVersionId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const source = await prisma.budgetVersion.findFirst({
    where: { id: sourceVersionId, orgId: org.orgId },
    include: { budgetLines: true },
  })
  if (!source) return { error: 'Version not found' }
  try {
    const access = await assertProjectAccess(source.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { error: 'No tenés permiso para editar el presupuesto de este proyecto' }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  const versionCode = await getNextVersionCode(source.projectId)
  const newVersion = await prisma.budgetVersion.create({
    data: {
      orgId: org.orgId,
      projectId: source.projectId,
      versionCode,
      versionType: 'WORKING',
      status: 'DRAFT',
      notes: `Copy of ${source.versionCode}`,
      createdByOrgMemberId: org.memberId,
    },
  })

  if (source.budgetLines.length > 0) {
    await prisma.budgetLine.createMany({
      data: source.budgetLines.map((l) => ({
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

  revalidatePath(`/projects/${source.projectId}/budget`)
  return { success: true, versionId: newVersion.id }
}

export async function listBudgetLines(versionId: string) {
  const { org } = await getAuthContext()
  const version = await prisma.budgetVersion.findFirst({
    where: { id: versionId, orgId: org.orgId },
    select: { id: true },
  })
  if (!version) return null

  const lines = await prisma.budgetLine.findMany({
    where: {
      budgetVersionId: versionId,
      wbsNode: { active: true },
    },
    orderBy: { sortOrder: 'asc' },
    include: {
      wbsNode: { select: { id: true, code: true, name: true } },
      resources: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          resourceType: true,
          description: true,
          unit: true,
          quantity: true,
          unitCost: true,
          totalCost: true,
          attributes: true,
        },
      },
    },
  })
  lines.sort((a, b) => {
    const c = a.wbsNode.code.localeCompare(b.wbsNode.code)
    return c !== 0 ? c : a.sortOrder - b.sortOrder
  })
  return lines.map((line) => serializeForClient(line))
}

/** Copy all lines from source version into target version (target must be DRAFT). */
export async function importLinesFromVersion(
  targetVersionId: string,
  sourceVersionId: string
) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const [target, source] = await Promise.all([
    prisma.budgetVersion.findFirst({
      where: { id: targetVersionId, orgId: org.orgId },
      include: { budgetLines: true },
    }),
    prisma.budgetVersion.findFirst({
      where: { id: sourceVersionId, orgId: org.orgId },
      include: { budgetLines: true },
    }),
  ])
  if (!target || !source) return { error: 'Version not found' }
  if (target.projectId !== source.projectId) return { error: 'Versions must belong to the same project' }
  if (!isEditableVersion(target.status)) return { error: 'Target version must be DRAFT' }
  try {
    const access = await assertProjectAccess(target.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { error: 'No tenés permiso para editar el presupuesto de este proyecto' }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  if (source.budgetLines.length === 0) return { success: true, count: 0 }

  const maxSort = await prisma.budgetLine.aggregate({
    where: { budgetVersionId: targetVersionId },
    _max: { sortOrder: true },
  })
  let sortOrder = (maxSort._max.sortOrder ?? -1) + 1

  await prisma.budgetLine.createMany({
    data: source.budgetLines.map((l) => ({
      orgId: org.orgId,
      budgetVersionId: targetVersionId,
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
      sortOrder: sortOrder++,
    })),
  })

  revalidatePath(`/projects/${target.projectId}/budget/${targetVersionId}`)
  return { success: true, count: source.budgetLines.length }
}

/** Get APU (Análisis de Precio Unitario) detail for a budget line. */
export async function getAPUDetail(lineId: string, versionId: string) {
  const { org } = await getAuthContext()

  const line = await prisma.budgetLine.findFirst({
    where: {
      id: lineId,
      budgetVersionId: versionId,
      orgId: org.orgId,
    },
    include: {
      wbsNode: { select: { code: true, name: true } },
      resource: {
        select: { code: true, name: true, unit: true, unitCost: true },
      },
      resources: {
        orderBy: { sortOrder: 'asc' },
        select: {
          description: true,
          unit: true,
          quantity: true,
          unitCost: true,
          totalCost: true,
        },
      },
    },
  })

  if (!line) throw new Error('Budget line not found')

  const qty = Number(line.quantity) || 1
  const total = Number(line.salePriceTotal ?? line.directCostTotal)
  const totalUnitPrice = qty > 0 ? total / qty : 0
  const indirectCostPct = Number(line.indirectCostPct ?? 0)
  let directCostFromResources = 0

  let resources: Array<{
    resourceCode: string
    resourceName: string
    resourceUnit: string
    quantityPerUnit: number
    unitCost: number
    subtotal: number
  }> = []

  if (line.resources.length > 0) {
    resources = line.resources.map((r) => ({
      resourceCode: r.description.slice(0, 20),
      resourceName: r.description,
      resourceUnit: r.unit,
      quantityPerUnit: Number(r.quantity),
      unitCost: Number(r.unitCost),
      subtotal: Number(r.totalCost),
    }))
    directCostFromResources = resources.reduce((s, r) => s + r.subtotal, 0)
  } else if (line.resource) {
    const unitCost = Number(line.resource.unitCost)
    const directPerUnit = Number(line.directCostTotal) / qty
    resources = [
      {
        resourceCode: line.resource.code,
        resourceName: line.resource.name,
        resourceUnit: line.resource.unit,
        quantityPerUnit: unitCost > 0 ? directPerUnit / unitCost : 1,
        unitCost,
        subtotal: Number(line.directCostTotal),
      },
    ]
  } else {
    const directPerUnit = Number(line.directCostTotal) / qty
    resources = [
      {
        resourceCode: '-',
        resourceName: line.description,
        resourceUnit: line.unit,
        quantityPerUnit: 1,
        unitCost: directPerUnit,
        subtotal: Number(line.directCostTotal),
      },
    ]
  }

  const directCost =
    directCostFromResources > 0
      ? directCostFromResources
      : Number(line.directCostTotal) / qty
  const indirectCost = directCost * (indirectCostPct / 100)

  return {
    wbsCode: line.wbsNode.code,
    wbsName: line.wbsNode.name,
    unit: line.unit,
    resources,
    directCost,
    indirectCostPct,
    indirectCost,
    totalUnitPrice,
  }
}

/** Get budget line with resources for APU editor. */
export async function getBudgetLineWithResources(budgetLineId: string) {
  const { org } = await getAuthContext()

  const line = await prisma.budgetLine.findFirst({
    where: { id: budgetLineId, orgId: org.orgId },
    include: {
      wbsNode: { select: { code: true, name: true } },
      budgetVersion: {
        select: {
          markupMode: true,
          globalOverheadPct: true,
          globalFinancialPct: true,
          globalProfitPct: true,
          globalTaxPct: true,
        },
      },
      resources: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          resourceType: true,
          description: true,
          unit: true,
          quantity: true,
          unitCost: true,
          totalCost: true,
          attributes: true,
        },
      },
    },
  })

  if (!line) return null

  const attrs = (r: { attributes: unknown }) =>
    (r.attributes && typeof r.attributes === 'object' ? (r.attributes as Record<string, unknown>) : {}) as Record<string, string | null>

  return {
    id: line.id,
    wbsNode: line.wbsNode,
    description: line.description,
    unit: line.unit,
    quantity: Number(line.quantity),
    overheadPct: Number(line.overheadPct ?? 0),
    financialPct: Number(line.financialPct ?? 0),
    profitPct: Number(line.profitPct ?? 0),
    taxPct: Number(line.taxPct ?? 0),
    markupMode: line.budgetVersion?.markupMode ?? 'SIMPLE',
    globalOverheadPct: Number(line.budgetVersion?.globalOverheadPct ?? 0),
    globalFinancialPct: Number(line.budgetVersion?.globalFinancialPct ?? 0),
    globalProfitPct: Number(line.budgetVersion?.globalProfitPct ?? 0),
    globalTaxPct: Number(line.budgetVersion?.globalTaxPct ?? 0),
    resources: line.resources.map((r) => ({
      id: r.id,
      type: r.resourceType,
      name: r.description,
      description: attrs(r).description ?? null,
      unit: r.unit,
      quantity: Number(r.quantity),
      unitCost: Number(r.unitCost),
      totalCost: Number(r.totalCost),
      supplierName: attrs(r).supplierName ?? null,
    })),
  }
}

async function recalcBudgetLineFromResources(budgetLineId: string) {
  const line = await prisma.budgetLine.findFirst({
    where: { id: budgetLineId },
    include: { resources: { select: { totalCost: true } } },
  })
  if (!line) return

  const directCostTotal = line.resources.reduce(
    (sum, r) => sum.add(r.totalCost),
    new Prisma.Decimal(0)
  )
  const qty = Number(line.quantity) || 1
  const unitDirect = qty > 0 ? Number(directCostTotal) / qty : 0
  const overheadPct = Number(line.overheadPct ?? 0)
  const financialPct = Number(line.financialPct ?? 0)
  const profitPct = Number(line.profitPct ?? 0)
  const taxPct = Number(line.taxPct ?? 21)
  const calc = calculateBudgetLine(unitDirect, overheadPct, financialPct, profitPct, taxPct)
  const salePriceTotal = new Prisma.Decimal(Number(calc.totalPrice) * qty)

  await prisma.budgetLine.update({
    where: { id: budgetLineId },
    data: { directCostTotal, salePriceTotal },
  })
}

export type AddBudgetResourceInput = {
  type: 'MATERIAL' | 'LABOR' | 'EQUIPMENT'
  name: string
  description?: string | null
  unit: string
  quantity: number
  unitCost: number
  supplierName?: string | null
}

/** Add a resource to a budget line (APU). */
export async function addBudgetResource(
  budgetLineId: string,
  data: AddBudgetResourceInput
): Promise<{ success: boolean; error?: string; resource?: { id: string; type: string; name: string; description: string | null; unit: string; quantity: number; unitCost: number; totalCost: number; supplierName: string | null } }> {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const line = await prisma.budgetLine.findFirst({
    where: { id: budgetLineId, orgId: org.orgId },
    include: {
      budgetVersion: { select: { status: true, projectId: true } },
      resources: { select: { totalCost: true } },
    },
  })
  if (!line) return { success: false, error: 'Línea no encontrada' }
  try {
    const access = await assertProjectAccess(line.budgetVersion.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { success: false, error: 'No tenés permiso para editar el presupuesto de este proyecto' }
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
  }
  if (!isEditableVersion(line.budgetVersion.status)) {
    return { success: false, error: 'No se puede editar esta versión' }
  }
  const validTypes = ['MATERIAL', 'LABOR', 'EQUIPMENT'] as const
  if (!validTypes.includes(data.type as (typeof validTypes)[number])) {
    return { success: false, error: 'Tipo de recurso inválido' }
  }

  const totalCost = new Prisma.Decimal(data.quantity * data.unitCost)
  const importedCap = line.importedDirectCostTotal != null ? Number(line.importedDirectCostTotal) : null
  if (importedCap != null) {
    const currentSum = line.resources.reduce((s, r) => s + Number(r.totalCost), 0)
    const newTotal = currentSum + Number(totalCost)
    if (newTotal > importedCap) {
      return {
        success: false,
        error: `La suma del desglose (materiales, mano de obra, equipos) no debe superar el valor importado (${importedCap.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}). Suma actual: ${newTotal.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}.`,
      }
    }
  }
  const maxSort = await prisma.budgetResource.aggregate({
    where: { budgetLineId },
    _max: { sortOrder: true },
  })

  const created = await prisma.$transaction(async (tx) => {
    const resource = await tx.budgetResource.create({
      data: {
        orgId: org.orgId,
        budgetLineId,
        resourceType: data.type,
        description: data.name.trim() || 'Recurso',
        unit: data.unit,
        quantity: new Prisma.Decimal(data.quantity),
        unitCost: new Prisma.Decimal(data.unitCost),
        totalCost,
        attributes: data.supplierName
          ? { supplierName: data.supplierName, description: data.description ?? null }
          : data.description
            ? { description: data.description }
            : {},
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'BUDGET_RESOURCE.ADDED',
      entityType: 'BudgetResource',
      entityId: resource.id,
      payload: { budgetLineId, projectId: line.budgetVersion.projectId, versionId: line.budgetVersionId },
    })
    return resource
  })

  await recalcBudgetLineFromResources(budgetLineId)
  revalidatePath(`/projects/${line.budgetVersion.projectId}/budget/${line.budgetVersionId}`)

  return {
    success: true,
    resource: {
      id: created.id,
      type: created.resourceType,
      name: created.description,
      description: (created.attributes as Record<string, string>)?.description ?? null,
      unit: created.unit,
      quantity: Number(created.quantity),
      unitCost: Number(created.unitCost),
      totalCost: Number(created.totalCost),
      supplierName: (created.attributes as Record<string, string>)?.supplierName ?? null,
    },
  }
}

/** Update a budget resource. */
export async function updateBudgetResource(
  resourceId: string,
  data: { name?: string; description?: string | null; unit?: string; quantity?: number; unitCost?: number; supplierName?: string | null }
): Promise<{ success: boolean; error?: string }> {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const resource = await prisma.budgetResource.findFirst({
    where: { id: resourceId, orgId: org.orgId },
    include: {
      budgetLine: {
        include: {
          budgetVersion: { select: { status: true, projectId: true } },
          resources: { select: { id: true, totalCost: true } },
        },
      },
    },
  })
  if (!resource) return { success: false, error: 'Recurso no encontrado' }
  try {
    const access = await assertProjectAccess(resource.budgetLine.budgetVersion.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { success: false, error: 'No tenés permiso para editar el presupuesto de este proyecto' }
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
  }
  if (!isEditableVersion(resource.budgetLine.budgetVersion.status)) {
    return { success: false, error: 'No se puede editar esta versión' }
  }

  const payload: { description?: string; unit?: string; quantity?: Prisma.Decimal; unitCost?: Prisma.Decimal; totalCost?: Prisma.Decimal; attributes?: object } = {}
  if (data.name !== undefined) payload.description = data.name.trim() || resource.description
  if (data.unit !== undefined) payload.unit = data.unit
  if (data.quantity !== undefined) payload.quantity = new Prisma.Decimal(data.quantity)
  if (data.unitCost !== undefined) payload.unitCost = new Prisma.Decimal(data.unitCost)
  if (data.quantity !== undefined || data.unitCost !== undefined) {
    const q = data.quantity ?? Number(resource.quantity)
    const u = data.unitCost ?? Number(resource.unitCost)
    payload.totalCost = new Prisma.Decimal(q * u)
  }
  const attrs = (resource.attributes && typeof resource.attributes === 'object' ? (resource.attributes as Record<string, unknown>) : {}) as Record<string, string | null>
  if (data.description !== undefined) attrs.description = data.description
  if (data.supplierName !== undefined) attrs.supplierName = data.supplierName
  payload.attributes = attrs

  const importedCap = resource.budgetLine.importedDirectCostTotal != null ? Number(resource.budgetLine.importedDirectCostTotal) : null
  if (importedCap != null) {
    const q = data.quantity ?? Number(resource.quantity)
    const u = data.unitCost ?? Number(resource.unitCost)
    const updatedResourceTotal = q * u
    const otherSum = resource.budgetLine.resources
      .filter((r) => r.id !== resourceId)
      .reduce((s, r) => s + Number(r.totalCost), 0)
    const newTotal = otherSum + updatedResourceTotal
    if (newTotal > importedCap) {
      return {
        success: false,
        error: `La suma del desglose no debe superar el valor importado (${importedCap.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}).`,
      }
    }
  }

  await prisma.budgetResource.update({
    where: { id: resourceId },
    data: payload,
  })

  await recalcBudgetLineFromResources(resource.budgetLineId)
  revalidatePath(`/projects/${resource.budgetLine.budgetVersion.projectId}/budget/${resource.budgetLine.budgetVersionId}`)
  return { success: true }
}

/** Delete a budget resource. */
export async function deleteBudgetResource(resourceId: string): Promise<{ success: boolean; error?: string }> {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const resource = await prisma.budgetResource.findFirst({
    where: { id: resourceId, orgId: org.orgId },
    include: { budgetLine: { include: { budgetVersion: { select: { status: true, projectId: true } } } } },
  })
  if (!resource) return { success: false, error: 'Recurso no encontrado' }
  try {
    const access = await assertProjectAccess(resource.budgetLine.budgetVersion.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { success: false, error: 'No tenés permiso para editar el presupuesto de este proyecto' }
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
  }
  if (!isEditableVersion(resource.budgetLine.budgetVersion.status)) {
    return { success: false, error: 'No se puede editar esta versión' }
  }

  const budgetLineId = resource.budgetLineId
  await prisma.budgetResource.delete({ where: { id: resourceId } })
  await recalcBudgetLineFromResources(budgetLineId)
  revalidatePath(`/projects/${resource.budgetLine.budgetVersion.projectId}/budget/${resource.budgetLine.budgetVersionId}`)
  return { success: true }
}

/** Update budget line quantity only; recalculates directCostTotal and salePriceTotal. */
export async function updateBudgetLineQuantity(
  budgetLineId: string,
  newQuantity: number
): Promise<{ success: boolean; error?: string }> {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  if (newQuantity <= 0 || !Number.isFinite(newQuantity)) {
    return { success: false, error: 'Cantidad inválida' }
  }

  const line = await prisma.budgetLine.findFirst({
    where: { id: budgetLineId, orgId: org.orgId },
    include: { budgetVersion: { select: { status: true, projectId: true } } },
  })
  if (!line) return { success: false, error: 'Línea no encontrada' }
  try {
    const access = await assertProjectAccess(line.budgetVersion.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.BUDGET)) {
      return { success: false, error: 'No tenés permiso para editar el presupuesto de este proyecto' }
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
  }
  if (!isEditableVersion(line.budgetVersion.status)) {
    return { success: false, error: 'No se puede editar cantidad en versión aprobada' }
  }

  const qty = Number(line.quantity) || 1
  const direct = Number(line.directCostTotal)
  const sale = Number(line.salePriceTotal ?? line.directCostTotal)
  const unitDirect = qty > 0 ? direct / qty : 0
  const unitSale = qty > 0 ? sale / qty : 0
  const newDirectCostTotal = new Prisma.Decimal(unitDirect * newQuantity)
  const newSalePriceTotal = new Prisma.Decimal(unitSale * newQuantity)

  await prisma.$transaction(async (tx) => {
    await tx.budgetLine.update({
      where: { id: budgetLineId },
      data: {
        quantity: new Prisma.Decimal(newQuantity),
        directCostTotal: newDirectCostTotal,
        salePriceTotal: newSalePriceTotal,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'BUDGET_LINE.UPDATED',
      entityType: 'BudgetLine',
      entityId: budgetLineId,
      payload: { budgetVersionId: line.budgetVersionId, projectId: line.budgetVersion.projectId },
    })
  })

  revalidatePath(`/projects/${line.budgetVersion.projectId}/budget`)
  revalidatePath(`/projects/${line.budgetVersion.projectId}/budget/${line.budgetVersionId}`)
  return { success: true }
}

/**
 * Id de la versión APPROVED o BASELINE del proyecto (para redirect a materiales, etc.).
 * Retorna null si no hay ninguna.
 */
export async function getApprovedOrBaselineVersionId(projectId: string): Promise<string | null> {
  try {
    const { org } = await getAuthContext()
    const version = await prisma.budgetVersion.findFirst({
      where: {
        projectId,
        orgId: org.orgId,
        status: { in: ['APPROVED', 'BASELINE'] },
      },
      orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    })
    return version?.id ?? null
  } catch {
    return null
  }
}

/**
 * Total de venta (con márgenes e IVA) de la versión APPROVED o BASELINE del proyecto.
 * Se usa en el resumen del proyecto para mostrar el presupuesto aprobado.
 */
export async function getApprovedOrBaselineBudgetTotal(projectId: string): Promise<number> {
  try {
    const { org } = await getAuthContext()
    const version = await prisma.budgetVersion.findFirst({
      where: {
        projectId,
        orgId: org.orgId,
        status: { in: ['APPROVED', 'BASELINE'] },
      },
      orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
      include: {
        budgetLines: {
          select: {
            directCostTotal: true,
            quantity: true,
            overheadPct: true,
            financialPct: true,
            profitPct: true,
            taxPct: true,
          },
        },
      },
    })
    if (!version?.budgetLines?.length) return 0
    let total = 0
    for (const line of version.budgetLines) {
      const qty = Number(line.quantity) || 1
      const unitDirect = qty > 0 ? Number(line.directCostTotal) / qty : 0
      const oh = Number(line.overheadPct ?? 0)
      const fin = Number(line.financialPct ?? 0)
      const prof = Number(line.profitPct ?? 0)
      const tax = Number(line.taxPct ?? 21)
      const calc = calculateBudgetLine(unitDirect, oh, fin, prof, tax)
      total += Number(calc.totalPrice) * qty
    }
    return total
  } catch {
    return 0
  }
}

/**
 * Totales de presupuesto (approved/baseline) para una lista de proyectos.
 * Misma fuente que la columna Presupuesto de la lista de proyectos.
 */
export async function getApprovedOrBaselineBudgetTotals(
  projectIds: string[]
): Promise<Record<string, number>> {
  if (projectIds.length === 0) return {}
  const results = await Promise.all(
    projectIds.map(async (id) => {
      const total = await getApprovedOrBaselineBudgetTotal(id)
      return { id, total }
    })
  )
  const record: Record<string, number> = {}
  for (const { id, total } of results) record[id] = total
  return record
}
