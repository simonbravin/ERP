'use server'

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { requireRole } from '@/lib/rbac'
import { requirePermission, requireOrgFinanceAccess } from '@/lib/auth-helpers'
import { publishOutboxEvent } from '@/lib/events/event-publisher'
import { toBaseAmount } from '@/lib/currency-utils'
import { serializeTransaction } from './finance-helpers'
import { getApprovedOrBaselineBudgetTotals } from './budget'

export async function createCompanyTransaction(data: {
  type: 'EXPENSE' | 'INCOME' | 'OVERHEAD'
  documentType?: string
  partyId?: string
  description: string
  issueDate: Date
  dueDate?: Date
  currency?: string
  subtotal: number
  taxTotal?: number
  total: number
  reference?: string
  retentionAmount?: number
  adjustmentAmount?: number
  adjustmentNotes?: string
}) {
  await requirePermission('FINANCE', 'create')
  const { org } = await requireOrgFinanceAccess()
  requireRole(org.role, 'ACCOUNTANT')
  if (data.partyId) {
    const party = await prisma.party.findFirst({
      where: { id: data.partyId, orgId: org.orgId },
      select: { id: true },
    })
    if (!party) throw new Error('Proveedor/Cliente no encontrado')
  }
  const last = await prisma.financeTransaction.findFirst({
    where: { orgId: org.orgId },
    orderBy: { transactionNumber: 'desc' },
    select: { transactionNumber: true },
  })
  const lastNum = last?.transactionNumber?.match(/\d+$/)?.[0] ?? '0'
  const transactionNumber = `TXN-${String(Number(lastNum) + 1).padStart(6, '0')}`
  const currency = data.currency ?? 'ARS'
  let rateToArs = 1
  if (currency !== 'ARS') {
    const rate = await prisma.exchangeRate.findFirst({
      where: { fromCurrency: currency, toCurrency: 'ARS', effectiveDate: { lte: data.issueDate } },
      orderBy: { effectiveDate: 'desc' },
    })
    rateToArs = rate ? Number(rate.rate) : 1
  }
  const totalDec = new Prisma.Decimal(data.total)
  const amountBaseCurrency = toBaseAmount(totalDec, rateToArs)
  const tx = await prisma.$transaction(async (db) => {
    const created = await db.financeTransaction.create({
      data: {
        orgId: org.orgId,
        projectId: null,
        type: data.type,
        documentType: data.documentType ?? 'INVOICE',
        status: 'DRAFT',
        transactionNumber,
        partyId: data.partyId ?? undefined,
        description: data.description,
        issueDate: data.issueDate,
        dueDate: data.dueDate ?? undefined,
        currency,
        subtotal: new Prisma.Decimal(data.subtotal),
        taxTotal: new Prisma.Decimal(data.taxTotal ?? 0),
        total: totalDec,
        amountBaseCurrency,
        retentionAmount: new Prisma.Decimal(data.retentionAmount ?? 0),
        adjustmentAmount: new Prisma.Decimal(data.adjustmentAmount ?? 0),
        adjustmentNotes: data.adjustmentNotes ?? undefined,
        exchangeRateSnapshot: { rate: rateToArs, baseCurrency: 'ARS' } as object,
        reference: data.reference ?? undefined,
        createdByOrgMemberId: org.memberId,
      },
      include: { party: true },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.CREATED',
      entityType: 'FinanceTransaction',
      entityId: created.id,
      payload: { type: created.type, transactionNumber: created.transactionNumber },
    })
    return created
  })
  revalidatePath('/finance')
  revalidatePath('/finance/transactions')
  return { success: true, transaction: serializeTransaction(tx) }
}

export async function allocateOverhead(
  transactionId: string,
  allocations: Array<{ projectId: string; allocationPct: number }>
) {
  const { org } = await requireOrgFinanceAccess()
  requireRole(org.role, 'ACCOUNTANT')
  const tx = await prisma.financeTransaction.findFirst({
    where: { id: transactionId, orgId: org.orgId, deleted: false },
    select: { id: true, projectId: true, total: true },
  })
  if (!tx) throw new Error('Transacción no encontrada')
  if (tx.projectId != null) throw new Error('Solo se puede asignar gastos generales a transacciones sin proyecto')

  if (allocations.length === 0) {
    await prisma.$transaction(async (db) => {
      await db.overheadAllocation.deleteMany({ where: { transactionId } })
      await publishOutboxEvent(db, {
        orgId: org.orgId,
        eventType: 'OVERHEAD_ALLOCATION.UPDATED',
        entityType: 'FinanceTransaction',
        entityId: transactionId,
        payload: { allocationCount: 0 },
      })
    })
    revalidatePath('/finance')
    revalidatePath('/finance/overhead')
    return { success: true }
  }

  const totalPct = allocations.reduce((s, a) => s + a.allocationPct, 0)
  if (Math.abs(totalPct - 100) > 0.01) throw new Error('La suma de porcentajes debe ser 100%')
  const projectIds = allocations.map((a) => a.projectId)
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds }, orgId: org.orgId },
    select: { id: true },
  })
  if (projects.length !== projectIds.length) throw new Error('Uno o más proyectos no encontrados')
  await prisma.$transaction(async (db) => {
    await db.overheadAllocation.deleteMany({ where: { transactionId } })
    const totalAmount = Number(tx.total)
    await db.overheadAllocation.createMany({
      data: allocations.map((a) => ({
        orgId: org.orgId,
        transactionId,
        projectId: a.projectId,
        allocationPct: new Prisma.Decimal(a.allocationPct),
        allocationAmount: new Prisma.Decimal((totalAmount * a.allocationPct) / 100),
      })),
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'OVERHEAD_ALLOCATION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: transactionId,
      payload: { allocationCount: allocations.length },
    })
  })
  revalidatePath('/finance')
  revalidatePath('/finance/overhead')
  return { success: true }
}

/** Total de presupuesto (approved/baseline) por proyecto; misma fuente que la columna Presupuesto de la lista. */
export async function getApprovedBudgetTotalByProject(
  projectIds: string[]
): Promise<Record<string, number>> {
  return getApprovedOrBaselineBudgetTotals(projectIds)
}

/** Total de gastos generales asignados a un proyecto (suma de allocationAmount). */
export async function getOverheadAllocatedToProject(projectId: string): Promise<number> {
  const { org } = await requireOrgFinanceAccess()
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return 0
  const result = await prisma.overheadAllocation.aggregate({
    where: { projectId, orgId: org.orgId },
    _sum: { allocationAmount: true },
  })
  return Number(result._sum.allocationAmount ?? 0)
}

/**
 * Presupuesto de generales (cotizado) del proyecto: total costo directo del presupuesto
 * APPROVED/BASELINE × globalOverheadPct / 100 (márgenes globales).
 */
export async function getProjectOverheadBudgeted(projectId: string): Promise<number> {
  const { org } = await requireOrgFinanceAccess()
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return 0
  const version = await prisma.budgetVersion.findFirst({
    where: {
      projectId,
      orgId: org.orgId,
      status: { in: ['APPROVED', 'BASELINE'] },
    },
    orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
    select: {
      globalOverheadPct: true,
      budgetLines: { select: { directCostTotal: true } },
    },
  })
  if (!version?.budgetLines?.length) return 0
  const totalDirectCost = version.budgetLines.reduce(
    (s, l) => s + Number(l.directCostTotal),
    0
  )
  const pct = Number(version.globalOverheadPct ?? 0)
  return totalDirectCost * (pct / 100)
}

/**
 * Consumo de generales del proyecto: asignaciones de empresa a este proyecto
 * + transacciones OVERHEAD con projectId = este proyecto.
 */
export async function getProjectOverheadConsumed(projectId: string): Promise<number> {
  const allocated = await getOverheadAllocatedToProject(projectId)
  const { org } = await requireOrgFinanceAccess()
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return allocated
  const result = await prisma.financeTransaction.aggregate({
    where: {
      projectId,
      orgId: org.orgId,
      deleted: false,
      type: 'OVERHEAD',
    },
    _sum: { amountBaseCurrency: true },
  })
  const projectOverhead = Number(result._sum.amountBaseCurrency ?? 0)
  return allocated + projectOverhead
}

export type ProjectOverheadItem = {
  id: string
  /** Para allocation es allocationId; para project es transactionId. */
  transactionId?: string
  source: 'allocation' | 'project'
  transactionNumber: string
  description: string
  issueDate: Date
  amount: number
  partyName: string | null
}

/** Lista de generales que consumen el proyecto: asignaciones de empresa + transacciones OVERHEAD del proyecto. */
export async function getProjectOverheadItems(projectId: string): Promise<ProjectOverheadItem[]> {
  const { org } = await requireOrgFinanceAccess()
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return []

  const [allocations, projectTx] = await Promise.all([
    prisma.overheadAllocation.findMany({
      where: { projectId, orgId: org.orgId },
      include: {
        transaction: {
          select: {
            transactionNumber: true,
            description: true,
            issueDate: true,
            party: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.financeTransaction.findMany({
      where: {
        projectId,
        orgId: org.orgId,
        deleted: false,
        type: 'OVERHEAD',
      },
      include: { party: { select: { name: true } } },
      orderBy: { issueDate: 'desc' },
    }),
  ])

  const allocationItems: ProjectOverheadItem[] = allocations.map((a) => ({
    id: a.id,
    transactionId: a.transactionId,
    source: 'allocation',
    transactionNumber: a.transaction.transactionNumber,
    description: a.transaction.description,
    issueDate: a.transaction.issueDate,
    amount: Number(a.allocationAmount),
    partyName: a.transaction.party?.name ?? null,
  }))

  const projectItems: ProjectOverheadItem[] = projectTx.map((t) => ({
    id: t.id,
    transactionId: t.id,
    source: 'project',
    transactionNumber: t.transactionNumber,
    description: t.description,
    issueDate: t.issueDate,
    amount: Number(t.amountBaseCurrency),
    partyName: t.party?.name ?? null,
  }))

  const combined = [...allocationItems, ...projectItems]
  combined.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime())
  return combined
}

// ====================
// LISTAR TRANSACCIONES OVERHEAD (con asignaciones)
// ====================

export type OverheadTransactionWithAllocations = {
  id: string
  type: string
  transactionNumber: string
  description: string
  issueDate: Date
  total: number
  currency: string
  party: { name: string } | null
  allocations: Array<{
    id: string
    projectId: string
    projectName: string
    projectNumber: string
    allocationPct: number
    allocationAmount: number
  }>
  totalAllocatedPct: number
  totalAllocatedAmount: number
  remainingAmount: number
  status: 'unallocated' | 'partial' | 'complete'
}

export async function getOverheadTransactions(): Promise<OverheadTransactionWithAllocations[]> {
  const { org } = await requireOrgFinanceAccess()
  const transactions = await prisma.financeTransaction.findMany({
    where: {
      orgId: org.orgId,
      projectId: null,
      type: { in: ['OVERHEAD', 'EXPENSE'] },
      deleted: false,
    },
    include: {
      party: { select: { name: true } },
      overheadAllocations: {
        include: {
          project: { select: { id: true, name: true, projectNumber: true } },
        },
        orderBy: { createdAt: 'desc' as const },
      },
    },
    orderBy: { issueDate: 'desc' },
  })

  return transactions.map((tx) => {
    const totalAllocatedPct = tx.overheadAllocations.reduce(
      (sum, a) => sum + Number(a.allocationPct),
      0
    )
    const totalAllocatedAmount = tx.overheadAllocations.reduce(
      (sum, a) => sum + Number(a.allocationAmount),
      0
    )
    const totalNum = Number(tx.total)
    const remainingAmount = totalNum - totalAllocatedAmount
    let status: 'unallocated' | 'partial' | 'complete' = 'unallocated'
    if (totalAllocatedPct >= 100) status = 'complete'
    else if (totalAllocatedPct > 0) status = 'partial'

    return {
      id: tx.id,
      type: tx.type,
      transactionNumber: tx.transactionNumber,
      description: tx.description,
      issueDate: tx.issueDate,
      total: totalNum,
      currency: tx.currency,
      party: tx.party,
      allocations: tx.overheadAllocations.map((a) => ({
        id: a.id,
        projectId: a.projectId,
        projectName: a.project.name,
        projectNumber: a.project.projectNumber,
        allocationPct: Number(a.allocationPct),
        allocationAmount: Number(a.allocationAmount),
      })),
      totalAllocatedPct,
      totalAllocatedAmount,
      remainingAmount,
      status,
    }
  })
}

// ====================
// DASHBOARD DE OVERHEAD
// ====================

export type OverheadDashboard = {
  totalOverhead: number
  totalAllocated: number
  unallocated: number
  unallocatedTransactions: number
  partiallyAllocated: number
  topProjects: Array<{
    projectId: string
    projectName: string
    projectNumber: string
    totalOverhead: number
  }>
}

export async function getOverheadDashboard(): Promise<OverheadDashboard> {
  const { org } = await requireOrgFinanceAccess()
  const overheadTransactions = await prisma.financeTransaction.findMany({
    where: {
      orgId: org.orgId,
      projectId: null,
      type: 'OVERHEAD',
      deleted: false,
    },
    include: {
      overheadAllocations: { select: { allocationAmount: true } },
    },
  })

  const totalOverhead = overheadTransactions.reduce((sum, tx) => sum + Number(tx.total), 0)
  const totalAllocated = overheadTransactions.reduce(
    (sum, tx) =>
      sum +
      tx.overheadAllocations.reduce((s, a) => s + Number(a.allocationAmount), 0),
    0
  )
  const unallocated = totalOverhead - totalAllocated

  const unallocatedTransactions = overheadTransactions.filter((tx) => {
    const allocated = tx.overheadAllocations.reduce((s, a) => s + Number(a.allocationAmount), 0)
    return allocated === 0
  }).length

  const partiallyAllocated = overheadTransactions.filter((tx) => {
    const allocated = tx.overheadAllocations.reduce((s, a) => s + Number(a.allocationAmount), 0)
    const total = Number(tx.total)
    return allocated > 0 && allocated < total
  }).length

  const projectAllocations = await prisma.overheadAllocation.groupBy({
    by: ['projectId'],
    where: { orgId: org.orgId },
    _sum: { allocationAmount: true },
  })
  const sorted = [...projectAllocations].sort(
    (a, b) => (Number(b._sum.allocationAmount ?? 0) - Number(a._sum.allocationAmount ?? 0))
  )
  const top5 = sorted.slice(0, 5)
  const projectIds = top5.map((p) => p.projectId)
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds }, orgId: org.orgId },
    select: { id: true, name: true, projectNumber: true },
  })
  const topProjects = top5.map((p) => {
    const project = projects.find((pr) => pr.id === p.projectId)
    return {
      projectId: p.projectId,
      projectName: project?.name ?? 'Proyecto eliminado',
      projectNumber: project?.projectNumber ?? '—',
      totalOverhead: Number(p._sum.allocationAmount ?? 0),
    }
  })

  return {
    totalOverhead,
    totalAllocated,
    unallocated,
    unallocatedTransactions,
    partiallyAllocated,
    topProjects,
  }
}

// ====================
// ELIMINAR ASIGNACIÓN
// ====================

export async function deleteOverheadAllocation(allocationId: string) {
  await requirePermission('FINANCE', 'edit')
  const { org } = await requireOrgFinanceAccess()
  requireRole(org.role, 'ACCOUNTANT')
  const allocation = await prisma.overheadAllocation.findUnique({
    where: { id: allocationId },
    select: { orgId: true, transactionId: true },
  })
  if (!allocation || allocation.orgId !== org.orgId) throw new Error('Asignación no encontrada')
  await prisma.$transaction(async (db) => {
    await db.overheadAllocation.delete({ where: { id: allocationId } })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'OVERHEAD_ALLOCATION.DELETED',
      entityType: 'OverheadAllocation',
      entityId: allocationId,
      payload: { transactionId: allocation.transactionId },
    })
  })
  revalidatePath('/finance/overhead')
  return { success: true }
}

// ====================
// ACTUALIZAR ASIGNACIÓN
// ====================

export async function updateOverheadAllocation(
  allocationId: string,
  data: { allocationPct: number; notes?: string }
) {
  await requirePermission('FINANCE', 'edit')
  const { org } = await requireOrgFinanceAccess()
  requireRole(org.role, 'ACCOUNTANT')
  const allocation = await prisma.overheadAllocation.findUnique({
    where: { id: allocationId },
    include: { transaction: { select: { total: true } } },
  })
  if (!allocation || allocation.orgId !== org.orgId) throw new Error('Asignación no encontrada')
  const newAmount = (Number(allocation.transaction.total) * data.allocationPct) / 100
  await prisma.$transaction(async (db) => {
    await db.overheadAllocation.update({
      where: { id: allocationId },
      data: {
        allocationPct: new Prisma.Decimal(data.allocationPct),
        allocationAmount: new Prisma.Decimal(newAmount),
        notes: data.notes,
      },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'OVERHEAD_ALLOCATION.UPDATED',
      entityType: 'OverheadAllocation',
      entityId: allocationId,
      payload: { transactionId: allocation.transactionId },
    })
  })
  revalidatePath('/finance/overhead')
  return { success: true }
}
