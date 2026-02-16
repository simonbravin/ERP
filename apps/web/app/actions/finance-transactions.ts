'use server'

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { requireRole } from '@/lib/rbac'
import { requirePermission, getAuthContext } from '@/lib/auth-helpers'
import { publishOutboxEvent } from '@/lib/events/event-publisher'
import {
  createFinanceTransactionSchema,
  updateFinanceTransactionSchema,
  createFinanceLineSchema,
  updateFinanceLineSchema,
  projectTransactionCreateSchema,
  projectTransactionUpdateSchema,
  getTransactionTypePrefix,
  type TransactionType,
} from '@repo/validators'
import type {
  CreateFinanceTransactionInput,
  UpdateFinanceTransactionInput,
  CreateFinanceLineInput,
  UpdateFinanceLineInput,
  ProjectTransactionCreateInput,
  ProjectTransactionUpdateInput,
} from '@repo/validators'
import { toBaseAmount } from '@/lib/currency-utils'
import { isEditableStatus, toNum, serializeTransaction } from './finance-helpers'

export async function getNextTransactionNumber(
  orgId: string,
  type: TransactionType,
  year: number
): Promise<string> {
  const prefix = getTransactionTypePrefix(type)
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year + 1, 0, 1)
  const count = await prisma.financeTransaction.count({
    where: {
      orgId,
      type,
      issueDate: { gte: yearStart, lt: yearEnd },
      deleted: false,
    },
  })
  const seq = count + 1
  return `${prefix}-${year}-${seq.toString().padStart(3, '0')}`
}

async function getNextProjectTransactionNumber(orgId: string): Promise<string> {
  const last = await prisma.financeTransaction.findFirst({
    where: { orgId, transactionNumber: { startsWith: 'TXN-' } },
    orderBy: { transactionNumber: 'desc' },
    select: { transactionNumber: true },
  })
  const lastNum = last?.transactionNumber?.match(/\d+$/)?.[0] ?? '0'
  return `TXN-${String(Number(lastNum) + 1).padStart(6, '0')}`
}

export type ListFinanceTransactionsFilters = {
  type?: string
  status?: string
  projectId?: string
  dateFrom?: string // YYYY-MM-DD
  dateTo?: string // YYYY-MM-DD
}

export type GetProjectTransactionsFilters = {
  dateFrom?: string // YYYY-MM-DD
  dateTo?: string // YYYY-MM-DD
  partyId?: string
  type?: string
}

export async function listFinanceTransactions(filters: ListFinanceTransactionsFilters = {}) {
  const { org } = await getAuthContext()
  const where: Record<string, unknown> = { orgId: org.orgId, deleted: false }
  if (filters.type) where.type = filters.type
  if (filters.status) where.status = filters.status
  if (filters.projectId) where.projectId = filters.projectId
  if (filters.dateFrom || filters.dateTo) {
    where.issueDate = {}
    if (filters.dateFrom) (where.issueDate as Record<string, Date>).gte = new Date(filters.dateFrom)
    if (filters.dateTo) (where.issueDate as Record<string, Date>).lte = new Date(filters.dateTo)
  }

  const list = await prisma.financeTransaction.findMany({
    where,
    orderBy: { issueDate: 'desc' },
    include: {
      project: { select: { id: true, name: true } },
      party: { select: { id: true, name: true } },
      createdBy: { select: { user: { select: { fullName: true } } } },
    },
  })
  return list.map((t) => ({
    ...t,
    total: Number(t.total),
    amountBaseCurrency: Number(t.amountBaseCurrency),
  }))
}

export async function getFinanceTransaction(id: string) {
  const { org } = await getAuthContext()
  const tx = await prisma.financeTransaction.findFirst({
    where: { id, orgId: org.orgId, deleted: false },
    include: {
      project: { select: { id: true, name: true } },
      party: { select: { id: true, name: true } },
      createdBy: { select: { user: { select: { fullName: true, email: true } } } },
      lines: {
        orderBy: { sortOrder: 'asc' },
        include: { wbsNode: { select: { id: true, code: true, name: true } } },
      },
    },
  })
  if (!tx) return null
  return {
    ...tx,
    total: Number(tx.total),
    amountBaseCurrency: Number(tx.amountBaseCurrency),
    subtotal: Number(tx.subtotal),
    taxTotal: Number(tx.taxTotal),
    retentionAmount: Number(tx.retentionAmount ?? 0),
    adjustmentAmount: Number(tx.adjustmentAmount ?? 0),
    lines: tx.lines.map((l) => ({
      ...l,
      lineTotal: Number(l.lineTotal),
      unitPrice: Number(l.unitPrice),
      quantity: Number(l.quantity),
    })),
  }
}

export async function listProjectsForFinance() {
  const { org } = await getAuthContext()
  return prisma.project.findMany({
    where: { orgId: org.orgId, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

export async function listPartiesForFinance() {
  const { org } = await getAuthContext()
  return prisma.party.findMany({
    where: { orgId: org.orgId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 500,
  })
}

export async function listCurrencies() {
  const { org } = await getAuthContext()
  const currencies = await prisma.currency.findMany({
    where: { active: true },
    select: { code: true, name: true, symbol: true },
    orderBy: { code: 'asc' },
  })
  return currencies
}

export async function listWbsNodesForProject(projectId: string) {
  const { org } = await getAuthContext()
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return []
  const nodes = await prisma.wbsNode.findMany({
    where: { projectId, orgId: org.orgId, active: true },
    select: { id: true, code: true, name: true },
    orderBy: [{ code: 'asc' }],
  })
  return nodes
}

export async function createFinanceTransaction(data: CreateFinanceTransactionInput) {
  await requirePermission('FINANCE', 'create')
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')

  const parsed = createFinanceTransactionSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const { projectId, partyId, currencyCode, exchangeRateSnapshot: rateNum, issueDate, ...rest } = parsed.data
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId: org.orgId },
      select: { id: true },
    })
    if (!project) return { error: { projectId: ['Project not found'] } }
  }

  const currency = await prisma.currency.findFirst({
    where: { code: currencyCode },
    select: { code: true },
  })
  if (!currency) return { error: { currencyCode: ['Currency not found'] } }

  const year = new Date(issueDate).getFullYear()
  const transactionNumber = await getNextTransactionNumber(org.orgId, parsed.data.type as TransactionType, year)

  const total = new Prisma.Decimal(0)
  const amountBase = new Prisma.Decimal(0)
  await prisma.$transaction(async (tx) => {
    const created = await tx.financeTransaction.create({
      data: {
        orgId: org.orgId,
        type: parsed.data.type,
        documentType: parsed.data.documentType ?? 'INVOICE',
        status: 'DRAFT',
        transactionNumber,
        issueDate,
        currency: currencyCode,
        subtotal: total,
        taxTotal: new Prisma.Decimal(0),
        total,
        amountBaseCurrency: amountBase,
        retentionAmount: new Prisma.Decimal(parsed.data.retentionAmount ?? 0),
        adjustmentAmount: new Prisma.Decimal(parsed.data.adjustmentAmount ?? 0),
        adjustmentNotes: parsed.data.adjustmentNotes ?? undefined,
        exchangeRateSnapshot: { rate: rateNum, baseCurrency: 'USD' } as object,
        description: rest.description,
        reference: rest.reference ?? undefined,
        projectId: projectId ?? undefined,
        partyId: partyId ?? undefined,
        createdByOrgMemberId: org.memberId,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.CREATED',
      entityType: 'FinanceTransaction',
      entityId: created.id,
      payload: { type: created.type, transactionNumber: created.transactionNumber },
    })
  })

  revalidatePath('/finance/transactions')
  return { success: true }
}

export async function createFinanceTransactionWithLines(
  data: CreateFinanceTransactionInput,
  lines: { description: string; amount: number; wbsNodeId?: string | null; unit?: string | null; quantity?: number }[]
) {
  await requirePermission('FINANCE', 'create')
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')

  const parsed = createFinanceTransactionSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const { projectId, partyId, currencyCode, exchangeRateSnapshot: rateNum, issueDate, ...rest } = parsed.data
  let projectIdCheck: string | null = projectId ?? null
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId: org.orgId },
      select: { id: true },
    })
    if (!project) return { error: { projectId: ['Project not found'] } }
  }

  const currency = await prisma.currency.findFirst({
    where: { code: currencyCode },
    select: { code: true },
  })
  if (!currency) return { error: { currencyCode: ['Currency not found'] } }

  const year = new Date(issueDate).getFullYear()
  const transactionNumber = await getNextTransactionNumber(org.orgId, parsed.data.type as TransactionType, year)

  if (projectIdCheck) {
    for (const l of lines) {
      if (l.wbsNodeId) {
        const wbs = await prisma.wbsNode.findFirst({
          where: { id: l.wbsNodeId, projectId: projectIdCheck, orgId: org.orgId, active: true },
          select: { id: true },
        })
        if (!wbs) return { error: { _form: [`WBS item ${l.wbsNodeId} does not belong to the selected project`] } }
      }
    }
  }

  const lineTotals = lines.map((l) => new Prisma.Decimal(l.amount))
  const total = lineTotals.reduce((a, b) => a.add(b), new Prisma.Decimal(0))
  const amountBase = toBaseAmount(total, rateNum ?? 1)

  const tx = await prisma.$transaction(async (db) => {
    const created = await db.financeTransaction.create({
      data: {
        orgId: org.orgId,
        type: parsed.data.type,
        documentType: parsed.data.documentType ?? 'INVOICE',
        status: 'DRAFT',
        transactionNumber,
        issueDate,
        currency: currencyCode,
        subtotal: total,
        taxTotal: new Prisma.Decimal(0),
        total,
        amountBaseCurrency: amountBase,
        retentionAmount: new Prisma.Decimal(parsed.data.retentionAmount ?? 0),
        adjustmentAmount: new Prisma.Decimal(parsed.data.adjustmentAmount ?? 0),
        adjustmentNotes: parsed.data.adjustmentNotes ?? undefined,
        exchangeRateSnapshot: { rate: rateNum ?? 1, baseCurrency: 'USD' } as object,
        description: rest.description,
        reference: rest.reference ?? undefined,
        projectId: projectId ?? undefined,
        partyId: partyId ?? undefined,
        createdByOrgMemberId: org.memberId,
        lines: {
          create: lines.map((l, i) => {
            const amt = new Prisma.Decimal(l.amount)
            const qty = l.quantity != null && l.quantity > 0 ? new Prisma.Decimal(l.quantity) : new Prisma.Decimal(1)
            const unitPrice = qty.isZero() ? amt : amt.div(qty)
            let wbsNodeId: string | undefined
            if (l.wbsNodeId && projectIdCheck) {
              wbsNodeId = l.wbsNodeId
            }
            return {
              orgId: org.orgId,
              description: l.description,
              unit: l.unit ?? 'ea',
              quantity: qty,
              unitPrice,
              lineTotal: amt,
              sortOrder: i,
              wbsNodeId,
            }
          }),
        },
      },
      include: { lines: true },
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

  revalidatePath('/finance/transactions')
  return { success: true, id: tx.id }
}

export async function updateFinanceTransaction(id: string, data: UpdateFinanceTransactionInput) {
  await requirePermission('FINANCE', 'edit')
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')

  const existing = await prisma.financeTransaction.findFirst({
    where: { id, orgId: org.orgId, deleted: false },
    include: { lines: true },
  })
  if (!existing) return { error: { _form: ['Transaction not found'] } }
  if (!isEditableStatus(existing.status)) return { error: { _form: ['Transaction cannot be edited'] } }

  const parsed = updateFinanceTransactionSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const { projectId, partyId, currencyCode, exchangeRateSnapshot: rateNum, issueDate, ...rest } = parsed.data
  if (projectId !== undefined && projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId: org.orgId },
      select: { id: true },
    })
    if (!project) return { error: { projectId: ['Project not found'] } }
  }
  if (currencyCode) {
    const currency = await prisma.currency.findFirst({ where: { code: currencyCode }, select: { code: true } })
    if (!currency) return { error: { currencyCode: ['Currency not found'] } }
  }

  const total = existing.lines.reduce((s, l) => s.add(l.lineTotal), new Prisma.Decimal(0))
  const rate = rateNum ?? (existing.exchangeRateSnapshot as { rate?: number })?.rate ?? 1
  const amountBase = toBaseAmount(total, rate)

  const payload: Record<string, unknown> = {
    description: rest.description ?? existing.description,
    issueDate: issueDate ?? existing.issueDate,
    currency: currencyCode ?? existing.currency,
    total,
    amountBaseCurrency: amountBase,
    exchangeRateSnapshot: { rate, baseCurrency: 'USD' } as object,
    reference: rest.reference !== undefined ? rest.reference : existing.reference,
    projectId: projectId !== undefined ? projectId : existing.projectId,
    partyId: partyId !== undefined ? partyId : existing.partyId,
  }
  if (parsed.data.documentType !== undefined) payload.documentType = parsed.data.documentType
  if (parsed.data.retentionAmount !== undefined) payload.retentionAmount = new Prisma.Decimal(parsed.data.retentionAmount)
  if (parsed.data.adjustmentAmount !== undefined) payload.adjustmentAmount = new Prisma.Decimal(parsed.data.adjustmentAmount)
  if (parsed.data.adjustmentNotes !== undefined) payload.adjustmentNotes = parsed.data.adjustmentNotes

  await prisma.$transaction(async (db) => {
    await db.financeTransaction.update({
      where: { id },
      data: payload,
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: id,
      payload: { updatedFields: Object.keys(payload) },
    })
  })

  revalidatePath('/finance/transactions')
  revalidatePath(`/finance/transactions/${id}`)
  return { success: true }
}

export async function addFinanceLine(transactionId: string, data: CreateFinanceLineInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')

  const tx = await prisma.financeTransaction.findFirst({
    where: { id: transactionId, orgId: org.orgId, deleted: false },
    include: { lines: true },
  })
  if (!tx) return { error: { _form: ['Transaction not found'] } }
  if (!isEditableStatus(tx.status)) return { error: { _form: ['Transaction cannot be edited'] } }

  const parsed = createFinanceLineSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  if (parsed.data.wbsNodeId && tx.projectId) {
    const wbs = await prisma.wbsNode.findFirst({
      where: { id: parsed.data.wbsNodeId, projectId: tx.projectId, orgId: org.orgId, active: true },
      select: { id: true },
    })
    if (!wbs) return { error: { wbsNodeId: ['WBS item must belong to the transaction project'] } }
  }

  const amt = new Prisma.Decimal(parsed.data.amount)
  const qty = parsed.data.quantity != null && parsed.data.quantity > 0 ? new Prisma.Decimal(parsed.data.quantity) : new Prisma.Decimal(1)
  const unitPrice = qty.isZero() ? amt : amt.div(qty)
  const maxSort = tx.lines.length ? Math.max(...tx.lines.map((l) => l.sortOrder)) : -1

  await prisma.$transaction(async (db) => {
    await db.financeLine.create({
      data: {
        orgId: org.orgId,
        transactionId,
        description: parsed.data.description,
        unit: parsed.data.unit ?? 'ea',
        quantity: qty,
        unitPrice,
        lineTotal: amt,
        sortOrder: maxSort + 1,
        wbsNodeId: parsed.data.wbsNodeId ?? undefined,
      },
    })
    const allLines = await db.financeLine.findMany({ where: { transactionId }, select: { lineTotal: true } })
    const newTotal = allLines.reduce((s, l) => s.add(l.lineTotal), new Prisma.Decimal(0))
    const snapshot = (tx.exchangeRateSnapshot as { rate?: number }) ?? { rate: 1 }
    const rate = snapshot.rate ?? 1
    await db.financeTransaction.update({
      where: { id: transactionId },
      data: { total: newTotal, amountBaseCurrency: toBaseAmount(newTotal, rate) },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: transactionId,
      payload: { reason: 'line_added' },
    })
  })

  revalidatePath('/finance/transactions')
  revalidatePath(`/finance/transactions/${transactionId}`)
  return { success: true }
}

export async function updateFinanceLine(lineId: string, data: UpdateFinanceLineInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')

  const line = await prisma.financeLine.findFirst({
    where: { id: lineId, orgId: org.orgId },
    include: { transaction: true },
  })
  if (!line) return { error: { _form: ['Line not found'] } }
  if (!isEditableStatus(line.transaction.status)) return { error: { _form: ['Transaction cannot be edited'] } }

  const parsed = updateFinanceLineSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const payload: Record<string, unknown> = {}
  if (parsed.data.description !== undefined) payload.description = parsed.data.description
  if (parsed.data.amount !== undefined) {
    const amt = new Prisma.Decimal(parsed.data.amount)
    const qty = parsed.data.quantity != null && parsed.data.quantity > 0 ? new Prisma.Decimal(parsed.data.quantity) : new Prisma.Decimal(1)
    payload.unitPrice = qty.isZero() ? amt : amt.div(qty)
    payload.lineTotal = amt
    payload.quantity = qty
  }
  if (parsed.data.wbsNodeId !== undefined) payload.wbsNodeId = parsed.data.wbsNodeId ?? null
  if (parsed.data.unit !== undefined) payload.unit = parsed.data.unit ?? 'ea'

  await prisma.$transaction(async (db) => {
    if (Object.keys(payload).length) await db.financeLine.update({ where: { id: lineId }, data: payload })
    const allLines = await db.financeLine.findMany({ where: { transactionId: line.transactionId }, select: { lineTotal: true } })
    const newTotal = allLines.reduce((s, l) => s.add(l.lineTotal), new Prisma.Decimal(0))
    const snapshot = (line.transaction.exchangeRateSnapshot as { rate?: number }) ?? { rate: 1 }
    const rate = snapshot.rate ?? 1
    await db.financeTransaction.update({
      where: { id: line.transactionId },
      data: { total: newTotal, amountBaseCurrency: toBaseAmount(newTotal, rate) },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: line.transactionId,
      payload: { reason: 'line_updated' },
    })
  })

  revalidatePath(`/finance/transactions/${line.transactionId}`)
  return { success: true }
}

export async function deleteFinanceLine(lineId: string) {
  await requirePermission('FINANCE', 'delete')
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')

  const line = await prisma.financeLine.findFirst({
    where: { id: lineId, orgId: org.orgId },
    include: { transaction: true },
  })
  if (!line) throw new Error('Line not found')
  if (!isEditableStatus(line.transaction.status)) throw new Error('Transaction cannot be edited')

  await prisma.$transaction(async (db) => {
    await db.financeLine.delete({ where: { id: lineId } })
    const allLines = await db.financeLine.findMany({ where: { transactionId: line.transactionId }, select: { lineTotal: true } })
    const newTotal = allLines.reduce((s, l) => s.add(l.lineTotal), new Prisma.Decimal(0))
    const snapshot = (line.transaction.exchangeRateSnapshot as { rate?: number }) ?? { rate: 1 }
    const rate = snapshot.rate ?? 1
    await db.financeTransaction.update({
      where: { id: line.transactionId },
      data: { total: newTotal, amountBaseCurrency: toBaseAmount(newTotal, rate) },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: line.transactionId,
      payload: { reason: 'line_deleted' },
    })
  })

  revalidatePath(`/finance/transactions/${line.transactionId}`)
  return { success: true }
}

export async function submitFinanceTransaction(id: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')

  const tx = await prisma.financeTransaction.findFirst({
    where: { id, orgId: org.orgId, deleted: false },
    select: { id: true, status: true },
  })
  if (!tx) return { error: 'Transaction not found' }
  if (tx.status !== 'DRAFT') return { error: 'Only draft transactions can be submitted.' }

  await prisma.$transaction(async (db) => {
    await db.financeTransaction.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: id,
      payload: { status: 'SUBMITTED' },
    })
  })

  revalidatePath('/finance/transactions')
  revalidatePath(`/finance/transactions/${id}`)
  return { success: true }
}

export async function approveFinanceTransaction(id: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const tx = await prisma.financeTransaction.findFirst({
    where: { id, orgId: org.orgId, deleted: false },
    select: { id: true, status: true },
  })
  if (!tx) return { error: 'Transaction not found' }
  if (tx.status !== 'SUBMITTED') return { error: 'Only submitted transactions can be approved.' }

  await prisma.$transaction(async (db) => {
    await db.financeTransaction.update({
      where: { id },
      data: { status: 'APPROVED' },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: id,
      payload: { status: 'APPROVED' },
    })
  })

  revalidatePath('/finance/transactions')
  revalidatePath(`/finance/transactions/${id}`)
  return { success: true }
}

export async function rejectFinanceTransaction(id: string, reason: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const tx = await prisma.financeTransaction.findFirst({
    where: { id, orgId: org.orgId, deleted: false },
    select: { id: true, status: true },
  })
  if (!tx) return { error: 'Transaction not found' }
  if (tx.status !== 'SUBMITTED') return { error: 'Only submitted transactions can be rejected.' }

  await prisma.$transaction(async (db) => {
    await db.financeTransaction.update({
      where: { id },
      data: { status: 'DRAFT', reference: reason || undefined },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: id,
      payload: { status: 'DRAFT' },
    })
  })

  revalidatePath('/finance/transactions')
  revalidatePath(`/finance/transactions/${id}`)
  return { success: true }
}

export async function markFinanceTransactionPaid(id: string, paymentDate: Date) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')

  const tx = await prisma.financeTransaction.findFirst({
    where: { id, orgId: org.orgId, deleted: false },
    select: { id: true, status: true },
  })
  if (!tx) return { error: 'Transaction not found' }
  if (tx.status !== 'APPROVED') return { error: 'Only approved transactions can be marked as paid.' }

  await prisma.$transaction(async (db) => {
    await db.financeTransaction.update({
      where: { id },
      data: { status: 'PAID', paidDate: paymentDate },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: id,
      payload: { status: 'PAID' },
    })
  })

  revalidatePath('/finance/transactions')
  revalidatePath(`/finance/transactions/${id}`)
  return { success: true }
}

export async function voidFinanceTransaction(id: string, reason: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const tx = await prisma.financeTransaction.findFirst({
    where: { id, orgId: org.orgId, deleted: false },
    select: { id: true, status: true },
  })
  if (!tx) return { error: 'Transaction not found' }
  if (tx.status === 'VOIDED') return { error: 'Transaction is already voided.' }

  await prisma.$transaction(async (db) => {
    await db.financeTransaction.update({
      where: { id },
      data: { status: 'VOIDED', reference: reason || undefined },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: id,
      payload: { status: 'VOIDED' },
    })
  })

  revalidatePath('/finance/transactions')
  revalidatePath(`/finance/transactions/${id}`)
  return { success: true }
}

// ====================
// PROJECT-SCOPED TRANSACTIONS (projects/[id]/finance/transactions)
// ====================

export async function getProjectTransactions(projectId: string, filters: GetProjectTransactionsFilters = {}) {
  const { org } = await getAuthContext()
  const where: { projectId: string; orgId: string; deleted: boolean; issueDate?: { gte?: Date; lte?: Date }; partyId?: string; type?: string } = {
    projectId,
    orgId: org.orgId,
    deleted: false,
  }
  if (filters.dateFrom || filters.dateTo) {
    where.issueDate = {}
    if (filters.dateFrom) where.issueDate.gte = new Date(filters.dateFrom)
    if (filters.dateTo) where.issueDate.lte = new Date(filters.dateTo)
  }
  if (filters.partyId) where.partyId = filters.partyId
  if (filters.type) where.type = filters.type

  const list = await prisma.financeTransaction.findMany({
    where,
    include: {
      party: { select: { id: true, name: true } },
      createdBy: { select: { user: { select: { fullName: true } } } },
      lines: true,
      payments: { orderBy: { paidOn: 'desc' } },
    },
    orderBy: { issueDate: 'desc' },
  })
  return list.map((t) => serializeTransaction({
    ...t,
    total: t.total,
    subtotal: t.subtotal,
    taxTotal: t.taxTotal,
    amountBaseCurrency: t.amountBaseCurrency,
  }))
}

export async function getProjectTransaction(id: string) {
  const { org } = await getAuthContext()
  const tx = await prisma.financeTransaction.findFirst({
    where: { id, orgId: org.orgId, deleted: false },
    include: {
      party: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: 'asc' } },
      payments: { orderBy: { paidOn: 'desc' } },
      createdBy: { select: { user: { select: { fullName: true } } } },
    },
  })
  if (!tx) return null
  return serializeTransaction({
    ...tx,
    total: tx.total,
    subtotal: tx.subtotal,
    taxTotal: tx.taxTotal,
    amountBaseCurrency: tx.amountBaseCurrency,
  })
}

/** List parties (suppliers or clients) for the project's org, for use in transaction form */
export async function getPartiesForProject(
  projectId: string,
  partyType: 'SUPPLIER' | 'CLIENT'
): Promise<{ id: string; name: string }[]> {
  const { org } = await getAuthContext()
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return []
  const list = await prisma.party.findMany({
    where: { orgId: org.orgId, partyType, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return list
}

/** List all parties (suppliers + clients) for the project's org, for filter dropdown */
export async function getPartiesForProjectFilter(projectId: string): Promise<{ id: string; name: string; partyType: string }[]> {
  const { org } = await getAuthContext()
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return []
  const list = await prisma.party.findMany({
    where: { orgId: org.orgId, active: true, partyType: { in: ['SUPPLIER', 'CLIENT'] } },
    select: { id: true, name: true, partyType: true },
    orderBy: { name: 'asc' },
  })
  return list
}

export async function createProjectTransaction(
  projectId: string,
  data: ProjectTransactionCreateInput
) {
  await requirePermission('FINANCE', 'create')
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')

  const parsed = projectTransactionCreateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return { error: { _form: ['Project not found'] } }

  const currency = await prisma.currency.findFirst({
    where: { code: parsed.data.currency },
    select: { code: true },
  })
  if (!currency) return { error: { currency: ['Currency not found'] } }

  const transactionNumber = await getNextProjectTransactionNumber(org.orgId)
  const currencyCode = parsed.data.currency
  // Base currency ARS: amountBaseCurrency = total en ARS
  let rateToArs = 1
  if (currencyCode !== 'ARS') {
    if (parsed.data.exchangeRate != null && parsed.data.exchangeRate > 0) {
      rateToArs = parsed.data.exchangeRate // 1 unidad de currency = rateToArs ARS
    } else {
      const exchangeRate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: currencyCode,
          toCurrency: 'ARS',
          effectiveDate: { lte: parsed.data.issueDate },
        },
        orderBy: { effectiveDate: 'desc' },
      })
      rateToArs = exchangeRate ? Number(exchangeRate.rate) : 1
    }
  }
  const totalDec = new Prisma.Decimal(parsed.data.total)
  const amountBaseCurrency = toBaseAmount(totalDec, rateToArs)

  const tx = await prisma.$transaction(async (db) => {
    const created = await db.financeTransaction.create({
      data: {
        orgId: org.orgId,
        projectId,
        type: parsed.data.type,
        documentType: parsed.data.documentType ?? 'INVOICE',
        status: 'DRAFT',
        transactionNumber,
        partyId: parsed.data.partyId ?? undefined,
        description: parsed.data.description,
        issueDate: parsed.data.issueDate,
        dueDate: parsed.data.dueDate ?? undefined,
        currency: currencyCode,
        subtotal: new Prisma.Decimal(parsed.data.subtotal),
        taxTotal: new Prisma.Decimal(parsed.data.taxTotal ?? 0),
        total: totalDec,
        amountBaseCurrency,
        retentionAmount: new Prisma.Decimal(parsed.data.retentionAmount ?? 0),
        adjustmentAmount: new Prisma.Decimal(parsed.data.adjustmentAmount ?? 0),
        adjustmentNotes: parsed.data.adjustmentNotes ?? undefined,
        exchangeRateSnapshot: { rate: rateToArs, baseCurrency: 'ARS' } as object,
        reference: parsed.data.reference ?? undefined,
        createdByOrgMemberId: org.memberId,
        lines: {
          create: (parsed.data.lines ?? []).map(
            (
              line: {
                description: string
                unit?: string | null
                quantity: number
                unitPrice: number
                lineTotal: number
                wbsNodeId?: string | null
              },
              idx: number
            ) => ({
              orgId: org.orgId,
              description: line.description,
              unit: line.unit ?? undefined,
              quantity: new Prisma.Decimal(line.quantity),
              unitPrice: new Prisma.Decimal(line.unitPrice),
              lineTotal: new Prisma.Decimal(line.lineTotal),
              sortOrder: idx,
              wbsNodeId: line.wbsNodeId ?? undefined,
            })
          ),
        },
      },
      include: { lines: true, party: true },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.CREATED',
      entityType: 'FinanceTransaction',
      entityId: created.id,
      payload: { projectId, type: created.type, transactionNumber: created.transactionNumber },
    })
    return created
  })

  revalidatePath(`/projects/${projectId}/finance/transactions`)
  revalidatePath(`/projects/${projectId}/finance`)
  return { success: true, transaction: serializeTransaction(tx) }
}

export async function updateProjectTransaction(id: string, data: ProjectTransactionUpdateInput) {
  await requirePermission('FINANCE', 'edit')
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')

  const existing = await prisma.financeTransaction.findFirst({
    where: { id, orgId: org.orgId, deleted: false },
    select: { id: true, projectId: true, status: true, currency: true, total: true, issueDate: true },
  })
  if (!existing) return { error: { _form: ['Transaction not found'] } }

  const parsed = projectTransactionUpdateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const payload: Record<string, unknown> = {}
  const canEditFull = isEditableStatus(existing.status)
  if (parsed.data.status !== undefined) payload.status = parsed.data.status
  if (parsed.data.partyId !== undefined) payload.partyId = parsed.data.partyId ?? null
  if (canEditFull) {
    if (parsed.data.description !== undefined) payload.description = parsed.data.description
    if (parsed.data.documentType !== undefined) payload.documentType = parsed.data.documentType
    if (parsed.data.issueDate !== undefined) payload.issueDate = parsed.data.issueDate
    if (parsed.data.dueDate !== undefined) payload.dueDate = parsed.data.dueDate
    if (parsed.data.paidDate !== undefined) payload.paidDate = parsed.data.paidDate
    if (parsed.data.reference !== undefined) payload.reference = parsed.data.reference
    if (parsed.data.currency !== undefined) payload.currency = parsed.data.currency
    if (parsed.data.subtotal !== undefined) payload.subtotal = new Prisma.Decimal(parsed.data.subtotal)
    if (parsed.data.taxTotal !== undefined) payload.taxTotal = new Prisma.Decimal(parsed.data.taxTotal)
    if (parsed.data.total !== undefined) payload.total = new Prisma.Decimal(parsed.data.total)
    if (parsed.data.retentionAmount !== undefined) payload.retentionAmount = new Prisma.Decimal(parsed.data.retentionAmount)
    if (parsed.data.adjustmentAmount !== undefined) payload.adjustmentAmount = new Prisma.Decimal(parsed.data.adjustmentAmount)
    if (parsed.data.adjustmentNotes !== undefined) payload.adjustmentNotes = parsed.data.adjustmentNotes
    const currencyCode = (parsed.data.currency as string | undefined) ?? existing.currency
    const totalNum = parsed.data.total ?? Number(existing.total)
    const needBaseAmount = parsed.data.currency !== undefined || parsed.data.total !== undefined || parsed.data.exchangeRate !== undefined
    if (needBaseAmount) {
      let rateToArs = 1
      if (currencyCode !== 'ARS') {
        if (parsed.data.exchangeRate != null && parsed.data.exchangeRate > 0) {
          rateToArs = parsed.data.exchangeRate
        } else {
          const exchangeRate = await prisma.exchangeRate.findFirst({
            where: { fromCurrency: currencyCode, toCurrency: 'ARS', effectiveDate: { lte: existing.issueDate } },
            orderBy: { effectiveDate: 'desc' },
          })
          rateToArs = exchangeRate ? Number(exchangeRate.rate) : 1
        }
      }
      const totalDec = new Prisma.Decimal(totalNum)
      payload.amountBaseCurrency = toBaseAmount(totalDec, rateToArs)
      payload.exchangeRateSnapshot = { rate: rateToArs, baseCurrency: 'ARS' }
    }
  }

  const updated = await prisma.$transaction(async (db) => {
    const result = await db.financeTransaction.update({
      where: { id },
      data: payload,
      include: { party: true, lines: true },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: id,
      payload: { projectId: existing.projectId, updatedFields: Object.keys(payload) },
    })
    return result
  })

  if (existing.projectId) {
    revalidatePath(`/projects/${existing.projectId}/finance/transactions`)
    revalidatePath(`/projects/${existing.projectId}/finance`)
  }
  revalidatePath(`/finance/transactions/${id}`)
  return { success: true, transaction: serializeTransaction(updated) }
}

export async function deleteProjectTransaction(id: string) {
  await requirePermission('FINANCE', 'delete')
  const { org } = await getAuthContext()
  requireRole(org.role, 'ACCOUNTANT')

  const existing = await prisma.financeTransaction.findFirst({
    where: { id, orgId: org.orgId, deleted: false },
    select: { id: true, projectId: true },
  })
  if (!existing) throw new Error('Transacción no encontrada')

  await prisma.$transaction(async (db) => {
    await db.financeTransaction.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date(),
        deletedByOrgMemberId: org.memberId,
      },
    })
    await publishOutboxEvent(db, {
      orgId: org.orgId,
      eventType: 'FINANCE_TRANSACTION.UPDATED',
      entityType: 'FinanceTransaction',
      entityId: id,
      payload: { deleted: true, projectId: existing.projectId },
    })
  })

  if (existing.projectId) {
    revalidatePath(`/projects/${existing.projectId}/finance/transactions`)
    revalidatePath(`/projects/${existing.projectId}/finance`)
  }
  revalidatePath(`/finance/transactions`)
  return { success: true }
}
