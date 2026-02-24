'use server'

import { prisma, Prisma } from '@repo/database'
import { getApprovedOrBaselineBudgetTotals } from './budget'

export type KPIs = {
  activeProjects: number
  totalBudget: number
  pendingCertifications: number
  monthExpenses: number
  /** Cuentas por cobrar: ingresos/ventas aprobados no cobrados */
  accountsReceivable: number
  /** Cuentas por pagar: gastos/compras aprobados no pagados */
  accountsPayable: number
  /** Avance % ponderado por monto certificado (solo proyectos activos, última cert aprobada) */
  progressPct: number | null
  /** Órdenes de cambio pendientes (DRAFT o CHANGES_REQUESTED) */
  pendingChangeOrders: number
}

export type CashflowDataPoint = {
  month: string
  income: number
  expenses: number
  net: number
}

export type Alert = {
  id: string
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
  link?: string
}

export type ActivityItem = {
  id: string
  action: string
  entityType: string
  actorName: string
  projectName?: string | null
  createdAt: Date
  details: unknown
}

/**
 * Get organization-wide KPIs for dashboard.
 * When allowedProjectIds is provided (restricted user), only those projects are included; null = all projects.
 */
export async function getOrgKPIs(
  orgId: string,
  allowedProjectIds: string[] | null = null
): Promise<KPIs> {
  const projectFilter =
    allowedProjectIds === null
      ? { orgId, status: 'ACTIVE' as const, active: true }
      : { orgId, status: 'ACTIVE' as const, active: true, id: { in: allowedProjectIds } }

  // Total active projects
  const activeProjectsCount = await prisma.project.count({
    where: projectFilter,
  })

  // Total budget: same logic as projects list (approved or baseline version per project)
  const activeProjects = await prisma.project.findMany({
    where: projectFilter,
    select: { id: true },
  })
  const activeProjectIds = activeProjects.map((p) => p.id)
  const budgetTotalsByProject = await getApprovedOrBaselineBudgetTotals(activeProjectIds)
  const totalBudget = Object.values(budgetTotalsByProject).reduce((sum, v) => sum + v, 0)

  // Pending certifications (ISSUED status)
  const pendingCertifications = await prisma.certification.count({
    where:
      allowedProjectIds === null
        ? { orgId, status: 'ISSUED' }
        : { orgId, status: 'ISSUED', projectId: { in: allowedProjectIds } },
  })

  // Current month expenses
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const txBaseWhere = {
    orgId,
    deleted: false,
    ...(allowedProjectIds !== null ? { projectId: { in: allowedProjectIds } } : {}),
  }

  const monthExpenses = await prisma.financeTransaction.aggregate({
    where: {
      ...txBaseWhere,
      type: { in: ['EXPENSE', 'PURCHASE'] },
      status: { in: ['APPROVED', 'PAID'] },
      issueDate: { gte: firstDayOfMonth },
    },
    _sum: { amountBaseCurrency: true },
  })

  // Cuentas por cobrar: INCOME/SALE no cobrados
  const receivables = await prisma.financeTransaction.aggregate({
    where: {
      ...txBaseWhere,
      type: { in: ['INCOME', 'SALE'] },
      status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
    },
    _sum: { amountBaseCurrency: true },
  })

  // Cuentas por pagar: EXPENSE/PURCHASE/OVERHEAD no pagados
  const payables = await prisma.financeTransaction.aggregate({
    where: {
      ...txBaseWhere,
      type: { in: ['EXPENSE', 'PURCHASE', 'OVERHEAD'] },
      status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
    },
    _sum: { amountBaseCurrency: true },
  })

  // Avance %: última certificación aprobada por proyecto activo, promedio ponderado por totalAmount
  const certificationsWithLines = await prisma.certification.findMany({
    where: {
      orgId,
      status: 'APPROVED',
      project:
        allowedProjectIds === null
          ? { status: 'ACTIVE', active: true }
          : { status: 'ACTIVE', active: true, id: { in: allowedProjectIds } },
    },
    include: {
      lines: {
        select: {
          totalProgressPct: true,
          totalAmount: true,
        },
      },
    },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
  })

  let progressPct: number | null = null
  const latestByProject = new Map<string, typeof certificationsWithLines[0]['lines']>()
  for (const cert of certificationsWithLines) {
    if (!latestByProject.has(cert.projectId)) {
      latestByProject.set(cert.projectId, cert.lines)
    }
  }
  let weightedSum = 0
  let totalWeight = 0
  for (const lines of latestByProject.values()) {
    for (const line of lines) {
      const pct = Number(line.totalProgressPct)
      const amt = Number(line.totalAmount)
      if (amt > 0) {
        weightedSum += pct * amt
        totalWeight += amt
      }
    }
  }
  if (totalWeight > 0) {
    progressPct = Math.round((weightedSum / totalWeight) * 100) / 100
  }

  // Órdenes de cambio pendientes (no aprobadas)
  const pendingChangeOrders = await prisma.changeOrder.count({
    where:
      allowedProjectIds === null
        ? { orgId, status: { in: ['DRAFT', 'CHANGES_REQUESTED'] } }
        : {
            orgId,
            status: { in: ['DRAFT', 'CHANGES_REQUESTED'] },
            projectId: { in: allowedProjectIds },
          },
  })

  return {
    activeProjects: activeProjectsCount,
    totalBudget: Number(totalBudget),
    pendingCertifications,
    monthExpenses: Number(monthExpenses._sum.amountBaseCurrency || 0),
    accountsReceivable: Number(receivables._sum.amountBaseCurrency ?? 0),
    accountsPayable: Number(payables._sum.amountBaseCurrency ?? 0),
    progressPct,
    pendingChangeOrders,
  }
}

/**
 * Get cashflow data for the last N months (default 12 for dashboard toggle)
 */
export async function getCashflowData(orgId: string, months = 12): Promise<CashflowDataPoint[]> {
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)

  // Income from approved certifications
  const certifications = await prisma.certification.findMany({
    where: {
      orgId,
      status: 'APPROVED',
      approvedAt: { gte: startDate },
    },
    include: {
      lines: {
        select: { periodAmount: true },
      },
    },
    orderBy: { periodYear: 'asc' },
  })

  // Expenses from paid/approved transactions
  const expenses = await prisma.financeTransaction.findMany({
    where: {
      orgId,
      type: { in: ['EXPENSE', 'PURCHASE'] },
      status: { in: ['APPROVED', 'PAID'] },
      issueDate: { gte: startDate },
      deleted: false,
    },
    select: {
      issueDate: true,
      amountBaseCurrency: true,
    },
    orderBy: { issueDate: 'asc' },
  })

  // Group by month
  const monthlyData = new Map<string, { income: number; expenses: number }>()

  // Process certifications
  certifications.forEach((cert) => {
    const monthKey = `${cert.periodYear}-${String(cert.periodMonth).padStart(2, '0')}`
    const total = cert.lines.reduce(
      (sum, line) => sum.add(line.periodAmount),
      new Prisma.Decimal(0)
    )

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { income: 0, expenses: 0 })
    }
    monthlyData.get(monthKey)!.income += Number(total)
  })

  // Process expenses
  expenses.forEach((expense) => {
    const date = new Date(expense.issueDate)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { income: 0, expenses: 0 })
    }
    monthlyData.get(monthKey)!.expenses += Number(expense.amountBaseCurrency)
  })

  // If no data, generate empty months
  if (monthlyData.size === 0) {
    const now = new Date()
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthlyData.set(monthKey, { income: 0, expenses: 0 })
    }
  }

  // Convert to sorted array
  return Array.from(monthlyData.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({
      month,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
    }))
}

/**
 * Get project-level cashflow data for last 6 months
 */
export async function getProjectCashflowData(
  orgId: string,
  projectId: string
): Promise<CashflowDataPoint[]> {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const [certifications, expenses] = await Promise.all([
    prisma.certification.findMany({
      where: {
        orgId,
        projectId,
        status: 'APPROVED',
        approvedAt: { gte: sixMonthsAgo },
      },
      include: {
        lines: { select: { periodAmount: true } },
      },
    }),
    prisma.financeTransaction.findMany({
      where: {
        orgId,
        projectId,
        type: { in: ['EXPENSE', 'PURCHASE'] },
        status: { in: ['APPROVED', 'PAID'] },
        issueDate: { gte: sixMonthsAgo },
        deleted: false,
      },
      select: {
        issueDate: true,
        amountBaseCurrency: true,
      },
    }),
  ])

  const monthlyData = new Map<string, { income: number; expenses: number }>()

  certifications.forEach((cert) => {
    const monthKey = `${cert.periodYear}-${String(cert.periodMonth).padStart(2, '0')}`
    const total = cert.lines.reduce(
      (sum, line) => sum.add(line.periodAmount),
      new Prisma.Decimal(0)
    )
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { income: 0, expenses: 0 })
    }
    monthlyData.get(monthKey)!.income += Number(total)
  })

  expenses.forEach((expense) => {
    const date = new Date(expense.issueDate)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { income: 0, expenses: 0 })
    }
    monthlyData.get(monthKey)!.expenses += Number(expense.amountBaseCurrency)
  })

  if (monthlyData.size === 0) {
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthlyData.set(monthKey, { income: 0, expenses: 0 })
    }
  }

  return Array.from(monthlyData.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({
      month,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
    }))
}

/**
 * Get alerts for dashboard.
 * When allowedProjectIds is provided (restricted user), only alerts for those projects; null = all.
 */
export async function getAlerts(
  orgId: string,
  allowedProjectIds: string[] | null = null
): Promise<Alert[]> {
  const alerts: Alert[] = []

  // 1. Certifications overdue (>30 days without approval)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const overdueCertifications = await prisma.certification.findMany({
    where: {
      orgId,
      status: 'ISSUED',
      issuedAt: { lt: thirtyDaysAgo },
      ...(allowedProjectIds !== null ? { projectId: { in: allowedProjectIds } } : {}),
    },
    include: { project: { select: { name: true } } },
    take: 3,
  })

  overdueCertifications.forEach((cert) => {
    alerts.push({
      id: `cert-${cert.id}`,
      type: 'error',
      title: 'Certificación pendiente',
      message: `Certificación ${cert.number} de ${cert.project.name} sin aprobar hace más de 30 días`,
      link: `/projects/${cert.projectId}/certifications/${cert.id}`,
    })
  })

  // 2. Unanswered RFIs (>7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const unansweredRFIs = await prisma.rFI.count({
    where: {
      orgId,
      status: 'OPEN',
      createdAt: { lt: sevenDaysAgo },
      ...(allowedProjectIds !== null ? { projectId: { in: allowedProjectIds } } : {}),
    },
  })

  if (unansweredRFIs > 0) {
    alerts.push({
      id: 'rfis-overdue',
      type: 'warning',
      title: 'RFIs sin responder',
      message: `${unansweredRFIs} RFI(s) abiertos hace más de 7 días`,
    })
  }

  // 3. Low stock items (org-level; skip for restricted users so we only show project-related alerts)
  const lowStockItems =
    allowedProjectIds === null
      ? await prisma.inventoryItem.findMany({
          where: {
            orgId,
            active: true,
            minStockQty: { not: null },
          },
          select: {
            id: true,
            name: true,
            minStockQty: true,
          },
          take: 10,
        })
      : []

  for (const item of lowStockItems) {
    // Calculate current stock from movements
    const movements = await prisma.inventoryMovement.findMany({
      where: { itemId: item.id },
      select: {
        movementType: true,
        quantity: true,
      },
    })

    let currentStock = new Prisma.Decimal(0)
    movements.forEach((mov) => {
      if (mov.movementType === 'PURCHASE' || mov.movementType === 'ADJUSTMENT') {
        currentStock = currentStock.add(mov.quantity)
      } else if (mov.movementType === 'ISSUE') {
        currentStock = currentStock.sub(mov.quantity)
      }
    })

    if (item.minStockQty && currentStock.lessThan(item.minStockQty)) {
      alerts.push({
        id: `inventory-${item.id}`,
        type: 'warning',
        title: 'Stock bajo',
        message: `${item.name} está por debajo del stock mínimo`,
        link: '/inventory',
      })
    }
  }

  // 4. Change orders pending approval
  const pendingChangeOrders = await prisma.changeOrder.count({
    where: {
      orgId,
      status: 'SUBMITTED',
      ...(allowedProjectIds !== null ? { projectId: { in: allowedProjectIds } } : {}),
    },
  })

  if (pendingChangeOrders > 0) {
    alerts.push({
      id: 'co-pending',
      type: 'info',
      title: 'Órdenes de cambio pendientes',
      message: `${pendingChangeOrders} orden(es) de cambio esperando aprobación`,
    })
  }

  return alerts.slice(0, 5) // Max 5 alerts
}

/**
 * Get recent activity from audit log.
 * When allowedProjectIds is provided (restricted user), only activity for those projects; activities without projectId are excluded. null = all.
 */
export async function getRecentActivity(
  orgId: string,
  allowedProjectIds: string[] | null = null
): Promise<ActivityItem[]> {
  const activities = await prisma.auditLog.findMany({
    where: {
      orgId,
      ...(allowedProjectIds !== null
        ? { projectId: { in: allowedProjectIds } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Get user names for activities
  const userIds = [...new Set(activities.map((a) => a.actorUserId))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u.fullName]))

  // Get project names for activities that have projectId
  const projectIds = activities
    .map((a) => a.projectId)
    .filter((id): id is string => id !== null)

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true },
  })

  const projectMap = new Map(projects.map((p) => [p.id, p.name]))

  return activities.map((activity) => ({
    id: activity.id,
    action: activity.action,
    entityType: activity.entityType,
    actorName: userMap.get(activity.actorUserId) || 'Sistema',
    projectName: activity.projectId ? projectMap.get(activity.projectId) : null,
    createdAt: activity.createdAt,
    details: activity.detailsJson,
  }))
}

/**
 * Get recent activity for a specific project from audit log
 */
export async function getRecentActivityByProject(
  orgId: string,
  projectId: string
): Promise<ActivityItem[]> {
  const activities = await prisma.auditLog.findMany({
    where: { orgId, projectId },
    orderBy: { createdAt: 'desc' },
    take: 15,
  })

  const userIds = [...new Set(activities.map((a) => a.actorUserId))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u.fullName]))

  const projectIds = activities
    .map((a) => a.projectId)
    .filter((id): id is string => id !== null)
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true },
  })
  const projectMap = new Map(projects.map((p) => [p.id, p.name]))

  return activities.map((activity) => ({
    id: activity.id,
    action: activity.action,
    entityType: activity.entityType,
    actorName: userMap.get(activity.actorUserId) || 'Sistema',
    projectName: activity.projectId ? projectMap.get(activity.projectId) : null,
    createdAt: activity.createdAt,
    details: activity.detailsJson,
  }))
}
