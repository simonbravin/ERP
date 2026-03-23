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

export type ProjectDashboardEvm = {
  /** Presupuesto de referencia (misma base que KPI “Presupuesto total”). */
  bac: number
  /** Valor ganado: BAC × avance físico ponderado del cronograma activo. */
  ev: number
  /** Coste real: gastos pagados (misma base que “Gastado”). */
  ac: number
  /** Valor planificado lineal en el tiempo (ventana plan del cronograma activo). */
  pv: number | null
  /** Avance físico 0–100 (%), ponderado por duración planificada de tareas TASK. */
  physicalProgressPct: number
  /** CPI = EV / AC cuando AC > 0. */
  cpi: number | null
  /** SPI = EV / PV cuando PV > 0. */
  spi: number | null
  /** CV = EV − AC */
  cv: number
  /** SV = EV − PV cuando PV != null */
  sv: number | null
  hasSchedule: boolean
  scheduleName: string | null
  taskCount: number
}

export type ProjectDashboardCrossAlert = {
  kind: 'delay_and_cost' | 'schedule_delay' | 'wbs_cost_overrun'
  wbsCode: string
  wbsName: string
  /** Sobrepaso sobre presupuesto de partida (0–100+), solo en alertas de coste. */
  overspendPct?: number
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
  evm: ProjectDashboardEvm
  crossAlerts: ProjectDashboardCrossAlert[]
  certifications: {
    total: number
    count: number
    data: Array<{ number: number; period: string; amount: number; status: string }>
  }
  expensesByWbs: Array<{
    wbsNodeId: string
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

type ActiveScheduleRow = {
  id: string
  name: string
  status: string
  projectStartDate: Date
  projectEndDate: Date
}

type ScheduleTaskForDashboard = {
  progressPercent: unknown
  plannedDuration: number
  plannedStartDate: Date
  plannedEndDate: Date
  wbsNodeId: string
  wbsNode: { code: string; name: string }
}

async function loadActiveScheduleWithTasks(
  projectId: string,
  orgId: string
): Promise<{ active: ActiveScheduleRow | null; tasks: ScheduleTaskForDashboard[] }> {
  const schedules = await prisma.schedule.findMany({
    where: { projectId, orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      isBaseline: true,
      projectStartDate: true,
      projectEndDate: true,
    },
  })
  if (schedules.length === 0) {
    return { active: null, tasks: [] }
  }
  const active =
    schedules.find((s) => s.status === 'DRAFT') ??
    schedules.find((s) => s.isBaseline) ??
    schedules[0]
  const tasks = await prisma.scheduleTask.findMany({
    where: { scheduleId: active.id, taskType: 'TASK' },
    select: {
      progressPercent: true,
      plannedDuration: true,
      plannedStartDate: true,
      plannedEndDate: true,
      wbsNodeId: true,
      wbsNode: { select: { code: true, name: true } },
    },
  })
  return { active, tasks }
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

  const [budgetVersion, actualExpenses, committedExpenses, certifications, scheduleContext, supplierParties, transactionsForCashflow, financeLinesForWbs, commitmentLinesByWbs] =
    await Promise.all([
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
    loadActiveScheduleWithTasks(projectId, org.orgId),
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
      wbsNodeId: wbsId,
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

  const { active: activeSchedule, tasks: scheduleTasks } = scheduleContext
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const delayedWbsInfo = new Map<string, { code: string; name: string }>()
  for (const t of scheduleTasks) {
    if (t.plannedEndDate >= startOfToday || Number(t.progressPercent) >= 99.5) continue
    delayedWbsInfo.set(t.wbsNodeId, { code: t.wbsNode.code, name: t.wbsNode.name })
  }

  let physicalProgressPct = 0
  let weightedProgress = 0
  let durationWeight = 0
  for (const t of scheduleTasks) {
    const d = Math.max(1, t.plannedDuration)
    const p = Math.min(100, Math.max(0, Number(t.progressPercent)))
    durationWeight += d
    weightedProgress += p * d
  }
  if (durationWeight > 0) physicalProgressPct = weightedProgress / durationWeight

  const bac = totalBudget
  const ac = totalSpent
  const ev = bac * (physicalProgressPct / 100)

  let pv: number | null = null
  if (activeSchedule) {
    let spanStart = activeSchedule.projectStartDate.getTime()
    let spanEnd = activeSchedule.projectEndDate.getTime()
    for (const t of scheduleTasks) {
      spanStart = Math.min(spanStart, t.plannedStartDate.getTime())
      spanEnd = Math.max(spanEnd, t.plannedEndDate.getTime())
    }
    if (spanEnd > spanStart && bac > 0) {
      const now = Date.now()
      let plannedPct = 0
      if (now <= spanStart) plannedPct = 0
      else if (now >= spanEnd) plannedPct = 100
      else plannedPct = ((now - spanStart) / (spanEnd - spanStart)) * 100
      pv = bac * (plannedPct / 100)
    }
  }

  const cpi = ac > 0 ? ev / ac : null
  const spi = pv != null && pv > 0 ? ev / pv : null
  const cv = ev - ac
  const sv = pv != null ? ev - pv : null

  const evm: ProjectDashboardEvm = {
    bac,
    ev,
    ac,
    pv,
    physicalProgressPct,
    cpi,
    spi,
    cv,
    sv,
    hasSchedule: activeSchedule != null,
    scheduleName: activeSchedule?.name ?? null,
    taskCount: scheduleTasks.length,
  }

  const crossAlerts: ProjectDashboardCrossAlert[] = []
  const delayCostWbs = new Set<string>()
  const scheduleDelayEmitted = new Set<string>()

  for (const [wbsId, b] of budgetedByWbs) {
    const budgeted = b.total
    const actual = actualByWbs.get(wbsId) ?? 0
    if (delayedWbsInfo.has(wbsId) && budgeted > 0 && actual > budgeted * 1.05) {
      crossAlerts.push({
        kind: 'delay_and_cost',
        wbsCode: b.code,
        wbsName: b.name,
        overspendPct: ((actual - budgeted) / budgeted) * 100,
      })
      delayCostWbs.add(wbsId)
    }
  }

  for (const [wbsId, b] of budgetedByWbs) {
    if (delayCostWbs.has(wbsId)) continue
    const budgeted = b.total
    const actual = actualByWbs.get(wbsId) ?? 0
    if (delayedWbsInfo.has(wbsId)) {
      crossAlerts.push({ kind: 'schedule_delay', wbsCode: b.code, wbsName: b.name })
      scheduleDelayEmitted.add(wbsId)
    } else if (budgeted > 0 && actual > budgeted * 1.1) {
      crossAlerts.push({
        kind: 'wbs_cost_overrun',
        wbsCode: b.code,
        wbsName: b.name,
        overspendPct: ((actual - budgeted) / budgeted) * 100,
      })
    }
  }

  for (const [wbsId, info] of delayedWbsInfo) {
    if (delayCostWbs.has(wbsId) || scheduleDelayEmitted.has(wbsId)) continue
    crossAlerts.push({
      kind: 'schedule_delay',
      wbsCode: info.code,
      wbsName: info.name,
    })
  }

  const alertOrder: Record<ProjectDashboardCrossAlert['kind'], number> = {
    delay_and_cost: 0,
    schedule_delay: 1,
    wbs_cost_overrun: 2,
  }
  crossAlerts.sort((a, b) => alertOrder[a.kind] - alertOrder[b.kind])
  const crossAlertsCapped = crossAlerts.slice(0, 8)

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
    evm,
    crossAlerts: crossAlertsCapped,
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
