'use server'

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { requireRole } from '@/lib/rbac'
import { requirePermission, getAuthContext } from '@/lib/auth-helpers'
import { publishOutboxEvent } from '@/lib/events/event-publisher'
import { toBaseAmount } from '@/lib/currency-utils'
import { serializeTransaction } from './finance-helpers'

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
  const { org } = await getAuthContext()
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
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')
  const totalPct = allocations.reduce((s, a) => s + a.allocationPct, 0)
  if (Math.abs(totalPct - 100) > 0.01) throw new Error('La suma de porcentajes debe ser 100%')
  const tx = await prisma.financeTransaction.findFirst({
    where: { id: transactionId, orgId: org.orgId, deleted: false },
    select: { id: true, projectId: true, total: true },
  })
  if (!tx) throw new Error('Transacción no encontrada')
  if (tx.projectId != null) throw new Error('Solo se puede asignar overhead a transacciones sin proyecto')
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

// ====================
// LISTAR TRANSACCIONES OVERHEAD (con asignaciones)
// ====================

export type OverheadTransactionWithAllocations = {
  id: string
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
  const { org } = await getAuthContext()
  const transactions = await prisma.financeTransaction.findMany({
    where: {
      orgId: org.orgId,
      projectId: null,
      type: 'OVERHEAD',
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
  const { org } = await getAuthContext()
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
  const { org } = await getAuthContext()
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
  const { org } = await getAuthContext()
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
