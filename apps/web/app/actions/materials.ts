'use server'

import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { Prisma } from '@repo/database'
import type { ConsolidatedMaterial, MaterialsBySupplier, MaterialLineForPO } from '@/lib/types/materials'
import { RESOURCE_TYPES } from '@/lib/constants/budget'

function getSupplierName(attributes: unknown): string | null {
  if (!attributes || typeof attributes !== 'object') return null
  const v = (attributes as Record<string, unknown>).supplierName
  return typeof v === 'string' ? v : null
}

/**
 * Obtener lista consolidada de materiales de una versión de presupuesto
 */
export async function getConsolidatedMaterials(budgetVersionId: string): Promise<ConsolidatedMaterial[]> {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) throw new Error('Unauthorized')
  const orgId = org.orgId

  const version = await prisma.budgetVersion.findFirst({
    where: { id: budgetVersionId, orgId },
    select: { status: true },
  })
  if (!version) throw new Error('Budget version not found')

  const resources = await prisma.budgetResource.findMany({
    where: {
      budgetLine: { budgetVersionId, orgId },
      resourceType: RESOURCE_TYPES.MATERIAL,
    },
    include: {
      budgetLine: {
        select: {
          quantity: true,
          wbsNode: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  const materialsMap = new Map<string, ConsolidatedMaterial>()

  for (const resource of resources) {
    const name = resource.description?.trim() || 'Sin nombre'
    const key = name.toLowerCase().trim()
    const supplierName = getSupplierName(resource.attributes)

    if (!materialsMap.has(key)) {
      materialsMap.set(key, {
        name,
        description: (resource.attributes && typeof resource.attributes === 'object'
          ? (resource.attributes as Record<string, unknown>).description as string | null
          : null) ?? null,
        unit: resource.unit,
        totalQuantity: 0,
        averageUnitCost: 0,
        totalCost: 0,
        suppliers: [],
        usedInItems: [],
      })
    }

    const material = materialsMap.get(key)!
    const lineQty = Number(resource.budgetLine.quantity) || 1
    const quantityNeeded = Number(resource.quantity) * lineQty
    const costForThisItem = quantityNeeded * Number(resource.unitCost)

    material.totalQuantity += quantityNeeded
    material.totalCost += costForThisItem

    if (supplierName) {
      const existing = material.suppliers.find((s) => s.name === supplierName)
      if (existing) {
        existing.quantity += quantityNeeded
      } else {
        material.suppliers.push({
          name: supplierName,
          quantity: quantityNeeded,
          unitCost: Number(resource.unitCost),
        })
      }
    }

    material.usedInItems.push({
      wbsCode: resource.budgetLine.wbsNode.code,
      wbsName: resource.budgetLine.wbsNode.name,
      quantity: quantityNeeded,
    })
  }

  const consolidated: ConsolidatedMaterial[] = []
  for (const material of materialsMap.values()) {
    if (material.totalQuantity > 0) {
      material.averageUnitCost = material.totalCost / material.totalQuantity
    }
    consolidated.push(material)
  }
  return consolidated
}

/**
 * Agrupar materiales por proveedor (solo recursos con supplierName en attributes)
 */
export async function getMaterialsBySupplier(budgetVersionId: string): Promise<MaterialsBySupplier[]> {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) throw new Error('Unauthorized')
  const orgId = org.orgId

  const resources = await prisma.budgetResource.findMany({
    where: {
      budgetLine: { budgetVersionId, orgId },
      resourceType: RESOURCE_TYPES.MATERIAL,
    },
    include: {
      budgetLine: { select: { quantity: true } },
    },
  })

  const suppliersMap = new Map<string, MaterialsBySupplier>()

  for (const resource of resources) {
    const supplierName = getSupplierName(resource.attributes)
    if (!supplierName) continue

    if (!suppliersMap.has(supplierName)) {
      suppliersMap.set(supplierName, {
        supplierName,
        totalCost: 0,
        materials: [],
      })
    }

    const supplier = suppliersMap.get(supplierName)!
    const lineQty = Number(resource.budgetLine.quantity) || 1
    const quantityNeeded = Number(resource.quantity) * lineQty
    const totalCost = quantityNeeded * Number(resource.unitCost)
    const name = resource.description?.trim() || 'Sin nombre'

    supplier.totalCost += totalCost
    const existing = supplier.materials.find((m) => m.name === name)
    if (existing) {
      existing.quantity += quantityNeeded
      existing.totalCost += totalCost
    } else {
      supplier.materials.push({
        name,
        unit: resource.unit,
        quantity: quantityNeeded,
        unitCost: Number(resource.unitCost),
        totalCost,
      })
    }
  }

  return Array.from(suppliersMap.values()).sort((a, b) => b.totalCost - a.totalCost)
}

/**
 * Generar pre-orden de compra para un proveedor (retorna datos para documento)
 */
export async function generatePurchaseOrder(
  budgetVersionId: string,
  supplierName: string
): Promise<
  | { success: true; data: { project: { name: string; projectNumber: string; clientName: string | null }; versionCode: string; supplier: MaterialsBySupplier; generatedAt: Date } }
  | { success: false; error: string }
> {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }
  const orgId = org.orgId

  try {
    const version = await prisma.budgetVersion.findFirst({
      where: { id: budgetVersionId, orgId },
      include: {
        project: { select: { name: true, projectNumber: true, clientName: true } },
      },
    })
    if (!version) return { success: false, error: 'Budget version not found' }

    const bySupplier = await getMaterialsBySupplier(budgetVersionId)
    const supplier = bySupplier.find((s) => s.supplierName === supplierName)
    if (!supplier) return { success: false, error: 'Supplier not found' }

    return {
      success: true,
      data: {
        project: version.project,
        versionCode: version.versionCode,
        supplier,
        generatedAt: new Date(),
      },
    }
  } catch (error) {
    console.error('Error generating purchase order:', error)
    return { success: false, error: 'Error al generar orden de compra' }
  }
}

/**
 * Get material line items for purchase order (one per budget resource, with WBS for traceability).
 */
export async function getMaterialsForPurchaseOrder(
  budgetVersionId: string
): Promise<MaterialLineForPO[]> {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) throw new Error('Unauthorized')

  const version = await prisma.budgetVersion.findFirst({
    where: { id: budgetVersionId, orgId: org.orgId },
    select: { id: true },
  })
  if (!version) throw new Error('Budget version not found')

  const resources = await prisma.budgetResource.findMany({
    where: {
      budgetLine: { budgetVersionId, orgId: org.orgId },
      resourceType: RESOURCE_TYPES.MATERIAL,
    },
    include: {
      budgetLine: {
        select: {
          quantity: true,
          wbsNode: { select: { id: true, code: true, name: true } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  const result: MaterialLineForPO[] = []
  for (const r of resources) {
    const lineQty = Number(r.budgetLine.quantity) || 1
    const quantity = Number(r.quantity) * lineQty
    const unitCost = Number(r.unitCost)
    const totalCost = quantity * unitCost
    result.push({
      budgetResourceId: r.id,
      wbsNodeId: r.budgetLine.wbsNode.id,
      wbsCode: r.budgetLine.wbsNode.code,
      wbsName: r.budgetLine.wbsNode.name,
      description: r.description?.trim() || 'Sin nombre',
      unit: r.unit,
      quantity,
      unitCost,
      totalCost,
      supplierName: getSupplierName(r.attributes),
    })
  }
  return result
}

export type CreatePurchaseOrderCommitmentInput = {
  projectId: string
  partyId: string
  issueDate: string
  description?: string | null
  lines: Array<{
    wbsNodeId: string
    description: string
    unit: string
    quantity: number
    unitPrice: number
  }>
}

/**
 * Create a purchase order (Commitment type PO) with lines linked to WBS for traceability.
 */
export async function createPurchaseOrderCommitment(
  input: CreatePurchaseOrderCommitmentInput
): Promise<{ success: true; commitmentId: string; commitmentNumber: string } | { success: false; error: string }> {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'No organization' }

  const { projectId, partyId, issueDate, description, lines } = input
  if (!lines.length) return { success: false, error: 'Debe incluir al menos una línea' }

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  const party = await prisma.party.findFirst({
    where: { id: partyId, orgId: org.orgId },
    select: { id: true },
  })
  if (!party) return { success: false, error: 'Proveedor no encontrado' }

  const wbsIds = [...new Set(lines.map((l) => l.wbsNodeId))]
  const wbsNodes = await prisma.wbsNode.findMany({
    where: { id: { in: wbsIds }, projectId, orgId: org.orgId },
    select: { id: true },
  })
  const wbsSet = new Set(wbsNodes.map((n) => n.id))
  for (const l of lines) {
    if (!wbsSet.has(l.wbsNodeId)) return { success: false, error: `WBS no válido para este proyecto: ${l.wbsNodeId}` }
  }

  const existing = await prisma.commitment.findMany({
    where: { orgId: org.orgId, commitmentType: 'PO', deleted: false },
    orderBy: { commitmentNumber: 'desc' },
    take: 1,
    select: { commitmentNumber: true },
  })
  const nextNum = existing.length
    ? (parseInt(existing[0].commitmentNumber.replace(/^OC-?/i, ''), 10) || 0) + 1
    : 1
  const commitmentNumber = `OC-${String(nextNum).padStart(4, '0')}`

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)

  try {
    const commitment = await prisma.commitment.create({
      data: {
        orgId: org.orgId,
        projectId,
        partyId,
        commitmentType: 'PO',
        commitmentNumber,
        status: 'DRAFT',
        issueDate: new Date(issueDate),
        description: description ?? undefined,
        total: new Prisma.Decimal(total),
        currency: 'USD',
        totalBaseCurrency: new Prisma.Decimal(total),
        createdByOrgMemberId: org.memberId,
        lines: {
          create: lines.map((l, i) => ({
            orgId: org.orgId,
            wbsNodeId: l.wbsNodeId,
            description: l.description,
            unit: l.unit,
            quantity: new Prisma.Decimal(l.quantity),
            unitPrice: new Prisma.Decimal(l.unitPrice),
            lineTotal: new Prisma.Decimal(l.quantity * l.unitPrice),
            sortOrder: i,
          })),
        },
      },
      select: { id: true, commitmentNumber: true },
    })
    return { success: true, commitmentId: commitment.id, commitmentNumber: commitment.commitmentNumber }
  } catch (e) {
    console.error('createPurchaseOrderCommitment:', e)
    return { success: false, error: 'Error al crear la orden de compra' }
  }
}

// ====================
// LIST & DETAIL PURCHASE ORDERS (Commitments PO)
// ====================

export type ProjectPurchaseOrdersFilters = {
  status?: string // '' | 'DRAFT' | 'APPROVED' etc
  partyId?: string
  dateFrom?: string
  dateTo?: string
}

export type ProjectPurchaseOrderRow = {
  id: string
  commitmentNumber: string
  issueDate: Date
  status: string
  partyId: string
  partyName: string
  total: number
  currency: string
  description: string | null
}

export async function getProjectPurchaseOrders(
  projectId: string,
  filters: ProjectPurchaseOrdersFilters = {}
): Promise<ProjectPurchaseOrderRow[]> {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) throw new Error('Unauthorized')

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) throw new Error('Proyecto no encontrado')

  const where: {
    projectId: string
    orgId: string
    commitmentType: string
    deleted: boolean
    status?: string | { in: string[] }
    partyId?: string
    issueDate?: { gte?: Date; lte?: Date }
  } = {
    projectId,
    orgId: org.orgId,
    commitmentType: 'PO',
    deleted: false,
  }
  if (filters.status && filters.status !== 'all') {
    where.status = filters.status
  }
  if (filters.partyId) where.partyId = filters.partyId
  if (filters.dateFrom || filters.dateTo) {
    where.issueDate = {}
    if (filters.dateFrom) where.issueDate.gte = new Date(filters.dateFrom)
    if (filters.dateTo) {
      const d = new Date(filters.dateTo)
      d.setHours(23, 59, 59, 999)
      where.issueDate.lte = d
    }
  }

  const list = await prisma.commitment.findMany({
    where,
    include: {
      party: { select: { id: true, name: true } },
    },
    orderBy: [{ issueDate: 'desc' }, { commitmentNumber: 'desc' }],
  })

  return list.map((c) => ({
    id: c.id,
    commitmentNumber: c.commitmentNumber,
    issueDate: c.issueDate,
    status: c.status,
    partyId: c.partyId,
    partyName: c.party.name,
    total: Number(c.totalBaseCurrency ?? c.total),
    currency: c.currency,
    description: c.description,
  }))
}

export type CommitmentDetailWithLines = {
  id: string
  commitmentNumber: string
  issueDate: Date
  status: string
  partyId: string
  partyName: string
  total: number
  currency: string
  description: string | null
  projectId: string
  lines: Array<{
    id: string
    description: string
    unit: string | null
    quantity: number
    unitPrice: number
    lineTotal: number
    wbsNodeId: string | null
    wbsCode: string | null
    wbsName: string | null
  }>
}

export async function getCommitmentById(commitmentId: string): Promise<CommitmentDetailWithLines | null> {
  const session = await getSession()
  if (!session?.user?.id) return null

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return null

  const c = await prisma.commitment.findFirst({
    where: { id: commitmentId, orgId: org.orgId, commitmentType: 'PO', deleted: false },
    include: {
      party: { select: { id: true, name: true } },
      lines: {
        include: { wbsNode: { select: { id: true, code: true, name: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
  if (!c) return null

  return {
    id: c.id,
    commitmentNumber: c.commitmentNumber,
    issueDate: c.issueDate,
    status: c.status,
    partyId: c.partyId,
    partyName: c.party.name,
    total: Number(c.totalBaseCurrency ?? c.total),
    currency: c.currency,
    description: c.description,
    projectId: c.projectId,
    lines: c.lines.map((l) => ({
      id: l.id,
      description: l.description,
      unit: l.unit,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
      wbsNodeId: l.wbsNodeId,
      wbsCode: l.wbsNode?.code ?? null,
      wbsName: l.wbsNode?.name ?? null,
    })),
  }
}
