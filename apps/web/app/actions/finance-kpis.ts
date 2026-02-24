'use server'

import { prisma } from '@repo/database'
import { requireOrgFinanceAccess } from '@/lib/auth-helpers'
import { serializeTransaction } from './finance-helpers'
import { getOverheadDashboard, type OverheadDashboard } from './finance-overhead'

// ====================
// FINANZAS GLOBAL DE EMPRESA (módulo top-level, multi-tenant estricto)
// ====================

/** Balance de la empresa (ingresos pagados − gastos pagados). Para mostrar en Transacciones de la empresa. */
export async function getCompanyFinanceBalance(): Promise<number> {
  const { org } = await requireOrgFinanceAccess()
  const baseWhere = { orgId: org.orgId, deleted: false }
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

export type CompanyTransactionsFilters = {
  projectId?: string | null // 'null' o null = solo overhead
  /** Varios proyectos (tiene prioridad sobre projectId si tiene longitud) */
  projectIds?: string[]
  type?: string
  partyId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export async function getCompanyTransactions(filters: CompanyTransactionsFilters = {}) {
  const { org } = await requireOrgFinanceAccess()
  if (filters.projectId && filters.projectId !== 'null') {
    const project = await prisma.project.findFirst({
      where: { id: filters.projectId, orgId: org.orgId },
      select: { id: true },
    })
    if (!project) throw new Error('Proyecto no encontrado')
  }
  if (filters.projectIds?.length) {
    const found = await prisma.project.findMany({
      where: { id: { in: filters.projectIds }, orgId: org.orgId },
      select: { id: true },
    })
    if (found.length !== filters.projectIds.length) throw new Error('Uno o más proyectos no encontrados')
  }
  if (filters.partyId) {
    const party = await prisma.party.findFirst({
      where: { id: filters.partyId, orgId: org.orgId },
      select: { id: true },
    })
    if (!party) throw new Error('Proveedor/Cliente no encontrado')
  }

  const where: Record<string, unknown> = {
    orgId: org.orgId,
    deleted: false,
  }
  if (filters.projectIds?.length) {
    where.projectId = { in: filters.projectIds }
  } else if (filters.projectId !== undefined) {
    if (filters.projectId === 'null' || filters.projectId === null) {
      where.projectId = null
    } else {
      where.projectId = filters.projectId
    }
  }
  if (filters.type) where.type = filters.type
  if (filters.partyId) where.partyId = filters.partyId
  if (filters.status) where.status = filters.status
  if (filters.dateFrom || filters.dateTo) {
    where.issueDate = {}
    if (filters.dateFrom) (where.issueDate as Record<string, Date>).gte = new Date(filters.dateFrom)
    if (filters.dateTo) (where.issueDate as Record<string, Date>).lte = new Date(filters.dateTo)
  }
  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: 'insensitive' } },
      { reference: { contains: filters.search, mode: 'insensitive' } },
      { transactionNumber: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  const list = await prisma.financeTransaction.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, projectNumber: true } },
      party: { select: { id: true, name: true, partyType: true } },
      createdBy: { select: { user: { select: { fullName: true } } } },
      overheadAllocations: { include: { project: { select: { name: true } } } },
    },
    orderBy: { issueDate: 'desc' },
    take: 500,
  })
  return list.map((t) => {
    const serialized = serializeTransaction({
      ...t,
      total: t.total,
      subtotal: t.subtotal,
      taxTotal: t.taxTotal,
      amountBaseCurrency: t.amountBaseCurrency,
    })
    return {
      ...serialized,
      overheadAllocations: (t.overheadAllocations ?? []).map((a) => ({
        id: a.id,
        orgId: a.orgId,
        transactionId: a.transactionId,
        projectId: a.projectId,
        allocationPct: Number(a.allocationPct),
        allocationAmount: Number(a.allocationAmount),
        notes: a.notes,
        createdAt: a.createdAt,
        project: a.project,
      })),
    }
  })
}

export type CompanyFinanceDashboard = {
  totalIncome: number
  totalExpense: number
  balance: number
  pendingIncome: number
  pendingExpense: number
  currentMonthIncome: number
  currentMonthExpense: number
  currentMonthNet: number
  unallocatedOverhead: number
  upcomingPayments: Array<{
    id: string
    description: string
    dueDate: Date | null
    amount: number
    supplier: string
    project: string
  }>
  topProjects: Array<{
    projectId: string | null
    projectName: string
    projectNumber: string
    totalExpense: number
  }>
}

export async function getCompanyFinanceDashboard(): Promise<CompanyFinanceDashboard> {
  const { org } = await requireOrgFinanceAccess()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const next30 = new Date(now)
  next30.setDate(next30.getDate() + 30)
  const last3Months = new Date(now)
  last3Months.setMonth(last3Months.getMonth() - 3)

  const baseWhere = { orgId: org.orgId, deleted: false }

  const [totalIncome, totalExpense, pendingIncome, pendingExpense, currentMonthIncome, currentMonthExpense, upcomingPayments, projectExpenses, projects, overheadTx] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['INCOME', 'SALE'] }, status: 'PAID' },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] }, status: 'PAID' },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['INCOME', 'SALE'] }, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] }, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['INCOME', 'SALE'] }, status: 'PAID', paidDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] }, status: 'PAID', paidDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.findMany({
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { gte: now, lte: next30 },
      },
      select: {
        id: true,
        description: true,
        dueDate: true,
        amountBaseCurrency: true,
        party: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.financeTransaction.groupBy({
      by: ['projectId'],
      where: {
        ...baseWhere,
        projectId: { not: null },
        type: { in: ['EXPENSE', 'PURCHASE'] },
        status: 'PAID',
        paidDate: { gte: last3Months },
      },
      _sum: { amountBaseCurrency: true },
      orderBy: { _sum: { amountBaseCurrency: 'desc' } },
      take: 5,
    }),
    prisma.project.findMany({
      where: { orgId: org.orgId },
      select: { id: true, name: true, projectNumber: true },
    }),
    prisma.financeTransaction.findMany({
      where: { ...baseWhere, projectId: null, type: 'OVERHEAD' },
      select: {
        id: true,
        total: true,
        overheadAllocations: { select: { allocationAmount: true } },
      },
    }),
  ])

  const projectMap = new Map(projects.map((p) => [p.id, p]))
  const topProjects = projectExpenses.map((p) => {
    const proj = projectMap.get(p.projectId!)
    return {
      projectId: p.projectId,
      projectName: proj?.name ?? 'Proyecto eliminado',
      projectNumber: proj?.projectNumber ?? '—',
      totalExpense: Number(p._sum.amountBaseCurrency ?? 0),
    }
  })

  let unallocatedOverhead = 0
  for (const tx of overheadTx) {
    const allocated = tx.overheadAllocations.reduce((s, a) => s + Number(a.allocationAmount), 0)
    const total = Number(tx.total)
    if (total - allocated > 0) unallocatedOverhead += total - allocated
  }

  const ti = Number(totalIncome._sum.amountBaseCurrency ?? 0)
  const te = Number(totalExpense._sum.amountBaseCurrency ?? 0)
  const cmi = Number(currentMonthIncome._sum.amountBaseCurrency ?? 0)
  const cme = Number(currentMonthExpense._sum.amountBaseCurrency ?? 0)

  return {
    totalIncome: ti,
    totalExpense: te,
    balance: ti - te,
    pendingIncome: Number(pendingIncome._sum.amountBaseCurrency ?? 0),
    pendingExpense: Number(pendingExpense._sum.amountBaseCurrency ?? 0),
    currentMonthIncome: cmi,
    currentMonthExpense: cme,
    currentMonthNet: cmi - cme,
    unallocatedOverhead,
    upcomingPayments: upcomingPayments.map((p) => ({
      id: p.id,
      description: p.description,
      dueDate: p.dueDate,
      amount: Number(p.amountBaseCurrency),
      supplier: p.party?.name ?? '—',
      project: p.project?.name ?? 'Generales',
    })),
    topProjects,
  }
}

// ====================
// DASHBOARD EJECUTIVO - DATOS PARA GRÁFICOS
// ====================

export type FinanceExecutiveDashboard = {
  summary: CompanyFinanceDashboard
  monthlyTrend: Array<{ month: string; income: number; expense: number; balance: number }>
  expensesByCategory: Array<{ category: string; total: number; count: number }>
  topSuppliers: Array<{ supplierId: string; supplierName: string; total: number; count: number }>
  topProjectsByExpense: Array<{
    projectId: string
    projectName: string
    projectNumber: string
    total: number
  }>
  upcomingDue: Array<{
    id: string
    description: string
    dueDate: Date | null
    amount: number
    supplier: string
    project: string
  }>
  overheadSummary: OverheadDashboard
}

export async function getFinanceExecutiveDashboard(): Promise<FinanceExecutiveDashboard> {
  const { org } = await requireOrgFinanceAccess()
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const startDate = new Date(currentYear, currentMonth - 11, 1)
  const endDate = new Date(now)
  endDate.setHours(23, 59, 59, 999)

  const baseWhere = { orgId: org.orgId, deleted: false }

  // 1. Transacciones últimos 12 meses para tendencia mensual
  const transactionsForTrend = await prisma.financeTransaction.findMany({
    where: {
      ...baseWhere,
      issueDate: { gte: startDate, lte: endDate },
    },
    select: { issueDate: true, type: true, amountBaseCurrency: true },
  })

  const monthMap = new Map<
    string,
    { income: number; expense: number }
  >()
  for (let m = 0; m < 12; m++) {
    const d = new Date(currentYear, currentMonth - 11 + m, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, { income: 0, expense: 0 })
  }
  for (const tx of transactionsForTrend) {
    const key = `${tx.issueDate.getFullYear()}-${String(tx.issueDate.getMonth() + 1).padStart(2, '0')}`
    const row = monthMap.get(key)
    if (!row) continue
    const amount = Number(tx.amountBaseCurrency)
    if (tx.type === 'INCOME' || tx.type === 'SALE') {
      row.income += amount
    } else if (tx.type === 'EXPENSE' || tx.type === 'PURCHASE' || tx.type === 'OVERHEAD') {
      row.expense += amount
    }
  }
  const monthlyTrend = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, row]) => ({
      month,
      income: row.income,
      expense: row.expense,
      balance: row.income - row.expense,
    }))

  // 2. Gastos por categoría (tipo)
  const expensesByType = await prisma.financeTransaction.groupBy({
    by: ['type'],
    where: {
      ...baseWhere,
      type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
      issueDate: { gte: startDate },
    },
    _sum: { amountBaseCurrency: true },
    _count: true,
  })
  const expensesByCategory = expensesByType.map((r) => ({
    category: r.type,
    total: Number(r._sum.amountBaseCurrency ?? 0),
    count: r._count,
  }))

  // 3. Top 5 proveedores por gasto (transacciones con party SUPPLIER)
  const supplierParties = await prisma.party.findMany({
    where: { orgId: org.orgId, partyType: 'SUPPLIER' },
    select: { id: true, name: true },
  })
  const supplierIds = new Set(supplierParties.map((p) => p.id))
  const txBySupplier = await prisma.financeTransaction.groupBy({
    by: ['partyId'],
    where: {
      ...baseWhere,
      type: { in: ['EXPENSE', 'PURCHASE'] },
      partyId: { in: Array.from(supplierIds) },
      issueDate: { gte: startDate },
    },
    _sum: { amountBaseCurrency: true },
    _count: true,
  })
  const supplierMap = new Map(supplierParties.map((p) => [p.id, p.name]))
  const topSuppliers = txBySupplier
    .map((r) => ({
      supplierId: r.partyId!,
      supplierName: supplierMap.get(r.partyId!) ?? '—',
      total: Number(r._sum.amountBaseCurrency ?? 0),
      count: r._count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // 4. Top 5 proyectos por gasto
  const projectExpenses = await prisma.financeTransaction.groupBy({
    by: ['projectId'],
    where: {
      ...baseWhere,
      projectId: { not: null },
      type: { in: ['EXPENSE', 'PURCHASE'] },
      issueDate: { gte: startDate },
    },
    _sum: { amountBaseCurrency: true },
    orderBy: { _sum: { amountBaseCurrency: 'desc' } },
    take: 5,
  })
  const projectIds = projectExpenses.map((p) => p.projectId).filter((id): id is string => id != null)
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds }, orgId: org.orgId },
    select: { id: true, name: true, projectNumber: true },
  })
  const projectNameMap = new Map(projects.map((p) => [p.id, p]))
  const topProjectsByExpense = projectExpenses.map((p) => {
    const proj = projectNameMap.get(p.projectId!)
    return {
      projectId: p.projectId!,
      projectName: proj?.name ?? '—',
      projectNumber: proj?.projectNumber ?? '—',
      total: Number(p._sum.amountBaseCurrency ?? 0),
    }
  })

  // 5. Próximos vencimientos (30 días)
  const next30 = new Date(now)
  next30.setDate(next30.getDate() + 30)
  const upcomingDue = await prisma.financeTransaction.findMany({
    where: {
      ...baseWhere,
      type: { in: ['EXPENSE', 'PURCHASE'] },
      status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
      dueDate: { gte: now, lte: next30 },
    },
    select: {
      id: true,
      description: true,
      dueDate: true,
      amountBaseCurrency: true,
      party: { select: { name: true } },
      project: { select: { name: true, projectNumber: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 10,
  })

  const [summary, overheadSummary] = await Promise.all([
    getCompanyFinanceDashboard(),
    getOverheadDashboard(),
  ])

  return {
    summary,
    monthlyTrend,
    expensesByCategory,
    topSuppliers,
    topProjectsByExpense,
    upcomingDue: upcomingDue.map((tx) => ({
      id: tx.id,
      description: tx.description,
      dueDate: tx.dueDate,
      amount: Number(tx.amountBaseCurrency),
      supplier: tx.party?.name ?? '—',
      project: tx.project?.name ?? 'Generales',
    })),
    overheadSummary,
  }
}

// ====================
// DASHBOARD EJECUTIVO POR PROYECTO
// ====================

export type ProjectFinanceExecutiveDashboard = {
  summary: CompanyFinanceDashboard
  /** Presupuesto aprobado del proyecto (suma salePriceTotal de versión APPROVED). */
  budgeted: number
  /** Gasto real pagado del proyecto (EXPENSE/PURCHASE/OVERHEAD PAID). */
  consumed: number
  monthlyTrend: Array<{ month: string; income: number; expense: number; balance: number }>
  expensesByType: Array<{ type: string; total: number; count: number }>
  topSuppliers: Array<{ supplierId: string; supplierName: string; total: number; count: number }>
}

export async function getProjectFinanceExecutiveDashboard(
  projectId: string
): Promise<ProjectFinanceExecutiveDashboard> {
  const { org } = await requireOrgFinanceAccess()
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) throw new Error('Proyecto no encontrado')

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const startDate = new Date(currentYear, currentMonth - 11, 1)
  const endDate = new Date(now)
  endDate.setHours(23, 59, 59, 999)
  const startOfMonth = new Date(currentYear, currentMonth, 1)
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0)
  const next30 = new Date(now)
  next30.setDate(next30.getDate() + 30)

  const baseWhere = { orgId: org.orgId, projectId, deleted: false }

  const [approvedBudgetVersion, totalIncome, totalExpense,
    pendingIncome,
    pendingExpense,
    currentMonthIncome,
    currentMonthExpense,
    transactionsForTrend,
    upcomingPayments,
    expensesByTypeRaw,
    txBySupplier,
  ] = await Promise.all([
    prisma.budgetVersion.findFirst({
      where: { projectId, orgId: org.orgId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        budgetLines: { select: { salePriceTotal: true } },
      },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['INCOME', 'SALE'] }, status: 'PAID' },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] }, status: 'PAID' },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['INCOME', 'SALE'] }, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] }, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['INCOME', 'SALE'] }, status: 'PAID', paidDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...baseWhere, type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] }, status: 'PAID', paidDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.financeTransaction.findMany({
      where: { ...baseWhere, issueDate: { gte: startDate, lte: endDate } },
      select: { issueDate: true, type: true, amountBaseCurrency: true },
    }),
    prisma.financeTransaction.findMany({
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE'] },
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        dueDate: { gte: now, lte: next30 },
      },
      select: {
        id: true,
        description: true,
        dueDate: true,
        amountBaseCurrency: true,
        party: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.financeTransaction.groupBy({
      by: ['type'],
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
        status: 'PAID',
        issueDate: { gte: startDate, lte: endDate },
      },
      _sum: { amountBaseCurrency: true },
      _count: true,
    }),
    prisma.financeTransaction.groupBy({
      by: ['partyId'],
      where: {
        ...baseWhere,
        type: { in: ['EXPENSE', 'PURCHASE'] },
        status: 'PAID',
        partyId: { not: null },
        issueDate: { gte: startDate, lte: endDate },
      },
      _sum: { amountBaseCurrency: true },
      _count: true,
    }),
  ])

  const budgeted =
    approvedBudgetVersion?.budgetLines.reduce(
      (s, bl) => s + Number(bl.salePriceTotal),
      0
    ) ?? 0
  const ti = Number(totalIncome._sum.amountBaseCurrency ?? 0)
  const te = Number(totalExpense._sum.amountBaseCurrency ?? 0)
  const consumed = te
  const cmi = Number(currentMonthIncome._sum.amountBaseCurrency ?? 0)
  const cme = Number(currentMonthExpense._sum.amountBaseCurrency ?? 0)

  const monthMap = new Map<string, { income: number; expense: number }>()
  for (let m = 0; m < 12; m++) {
    const d = new Date(currentYear, currentMonth - 11 + m, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, { income: 0, expense: 0 })
  }
  for (const tx of transactionsForTrend) {
    const key = `${tx.issueDate.getFullYear()}-${String(tx.issueDate.getMonth() + 1).padStart(2, '0')}`
    const row = monthMap.get(key)
    if (!row) continue
    const amount = Number(tx.amountBaseCurrency)
    if (tx.type === 'INCOME' || tx.type === 'SALE') {
      row.income += amount
    } else if (tx.type === 'EXPENSE' || tx.type === 'PURCHASE' || tx.type === 'OVERHEAD') {
      row.expense += amount
    }
  }
  const monthlyTrend = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, row]) => ({
      month,
      income: row.income,
      expense: row.expense,
      balance: row.income - row.expense,
    }))

  const expensesByType = expensesByTypeRaw.map((r) => ({
    type: r.type,
    total: Number(r._sum.amountBaseCurrency ?? 0),
    count: r._count,
  }))

  const supplierPartyIds = [...new Set(txBySupplier.map((r) => r.partyId).filter(Boolean))] as string[]
  const supplierParties =
    supplierPartyIds.length > 0
      ? await prisma.party.findMany({
          where: { id: { in: supplierPartyIds } },
          select: { id: true, name: true },
        })
      : []
  const supplierNameMap = new Map(supplierParties.map((p) => [p.id, p.name]))
  const topSuppliers = txBySupplier
    .map((r) => ({
      supplierId: r.partyId!,
      supplierName: supplierNameMap.get(r.partyId!) ?? '—',
      total: Number(r._sum.amountBaseCurrency ?? 0),
      count: r._count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const summary: CompanyFinanceDashboard = {
    totalIncome: ti,
    totalExpense: te,
    balance: ti - te,
    pendingIncome: Number(pendingIncome._sum.amountBaseCurrency ?? 0),
    pendingExpense: Number(pendingExpense._sum.amountBaseCurrency ?? 0),
    currentMonthIncome: cmi,
    currentMonthExpense: cme,
    currentMonthNet: cmi - cme,
    unallocatedOverhead: 0,
    upcomingPayments: upcomingPayments.map((p) => ({
      id: p.id,
      description: p.description,
      dueDate: p.dueDate,
      amount: Number(p.amountBaseCurrency),
      supplier: p.party?.name ?? '—',
      project: p.project?.name ?? '—',
    })),
    topProjects: [],
  }

  return { summary, budgeted, consumed, monthlyTrend, expensesByType, topSuppliers }
}

// ====================
// PROYECTOS ACTIVOS (para selector de asignación)
// ====================

export async function getActiveProjects(): Promise<
  Array<{ id: string; name: string; projectNumber: string }>
> {
  const { org } = await requireOrgFinanceAccess()
  return prisma.project.findMany({
    where: { orgId: org.orgId, active: true },
    select: { id: true, name: true, projectNumber: true },
    orderBy: { name: 'asc' },
  })
}

export async function getAllProjects(): Promise<
  Array<{ id: string; name: string; projectNumber: string }>
> {
  const { org } = await requireOrgFinanceAccess()
  return prisma.project.findMany({
    where: { orgId: org.orgId },
    select: { id: true, name: true, projectNumber: true },
    orderBy: { name: 'asc' },
  })
}

export async function getFinanceFilterOptions(): Promise<{
  projects: Array<{ id: string; name: string; projectNumber: string }>
  parties: Array<{ id: string; name: string; partyType: string }>
}> {
  const { org } = await requireOrgFinanceAccess()
  const [projects, parties] = await Promise.all([
    prisma.project.findMany({
      where: { orgId: org.orgId, active: true },
      select: { id: true, name: true, projectNumber: true },
      orderBy: { name: 'asc' },
    }),
    prisma.party.findMany({
      where: { orgId: org.orgId, active: true },
      select: { id: true, name: true, partyType: true },
      orderBy: { name: 'asc' },
      take: 500,
    }),
  ])
  return { projects, parties }
}
