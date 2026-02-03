'use server'

import { redirectToLogin } from '@/lib/i18n-redirect'
import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { requireRole } from '@/lib/rbac'
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
async function getAuthContext() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()
  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()
  return { session, org }
}

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
  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return null

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
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

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
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const version = await prisma.budgetVersion.findFirst({
    where: { id: versionId, orgId: org.orgId },
    select: { id: true, projectId: true },
  })
  if (!version) return { error: 'Version not found' }

  await prisma.budgetVersion.update({
    where: { id: versionId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedByOrgMemberId: org.memberId,
    },
  })

  revalidatePath(`/projects/${version.projectId}/budget`)
  revalidatePath(`/projects/${version.projectId}/budget/${versionId}`)
  return { success: true }
}

export async function createBudgetLine(versionId: string, data: CreateBudgetLineInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const version = await prisma.budgetVersion.findFirst({
    where: { id: versionId, orgId: org.orgId },
    select: { id: true, projectId: true, status: true },
  })
  if (!version) return { error: { _form: ['Version not found'] } }
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

  await prisma.budgetLine.create({
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

  await prisma.budgetLine.update({
    where: { id: lineId },
    data: {
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.unit !== undefined && { unit: parsed.data.unit }),
      ...(parsed.data.quantity !== undefined && { quantity: new Prisma.Decimal(parsed.data.quantity) }),
      ...(parsed.data.indirectCostPct !== undefined && { indirectCostPct: new Prisma.Decimal(parsed.data.indirectCostPct) }),
      directCostTotal: directCost,
      salePriceTotal: totalCost,
    },
  })

  revalidatePath(`/projects/${line.budgetVersion.projectId}/budget/${line.budgetVersionId}`)
  return { success: true }
}

export async function deleteBudgetLine(lineId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const line = await prisma.budgetLine.findFirst({
    where: { id: lineId, orgId: org.orgId },
    include: { budgetVersion: { select: { id: true, projectId: true, status: true } } },
  })
  if (!line) throw new Error('Line not found')
  if (!isEditableVersion(line.budgetVersion.status)) {
    throw new Error('Cannot delete lines in locked/approved version.')
  }

  await prisma.budgetLine.delete({ where: { id: lineId } })

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
    where: { budgetVersionId: versionId },
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
  return lines
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
    include: { budgetVersion: { select: { status: true, projectId: true } } },
  })
  if (!line) return { success: false, error: 'Línea no encontrada' }
  if (!isEditableVersion(line.budgetVersion.status)) {
    return { success: false, error: 'No se puede editar esta versión' }
  }
  const validTypes = ['MATERIAL', 'LABOR', 'EQUIPMENT'] as const
  if (!validTypes.includes(data.type as (typeof validTypes)[number])) {
    return { success: false, error: 'Tipo de recurso inválido' }
  }

  const totalCost = new Prisma.Decimal(data.quantity * data.unitCost)
  const maxSort = await prisma.budgetResource.aggregate({
    where: { budgetLineId },
    _max: { sortOrder: true },
  })

  const created = await prisma.budgetResource.create({
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
    include: { budgetLine: { include: { budgetVersion: { select: { status: true, projectId: true } } } } },
  })
  if (!resource) return { success: false, error: 'Recurso no encontrado' }
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

  await prisma.budgetLine.update({
    where: { id: budgetLineId },
    data: {
      quantity: new Prisma.Decimal(newQuantity),
      directCostTotal: newDirectCostTotal,
      salePriceTotal: newSalePriceTotal,
    },
  })

  revalidatePath(`/projects/${line.budgetVersion.projectId}/budget`)
  revalidatePath(`/projects/${line.budgetVersion.projectId}/budget/${line.budgetVersionId}`)
  return { success: true }
}
