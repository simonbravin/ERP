'use server'

import { prisma } from '@repo/database'
import { getNextWeekRange } from '@/lib/weekly-report-email'
import type { CashProjectionResult, FinanceAlert } from './finance-ap-ar'

const DEFAULT_MIN_CASH_THRESHOLD = 0

export async function getCompanyCashProjectionForOrg(
  orgId: string,
  asOfDate: Date
): Promise<CashProjectionResult> {
  const end = new Date(asOfDate)
  end.setHours(23, 59, 59, 999)

  const [paidIncome, paidExpense, receivables, payables] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: {
        orgId,
        deleted: false,
        type: { in: ['INCOME', 'SALE'] },
        status: 'PAID',
        paidDate: { lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId,
        deleted: false,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: 'PAID',
        paidDate: { lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId,
        deleted: false,
        type: { in: ['INCOME', 'SALE'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId,
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

export async function getProjectCashProjectionForOrg(
  orgId: string,
  projectId: string,
  asOfDate: Date
): Promise<CashProjectionResult> {
  const end = new Date(asOfDate)
  end.setHours(23, 59, 59, 999)

  const baseWhere = { orgId, projectId, deleted: false }

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

export async function getCompanyFinanceBalanceForOrg(orgId: string): Promise<number> {
  const baseWhere = { orgId, deleted: false }
  const [totalIncome, totalExpense] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['INCOME', 'SALE'] }, status: 'PAID' },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] }, status: 'PAID' },
      _sum: { amountBaseCurrency: true },
    }),
  ])
  const ti = Number(totalIncome._sum.amountBaseCurrency ?? 0)
  const te = Number(totalExpense._sum.amountBaseCurrency ?? 0)
  return ti - te
}

export async function getCompanyFinanceAlertsForOrg(orgId: string): Promise<FinanceAlert[]> {
  const alerts: FinanceAlert[] = []
  const now = new Date()
  const next30 = new Date(now)
  next30.setDate(next30.getDate() + 30)

  const [projection, overdueCount, payablesSum, receivablesSum] = await Promise.all([
    getCompanyCashProjectionForOrg(orgId, now),
    prisma.financeTransaction.count({
      where: {
        orgId,
        deleted: false,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { lt: now },
      },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId,
        deleted: false,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { gte: now, lte: next30 },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId,
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

export async function getDueNextWeekForOrg(orgId: string): Promise<{
  payablesSum: number
  receivablesSum: number
}> {
  const { start, end } = getNextWeekRange()
  const [payables, receivables] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: {
        orgId,
        deleted: false,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { gte: start, lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId,
        deleted: false,
        type: { in: ['INCOME', 'SALE'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { gte: start, lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
  ])
  return {
    payablesSum: Number(payables._sum.amountBaseCurrency ?? 0),
    receivablesSum: Number(receivables._sum.amountBaseCurrency ?? 0),
  }
}

export async function getDueNextWeekForProject(
  orgId: string,
  projectId: string
): Promise<{ payablesSum: number; receivablesSum: number }> {
  const { start, end } = getNextWeekRange()
  const [payables, receivables] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: {
        orgId,
        projectId,
        deleted: false,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { gte: start, lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        orgId,
        projectId,
        deleted: false,
        type: { in: ['INCOME', 'SALE'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { gte: start, lte: end },
      },
      _sum: { amountBaseCurrency: true },
    }),
  ])
  return {
    payablesSum: Number(payables._sum.amountBaseCurrency ?? 0),
    receivablesSum: Number(receivables._sum.amountBaseCurrency ?? 0),
  }
}

// ====================
// WEEKLY REPORT PAYLOAD
// ====================

export type WeeklyReportProjectRow = {
  projectId: string
  projectName: string
  projectNumber: string
  projectedBalance: number
  payablesNextWeek: number
  receivablesNextWeek: number
}

export type WeeklyReportPayload = {
  orgId: string
  orgName: string
  reportDate: string
  balance: number
  projection: CashProjectionResult
  payablesNextWeek: number
  receivablesNextWeek: number
  alerts: FinanceAlert[]
  projects: WeeklyReportProjectRow[]
}

export async function buildWeeklyReportPayload(orgId: string): Promise<WeeklyReportPayload | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId, active: true },
    select: { name: true },
  })
  if (!org) return null

  const now = new Date()
  const reportDate = now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const [
    balance,
    projection,
    alerts,
    dueNextWeek,
    projectsList,
  ] = await Promise.all([
    getCompanyFinanceBalanceForOrg(orgId),
    getCompanyCashProjectionForOrg(orgId, now),
    getCompanyFinanceAlertsForOrg(orgId),
    getDueNextWeekForOrg(orgId),
    prisma.project.findMany({
      where: { orgId },
      select: { id: true, name: true, projectNumber: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const projects: WeeklyReportProjectRow[] = await Promise.all(
    projectsList.map(async (p) => {
      const [projProjection, projDue] = await Promise.all([
        getProjectCashProjectionForOrg(orgId, p.id, now),
        getDueNextWeekForProject(orgId, p.id),
      ])
      return {
        projectId: p.id,
        projectName: p.name,
        projectNumber: p.projectNumber,
        projectedBalance: projProjection.projectedBalance,
        payablesNextWeek: projDue.payablesSum,
        receivablesNextWeek: projDue.receivablesSum,
      }
    })
  )

  return {
    orgId,
    orgName: org.name,
    reportDate,
    balance,
    projection,
    payablesNextWeek: dueNextWeek.payablesSum,
    receivablesNextWeek: dueNextWeek.receivablesSum,
    alerts,
    projects,
  }
}
