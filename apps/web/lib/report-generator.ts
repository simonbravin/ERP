import { prisma } from '@repo/database'
import ExcelJS from 'exceljs'
import { getApprovedOrBaselineBudgetTotals } from '@/app/actions/budget'

type FilterConfig = {
  status?: string
  phase?: string
  startDateFrom?: string
  startDateTo?: string
  type?: string
  projectId?: string
}

export async function generateProjectsReport(
  orgId: string,
  filters: FilterConfig,
  columns: string[]
) {
  const where: Record<string, unknown> = { orgId, active: true }
  if (filters.status) where.status = filters.status
  if (filters.phase) where.phase = filters.phase
  if (filters.startDateFrom) {
    where.startDate = { gte: new Date(filters.startDateFrom) }
  }
  if (filters.startDateTo) {
    where.startDate = {
      ...(where.startDate as object),
      lte: new Date(filters.startDateTo),
    }
  }

  const projects = await prisma.project.findMany({
    where,
    select: {
      id: true,
      projectNumber: true,
      name: true,
      clientName: true,
      status: true,
      phase: true,
      startDate: true,
      plannedEndDate: true,
      totalBudget: true,
      location: true,
    },
  })

  const projectIds = projects.map((p) => p.id)
  const budgetTotals = projectIds.length > 0 ? await getApprovedOrBaselineBudgetTotals(projectIds) : {}

  return projects.map((p) => {
    const row: Record<string, unknown> = {}
    if (columns.includes('id')) row.id = p.id
    if (columns.includes('projectNumber')) row.projectNumber = p.projectNumber
    if (columns.includes('name')) row.name = p.name
    if (columns.includes('clientName')) row.clientName = p.clientName
    if (columns.includes('status')) row.status = p.status
    if (columns.includes('phase')) row.phase = p.phase
    if (columns.includes('startDate'))
      row.startDate = p.startDate?.toISOString().slice(0, 10)
    if (columns.includes('plannedEndDate'))
      row.plannedEndDate = p.plannedEndDate?.toISOString().slice(0, 10)
    if (columns.includes('totalBudget')) {
      const total = budgetTotals[p.id] ?? 0
      row.totalBudget = total > 0 ? total : null
    }
    if (columns.includes('location')) row.location = p.location
    return row
  })
}

export async function generateFinanceTransactionsReport(
  orgId: string,
  filters: FilterConfig,
  columns: string[]
) {
  const where: Record<string, unknown> = { orgId, deleted: false }
  if (filters.status) where.status = filters.status
  if (filters.type) where.type = filters.type
  if (filters.projectId) where.projectId = filters.projectId

  const txns = await prisma.financeTransaction.findMany({
    where,
    include: { project: { select: { name: true } } },
    orderBy: { issueDate: 'desc' },
  })

  return txns.map((t) => {
    const row: Record<string, unknown> = {}
    if (columns.includes('transactionNumber')) row.transactionNumber = t.transactionNumber
    if (columns.includes('type')) row.type = t.type
    if (columns.includes('status')) row.status = t.status
    if (columns.includes('issueDate')) row.issueDate = t.issueDate?.toISOString().slice(0, 10)
    if (columns.includes('description')) row.description = t.description
    if (columns.includes('total')) row.total = Number(t.total)
    if (columns.includes('currency')) row.currency = t.currency
    if (columns.includes('projectName')) row.projectName = t.project?.name
    return row
  })
}

export async function generateBudgetLinesReport(
  orgId: string,
  filters: FilterConfig,
  columns: string[]
) {
  const where: { orgId: string; budgetVersion?: { projectId: string } } = {
    orgId,
  }
  if (filters.projectId) {
    where.budgetVersion = { projectId: filters.projectId }
  }

  const lines = await prisma.budgetLine.findMany({
    where,
    include: {
      wbsNode: { select: { code: true, name: true } },
      budgetVersion: {
        select: { project: { select: { name: true } } },
      },
    },
  })

  return lines.map((l) => {
    const row: Record<string, unknown> = {}
    if (columns.includes('description')) row.description = l.description
    if (columns.includes('unit')) row.unit = l.unit
    if (columns.includes('quantity')) row.quantity = Number(l.quantity)
    if (columns.includes('directCostTotal')) row.directCostTotal = Number(l.directCostTotal)
    if (columns.includes('salePriceTotal')) row.salePriceTotal = Number(l.salePriceTotal)
    if (columns.includes('wbsCode')) row.wbsCode = l.wbsNode?.code
    if (columns.includes('wbsName')) row.wbsName = l.wbsNode?.name
    if (columns.includes('projectName'))
      row.projectName = l.budgetVersion?.project?.name
    return row
  })
}

export async function generateReportData(
  orgId: string,
  entityType: string,
  filters: FilterConfig,
  columns: string[]
): Promise<Record<string, unknown>[]> {
  switch (entityType) {
    case 'PROJECT':
      return generateProjectsReport(orgId, filters, columns)
    case 'FINANCE_TRANSACTION':
      return generateFinanceTransactionsReport(orgId, filters, columns)
    case 'BUDGET_LINE':
      return generateBudgetLinesReport(orgId, filters, columns)
    default:
      return []
  }
}

const COLUMN_LABELS: Record<string, string> = {
  id: 'ID',
  projectNumber: 'Number',
  name: 'Name',
  clientName: 'Client',
  status: 'Status',
  phase: 'Phase',
  startDate: 'Start Date',
  plannedEndDate: 'Planned End',
  totalBudget: 'Total Budget',
  location: 'Location',
  transactionNumber: 'Transaction #',
  type: 'Type',
  issueDate: 'Issue Date',
  description: 'Description',
  total: 'Total',
  currency: 'Currency',
  projectName: 'Project',
  unit: 'Unit',
  quantity: 'Quantity',
  directCostTotal: 'Direct Cost',
  salePriceTotal: 'Sale Price',
  wbsCode: 'WBS Code',
  wbsName: 'WBS Name',
}

export async function exportToExcel(
  data: Record<string, unknown>[],
  columns: string[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Report')

  const excelColumns = columns.map((key) => ({
    header: COLUMN_LABELS[key] ?? key,
    key,
    width: 15,
  }))
  worksheet.columns = excelColumns

  if (data.length > 0) {
    const rows = data.map((row) => {
      const r: Record<string, unknown> = {}
      for (const col of columns) {
        r[col] = row[col] ?? ''
      }
      return r
    })
    worksheet.addRows(rows)
  }

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
