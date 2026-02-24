'use server'

import { prisma } from '@repo/database'
import { getAuthContext, requireOrgFinanceAccess } from '@/lib/auth-helpers'
import { assertProjectAccess } from '@/lib/project-permissions'

// ====================
// CASHFLOW DEL PROYECTO
// ====================

export interface CashflowDataPoint {
  month: string
  income: number
  expense: number
  balance: number
  incomeCount: number
  expenseCount: number
}

export async function getProjectCashflow(
  projectId: string,
  dateRange?: { from: Date; to: Date }
): Promise<CashflowDataPoint[]> {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return []
  }
  const to = dateRange?.to ?? new Date()
  const from = dateRange?.from ?? new Date(to.getFullYear(), to.getMonth() - 6, 1)

  const transactions = await prisma.financeTransaction.findMany({
    where: {
      projectId,
      orgId: org.orgId,
      deleted: false,
      issueDate: { gte: from, lte: to },
    },
    select: {
      issueDate: true,
      type: true,
      amountBaseCurrency: true,
      status: true,
    },
    orderBy: { issueDate: 'asc' },
  })

  const monthlyData = new Map<string, CashflowDataPoint>()
  const current = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  while (current <= end) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
    monthlyData.set(monthKey, {
      month: monthKey,
      income: 0,
      expense: 0,
      balance: 0,
      incomeCount: 0,
      expenseCount: 0,
    })
    current.setMonth(current.getMonth() + 1)
  }

  transactions.forEach((tx) => {
    const d = new Date(tx.issueDate)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const data = monthlyData.get(monthKey)
    if (!data) return
    const amount = Number(tx.amountBaseCurrency)
    if (tx.type === 'INCOME' || tx.type === 'SALE') {
      data.income += amount
      data.incomeCount++
    } else if (tx.type === 'EXPENSE' || tx.type === 'PURCHASE' || tx.type === 'OVERHEAD') {
      data.expense += amount
      data.expenseCount++
    }
  })

  let runningBalance = 0
  const result = Array.from(monthlyData.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((point) => {
      const netCashflow = point.income - point.expense
      runningBalance += netCashflow
      return { ...point, balance: runningBalance }
    })
  return result
}

export type ProjectCashflowSummary = {
  totalIncome: number
  totalExpense: number
  avgMonthlyIncome: number
  avgMonthlyExpense: number
  periodBalance: number
}

export async function getProjectCashflowSummary(
  projectId: string,
  dateRange: { from: Date; to: Date }
): Promise<ProjectCashflowSummary> {
  const points = await getProjectCashflow(projectId, dateRange)
  const totalIncome = points.reduce((s, p) => s + p.income, 0)
  const totalExpense = points.reduce((s, p) => s + p.expense, 0)
  const monthsCount = points.length || 1
  return {
    totalIncome,
    totalExpense,
    avgMonthlyIncome: totalIncome / monthsCount,
    avgMonthlyExpense: totalExpense / monthsCount,
    periodBalance: totalIncome - totalExpense,
  }
}

export type ProjectCashflowBreakdownByWbsItem = {
  wbsNodeId: string | null
  wbsNodeCode: string
  wbsNodeName: string
  totalExpense: number
}

export type ProjectCashflowBreakdownByWbsResult = {
  breakdown: ProjectCashflowBreakdownByWbsItem[]
  /** Per-month expense by WBS for chart tab (top WBS keys + 'other') */
  timelineByWbs: Array<{ month: string; wbsExpenses: Record<string, number> }>
}

export async function getProjectCashflowBreakdownByWbs(
  projectId: string,
  dateRange: { from: Date; to: Date }
): Promise<ProjectCashflowBreakdownByWbsResult> {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return { breakdown: [], timelineByWbs: [] }
  }
  const from = dateRange.from
  const to = dateRange.to

  const [lines, transactionsWithNoLines] = await Promise.all([
    prisma.financeLine.findMany({
      where: {
        transaction: {
          projectId,
          orgId: org.orgId,
          deleted: false,
          issueDate: { gte: from, lte: to },
          type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
          status: { in: ['APPROVED', 'PAID'] },
        },
      },
      select: {
        wbsNodeId: true,
        lineTotal: true,
        transaction: { select: { issueDate: true } },
        wbsNode: { select: { code: true, name: true } },
      },
    }),
    prisma.financeTransaction.findMany({
      where: {
        projectId,
        orgId: org.orgId,
        deleted: false,
        issueDate: { gte: from, lte: to },
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: { in: ['APPROVED', 'PAID'] },
        lines: { none: {} },
      },
      select: { amountBaseCurrency: true, issueDate: true },
    }),
  ])

  const totalByWbs = new Map<
    string | null,
    { code: string; name: string; total: number }
  >()
  const byMonthByWbs = new Map<
    string,
    Map<string | null, number>
  >()

  for (const tx of transactionsWithNoLines) {
    const amount = Number(tx.amountBaseCurrency)
    const d = new Date(tx.issueDate)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const existing = totalByWbs.get(null)
    if (existing) {
      existing.total += amount
    } else {
      totalByWbs.set(null, { code: '—', name: 'Sin partida', total: amount })
    }
    let monthMap = byMonthByWbs.get(monthKey)
    if (!monthMap) {
      monthMap = new Map()
      byMonthByWbs.set(monthKey, monthMap)
    }
    monthMap.set(null, (monthMap.get(null) ?? 0) + amount)
  }

  for (const line of lines) {
    const amount = Number(line.lineTotal)
    const wbsId = line.wbsNodeId
    const code = line.wbsNode?.code ?? '—'
    const name = line.wbsNode?.name ?? 'Sin partida'

    const existing = totalByWbs.get(wbsId)
    if (existing) {
      existing.total += amount
    } else {
      totalByWbs.set(wbsId, { code, name, total: amount })
    }

    const d = new Date(line.transaction.issueDate)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    let monthMap = byMonthByWbs.get(monthKey)
    if (!monthMap) {
      monthMap = new Map()
      byMonthByWbs.set(monthKey, monthMap)
    }
    monthMap.set(wbsId, (monthMap.get(wbsId) ?? 0) + amount)
  }

  const breakdown: ProjectCashflowBreakdownByWbsItem[] = Array.from(
    totalByWbs.entries()
  )
    .map(([wbsNodeId, data]) => ({
      wbsNodeId,
      wbsNodeCode: data.code,
      wbsNodeName: data.name,
      totalExpense: data.total,
    }))
    .sort((a, b) => b.totalExpense - a.totalExpense)

  const topWbsIds = breakdown.slice(0, 8).map((b) => b.wbsNodeId)
  const monthKeys = Array.from(byMonthByWbs.keys()).sort()

  const timelineByWbs = monthKeys.map((monthKey) => {
    const monthMap = byMonthByWbs.get(monthKey)!
    const wbsExpenses: Record<string, number> = {}
    let other = 0
    for (const [wbsId, amount] of monthMap) {
      const key = wbsId ?? '__null__'
      if (topWbsIds.includes(wbsId)) {
        wbsExpenses[key] = (wbsExpenses[key] ?? 0) + amount
      } else {
        other += amount
      }
    }
    if (other > 0) wbsExpenses['__other__'] = other
    return { month: monthKey, wbsExpenses }
  })

  return { breakdown, timelineByWbs }
}

// ====================
// KPIs DE CASHFLOW
// ====================

export async function getProjectCashflowKPIs(projectId: string) {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return {
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      pendingIncome: 0,
      pendingExpense: 0,
      currentMonthIncome: 0,
      currentMonthExpense: 0,
      currentMonthNet: 0,
      upcomingPayments: [],
    }
  }
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const next30Days = new Date(now)
  next30Days.setDate(next30Days.getDate() + 30)

  const [totalIncome, totalExpense, pendingIncome, pendingExpense, currentMonthIncome, currentMonthExpense, upcomingPayments] =
    await Promise.all([
      prisma.financeTransaction.aggregate({
        where: {
          projectId,
          orgId: org.orgId,
          deleted: false,
          type: { in: ['INCOME', 'SALE'] },
          status: 'PAID',
        },
        _sum: { amountBaseCurrency: true },
      }),
      prisma.financeTransaction.aggregate({
        where: {
          projectId,
          orgId: org.orgId,
          deleted: false,
          type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
          status: 'PAID',
        },
        _sum: { amountBaseCurrency: true },
      }),
      prisma.financeTransaction.aggregate({
        where: {
          projectId,
          orgId: org.orgId,
          deleted: false,
          type: { in: ['INCOME', 'SALE'] },
          status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        },
        _sum: { amountBaseCurrency: true },
      }),
      prisma.financeTransaction.aggregate({
        where: {
          projectId,
          orgId: org.orgId,
          deleted: false,
          type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
          status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        },
        _sum: { amountBaseCurrency: true },
      }),
      prisma.financeTransaction.aggregate({
        where: {
          projectId,
          orgId: org.orgId,
          deleted: false,
          type: { in: ['INCOME', 'SALE'] },
          status: 'PAID',
          paidDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amountBaseCurrency: true },
      }),
      prisma.financeTransaction.aggregate({
        where: {
          projectId,
          orgId: org.orgId,
          deleted: false,
          type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
          status: 'PAID',
          paidDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amountBaseCurrency: true },
      }),
      prisma.financeTransaction.findMany({
        where: {
          projectId,
          orgId: org.orgId,
          deleted: false,
          type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
          status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
          dueDate: { gte: now, lte: next30Days },
        },
        select: {
          id: true,
          description: true,
          dueDate: true,
          amountBaseCurrency: true,
          party: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
    ])

  const incomeVal = Number(totalIncome._sum.amountBaseCurrency ?? 0)
  const expenseVal = Number(totalExpense._sum.amountBaseCurrency ?? 0)
  const currInc = Number(currentMonthIncome._sum.amountBaseCurrency ?? 0)
  const currExp = Number(currentMonthExpense._sum.amountBaseCurrency ?? 0)

  return {
    totalIncome: incomeVal,
    totalExpense: expenseVal,
    balance: incomeVal - expenseVal,
    pendingIncome: Number(pendingIncome._sum.amountBaseCurrency ?? 0),
    pendingExpense: Number(pendingExpense._sum.amountBaseCurrency ?? 0),
    currentMonthIncome: currInc,
    currentMonthExpense: currExp,
    currentMonthNet: currInc - currExp,
    upcomingPayments: upcomingPayments.map((p) => ({
      id: p.id,
      description: p.description,
      dueDate: p.dueDate,
      amount: Number(p.amountBaseCurrency),
      supplier: p.party?.name ?? 'N/A',
    })),
  }
}

/**
 * Actual cost per WBS node is calculated by aggregating FinanceLine.lineTotal
 * for transactions with status APPROVED or PAID (no WBSItemBudget table).
 */
export async function getWBSActualCosts(projectId: string): Promise<Record<string, number>> {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return {}
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return {}

  const lines = await prisma.financeLine.findMany({
    where: {
      wbsNodeId: { not: null },
      transaction: {
        projectId,
        status: { in: ['APPROVED', 'PAID'] },
        deleted: false,
      },
    },
    select: { wbsNodeId: true, lineTotal: true },
  })

  const costMap: Record<string, number> = {}
  for (const line of lines) {
    if (!line.wbsNodeId) continue
    costMap[line.wbsNodeId] = (costMap[line.wbsNodeId] ?? 0) + Number(line.lineTotal)
  }
  return costMap
}

/**
 * Actual cost for a single WBS node (sum of FinanceLine.lineTotal for APPROVED/PAID transactions).
 */
export async function getWBSActualCost(wbsNodeId: string): Promise<number> {
  const { org } = await getAuthContext()
  const result = await prisma.financeLine.aggregate({
    where: {
      wbsNodeId,
      transaction: {
        status: { in: ['APPROVED', 'PAID'] },
        deleted: false,
        orgId: org.orgId,
      },
    },
    _sum: { lineTotal: true },
  })
  return Number(result._sum.lineTotal ?? 0)
}

/**
 * Budget and consumed for a single WBS node (from approved budget version).
 * Used in transaction line form to show presupuesto/consumido/disponible and detect over-budget.
 */
export type WBSBudgetAndConsumed = {
  budgeted: number
  consumed: number
  available: number
}

export async function getWBSBudgetAndConsumed(
  projectId: string,
  wbsNodeId: string
): Promise<WBSBudgetAndConsumed | null> {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return null
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) return null

  const [budgetVersion, consumedResult] = await Promise.all([
    prisma.budgetVersion.findFirst({
      where: { projectId, orgId: org.orgId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: {
        budgetLines: {
          where: { wbsNodeId },
          select: { salePriceTotal: true },
        },
      },
    }),
    prisma.financeLine.aggregate({
      where: {
        wbsNodeId,
        transaction: {
          projectId,
          orgId: org.orgId,
          status: { in: ['APPROVED', 'PAID'] },
          deleted: false,
        },
      },
      _sum: { lineTotal: true },
    }),
  ])

  const budgeted =
    budgetVersion?.budgetLines.reduce((s, bl) => s + Number(bl.salePriceTotal), 0) ?? 0
  const consumed = Number(consumedResult._sum.lineTotal ?? 0)
  const available = Math.max(0, budgeted - consumed)

  return { budgeted, consumed, available }
}

// ====================
// COMPANY CASHFLOW
// ====================

export type CompanyCashflowPoint = {
  month: string
  income: number
  expense: number
  balance: number
  overhead: number
}

export async function getCompanyCashflow(dateRange?: { from: Date; to: Date }): Promise<CompanyCashflowPoint[]> {
  const { org } = await requireOrgFinanceAccess()
  const toDate = dateRange?.to ?? new Date()
  const fromDate = dateRange?.from ?? new Date(toDate.getFullYear(), toDate.getMonth() - 6, 1)

  const list = await prisma.financeTransaction.findMany({
    where: {
      orgId: org.orgId,
      deleted: false,
      issueDate: { gte: fromDate, lte: toDate },
    },
    select: { issueDate: true, type: true, amountBaseCurrency: true, projectId: true },
    orderBy: { issueDate: 'asc' },
  })

  const monthly = new Map<string, { income: number; expense: number; overhead: number }>()
  let cur = new Date(fromDate)
  while (cur <= toDate) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
    monthly.set(key, { income: 0, expense: 0, overhead: 0 })
    cur.setMonth(cur.getMonth() + 1)
  }
  for (const tx of list) {
    const key = `${tx.issueDate.getFullYear()}-${String(tx.issueDate.getMonth() + 1).padStart(2, '0')}`
    const row = monthly.get(key)
    if (!row) continue
    const amt = Number(tx.amountBaseCurrency)
    if (tx.type === 'INCOME' || tx.type === 'SALE') {
      row.income += amt
    } else {
      row.expense += amt
      if (!tx.projectId) row.overhead += amt
    }
  }
  const keys = Array.from(monthly.keys()).sort()
  let running = 0
  return keys.map((monthKey) => {
    const row = monthly.get(monthKey)!
    running += row.income - row.expense
    return { month: monthKey, ...row, balance: running }
  })
}

// ====================
// CASHFLOW CONSOLIDADO CON DESGLOSE POR PROYECTO
// ====================

export type CashflowDataPointDetailed = {
  month: string
  income: number
  expense: number
  balance: number
  overhead: number
  projectExpenses: Record<string, number>
}

export type CashflowBreakdownItem = {
  projectId: string | null
  projectName: string
  projectNumber: string
  totalExpense: number
}

export type CompanyCashflowDetailedResult = {
  timeline: CashflowDataPointDetailed[]
  breakdown: CashflowBreakdownItem[]
  summary: {
    totalIncome: number
    totalExpense: number
    totalOverhead: number
    totalProjectExpenses: number
    avgMonthlyIncome: number
    avgMonthlyExpense: number
    periodBalance: number
  }
}

export async function getCompanyCashflowDetailed(
  dateRange?: { from: Date; to: Date }
): Promise<CompanyCashflowDetailedResult> {
  const { org } = await requireOrgFinanceAccess()
  const toDate = dateRange?.to ?? new Date()
  const fromDate = dateRange?.from ?? new Date(toDate.getFullYear(), toDate.getMonth() - 6, 1)

  const list = await prisma.financeTransaction.findMany({
    where: {
      orgId: org.orgId,
      deleted: false,
      issueDate: { gte: fromDate, lte: toDate },
    },
    select: {
      issueDate: true,
      type: true,
      amountBaseCurrency: true,
      projectId: true,
      project: { select: { id: true, name: true, projectNumber: true } },
    },
    orderBy: { issueDate: 'asc' },
  })

  const monthlyData = new Map<
    string,
    { income: number; expense: number; overhead: number; projectExpenses: Record<string, number> }
  >()
  let cur = new Date(fromDate)
  while (cur <= toDate) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
    monthlyData.set(key, {
      income: 0,
      expense: 0,
      overhead: 0,
      projectExpenses: {},
    })
    cur.setMonth(cur.getMonth() + 1)
  }

  const projectTotals = new Map<
    string | null,
    { name: string; number: string; total: number }
  >()

  for (const tx of list) {
    const key = `${tx.issueDate.getFullYear()}-${String(tx.issueDate.getMonth() + 1).padStart(2, '0')}`
    const data = monthlyData.get(key)
    if (!data) continue

    const amount = Number(tx.amountBaseCurrency)

    if (tx.type === 'INCOME' || tx.type === 'SALE') {
      data.income += amount
    } else if (tx.type === 'EXPENSE' || tx.type === 'PURCHASE' || tx.type === 'OVERHEAD') {
      data.expense += amount

      if (!tx.projectId) {
        data.overhead += amount
        const existing = projectTotals.get(null)
        if (existing) {
          existing.total += amount
        } else {
          projectTotals.set(null, { name: 'Generales', number: '—', total: amount })
        }
      } else {
        if (!data.projectExpenses[tx.projectId]) {
          data.projectExpenses[tx.projectId] = 0
        }
        data.projectExpenses[tx.projectId] += amount

        const existing = projectTotals.get(tx.projectId)
        if (existing) {
          existing.total += amount
        } else {
          projectTotals.set(tx.projectId, {
            name: tx.project?.name ?? 'Proyecto',
            number: tx.project?.projectNumber ?? '—',
            total: amount,
          })
        }
      }
    }
  }

  const keys = Array.from(monthlyData.keys()).sort()
  let runningBalance = 0
  const timeline: CashflowDataPointDetailed[] = keys.map((monthKey) => {
    const row = monthlyData.get(monthKey)!
    const netCashflow = row.income - row.expense
    runningBalance += netCashflow
    return {
      month: monthKey,
      ...row,
      balance: runningBalance,
    }
  })

  const breakdown: CashflowBreakdownItem[] = Array.from(projectTotals.entries())
    .map(([projectId, data]) => ({
      projectId,
      projectName: data.name,
      projectNumber: data.number,
      totalExpense: data.total,
    }))
    .sort((a, b) => b.totalExpense - a.totalExpense)

  const totalIncome = timeline.reduce((sum, p) => sum + p.income, 0)
  const totalExpense = timeline.reduce((sum, p) => sum + p.expense, 0)
  const totalOverhead = timeline.reduce((sum, p) => sum + p.overhead, 0)
  const totalProjectExpenses = totalExpense - totalOverhead
  const monthsCount = timeline.length || 1

  const summary = {
    totalIncome,
    totalExpense,
    totalOverhead,
    totalProjectExpenses,
    avgMonthlyIncome: totalIncome / monthsCount,
    avgMonthlyExpense: totalExpense / monthsCount,
    periodBalance: totalIncome - totalExpense,
  }

  return { timeline, breakdown, summary }
}

// ====================
// COMPARATIVA MES ANTERIOR
// ====================

export type CashflowMonthComparisonResult = {
  current: { income: number; expense: number; balance: number }
  previous: { income: number; expense: number; balance: number }
  changes: { incomeChange: number; expenseChange: number; balanceChange: number }
}

export async function getCashflowMonthComparison(): Promise<CashflowMonthComparisonResult> {
  const { org } = await requireOrgFinanceAccess()
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  const baseWhere = { orgId: org.orgId, deleted: false }

  const [currentIncome, currentExpense, prevIncome, prevExpense] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['INCOME', 'SALE'] },
        issueDate: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        issueDate: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['INCOME', 'SALE'] },
        issueDate: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        issueDate: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      _sum: { amountBaseCurrency: true },
    }),
  ])

  const currIncome = Number(currentIncome._sum.amountBaseCurrency ?? 0)
  const currExpense = Number(currentExpense._sum.amountBaseCurrency ?? 0)
  const pIncome = Number(prevIncome._sum.amountBaseCurrency ?? 0)
  const pExpense = Number(prevExpense._sum.amountBaseCurrency ?? 0)

  const incomeChange = pIncome === 0 ? 0 : ((currIncome - pIncome) / pIncome) * 100
  const expenseChange = pExpense === 0 ? 0 : ((currExpense - pExpense) / pExpense) * 100
  const prevBalance = pIncome - pExpense
  const balanceChange =
    prevBalance === 0 ? 0 : ((currIncome - currExpense - prevBalance) / Math.abs(prevBalance)) * 100

  return {
    current: {
      income: currIncome,
      expense: currExpense,
      balance: currIncome - currExpense,
    },
    previous: {
      income: pIncome,
      expense: pExpense,
      balance: prevBalance,
    },
    changes: {
      incomeChange,
      expenseChange,
      balanceChange,
    },
  }
}

export async function getProjectCashflowMonthComparison(
  projectId: string
): Promise<CashflowMonthComparisonResult> {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return {
      current: { income: 0, expense: 0, balance: 0 },
      previous: { income: 0, expense: 0, balance: 0 },
      changes: { incomeChange: 0, expenseChange: 0, balanceChange: 0 },
    }
  }
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  const baseWhere = { orgId: org.orgId, projectId, deleted: false }

  const [currentIncome, currentExpense, prevIncome, prevExpense] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['INCOME', 'SALE'] },
        issueDate: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        issueDate: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['INCOME', 'SALE'] },
        issueDate: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        issueDate: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      _sum: { amountBaseCurrency: true },
    }),
  ])

  const currIncome = Number(currentIncome._sum.amountBaseCurrency ?? 0)
  const currExpense = Number(currentExpense._sum.amountBaseCurrency ?? 0)
  const pIncome = Number(prevIncome._sum.amountBaseCurrency ?? 0)
  const pExpense = Number(prevExpense._sum.amountBaseCurrency ?? 0)

  const incomeChange = pIncome === 0 ? 0 : ((currIncome - pIncome) / pIncome) * 100
  const expenseChange = pExpense === 0 ? 0 : ((currExpense - pExpense) / pExpense) * 100
  const prevBalance = pIncome - pExpense
  const balanceChange =
    prevBalance === 0 ? 0 : ((currIncome - currExpense - prevBalance) / Math.abs(prevBalance)) * 100

  return {
    current: {
      income: currIncome,
      expense: currExpense,
      balance: currIncome - currExpense,
    },
    previous: {
      income: pIncome,
      expense: pExpense,
      balance: prevBalance,
    },
    changes: {
      incomeChange,
      expenseChange,
      balanceChange,
    },
  }
}
