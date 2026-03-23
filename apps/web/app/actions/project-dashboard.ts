'use server'

import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'

async function getAuthForProject() {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')
  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) throw new Error('No autorizado')
  return { org }
}

export type ProjectDashboardData = {
  budget: {
    total: number
    spent: number
    committed: number
    remaining: number
    variance: number
    variancePct: number
    commitmentRatio: number
  }
  certifications: {
    total: number
    count: number
    data: Array<{ number: number; period: string; amount: number; status: string }>
  }
  expensesByWbs: Array<{
    wbsCode: string
    wbsName: string
    budgeted: number
    actual: number
    committed: number
    variance: number
  }>
  expensesBySupplier: Array<{
    supplierId: string
    supplierName: string
    total: number
    count: number
  }>
  cashflow: Array<{ month: string; income: number; expense: number; balance: number }>
}

export async function getProjectDashboardData(projectId: string): Promise<ProjectDashboardData> {
  const { org } = await getAuthForProject()

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true },
  })
  if (!project) throw new Error('Proyecto no encontrado')

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const [budgetVersion, actualExpenses, committedExpenses, certifications, , supplierParties, transactionsForCashflow, financeLinesForWbs, commitmentLinesByWbs] = await Promise.all([
    (async () => {
      let version = await prisma.budgetVersion.findFirst({
        where: { projectId, orgId: org.orgId, status: { in: ['APPROVED', 'BASELINE'] } },
        orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
        include: {
          budgetLines: {
            include: { wbsNode: { select: { id: true, code: true, name: true } } },
          },
        },
      })
      if (!version) {
        version = await prisma.budgetVersion.findFirst({
          where: { projectId, orgId: org.orgId },
          orderBy: { createdAt: 'desc' },
          include: {
            budgetLines: {
              include: { wbsNode: { select: { id: true, code: true, name: true } } },
            },
          },
        })
      }
      return version ?? null
    })(),
    prisma.financeTransaction.aggregate({
      where: {
        projectId,
        orgId: org.orgId,
        deleted: false,
        type: { in: ['EXPENSE', 'PURCHASE'] },
        status: 'PAID',
      },
      _sum: { amountBaseCurrency: true },
    }),
    prisma.commitment.aggregate({
      where: {
        projectId,
        orgId: org.orgId,
        status: { in: ['DRAFT', 'PENDING', 'APPROVED'] },
      },
      _sum: { totalBaseCurrency: true },
    }),
    prisma.certification.findMany({
      where: { projectId, orgId: org.orgId },
      include: { lines: { select: { periodAmount: true } } },
      orderBy: { number: 'asc' },
    }),
    prisma.wbsNode.findMany({
      where: { projectId, orgId: org.orgId },
      select: { id: true, code: true, name: true },
    }),
    prisma.party.findMany({
      where: { orgId: org.orgId, partyType: 'SUPPLIER' },
      select: { id: true, name: true },
    }),
    prisma.financeTransaction.findMany({
      where: {
        projectId,
        orgId: org.orgId,
        deleted: false,
        issueDate: { gte: sixMonthsAgo },
      },
      select: { issueDate: true, type: true, amountBaseCurrency: true },
    }),
    prisma.financeLine.findMany({
      where: {
        transaction: {
          projectId,
          orgId: org.orgId,
          deleted: false,
          type: { in: ['EXPENSE', 'PURCHASE'] },
          status: 'PAID',
        },
      },
      select: { wbsNodeId: true, lineTotal: true },
    }),
    prisma.commitmentLine.findMany({
      where: {
        commitment: {
          projectId,
          orgId: org.orgId,
          commitmentType: 'PO',
          status: 'APPROVED',
          deleted: false,
        },
        wbsNodeId: { not: null },
      },
      select: { wbsNodeId: true, lineTotal: true },
    }),
  ])

  const totalBudget = (() => {
    if (!budgetVersion?.budgetLines?.length) return 0
    const totalDirectCost = budgetVersion.budgetLines.reduce(
      (sum, bl) => sum + Number(bl.directCostTotal ?? 0),
      0
    )
    const gg = Number(budgetVersion.globalOverheadPct)
    const gf = Number(budgetVersion.globalFinancialPct)
    const util = Number(budgetVersion.globalProfitPct)
    const tax = Number(budgetVersion.globalTaxPct)
    const subtotal1 = totalDirectCost * (1 + gg / 100)
    const subtotal2 = subtotal1 * (1 + gf / 100 + util / 100)
    return subtotal2 * (1 + tax / 100)
  })()
  const totalSpent = Number(actualExpenses._sum.amountBaseCurrency ?? 0)
  const totalCommitted = Number(committedExpenses._sum.totalBaseCurrency ?? 0)
  const remaining = totalBudget - totalSpent - totalCommitted
  const variance = totalBudget - totalSpent
  const variancePct = totalBudget === 0 ? 0 : (variance / totalBudget) * 100
  const commitmentRatio = totalBudget === 0 ? 0 : ((totalSpent + totalCommitted) / totalBudget) * 100

  const certificationsData = certifications.map((cert) => ({
    number: cert.number,
    period: `${cert.periodMonth}/${cert.periodYear}`,
    amount: cert.lines.reduce((sum, line) => sum + Number(line.periodAmount), 0),
    status: cert.status,
  }))
  const totalCertified = certificationsData.reduce((sum, c) => sum + c.amount, 0)

  const actualByWbs = new Map<string, number>()
  for (const fl of financeLinesForWbs) {
    if (fl.wbsNodeId) {
      actualByWbs.set(fl.wbsNodeId, (actualByWbs.get(fl.wbsNodeId) ?? 0) + Number(fl.lineTotal))
    }
  }
  const committedByWbs = new Map<string, number>()
  for (const cl of commitmentLinesByWbs) {
    if (cl.wbsNodeId) {
      committedByWbs.set(
        cl.wbsNodeId,
        (committedByWbs.get(cl.wbsNodeId) ?? 0) + Number(cl.lineTotal)
      )
    }
  }
  const budgetedByWbs = new Map<string, { code: string; name: string; total: number }>()
  if (budgetVersion?.budgetLines?.length) {
    const gg = Number(budgetVersion.globalOverheadPct)
    const gf = Number(budgetVersion.globalFinancialPct)
    const util = Number(budgetVersion.globalProfitPct)
    const tax = Number(budgetVersion.globalTaxPct)
    const factor = (1 + gg / 100) * (1 + gf / 100 + util / 100) * (1 + tax / 100)
    for (const bl of budgetVersion.budgetLines) {
      const wbs = bl.wbsNode
      if (!wbs) continue
      const directCost = Number(bl.directCostTotal ?? 0)
      const sale = directCost * factor
      const prev = budgetedByWbs.get(wbs.id)
      if (prev) {
        prev.total += sale
      } else {
        budgetedByWbs.set(wbs.id, { code: wbs.code, name: wbs.name, total: sale })
      }
    }
  }
  const expensesByWbs = Array.from(budgetedByWbs.entries())
    .map(([wbsId, b]) => ({
      wbsCode: b.code,
      wbsName: b.name,
      budgeted: b.total,
      actual: actualByWbs.get(wbsId) ?? 0,
      committed: committedByWbs.get(wbsId) ?? 0,
      variance: b.total - (actualByWbs.get(wbsId) ?? 0),
    }))
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 10)

  const supplierIds = new Set(supplierParties.map((p) => p.id))
  const txBySupplier = await prisma.financeTransaction.groupBy({
    by: ['partyId'],
    where: {
      projectId,
      orgId: org.orgId,
      deleted: false,
      type: { in: ['EXPENSE', 'PURCHASE'] },
      partyId: { in: Array.from(supplierIds) },
    },
    _sum: { amountBaseCurrency: true },
    _count: true,
  })
  const supplierMap = new Map(supplierParties.map((p) => [p.id, p.name]))
  const expensesBySupplier = txBySupplier
    .filter((r) => r.partyId != null)
    .map((r) => ({
      supplierId: r.partyId!,
      supplierName: supplierMap.get(r.partyId!) ?? '—',
      total: Number(r._sum.amountBaseCurrency ?? 0),
      count: r._count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const monthMap = new Map<string, { income: number; expense: number }>()
  for (let m = 0; m < 6; m++) {
    const d = new Date()
    d.setMonth(d.getMonth() - 5 + m)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, { income: 0, expense: 0 })
  }
  for (const tx of transactionsForCashflow) {
    const key = `${tx.issueDate.getFullYear()}-${String(tx.issueDate.getMonth() + 1).padStart(2, '0')}`
    const row = monthMap.get(key)
    if (!row) continue
    const amount = Number(tx.amountBaseCurrency)
    if (tx.type === 'INCOME' || tx.type === 'SALE') row.income += amount
    else if (tx.type === 'EXPENSE' || tx.type === 'PURCHASE') row.expense += amount
  }
  const cashflow = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, row]) => ({
      month,
      income: row.income,
      expense: row.expense,
      balance: row.income - row.expense,
    }))

  return {
    budget: {
      total: totalBudget,
      spent: totalSpent,
      committed: totalCommitted,
      remaining,
      variance,
      variancePct,
      commitmentRatio,
    },
    certifications: {
      total: totalCertified,
      count: certifications.length,
      data: certificationsData,
    },
    expensesByWbs,
    expensesBySupplier,
    cashflow,
  }
}
