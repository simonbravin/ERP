'use server'

import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { requirePermission } from '@/lib/auth-helpers'
import { prisma } from '@repo/database'
import { revalidatePath } from 'next/cache'
import type {
  QueryConfig,
  ReportConfig,
  TableMetadata,
  ReportResult,
  QueryFilter,
} from '@/lib/types/reports'
import type { CompanyTransactionsFilters } from './finance'

const WHITELIST_TABLES = [
  'finance_transactions',
  'projects',
  'budget_lines',
  'certifications',
  'inventory_movements',
] as const

// ==================== Auth ====================

async function getAuthForReports() {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')
  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) throw new Error('No autorizado')
  return { session, org }
}

// ==================== Proyectos para Query Builder ====================

export async function getProjectsForQueryBuilder(): Promise<
  { id: string; name: string; projectNumber: string }[]
> {
  const { org } = await getAuthForReports()
  const projects = await prisma.project.findMany({
    where: { orgId: org.orgId },
    select: { id: true, name: true, projectNumber: true },
    orderBy: { name: 'asc' },
  })
  return projects
}

// ==================== Metadatos de tablas ====================

export async function getAvailableTables(): Promise<TableMetadata[]> {
  await getAuthForReports()

  return [
    {
      name: 'finance_transactions',
      label: 'Transacciones Financieras',
      fields: [
        { field: 'id', label: 'ID', type: 'text', table: 'finance_transactions' },
        { field: 'transactionNumber', label: 'Número', type: 'text', table: 'finance_transactions' },
        { field: 'type', label: 'Tipo', type: 'text', table: 'finance_transactions' },
        { field: 'status', label: 'Estado', type: 'text', table: 'finance_transactions' },
        { field: 'issueDate', label: 'Fecha Emisión', type: 'date', table: 'finance_transactions' },
        { field: 'total', label: 'Total', type: 'number', table: 'finance_transactions' },
        { field: 'amountBaseCurrency', label: 'Monto Base', type: 'number', table: 'finance_transactions' },
        { field: 'description', label: 'Descripción', type: 'text', table: 'finance_transactions' },
      ],
      relations: [
        { table: 'projects', type: 'belongsTo', foreignKey: 'projectId' },
        { table: 'parties', type: 'belongsTo', foreignKey: 'partyId' },
      ],
    },
    {
      name: 'projects',
      label: 'Proyectos',
      fields: [
        { field: 'id', label: 'ID', type: 'text', table: 'projects' },
        { field: 'projectNumber', label: 'Número', type: 'text', table: 'projects' },
        { field: 'name', label: 'Nombre', type: 'text', table: 'projects' },
        { field: 'clientName', label: 'Cliente', type: 'text', table: 'projects' },
        { field: 'status', label: 'Estado', type: 'text', table: 'projects' },
        { field: 'phase', label: 'Fase', type: 'text', table: 'projects' },
        { field: 'startDate', label: 'Fecha Inicio', type: 'date', table: 'projects' },
        { field: 'plannedEndDate', label: 'Fecha Fin Planificada', type: 'date', table: 'projects' },
        { field: 'location', label: 'Ubicación', type: 'text', table: 'projects' },
        { field: 'totalBudget', label: 'Presupuesto Total', type: 'number', table: 'projects' },
        { field: 'gastadoHastaElMomento', label: 'Gastado hasta el momento', type: 'number', table: 'projects' },
        { field: 'avanceObraPct', label: 'Avance de obra %', type: 'number', table: 'projects' },
        { field: 'montoAvance', label: 'Monto de avance', type: 'number', table: 'projects' },
        { field: 'diferencia', label: 'Diferencia', type: 'number', table: 'projects' },
      ],
      relations: [
        { table: 'finance_transactions', type: 'hasMany', foreignKey: 'projectId' },
        { table: 'certifications', type: 'hasMany', foreignKey: 'projectId' },
      ],
    },
    {
      name: 'budget_lines',
      label: 'Líneas de Presupuesto',
      fields: [
        { field: 'id', label: 'ID', type: 'text', table: 'budget_lines' },
        { field: 'description', label: 'Descripción', type: 'text', table: 'budget_lines' },
        { field: 'unit', label: 'Unidad', type: 'text', table: 'budget_lines' },
        { field: 'quantity', label: 'Cantidad', type: 'number', table: 'budget_lines' },
        { field: 'directCostTotal', label: 'Costo Directo', type: 'number', table: 'budget_lines' },
      ],
      relations: [
        { table: 'budget_versions', type: 'belongsTo', foreignKey: 'budgetVersionId' },
        { table: 'wbs_nodes', type: 'belongsTo', foreignKey: 'wbsNodeId' },
      ],
    },
    {
      name: 'certifications',
      label: 'Certificaciones',
      fields: [
        { field: 'id', label: 'ID', type: 'text', table: 'certifications' },
        { field: 'number', label: 'Número', type: 'number', table: 'certifications' },
        { field: 'periodMonth', label: 'Mes', type: 'number', table: 'certifications' },
        { field: 'periodYear', label: 'Año', type: 'number', table: 'certifications' },
        { field: 'status', label: 'Estado', type: 'text', table: 'certifications' },
        { field: 'issuedDate', label: 'Fecha Emisión', type: 'date', table: 'certifications' },
      ],
      relations: [{ table: 'projects', type: 'belongsTo', foreignKey: 'projectId' }],
    },
    {
      name: 'inventory_movements',
      label: 'Movimientos de Inventario',
      fields: [
        { field: 'id', label: 'ID', type: 'text', table: 'inventory_movements' },
        { field: 'movementType', label: 'Tipo', type: 'text', table: 'inventory_movements' },
        { field: 'quantity', label: 'Cantidad', type: 'number', table: 'inventory_movements' },
        { field: 'movementDate', label: 'Fecha', type: 'date', table: 'inventory_movements' },
      ],
      relations: [{ table: 'inventory_items', type: 'belongsTo', foreignKey: 'inventoryItemId' }],
    },
  ]
}

// ==================== Ejecutar query (Prisma-based, multi-tenant) ====================

function buildCompanyTransactionsFilters(where: QueryFilter[]): CompanyTransactionsFilters {
  const filters: CompanyTransactionsFilters = {}
  for (const f of where) {
    if (!f.field || f.value === undefined || f.value === '') continue
    if (f.field === 'type' && f.operator === '=') filters.type = String(f.value)
    if (f.field === 'status' && f.operator === '=') filters.status = String(f.value)
    if (f.field === 'projectId' && f.operator === '=') filters.projectId = f.value === null ? 'null' : String(f.value)
    if (f.field === 'issueDate' && f.operator === '>=') filters.dateFrom = String(f.value).slice(0, 10)
    if (f.field === 'issueDate' && f.operator === '<=') filters.dateTo = String(f.value).slice(0, 10)
    if (f.field === 'description' && f.operator === 'CONTAINS') filters.search = String(f.value)
  }
  return filters
}

export async function executeCustomQuery(config: QueryConfig): Promise<ReportResult> {
  const { org } = await getAuthForReports()
  const startTime = Date.now()

  if (!WHITELIST_TABLES.includes(config.table as (typeof WHITELIST_TABLES)[number])) {
    throw new Error('Tabla no permitida')
  }

  const selectSet = new Set(config.select)
  const pick = (row: Record<string, unknown>) => {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(row)) {
      if (selectSet.has(key) || selectSet.size === 0) out[key] = row[key]
    }
    if (selectSet.size > 0) {
      for (const s of selectSet) {
        if (!(s in out) && s in row) out[s] = row[s]
      }
    }
    return out
  }

  if (config.table === 'finance_transactions') {
    const { getCompanyTransactions } = await import('./finance')
    const filters = buildCompanyTransactionsFilters(config.where ?? [])
    if (config.projectIds?.length) filters.projectIds = config.projectIds
    if (config.dateFrom) filters.dateFrom = config.dateFrom
    if (config.dateTo) filters.dateTo = config.dateTo
    const list = await getCompanyTransactions(filters)
    const rows = list.map((t: Record<string, unknown>) => {
      const row = {
        id: t.id,
        transactionNumber: t.transactionNumber,
        type: t.type,
        status: t.status,
        issueDate: t.issueDate,
        total: typeof t.total === 'number' ? t.total : Number(t.total),
        amountBaseCurrency:
          typeof t.amountBaseCurrency === 'number' ? t.amountBaseCurrency : Number(t.amountBaseCurrency ?? t.total),
        description: t.description,
        projectName: (t.project as { name?: string })?.name ?? 'Overhead',
        partyName: (t.party as { name?: string })?.name ?? '—',
      }
      return selectSet.size > 0 ? pick(row) : row
    })
    const ordered =
      config.orderBy?.length && config.orderBy[0]
        ? [...rows].sort((a, b) => {
            const key = config.orderBy![0].field
            const dir = config.orderBy![0].direction === 'desc' ? -1 : 1
            const va = a[key] as number | string | Date
            const vb = b[key] as number | string | Date
            if (va == null && vb == null) return 0
            if (va == null) return dir
            if (vb == null) return -dir
            return va < vb ? -dir : va > vb ? dir : 0
          })
        : rows
    return {
      data: ordered.slice(0, 500),
      totalRows: ordered.length,
      executionTime: Date.now() - startTime,
    }
  }

  if (config.table === 'projects') {
    const projectIdsFilter = config.projectIds?.length ? { id: { in: config.projectIds } } : {}
    const projects = await prisma.project.findMany({
      where: { orgId: org.orgId, ...projectIdsFilter },
      select: {
        id: true,
        projectNumber: true,
        name: true,
        clientName: true,
        status: true,
        phase: true,
        startDate: true,
        plannedEndDate: true,
        location: true,
        totalBudget: true,
      },
      orderBy: config.orderBy?.[0]
        ? { [config.orderBy[0].field]: config.orderBy[0].direction }
        : { name: 'asc' },
      take: 500,
    })
    const projectIds = projects.map((p) => p.id)
    if (projectIds.length === 0) {
      return { data: [], totalRows: 0, executionTime: Date.now() - startTime }
    }

    const spentByProject = await prisma.financeTransaction.groupBy({
      by: ['projectId'],
      where: {
        orgId: org.orgId,
        projectId: { in: projectIds },
        deleted: false,
      },
      _sum: { total: true },
    })
    const spentMap = new Map<string, number>()
    for (const row of spentByProject) {
      if (row.projectId) spentMap.set(row.projectId, Number(row._sum.total ?? 0))
    }

    const certifications = await prisma.certification.findMany({
      where: { projectId: { in: projectIds }, orgId: org.orgId },
      include: { lines: { select: { totalAmount: true } } },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    })
    const certTotalByProject = new Map<string, number>()
    for (const cert of certifications) {
      if (certTotalByProject.has(cert.projectId)) continue
      const total = cert.lines.reduce((s, l) => s + Number(l.totalAmount), 0)
      certTotalByProject.set(cert.projectId, total)
    }

    const rows = projects.map((p) => {
      const totalBudget = p.totalBudget != null ? Number(p.totalBudget) : 0
      const gastadoHastaElMomento = spentMap.get(p.id) ?? 0
      const montoAvance = certTotalByProject.get(p.id) ?? 0
      const avanceObraPct = totalBudget > 0 ? (montoAvance / totalBudget) * 100 : 0
      const diferencia = montoAvance - gastadoHastaElMomento
      return {
        id: p.id,
        projectNumber: p.projectNumber,
        name: p.name,
        clientName: p.clientName,
        status: p.status,
        phase: p.phase,
        startDate: p.startDate,
        plannedEndDate: p.plannedEndDate,
        location: p.location,
        totalBudget: totalBudget || null,
        gastadoHastaElMomento,
        avanceObraPct: Math.round(avanceObraPct * 100) / 100,
        montoAvance,
        diferencia,
      }
    })

    const ordered =
      config.orderBy?.length && config.orderBy[0]
        ? [...rows].sort((a, b) => {
            const key = config.orderBy![0].field
            const dir = config.orderBy![0].direction === 'desc' ? -1 : 1
            const va = a[key as keyof typeof a]
            const vb = b[key as keyof typeof b]
            if (va == null && vb == null) return 0
            if (va == null) return dir
            if (vb == null) return -dir
            return va < vb ? -dir : va > vb ? dir : 0
          })
        : rows
    const data = selectSet.size > 0 ? ordered.map((r) => pick(r)) : ordered
    return {
      data,
      totalRows: data.length,
      executionTime: Date.now() - startTime,
    }
  }

  // Fallback: empty result for other tables (certifications, budget_lines, inventory_movements can be added similarly)
  return {
    data: [],
    totalRows: 0,
    executionTime: Date.now() - startTime,
  }
}

// ==================== Guardar reporte ====================

export async function saveCustomReport(reportData: {
  name: string
  description?: string
  category: string
  reportType: string
  config: ReportConfig
  isPublic?: boolean
}) {
  await requirePermission('REPORTS', 'create')
  const { session, org } = await getAuthForReports()
  const report = await prisma.customReport.create({
    data: {
      orgId: org.orgId,
      name: reportData.name,
      description: reportData.description ?? null,
      category: reportData.category,
      reportType: reportData.reportType,
      config: reportData.config as object,
      isPublic: reportData.isPublic ?? false,
      createdByUserId: session.user.id,
    },
  })
  revalidatePath('/reports')
  return { success: true, reportId: report.id }
}

// ==================== Ejecutar reporte guardado ====================

export async function runCustomReport(reportId: string): Promise<ReportResult> {
  const { session, org } = await getAuthForReports()
  const report = await prisma.customReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
  })
  if (!report) throw new Error('Reporte no encontrado')
  const config = report.config as ReportConfig
  const result = await executeCustomQuery(config.query)
  await prisma.customReport.update({
    where: { id: reportId },
    data: { lastRunAt: new Date(), runCount: { increment: 1 } },
  })
  return result
}

/** Validates access to a saved report before client opens export URL. */
export async function runSavedReport(
  reportId: string,
  _format: 'EXCEL' | 'CSV'
): Promise<void> {
  const { org } = await getAuthForReports()
  const report = await prisma.customReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
  })
  if (!report) throw new Error('Reporte no encontrado')
}

// ==================== Listar reportes ====================

export async function getCustomReports() {
  const { session, org } = await getAuthForReports()
  return prisma.customReport.findMany({
    where: {
      orgId: org.orgId,
      OR: [{ isPublic: true }, { createdByUserId: session.user.id }],
    },
    include: {
      createdBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

// ==================== Report Builder existente (preview + save) ====================

export async function getReportPreview(
  entityType: string,
  filters: Record<string, string | undefined>,
  selectedColumns: string[]
): Promise<Record<string, unknown>[]> {
  const { org } = await getAuthForReports()
  if (entityType === 'PROJECT') {
    const projectIdsFilter = filters.projectId ? { id: filters.projectId } : {}
    const projects = await prisma.project.findMany({
      where: { orgId: org.orgId, ...projectIdsFilter },
      select: {
        id: true,
        projectNumber: true,
        name: true,
        clientName: true,
        status: true,
        phase: true,
        startDate: true,
        plannedEndDate: true,
        location: true,
        totalBudget: true,
      },
      take: 100,
    })
    const projectIds = projects.map((p) => p.id)
    if (projectIds.length === 0) {
      return []
    }

    // Gastado hasta el momento: suma de transacciones financieras no eliminadas por proyecto
    const spentByProject = await prisma.financeTransaction.groupBy({
      by: ['projectId'],
      where: {
        orgId: org.orgId,
        projectId: { in: projectIds },
        deleted: false,
      },
      _sum: { total: true },
    })
    const spentMap = new Map<string, number>()
    for (const row of spentByProject) {
      if (row.projectId)
        spentMap.set(row.projectId, Number(row._sum.total ?? 0))
    }

    // Monto de avance: suma de totalAmount de la última certificación por proyecto
    const certifications = await prisma.certification.findMany({
      where: { projectId: { in: projectIds }, orgId: org.orgId },
      include: { lines: { select: { totalAmount: true } } },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    })
    const certTotalByProject = new Map<string, number>()
    for (const cert of certifications) {
      if (certTotalByProject.has(cert.projectId)) continue
      const total = cert.lines.reduce((s, l) => s + Number(l.totalAmount), 0)
      certTotalByProject.set(cert.projectId, total)
    }

    const keys = selectedColumns.length ? selectedColumns : ['projectNumber', 'name', 'status']
    return projects.map((p) => {
      const totalBudget = p.totalBudget != null ? Number(p.totalBudget) : 0
      const gastadoHastaElMomento = spentMap.get(p.id) ?? 0
      const montoAvance = certTotalByProject.get(p.id) ?? 0
      const avanceObraPct = totalBudget > 0 ? (montoAvance / totalBudget) * 100 : 0
      const diferencia = montoAvance - gastadoHastaElMomento

      const base: Record<string, unknown> = {
        ...p,
        totalBudget: totalBudget || null,
        gastadoHastaElMomento,
        avanceObraPct: Math.round(avanceObraPct * 100) / 100,
        montoAvance,
        diferencia,
      }
      const row: Record<string, unknown> = {}
      for (const k of keys) {
        if (k in base) row[k] = base[k]
      }
      return row
    })
  }
  if (entityType === 'FINANCE_TRANSACTION') {
    const { getCompanyTransactions } = await import('./finance')
    const list = await getCompanyTransactions({
      ...(filters.projectId && filters.projectId !== 'all' ? { projectId: filters.projectId } : {}),
    })
    const keys = selectedColumns.length ? selectedColumns : ['transactionNumber', 'type', 'status', 'issueDate', 'total']
    return (list as Record<string, unknown>[]).map((t) => {
      const row: Record<string, unknown> = {}
      const flat = { ...t, projectName: (t.project as { name?: string })?.name ?? 'Overhead' }
      for (const k of keys) {
        if (k in flat) row[k] = flat[k]
      }
      return row
    }).slice(0, 100)
  }
  if (entityType === 'BUDGET_LINE') {
    const lines = await prisma.budgetLine.findMany({
      where: { orgId: org.orgId },
      include: { wbsNode: true, budgetVersion: { include: { project: true } } },
      take: 100,
    })
    const keys = selectedColumns.length ? selectedColumns : ['description', 'unit', 'quantity', 'directCostTotal']
    return lines.map((l) => {
      const row: Record<string, unknown> = {
        wbsCode: l.wbsNode?.code,
        wbsName: l.wbsNode?.name,
        description: l.description,
        unit: l.unit,
        quantity: Number(l.quantity),
        directCostTotal: Number(l.directCostTotal),
        salePriceTotal: Number(l.salePriceTotal),
        projectName: l.budgetVersion?.project?.name,
      }
      const out: Record<string, unknown> = {}
      for (const k of keys) {
        if (k in row) out[k] = row[k]
      }
      return out
    })
  }
  return []
}

export async function createSavedReport(params: {
  name: string
  description?: string
  entityType: string
  filtersJson: Record<string, unknown>
  columnsJson: string[]
  sortJson?: Array<{ key: string; direction: 'asc' | 'desc' }>
  visibility: 'PRIVATE' | 'SHARED'
}) {
  const { session, org } = await getAuthForReports()
  const report = await prisma.customReport.create({
    data: {
      orgId: org.orgId,
      name: params.name,
      description: params.description ?? null,
      category: params.entityType === 'FINANCE_TRANSACTION' ? 'FINANCE' : params.entityType === 'BUDGET_LINE' ? 'BUDGET' : 'CUSTOM',
      reportType: 'TABLE',
      config: {
        entityType: params.entityType,
        filtersJson: params.filtersJson,
        columnsJson: params.columnsJson,
        sortJson: params.sortJson ?? [],
        visibility: params.visibility,
      },
      isPublic: params.visibility === 'SHARED',
      createdByUserId: session.user.id,
    },
  })
  revalidatePath('/reports')
  return { reportId: report.id }
}

// ==================== Eliminar reporte ====================

export async function deleteCustomReport(reportId: string) {
  await requirePermission('REPORTS', 'delete')
  const { session, org } = await getAuthForReports()
  const report = await prisma.customReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
  })
  if (!report) throw new Error('Reporte no encontrado')
  if (report.createdByUserId !== session.user.id) throw new Error('No tienes permiso para eliminar este reporte')
  await prisma.customReport.delete({ where: { id: reportId } })
  revalidatePath('/reports')
  return { success: true }
}
