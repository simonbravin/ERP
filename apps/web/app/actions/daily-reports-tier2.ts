'use server'

/**
 * Tier 2 - Libro de Obra integration with WBS, Inventory, Suppliers, Budget, Finance.
 * These actions complement (do not replace) the existing daily-reports actions.
 * updateWbsProgressOnSubmit, updateBudgetLineActuals, generateAlertsForReport are called from approveDailyReport.
 */

import { redirectToLogin } from '@/lib/i18n-redirect'
import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { requireRole } from '@/lib/rbac'
import {
  submitDailyReportTier2Schema,
  type SubmitDailyReportTier2Input,
} from '@repo/validators'

async function getAuthContext() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()
  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()
  return { session, org }
}

/** Determines WBS health from progress, dates and hours. */
function calculateWbsHealthStatus(
  progressPct: number,
  plannedEndDate: Date | null,
  actualHours: number,
  plannedHours: number
): string {
  if (progressPct >= 100) return 'COMPLETED'
  if (plannedHours > 0 && actualHours >= plannedHours * 1.1) return 'AHEAD'
  if (plannedEndDate && new Date() > plannedEndDate && progressPct < 100) return 'DELAYED'
  if (progressPct < 80) return 'AT_RISK'
  return 'ON_TRACK'
}

/**
 * Update a daily report with Tier 2 cost data and optionally submit.
 * Does not replace Tier 1 submit; use after report exists.
 * Future: propagate to WBS, Inventory, Suppliers, Budget, Finance.
 */
export async function submitDailyReportTier2(input: SubmitDailyReportTier2Input) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const parsed = submitDailyReportTier2Schema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.errors.map((e) => e.message).join(', '))

  const { reportId, budgetLineId, laborCosts, materialCosts, otherCosts, consumptions, suppliers } =
    parsed.data

  const existing = await prisma.dailyReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
  })
  if (!existing) throw new Error('Reporte no encontrado')
  if (existing.status !== 'DRAFT') throw new Error('Solo reportes en borrador pueden actualizarse con datos Tier 2')

  const totalCost = Number(laborCosts) + Number(materialCosts) + Number(otherCosts)

  await prisma.dailyReport.update({
    where: { id: reportId },
    data: {
      budgetLineId: budgetLineId ?? null,
      laborCosts,
      materialCosts,
      otherCosts,
      totalCost,
    },
  })

  // TODO Tier 2: create InventoryConsumption, DailyReportSupplier, WbsProgressUpdate, BudgetLineActualCost, FinanceTransaction
  // when those features are enabled in the UI.

  revalidatePath(`/projects/${existing.projectId}/daily-reports`)
  revalidatePath(`/projects/${existing.projectId}/daily-reports/${reportId}`)
  return { id: reportId, totalCost }
}

/**
 * Return a summary of what this report impacted across modules (Tier 2).
 * Stub: returns minimal data until full Tier 2 propagation is implemented.
 */
export async function generateDailyImpactSummary(reportId: string) {
  const { org } = await getAuthContext()

  const report = await prisma.dailyReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
    include: {
      wbsNodes: { select: { wbsNode: { select: { code: true, name: true } } } },
      budgetLine: { select: { description: true, directCostTotal: true } },
    },
  })
  if (!report) return null

  const totalCost = Number(report.totalCost ?? 0)
  const wbsPart = report.wbsNodes?.length
    ? report.wbsNodes.map((n) => `${n.wbsNode.code} — ${n.wbsNode.name}`).join(', ')
    : null

  let consumptionsPart: string[] = []
  let suppliersPart: string[] = []
  try {
    const extended = await prisma.dailyReport.findFirst({
      where: { id: reportId, orgId: org.orgId },
      select: {
        inventoryConsumptions: { include: { inventoryItem: { select: { name: true, unit: true } } } },
        supplierInteractions: { include: { globalParty: { select: { name: true } } } },
      },
    })
    if (extended?.inventoryConsumptions?.length) {
      consumptionsPart = extended.inventoryConsumptions.map(
        (c) => `${c.inventoryItem.name}: -${c.quantity} ${c.unit}`
      )
    }
    if (extended?.supplierInteractions?.length) {
      suppliersPart = extended.supplierInteractions.map((s) => s.globalParty.name)
    }
  } catch {
    // Tier 2 relations may not exist yet in client
  }

  return {
    reportId: report.id,
    totalCost,
    wbsSummary: wbsPart,
    inventoryConsumed: consumptionsPart,
    suppliersContacted: suppliersPart,
    budgetLine: report.budgetLine
      ? {
          description: report.budgetLine.description,
          budgeted: Number(report.budgetLine.directCostTotal),
        }
      : null,
  }
}

/**
 * When a report is APPROVED: sum labor hours, update WbsNode.actualHours and progress,
 * create WbsProgressUpdate. Called from approveDailyReport.
 */
export async function updateWbsProgressOnSubmit(reportId: string): Promise<void> {
  const report = await prisma.dailyReport.findFirst({
    where: { id: reportId },
    include: {
      labor: true,
      wbsNode: true,
      wbsNodes: { select: { wbsNodeId: true, wbsNode: true } },
    },
  })
  if (!report) return

  const totalLaborHours = report.labor.reduce(
    (sum, l) => sum.add(l.hoursWorked),
    new Prisma.Decimal(0)
  )
  const totalHoursNum = Number(totalLaborHours)
  if (totalHoursNum <= 0) return

  const nodeIds: string[] = report.wbsNodeId
    ? [report.wbsNodeId]
    : report.wbsNodes?.map((n) => n.wbsNodeId) ?? []
  if (nodeIds.length === 0) return

  const hoursPerNode = totalHoursNum / nodeIds.length

  for (const wbsNodeId of nodeIds) {
    const node = await prisma.wbsNode.findUnique({
      where: { id: wbsNodeId },
      select: {
        id: true,
        actualHours: true,
        plannedHours: true,
        plannedEndDate: true,
        progressPct: true,
        healthStatus: true,
      },
    })
    if (!node) continue

    const plannedHours = node.plannedHours ? Number(node.plannedHours) : null
    const currentActual = Number(node.actualHours ?? 0)
    const newActualHours = currentActual + hoursPerNode
    const progressBefore = Number(node.progressPct ?? 0)
    const progressAfter =
      plannedHours != null && plannedHours > 0
        ? Math.min(100, (newActualHours / plannedHours) * 100)
        : progressBefore

    const plannedEnd = node.plannedEndDate
    const healthStatus = calculateWbsHealthStatus(
      progressAfter,
      plannedEnd,
      newActualHours,
      plannedHours ?? 0
    )

    await prisma.$transaction([
      prisma.wbsNode.update({
        where: { id: wbsNodeId },
        data: {
          actualHours: new Prisma.Decimal(newActualHours),
          progressPct: new Prisma.Decimal(progressAfter),
          healthStatus,
          ...(progressAfter >= 100 && { actualEndDate: new Date() }),
        },
      }),
      prisma.wbsProgressUpdate.create({
        data: {
          wbsNodeId,
          dailyReportId: reportId,
          hoursAdded: new Prisma.Decimal(hoursPerNode),
          costAdded: null,
          progressBefore: new Prisma.Decimal(progressBefore),
          progressAfter: new Prisma.Decimal(progressAfter),
          status: healthStatus,
          variance: null,
          notes: null,
        },
      }),
    ])
  }
}

/**
 * When a report is APPROVED and has budgetLineId: create BudgetLineActualCost,
 * update BudgetLine.actualCostTotal, compute variance. Called from approveDailyReport.
 */
export async function updateBudgetLineActuals(reportId: string): Promise<void> {
  const report = await prisma.dailyReport.findFirst({
    where: { id: reportId },
    include: { budgetLine: true },
  })
  if (!report?.budgetLineId || !report.budgetLine) return

  const laborCost = Number(report.laborCosts ?? 0)
  const materialCost = Number(report.materialCosts ?? 0)
  const otherCost = Number(report.otherCosts ?? 0)
  const totalCost = laborCost + materialCost + otherCost
  if (totalCost <= 0) return

  const budgeted = Number(report.budgetLine.directCostTotal)
  const existingActuals = await prisma.budgetLineActualCost.aggregate({
    where: { budgetLineId: report.budgetLineId },
    _sum: { totalCost: true },
  })
  const previousTotal = Number(existingActuals._sum.totalCost ?? 0)
  const newActualTotal = previousTotal + totalCost
  const variancePct =
    budgeted > 0 ? ((newActualTotal - budgeted) / budgeted) * 100 : null

  await prisma.$transaction([
    prisma.budgetLineActualCost.create({
      data: {
        budgetLineId: report.budgetLineId,
        dailyReportId: reportId,
        laborCost: new Prisma.Decimal(laborCost),
        materialCost: new Prisma.Decimal(materialCost),
        equipmentCost: new Prisma.Decimal(0),
        subcontractCost: new Prisma.Decimal(0),
        otherCost: new Prisma.Decimal(otherCost),
        totalCost: new Prisma.Decimal(totalCost),
        budgetedCost: new Prisma.Decimal(budgeted),
        variance: variancePct != null ? new Prisma.Decimal(variancePct) : null,
      },
    }),
    prisma.budgetLine.update({
      where: { id: report.budgetLineId },
      data: { actualCostTotal: new Prisma.Decimal(newActualTotal) },
    }),
  ])
}

/**
 * After approval: generate alerts for WBS delayed, budget over, etc. Saves to Alert table.
 * Called from approveDailyReport.
 */
export async function generateAlertsForReport(reportId: string): Promise<{ id: string; type: string }[]> {
  const report = await prisma.dailyReport.findFirst({
    where: { id: reportId },
    include: {
      wbsNode: true,
      wbsNodes: { select: { wbsNode: true } },
      budgetLine: true,
    },
  })
  if (!report) return []

  const projectId = report.projectId
  const created: { id: string; type: string }[] = []

  const nodes = report.wbsNodeId && report.wbsNode
    ? [report.wbsNode]
    : report.wbsNodes?.map((n) => n.wbsNode) ?? []
  for (const node of nodes) {
    const status = node.healthStatus
    if (status === 'AT_RISK' || status === 'DELAYED') {
      const progressPct = Number(node.progressPct ?? 0)
      const a = await prisma.alert.create({
        data: {
          projectId,
          dailyReportId: reportId,
          type: 'WBS_DELAYED',
          severity: status === 'DELAYED' ? 'CRITICAL' : 'WARNING',
          title: `${node.name} ${status === 'DELAYED' ? 'retrasado' : 'en riesgo'}`,
          description: `${progressPct.toFixed(1)}% completado${status === 'DELAYED' ? ' (< 100% esperado a esta fecha)' : ''}`,
          affectedEntityId: node.id,
          affectedEntityType: 'WBS',
          metadata: { progressPct, healthStatus: status, wbsCode: node.code },
        },
      })
      created.push({ id: a.id, type: a.type })
    }
  }

  if (report.budgetLineId && report.budgetLine) {
    const budgeted = Number(report.budgetLine.directCostTotal)
    const actualTotal = Number(report.budgetLine.actualCostTotal ?? 0)
    if (budgeted > 0) {
      const variancePct = ((actualTotal - budgeted) / budgeted) * 100
      if (variancePct > 20) {
        const a = await prisma.alert.create({
          data: {
            projectId,
            dailyReportId: reportId,
            type: 'BUDGET_CRITICAL',
            severity: 'CRITICAL',
            title: `${report.budgetLine.description} sobrepasada (crítico)`,
            description: `Varianza: ${variancePct.toFixed(1)}%`,
            affectedEntityId: report.budgetLine.id,
            affectedEntityType: 'BUDGET',
            metadata: { variance: variancePct, budgeted, actual: actualTotal },
          },
        })
        created.push({ id: a.id, type: a.type })
      } else if (variancePct > 10) {
        const a = await prisma.alert.create({
          data: {
            projectId,
            dailyReportId: reportId,
            type: 'BUDGET_OVER',
            severity: 'WARNING',
            title: `${report.budgetLine.description} sobrepasada`,
            description: `Varianza: ${variancePct.toFixed(1)}%`,
            affectedEntityId: report.budgetLine.id,
            affectedEntityType: 'BUDGET',
            metadata: { variance: variancePct, budgeted, actual: actualTotal },
          },
        })
        created.push({ id: a.id, type: a.type })
      }
    }
  }

  return created
}
