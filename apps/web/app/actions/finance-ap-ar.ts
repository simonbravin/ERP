'use server'

import { prisma } from '@repo/database'
import { requireOrgFinanceAccess } from '@/lib/auth-helpers'
import { serializeTransaction } from './finance-helpers'

// ====================
// ACCOUNTS PAYABLE (AP)
// ====================

export type AccountsPayableFilters = {
  dueDateFrom?: string
  dueDateTo?: string
  partyId?: string
  projectId?: string
}

export type AccountsPayableItem = {
  id: string
  transactionNumber: string
  issueDate: Date
  dueDate: Date | null
  type: string
  documentType: string
  description: string
  total: number
  amountBaseCurrency: number
  currency: string
  status: string
  retentionAmount: number
  adjustmentAmount: number
  party: { id: string; name: string } | null
  project: { id: string; name: string; projectNumber: string } | null
}

export async function getCompanyAccountsPayable(
  filters: AccountsPayableFilters = {}
): Promise<AccountsPayableItem[]> {
  const { org } = await requireOrgFinanceAccess()
  const where: Record<string, unknown> = {
    orgId: org.orgId,
    deleted: false,
    type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
    status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
  }
  if (filters.projectId) where.projectId = filters.projectId
  if (filters.partyId) where.partyId = filters.partyId
  if (filters.dueDateFrom || filters.dueDateTo) {
    where.dueDate = {}
    if (filters.dueDateFrom) (where.dueDate as Record<string, Date>).gte = new Date(filters.dueDateFrom)
    if (filters.dueDateTo) (where.dueDate as Record<string, Date>).lte = new Date(filters.dueDateTo)
  }

  const list = await prisma.financeTransaction.findMany({
    where,
    include: {
      party: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, projectNumber: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { issueDate: 'desc' }],
    take: 500,
  })
  return list.map((t) => ({
    ...serializeTransaction(t),
    retentionAmount: Number(t.retentionAmount ?? 0),
    adjustmentAmount: Number(t.adjustmentAmount ?? 0),
    party: t.party,
    project: t.project,
  }))
}

export async function getProjectAccountsPayable(
  projectId: string,
  filters: Omit<AccountsPayableFilters, 'projectId'> = {}
): Promise<AccountsPayableItem[]> {
  const { org } = await requireOrgFinanceAccess()
  const where: Record<string, unknown> = {
    projectId,
    orgId: org.orgId,
    deleted: false,
    type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
    status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
  }
  if (filters.partyId) where.partyId = filters.partyId
  if (filters.dueDateFrom || filters.dueDateTo) {
    where.dueDate = {}
    if (filters.dueDateFrom) (where.dueDate as Record<string, Date>).gte = new Date(filters.dueDateFrom)
    if (filters.dueDateTo) (where.dueDate as Record<string, Date>).lte = new Date(filters.dueDateTo)
  }

  const list = await prisma.financeTransaction.findMany({
    where,
    include: {
      party: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, projectNumber: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { issueDate: 'desc' }],
    take: 500,
  })
  return list.map((t) => ({
    ...serializeTransaction(t),
    retentionAmount: Number(t.retentionAmount ?? 0),
    adjustmentAmount: Number(t.adjustmentAmount ?? 0),
    party: t.party,
    project: t.project,
  }))
}

// ====================
// ACCOUNTS RECEIVABLE (AR) — includes certifications (invoices from certifications)
// ====================

export type AccountsReceivableFilters = {
  dueDateFrom?: string
  dueDateTo?: string
  partyId?: string
  projectId?: string
}

export type AccountsReceivableItem = {
  id: string
  transactionNumber: string
  issueDate: Date
  dueDate: Date | null
  type: string
  documentType: string
  description: string
  total: number
  amountBaseCurrency: number
  currency: string
  status: string
  retentionAmount: number
  adjustmentAmount: number
  party: { id: string; name: string } | null
  project: { id: string; name: string; projectNumber: string } | null
  certification: { id: string; number: number; projectId: string } | null
}

export async function getCompanyAccountsReceivable(
  filters: AccountsReceivableFilters = {}
): Promise<AccountsReceivableItem[]> {
  const { org } = await requireOrgFinanceAccess()
  const where: Record<string, unknown> = {
    orgId: org.orgId,
    deleted: false,
    type: { in: ['INCOME', 'SALE'] },
    status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
  }
  if (filters.projectId) where.projectId = filters.projectId
  if (filters.partyId) where.partyId = filters.partyId
  if (filters.dueDateFrom || filters.dueDateTo) {
    where.dueDate = {}
    if (filters.dueDateFrom) (where.dueDate as Record<string, Date>).gte = new Date(filters.dueDateFrom)
    if (filters.dueDateTo) (where.dueDate as Record<string, Date>).lte = new Date(filters.dueDateTo)
  }

  const list = await prisma.financeTransaction.findMany({
    where,
    include: {
      party: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, projectNumber: true } },
      certification: { select: { id: true, number: true, projectId: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { issueDate: 'desc' }],
    take: 500,
  })
  return list.map((t) => ({
    ...serializeTransaction(t),
    retentionAmount: Number(t.retentionAmount ?? 0),
    adjustmentAmount: Number(t.adjustmentAmount ?? 0),
    party: t.party,
    project: t.project,
    certification: t.certification,
  }))
}

export async function getProjectAccountsReceivable(
  projectId: string,
  filters: Omit<AccountsReceivableFilters, 'projectId'> = {}
): Promise<AccountsReceivableItem[]> {
  const { org } = await requireOrgFinanceAccess()
  const where: Record<string, unknown> = {
    projectId,
    orgId: org.orgId,
    deleted: false,
    type: { in: ['INCOME', 'SALE'] },
    status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
  }
  if (filters.partyId) where.partyId = filters.partyId
  if (filters.dueDateFrom || filters.dueDateTo) {
    where.dueDate = {}
    if (filters.dueDateFrom) (where.dueDate as Record<string, Date>).gte = new Date(filters.dueDateFrom)
    if (filters.dueDateTo) (where.dueDate as Record<string, Date>).lte = new Date(filters.dueDateTo)
  }

  const list = await prisma.financeTransaction.findMany({
    where,
    include: {
      party: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, projectNumber: true } },
      certification: { select: { id: true, number: true, projectId: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { issueDate: 'desc' }],
    take: 500,
  })
  return list.map((t) => ({
    ...serializeTransaction(t),
    retentionAmount: Number(t.retentionAmount ?? 0),
    adjustmentAmount: Number(t.adjustmentAmount ?? 0),
    party: t.party,
    project: t.project,
    certification: t.certification,
  }))
}

// ====================
// CASH PROJECTION
// ====================

export type CashProjectionResult = {
  asOfDate: string
  paidIncomeToDate: number
  paidExpenseToDate: number
  receivablesDueByDate: number
  payablesDueByDate: number
  projectedBalance: number
  /** Net: paidIncome - paidExpense + receivables - payables */
}

export async function getCompanyCashProjection(asOfDate: Date): Promise<CashProjectionResult> {
  const { org } = await requireOrgFinanceAccess()
  const end = new Date(asOfDate)
  end.setHours(23, 59, 59, 999)

  const [paidIncome, paidExpense, receivables, payables] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: {
        orgId: org.orgId,
        deleted: false,
        type: { in: ['INCOME', 'SALE'] },
        status: 'PAID',
        paidDate: { lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId: org.orgId,
        deleted: false,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: 'PAID',
        paidDate: { lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId: org.orgId,
        deleted: false,
        type: { in: ['INCOME', 'SALE'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId: org.orgId,
        deleted: false,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
  ])

  const paidInc = Number(paidIncome._sum.amountBaseCurrency ?? 0)
  const paidExp = Number(paidExpense._sum.amountBaseCurrency ?? 0)
  const recv = Number(receivables._sum.amountBaseCurrency ?? 0)
  const pay = Number(payables._sum.amountBaseCurrency ?? 0)
  const projectedBalance = paidInc - paidExp + recv - pay

  return {
    asOfDate: asOfDate.toISOString().slice(0, 10),
    paidIncomeToDate: paidInc,
    paidExpenseToDate: paidExp,
    receivablesDueByDate: recv,
    payablesDueByDate: pay,
    projectedBalance,
  }
}

export async function getProjectCashProjection(
  projectId: string,
  asOfDate: Date
): Promise<CashProjectionResult> {
  const { org } = await requireOrgFinanceAccess()
  const end = new Date(asOfDate)
  end.setHours(23, 59, 59, 999)

  const baseWhere = { projectId, orgId: org.orgId, deleted: false }

  const [paidIncome, paidExpense, receivables, payables] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['INCOME', 'SALE'] },
        status: 'PAID',
        paidDate: { lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: 'PAID',
        paidDate: { lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['INCOME', 'SALE'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
  ])

  const paidInc = Number(paidIncome._sum.amountBaseCurrency ?? 0)
  const paidExp = Number(paidExpense._sum.amountBaseCurrency ?? 0)
  const recv = Number(receivables._sum.amountBaseCurrency ?? 0)
  const pay = Number(payables._sum.amountBaseCurrency ?? 0)
  const projectedBalance = paidInc - paidExp + recv - pay

  return {
    asOfDate: asOfDate.toISOString().slice(0, 10),
    paidIncomeToDate: paidInc,
    paidExpenseToDate: paidExp,
    receivablesDueByDate: recv,
    payablesDueByDate: pay,
    projectedBalance,
  }
}

// ====================
// FINANCE ALERTS
// ====================

export type FinanceAlert = {
  id: string
  type: 'LOW_CASH' | 'INCOME_INSUFFICIENT' | 'OVERDUE_PAYABLES'
  title: string
  message: string
  severity: 'warning' | 'danger'
  /** Optional link to AP/AR or projection */
  link?: string
}

/** Minimum cash threshold (configurable later via org settings). */
const DEFAULT_MIN_CASH_THRESHOLD = 0

export async function getCompanyFinanceAlerts(): Promise<FinanceAlert[]> {
  const { org } = await requireOrgFinanceAccess()
  const alerts: FinanceAlert[] = []
  const now = new Date()
  const next30 = new Date(now)
  next30.setDate(next30.getDate() + 30)

  const [projection, overdueCount, payablesSum, receivablesSum] = await Promise.all([
    getCompanyCashProjection(now),
    prisma.financeTransaction.count({
      where: {
        orgId: org.orgId,
        deleted: false,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { lt: now },
      },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId: org.orgId,
        deleted: false,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { gte: now, lte: next30 },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId: org.orgId,
        deleted: false,
        type: { in: ['INCOME', 'SALE'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { lte: next30 },
      },
      _sum: { amountBaseCurrency: true },
    }),
  ])

  const payablesDue = Number(payablesSum._sum.amountBaseCurrency ?? 0)
  const receivablesDue = Number(receivablesSum._sum.amountBaseCurrency ?? 0)

  if (projection.projectedBalance < DEFAULT_MIN_CASH_THRESHOLD && projection.projectedBalance < 0) {
    alerts.push({
      id: 'low-cash',
      type: 'LOW_CASH',
      title: 'Caja proyectada en negativo',
      message: `El balance proyectado a la fecha es ${projection.projectedBalance.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}. Revise cuentas por pagar y por cobrar.`,
      severity: 'danger',
      link: '/finance/cashflow',
    })
  }

  if (receivablesDue < payablesDue && payablesDue > 0) {
    alerts.push({
      id: 'income-insufficient',
      type: 'INCOME_INSUFFICIENT',
      title: 'Ingresos esperados no alcanzan a cubrir pagos',
      message: `Cuentas por cobrar hasta 30 días: ${receivablesDue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}. Cuentas por pagar en el mismo período: ${payablesDue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}.`,
      severity: 'warning',
      link: '/finance/accounts-payable',
    })
  }

  if (overdueCount > 0) {
    alerts.push({
      id: 'overdue-payables',
      type: 'OVERDUE_PAYABLES',
      title: `${overdueCount} pago(s) vencido(s)`,
      message: 'Hay cuentas por pagar con fecha de vencimiento pasada. Revise la lista de cuentas por pagar.',
      severity: 'warning',
      link: '/finance/accounts-payable',
    })
  }

  return alerts
}

/** Project-scoped finance alerts (no "gastos generales sin asignar"). */
export async function getProjectFinanceAlerts(projectId: string): Promise<FinanceAlert[]> {
  const { org } = await requireOrgFinanceAccess()
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return []

  const alerts: FinanceAlert[] = []
  const now = new Date()
  const next30 = new Date(now)
  next30.setDate(next30.getDate() + 30)

  const baseWhere = { orgId: org.orgId, projectId, deleted: false }

  const [projection, overdueCount, payablesSum, receivablesSum] = await Promise.all([
    getProjectCashProjection(projectId, now),
    prisma.financeTransaction.count({
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { lt: now },
      },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { gte: now, lte: next30 },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['INCOME', 'SALE'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { lte: next30 },
      },
      _sum: { amountBaseCurrency: true },
    }),
  ])

  const payablesDue = Number(payablesSum._sum.amountBaseCurrency ?? 0)
  const receivablesDue = Number(receivablesSum._sum.amountBaseCurrency ?? 0)
  const projectBase = `/projects/${projectId}/finance`

  if (projection.projectedBalance < DEFAULT_MIN_CASH_THRESHOLD && projection.projectedBalance < 0) {
    alerts.push({
      id: 'low-cash',
      type: 'LOW_CASH',
      title: 'Caja proyectada en negativo',
      message: `El balance proyectado a la fecha es ${projection.projectedBalance.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}. Revise cuentas por pagar y por cobrar.`,
      severity: 'danger',
      link: `${projectBase}/cashflow`,
    })
  }

  if (receivablesDue < payablesDue && payablesDue > 0) {
    alerts.push({
      id: 'income-insufficient',
      type: 'INCOME_INSUFFICIENT',
      title: 'Ingresos esperados no alcanzan a cubrir pagos',
      message: `Cuentas por cobrar hasta 30 días: ${receivablesDue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}. Cuentas por pagar en el mismo período: ${payablesDue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}.`,
      severity: 'warning',
      link: `${projectBase}/accounts-payable`,
    })
  }

  if (overdueCount > 0) {
    alerts.push({
      id: 'overdue-payables',
      type: 'OVERDUE_PAYABLES',
      title: `${overdueCount} pago(s) vencido(s)`,
      message: 'Hay cuentas por pagar con fecha de vencimiento pasada. Revise la lista de cuentas por pagar.',
      severity: 'warning',
      link: `${projectBase}/accounts-payable`,
    })
  }

  return alerts
}
