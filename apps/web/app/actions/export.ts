'use server'

import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { exportToExcel } from '@/lib/export/excel-exporter'
import type { ExcelConfig } from '@/lib/types/export'
import { getFinanceExecutiveDashboard } from '@/app/actions/finance'
import { getProject } from '@/app/actions/projects'
import { getProjectDashboardData } from '@/app/actions/project-dashboard'
import { formatCurrency } from '@/lib/format-utils'

type OrgData = {
  name: string
  legalName: string | null
  taxId: string | null
  address: string | null
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo: string | null
}

async function getOrganizationData(orgId: string): Promise<OrgData | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      taxId: true,
      address: true,
      city: true,
      country: true,
      profile: {
        select: {
          legalName: true,
          taxId: true,
          address: true,
          city: true,
          country: true,
          phone: true,
          email: true,
          website: true,
          logoStorageKey: true,
        },
      },
    },
  })
  if (!org) return null
  const p = org.profile
  return {
    name: org.name,
    legalName: p?.legalName ?? null,
    taxId: p?.taxId ?? org.taxId ?? null,
    address: p?.address ?? org.address ?? null,
    city: p?.city ?? org.city ?? null,
    country: p?.country ?? org.country ?? null,
    phone: p?.phone ?? null,
    email: p?.email ?? null,
    website: p?.website ?? null,
    logo: p?.logoStorageKey ?? null,
  }
}

export async function exportMaterialsToExcel(
  budgetVersionId: string,
  selectedColumns: string[]
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }

  const orgData = await getOrganizationData(org.orgId)

  try {
    const version = await prisma.budgetVersion.findFirst({
      where: { id: budgetVersionId, orgId: org.orgId },
      include: { project: true },
    })

    if (!version) {
      return { success: false, error: 'Version not found' }
    }

    const { getConsolidatedMaterials } = await import('./materials')
    const materials = await getConsolidatedMaterials(budgetVersionId)

    const allColumns = [
      { field: 'name', label: 'Material', type: 'text' as const, width: 30 },
      { field: 'description', label: 'Descripción', type: 'text' as const, width: 40 },
      { field: 'unit', label: 'Unidad', type: 'text' as const, width: 10 },
      { field: 'totalQuantity', label: 'Cantidad Total', type: 'number' as const, width: 15, align: 'right' as const },
      { field: 'averageUnitCost', label: 'Costo Unit. Promedio', type: 'currency' as const, width: 18, align: 'right' as const },
      { field: 'totalCost', label: 'Costo Total', type: 'currency' as const, width: 18, align: 'right' as const },
    ]

    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))

    const config: ExcelConfig = {
      title: 'LISTADO DE MATERIALES',
      subtitle: `Proyecto: ${version.project.name}`,
      includeCompanyHeader: true,
      project: {
        name: version.project.name,
        number: version.project.projectNumber,
        client: version.project.clientName ?? undefined,
        location: version.project.location ?? undefined,
      },
      metadata: {
        version: version.versionCode,
        date: new Date(),
        generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema',
      },
      columns,
      data: materials,
      totals: {
        label: 'TOTAL GENERAL',
        fields: ['totalCost'],
      },
      sheetName: 'Materiales',
      freezeHeader: true,
      autoFilter: true,
    }

    const buffer = await exportToExcel(config)
    const base64 = buffer.toString('base64')

    return {
      success: true,
      data: base64,
      filename: `materiales_${version.project.projectNumber}_${version.versionCode}_${Date.now()}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting materials:', error)
    return { success: false, error: 'Error al exportar materiales' }
  }
}

export async function exportBudgetToExcel(
  budgetVersionId: string,
  selectedColumns: string[]
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }

  const orgData = await getOrganizationData(org.orgId)

  try {
    const { getBudgetExportData } = await import('./budget')
    const exportData = await getBudgetExportData(budgetVersionId)
    if (!exportData) {
      return { success: false, error: 'Version not found' }
    }
    const { version, rows } = exportData
    const project = await getProject(version.projectId as string)
    const data = rows.map((r) => ({
      code: r.code,
      description: r.description,
      unit: r.unit,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      totalCost: r.totalCost,
      incidenciaPct: r.incidenciaPct ?? 0,
      overheadPct: 0,
      profitPct: 0,
      taxPct: 0,
    }))

    const allColumns = [
      { field: 'code', label: 'Código', type: 'text' as const, width: 12 },
      { field: 'description', label: 'Descripción', type: 'text' as const, width: 40 },
      { field: 'unit', label: 'Und', type: 'text' as const, width: 8 },
      { field: 'quantity', label: 'Cantidad', type: 'number' as const, width: 12, align: 'right' as const },
      { field: 'unitPrice', label: 'P.Unit', type: 'currency' as const, width: 15, align: 'right' as const },
      { field: 'totalCost', label: 'Total', type: 'currency' as const, width: 18, align: 'right' as const },
      { field: 'incidenciaPct', label: 'Inc %', type: 'percentage' as const, width: 10, align: 'right' as const },
      { field: 'overheadPct', label: 'GG %', type: 'percentage' as const, width: 10, align: 'right' as const },
      { field: 'profitPct', label: 'Benef %', type: 'percentage' as const, width: 10, align: 'right' as const },
      { field: 'taxPct', label: 'IVA %', type: 'percentage' as const, width: 10, align: 'right' as const },
    ]

    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))

    const v = version as { project: { name: string; projectNumber: string }; versionCode: string }
    const config: ExcelConfig = {
      title: 'PRESUPUESTO OFICIAL',
      subtitle: `${v.project.name} - ${v.versionCode}`,
      includeCompanyHeader: true,
      project: {
        name: v.project.name,
        number: v.project.projectNumber,
        client: (project as { clientName?: string | null } | null)?.clientName ?? undefined,
      },
      metadata: {
        version: v.versionCode,
        date: new Date(),
        generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema',
      },
      columns,
      data,
      totals: {
        label: 'TOTAL PRESUPUESTO',
        fields: ['totalCost'],
      },
      sheetName: 'Presupuesto',
      freezeHeader: true,
      autoFilter: true,
    }

    const buffer = await exportToExcel(config)
    const base64 = buffer.toString('base64')

    return {
      success: true,
      data: base64,
      filename: `presupuesto_${v.project.projectNumber}_${v.versionCode}_${Date.now()}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting budget:', error)
    return { success: false, error: 'Error al exportar presupuesto' }
  }
}

/**
 * Exportar materiales de un proveedor (por versión de presupuesto)
 */
export async function exportMaterialsBySupplierToExcel(
  budgetVersionId: string,
  supplierName: string,
  selectedColumns: string[]
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }

  const orgData = await getOrganizationData(org.orgId)

  try {
    const { getMaterialsBySupplier } = await import('./materials')
    const bySupplier = await getMaterialsBySupplier(budgetVersionId)
    const supplier = bySupplier.find((s) => s.supplierName === supplierName)
    if (!supplier) {
      return { success: false, error: 'Proveedor no encontrado' }
    }

    const version = await prisma.budgetVersion.findFirst({
      where: { id: budgetVersionId, orgId: org.orgId },
      include: { project: true },
    })
    if (!version) return { success: false, error: 'Versión no encontrada' }

    const data = supplier.materials.map((m) => ({
      name: m.name,
      unit: m.unit,
      quantity: m.quantity,
      unitCost: m.unitCost,
      totalCost: m.totalCost,
    }))

    const allColumns = [
      { field: 'name', label: 'Material', type: 'text' as const, width: 30 },
      { field: 'unit', label: 'Unidad', type: 'text' as const, width: 10 },
      { field: 'quantity', label: 'Cantidad', type: 'number' as const, width: 15, align: 'right' as const },
      { field: 'unitCost', label: 'Costo Unitario', type: 'currency' as const, width: 18, align: 'right' as const },
      { field: 'totalCost', label: 'Costo Total', type: 'currency' as const, width: 18, align: 'right' as const },
    ]

    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))

    const config: ExcelConfig = {
      title: 'MATERIALES POR PROVEEDOR',
      subtitle: `${version.project.name} - ${supplierName}`,
      includeCompanyHeader: true,
      project: {
        name: version.project.name,
        number: version.project.projectNumber,
        client: version.project.clientName ?? undefined,
      },
      metadata: {
        date: new Date(),
        generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema',
      },
      columns,
      data,
      totals: {
        label: 'TOTAL',
        fields: ['totalCost'],
      },
      sheetName: 'Materiales',
      freezeHeader: true,
      autoFilter: true,
    }

    const buffer = await exportToExcel(config)
    const base64 = buffer.toString('base64')

    return {
      success: true,
      data: base64,
      filename: `materiales_${supplierName.replace(/\s+/g, '_')}_${Date.now()}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting materials by supplier:', error)
    return { success: false, error: 'Error al exportar materiales del proveedor' }
  }
}

/**
 * Exportar todos los materiales agrupados por proveedor (totalidad) a Excel
 */
export async function exportAllMaterialsBySupplierToExcel(
  budgetVersionId: string,
  selectedColumns: string[]
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }

  const orgData = await getOrganizationData(org.orgId)

  try {
    const { getMaterialsBySupplier } = await import('./materials')
    const bySupplier = await getMaterialsBySupplier(budgetVersionId)

    const version = await prisma.budgetVersion.findFirst({
      where: { id: budgetVersionId, orgId: org.orgId },
      include: { project: true },
    })
    if (!version) return { success: false, error: 'Versión no encontrada' }

    const data: Array<{
      supplier: string
      name: string
      unit: string
      quantity: number
      unitCost: number
      totalCost: number
    }> = []
    for (const s of bySupplier) {
      for (const m of s.materials) {
        data.push({
          supplier: s.supplierName,
          name: m.name,
          unit: m.unit,
          quantity: m.quantity,
          unitCost: m.unitCost,
          totalCost: m.totalCost,
        })
      }
    }

    const allColumns = [
      { field: 'supplier', label: 'Proveedor', type: 'text' as const, width: 28 },
      { field: 'name', label: 'Material', type: 'text' as const, width: 30 },
      { field: 'unit', label: 'Unidad', type: 'text' as const, width: 10 },
      { field: 'quantity', label: 'Cantidad', type: 'number' as const, width: 15, align: 'right' as const },
      { field: 'unitCost', label: 'Costo Unitario', type: 'currency' as const, width: 18, align: 'right' as const },
      { field: 'totalCost', label: 'Costo Total', type: 'currency' as const, width: 18, align: 'right' as const },
    ]

    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))

    const config: ExcelConfig = {
      title: 'MATERIALES AGRUPADOS POR PROVEEDOR',
      subtitle: `${version.project.name} - Totalidad`,
      includeCompanyHeader: true,
      project: {
        name: version.project.name,
        number: version.project.projectNumber,
        client: version.project.clientName ?? undefined,
      },
      metadata: {
        date: new Date(),
        generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema',
      },
      columns,
      data,
      sheetName: 'Materiales por proveedor',
      freezeHeader: true,
      autoFilter: true,
    }

    const buffer = await exportToExcel(config)
    const base64 = buffer.toString('base64')

    return {
      success: true,
      data: base64,
      filename: `materiales_por_proveedor_total_${Date.now()}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting all materials by supplier:', error)
    return { success: false, error: 'Error al exportar materiales por proveedor' }
  }
}

/**
 * Exportar Orden de Compra (Commitment PO) a Excel.
 * Misma estructura que exportación de presupuestos: cabecera empresa, proyecto, número OC, proveedor, líneas.
 */
export async function exportPurchaseOrderToExcel(
  commitmentId: string,
  selectedColumns: string[]
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }

  const orgData = await getOrganizationData(org.orgId)

  try {
    const commitment = await prisma.commitment.findFirst({
      where: { id: commitmentId, orgId: org.orgId, deleted: false },
      include: {
        project: { select: { name: true, projectNumber: true, clientName: true } },
        party: { select: { name: true } },
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: { wbsNode: { select: { code: true } } },
        },
      },
    })
    if (!commitment) {
      return { success: false, error: 'Orden de compra no encontrada' }
    }

    const data = commitment.lines.map((line) => ({
      description: line.description,
      wbsCode: line.wbsNode?.code ?? '',
      unit: line.unit ?? 'und',
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      totalCost: Number(line.lineTotal),
    }))

    const allColumns = [
      { field: 'description', label: 'Descripción', type: 'text' as const, width: 40 },
      { field: 'wbsCode', label: 'Código WBS', type: 'text' as const, width: 12 },
      { field: 'unit', label: 'Unidad', type: 'text' as const, width: 10 },
      { field: 'quantity', label: 'Cantidad', type: 'number' as const, width: 12, align: 'right' as const },
      { field: 'unitPrice', label: 'P. Unit', type: 'currency' as const, width: 15, align: 'right' as const },
      { field: 'totalCost', label: 'Total', type: 'currency' as const, width: 18, align: 'right' as const },
    ]

    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))

    const project = commitment.project as { name: string; projectNumber: string; clientName: string | null }
    const config: ExcelConfig = {
      title: 'ORDEN DE COMPRA',
      subtitle: `${project.name} - ${commitment.commitmentNumber}`,
      includeCompanyHeader: true,
      project: {
        name: project.name,
        number: project.projectNumber,
        client: project.clientName ?? undefined,
      },
      metadata: {
        version: commitment.commitmentNumber,
        date: commitment.issueDate,
        generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema',
        filters: [`Proveedor: ${(commitment.party as { name: string }).name}`],
      },
      columns,
      data,
      totals: { label: 'TOTAL', fields: ['totalCost'] },
      sheetName: 'Orden de compra',
      freezeHeader: true,
      autoFilter: true,
    }

    const buffer = await exportToExcel(config)
    const base64 = buffer.toString('base64')
    const safeNumber = commitment.commitmentNumber.replace(/\s+/g, '_')
    return {
      success: true,
      data: base64,
      filename: `orden-compra-${project.projectNumber}-${safeNumber}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting purchase order:', error)
    return { success: false, error: 'Error al exportar orden de compra' }
  }
}

/**
 * Exportar lista de proyectos
 */
export async function exportProjectsToExcel(selectedColumns: string[]) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }

  const orgData = await getOrganizationData(org.orgId)

  try {
    const projects = await prisma.project.findMany({
      where: { orgId: org.orgId, active: true },
      orderBy: { createdAt: 'desc' },
    })

    const data = projects.map((p) => ({
      projectNumber: p.projectNumber,
      name: p.name,
      clientName: p.clientName ?? '-',
      location: p.location ?? '-',
      phase: p.phase,
      status: p.status,
      createdAt: p.createdAt,
    }))

    const allColumns = [
      { field: 'projectNumber', label: 'Número', type: 'text' as const, width: 15 },
      { field: 'name', label: 'Nombre', type: 'text' as const, width: 30 },
      { field: 'clientName', label: 'Cliente', type: 'text' as const, width: 25 },
      { field: 'location', label: 'Ubicación', type: 'text' as const, width: 25 },
      { field: 'phase', label: 'Fase', type: 'text' as const, width: 15 },
      { field: 'status', label: 'Estado', type: 'text' as const, width: 12 },
      { field: 'createdAt', label: 'Creado', type: 'date' as const, width: 12 },
    ]

    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))

    const config: ExcelConfig = {
      title: 'LISTA DE PROYECTOS',
      includeCompanyHeader: true,
      metadata: {
        date: new Date(),
        generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema',
      },
      columns,
      data,
      sheetName: 'Proyectos',
      freezeHeader: true,
      autoFilter: true,
    }

    const buffer = await exportToExcel(config)
    const base64 = buffer.toString('base64')

    return {
      success: true,
      data: base64,
      filename: `proyectos_${Date.now()}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting projects:', error)
    return { success: false, error: 'Error al exportar proyectos' }
  }
}

/**
 * Exportar equipo de trabajo
 */
export async function exportTeamToExcel(selectedColumns: string[]) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }

  const orgData = await getOrganizationData(org.orgId)

  try {
    const members = await prisma.orgMember.findMany({
      where: { orgId: org.orgId, active: true },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { user: { fullName: 'asc' } },
    })

    const data = members.map((m) => ({
      fullName: m.user.fullName ?? '-',
      email: m.user.email,
      role: m.role,
      status: m.active ? 'Activo' : 'Inactivo',
      lastLoginAt: m.user.lastLoginAt,
    }))

    const allColumns = [
      { field: 'fullName', label: 'Nombre Completo', type: 'text' as const, width: 25 },
      { field: 'email', label: 'Email', type: 'text' as const, width: 30 },
      { field: 'role', label: 'Rol', type: 'text' as const, width: 15 },
      { field: 'status', label: 'Estado', type: 'text' as const, width: 12 },
      { field: 'lastLoginAt', label: 'Último Acceso', type: 'date' as const, width: 15 },
    ]

    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))

    const config: ExcelConfig = {
      title: 'EQUIPO DE TRABAJO',
      includeCompanyHeader: true,
      metadata: {
        date: new Date(),
        generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema',
      },
      columns,
      data,
      sheetName: 'Equipo',
      freezeHeader: true,
      autoFilter: true,
    }

    const buffer = await exportToExcel(config)
    const base64 = buffer.toString('base64')

    return {
      success: true,
      data: base64,
      filename: `equipo_${Date.now()}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting team:', error)
    return { success: false, error: 'Error al exportar equipo' }
  }
}

/**
 * Template genérico de exportación para cualquier tabla
 */
export async function exportGenericTable(
  title: string,
  data: Record<string, unknown>[],
  columns: Array<{
    field: string
    label: string
    type: 'text' | 'number' | 'currency' | 'date' | 'percentage'
    width?: number
  }>,
  options?: {
    sheetName?: string
    includeCompanyHeader?: boolean
    totals?: { label: string; fields: string[] }
  }
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }

  const orgData = await getOrganizationData(org.orgId)

  try {
    const config: ExcelConfig = {
      title: title.toUpperCase(),
      includeCompanyHeader: options?.includeCompanyHeader ?? true,
      metadata: {
        date: new Date(),
        generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema',
      },
      columns: columns.map((col) => ({
        ...col,
        visible: true,
        align: ['number', 'currency', 'percentage'].includes(col.type)
          ? ('right' as const)
          : ('left' as const),
      })),
      data,
      totals: options?.totals,
      sheetName: options?.sheetName ?? 'Datos',
      freezeHeader: true,
      autoFilter: true,
    }

    const buffer = await exportToExcel(config)
    const base64 = buffer.toString('base64')

    return {
      success: true,
      data: base64,
      filename: `${title.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.xlsx`,
    }
  } catch (error) {
    console.error('Error in generic export:', error)
    return { success: false, error: 'Error al exportar datos' }
  }
}

// ==================== Transacciones Globales (Finanzas Empresa) ====================

export type CompanyTransactionsExportFilters = {
  projectId?: string | null
  type?: string
  partyId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export async function exportCompanyTransactionsToExcel(
  filters: CompanyTransactionsExportFilters,
  selectedColumns: string[]
) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }
  const orgData = await getOrganizationData(org.orgId)
  try {
    const { getCompanyTransactions } = await import('./finance')
    const list = await getCompanyTransactions(filters)
    const allColumns = [
      { field: 'issueDate', label: 'Fecha', type: 'date' as const, width: 12 },
      { field: 'transactionNumber', label: 'Número', type: 'text' as const, width: 18 },
      { field: 'type', label: 'Tipo', type: 'text' as const, width: 12 },
      { field: 'projectName', label: 'Proyecto', type: 'text' as const, width: 22 },
      { field: 'description', label: 'Descripción', type: 'text' as const, width: 35 },
      { field: 'partyName', label: 'Proveedor/Cliente', type: 'text' as const, width: 25 },
      { field: 'total', label: 'Monto', type: 'currency' as const, width: 14, align: 'right' as const },
      { field: 'status', label: 'Estado', type: 'text' as const, width: 12 },
    ]
    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))
    const data = list.map((t: Record<string, unknown>) => ({
      issueDate: t.issueDate,
      transactionNumber: t.transactionNumber,
      type: t.type,
      projectName: (t.project as { name?: string })?.name ?? 'Generales',
      description: t.description,
      partyName: (t.party as { name?: string })?.name ?? '—',
      total: typeof t.total === 'number' ? t.total : Number(t.total ?? 0),
      status: t.status,
    }))
    const config: ExcelConfig = {
      title: 'Transacciones de Empresa',
      subtitle: `Exportado el ${new Date().toLocaleDateString('es-AR')}`,
      includeCompanyHeader: true,
      metadata: { date: new Date(), generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema' },
      columns,
      data,
      sheetName: 'Transacciones',
      freezeHeader: true,
      autoFilter: true,
    }
    const buffer = await exportToExcel(config)
    return {
      success: true,
      data: buffer.toString('base64'),
      filename: `transacciones-empresa-${new Date().toISOString().split('T')[0]}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting company transactions:', error)
    return { success: false, error: 'Error al exportar transacciones' }
  }
}

// ==================== Cashflow consolidado ====================

export type CashflowExportParams = {
  dateFrom: string
  dateTo: string
}

export async function exportCompanyCashflowToExcel(
  params: CashflowExportParams,
  selectedColumns: string[]
) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }
  const orgData = await getOrganizationData(org.orgId)
  try {
    const { getCompanyCashflowDetailed } = await import('./finance')
    const from = new Date(params.dateFrom)
    const to = new Date(params.dateTo)
    const { timeline, breakdown } = await getCompanyCashflowDetailed({ from, to })
    const allColumns = [
      { field: 'month', label: 'Mes', type: 'text' as const, width: 12 },
      { field: 'income', label: 'Ingresos', type: 'currency' as const, width: 14, align: 'right' as const },
      { field: 'expense', label: 'Gastos', type: 'currency' as const, width: 14, align: 'right' as const },
      { field: 'overhead', label: 'Generales', type: 'currency' as const, width: 14, align: 'right' as const },
      { field: 'projectExpense', label: 'Gastos proyectos', type: 'currency' as const, width: 16, align: 'right' as const },
      { field: 'balance', label: 'Balance', type: 'currency' as const, width: 14, align: 'right' as const },
    ]
    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))
    const data = timeline.map((row) => ({
      month: row.month,
      income: row.income,
      expense: row.expense,
      overhead: row.overhead,
      projectExpense: row.expense - row.overhead,
      balance: row.balance,
    }))
    const config: ExcelConfig = {
      title: 'Flujo de caja consolidado',
      subtitle: `Período ${from.toLocaleDateString('es-AR')} - ${to.toLocaleDateString('es-AR')} · Exportado el ${new Date().toLocaleDateString('es-AR')}`,
      includeCompanyHeader: true,
      metadata: { date: new Date(), generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema' },
      columns,
      data,
      sheetName: 'Cashflow',
      freezeHeader: true,
      autoFilter: true,
    }
    const buffer = await exportToExcel(config)
    return {
      success: true,
      data: buffer.toString('base64'),
      filename: `cashflow-${params.dateFrom}-${params.dateTo}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting cashflow:', error)
    return { success: false, error: 'Error al exportar flujo de caja' }
  }
}

export type ProjectCashflowExportParams = CashflowExportParams & { projectId: string }

export async function exportProjectCashflowToExcel(
  params: ProjectCashflowExportParams,
  selectedColumns: string[]
) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }
  const project = await getProject(params.projectId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }
  try {
    const { getProjectCashflow } = await import('./finance')
    const from = new Date(params.dateFrom)
    const to = new Date(params.dateTo)
    const timeline = await getProjectCashflow(params.projectId, { from, to })
    const allColumns = [
      { field: 'month', label: 'Mes', type: 'text' as const, width: 12 },
      { field: 'income', label: 'Ingresos', type: 'currency' as const, width: 14, align: 'right' as const },
      { field: 'expense', label: 'Gastos', type: 'currency' as const, width: 14, align: 'right' as const },
      { field: 'net', label: 'Neto', type: 'currency' as const, width: 14, align: 'right' as const },
      { field: 'balance', label: 'Balance', type: 'currency' as const, width: 14, align: 'right' as const },
    ]
    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))
    const data = timeline.map((row) => ({
      month: row.month,
      income: row.income,
      expense: row.expense,
      net: row.income - row.expense,
      balance: row.balance,
    }))
    const config: ExcelConfig = {
      title: `Flujo de caja — ${project.name}`,
      subtitle: `Período ${from.toLocaleDateString('es-AR')} - ${to.toLocaleDateString('es-AR')} · Exportado el ${new Date().toLocaleDateString('es-AR')}`,
      includeCompanyHeader: false,
      metadata: { date: new Date(), generatedBy: 'Sistema' },
      columns,
      data,
      sheetName: 'Cashflow',
      freezeHeader: true,
      autoFilter: true,
    }
    const buffer = await exportToExcel(config)
    return {
      success: true,
      data: buffer.toString('base64'),
      filename: `cashflow-proyecto-${params.dateFrom}-${params.dateTo}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting project cashflow:', error)
    return { success: false, error: 'Error al exportar flujo de caja del proyecto' }
  }
}

// ==================== Overhead con asignaciones ====================

export async function exportOverheadToExcel(selectedColumns: string[]) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }
  const orgData = await getOrganizationData(org.orgId)
  try {
    const { getOverheadTransactions } = await import('./finance')
    const transactions = await getOverheadTransactions()
    const allColumns = [
      { field: 'issueDate', label: 'Fecha', type: 'date' as const, width: 12 },
      { field: 'transactionNumber', label: 'Número', type: 'text' as const, width: 18 },
      { field: 'description', label: 'Descripción', type: 'text' as const, width: 35 },
      { field: 'total', label: 'Total', type: 'currency' as const, width: 14, align: 'right' as const },
      { field: 'totalAllocatedPct', label: '% Asignado', type: 'percentage' as const, width: 12, align: 'right' as const },
      { field: 'remainingAmount', label: 'Pendiente', type: 'currency' as const, width: 14, align: 'right' as const },
      { field: 'status', label: 'Estado', type: 'text' as const, width: 12 },
    ]
    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))
    const data = transactions.map((tx) => ({
      issueDate: tx.issueDate,
      transactionNumber: tx.transactionNumber,
      description: tx.description,
      total: tx.total,
      totalAllocatedPct: tx.totalAllocatedPct / 100,
      remainingAmount: tx.remainingAmount,
      status: tx.status === 'complete' ? 'Completo' : tx.status === 'partial' ? 'Parcial' : 'Sin Asignar',
    }))
    const config: ExcelConfig = {
      title: 'Gastos generales',
      subtitle: `Exportado el ${new Date().toLocaleDateString('es-AR')}`,
      includeCompanyHeader: true,
      metadata: { date: new Date(), generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema' },
      columns,
      data,
      sheetName: 'Overhead',
      freezeHeader: true,
      autoFilter: true,
    }
    const buffer = await exportToExcel(config)
    return {
      success: true,
      data: buffer.toString('base64'),
      filename: `gastos-generales-${new Date().toISOString().split('T')[0]}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting overhead:', error)
    return { success: false, error: 'Error al exportar gastos generales' }
  }
}

// ==================== Transacciones por proyecto ====================

export async function exportProjectTransactionsToExcel(
  projectId: string,
  selectedColumns: string[]
) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }
  const orgData = await getOrganizationData(org.orgId)
  try {
    const { getProjectTransactions } = await import('./finance')
    const { getProject } = await import('./projects')
    const list = await getProjectTransactions(projectId)
    const projectData = await getProject(projectId)
    if (!projectData) return { success: false, error: 'Proyecto no encontrado' }
    const allColumns = [
      { field: 'issueDate', label: 'Fecha', type: 'date' as const, width: 12 },
      { field: 'transactionNumber', label: 'Número', type: 'text' as const, width: 18 },
      { field: 'type', label: 'Tipo', type: 'text' as const, width: 12 },
      { field: 'description', label: 'Descripción', type: 'text' as const, width: 35 },
      { field: 'partyName', label: 'Proveedor/Cliente', type: 'text' as const, width: 25 },
      { field: 'total', label: 'Monto', type: 'currency' as const, width: 14, align: 'right' as const },
      { field: 'status', label: 'Estado', type: 'text' as const, width: 12 },
    ]
    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))
    const data = list.map((t: Record<string, unknown>) => ({
      issueDate: t.issueDate,
      transactionNumber: t.transactionNumber,
      type: t.type,
      description: t.description,
      partyName: (t.party as { name?: string })?.name ?? '—',
      total: typeof t.total === 'number' ? t.total : Number((t.total as { toNumber?: () => number })?.toNumber?.() ?? t.total ?? 0),
      status: t.status,
    }))
    const config: ExcelConfig = {
      title: 'Transacciones del Proyecto',
      subtitle: projectData.name,
      includeCompanyHeader: true,
      project: { name: projectData.name, number: projectData.projectNumber },
      metadata: { date: new Date(), generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema' },
      columns,
      data,
      sheetName: 'Transacciones',
      freezeHeader: true,
      autoFilter: true,
    }
    const buffer = await exportToExcel(config)
    return {
      success: true,
      data: buffer.toString('base64'),
      filename: `transacciones-${projectData.projectNumber}-${new Date().toISOString().split('T')[0]}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting project transactions:', error)
    return { success: false, error: 'Error al exportar transacciones' }
  }
}

// ==================== Certificaciones por proyecto ====================

export async function exportCertificationsToExcel(
  projectId: string,
  selectedColumns: string[]
) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return { success: false, error: 'Unauthorized' }
  const orgData = await getOrganizationData(org.orgId)
  try {
    const { getProjectCertifications } = await import('./certifications')
    const { getProject } = await import('./projects')
    const certifications = await getProjectCertifications(projectId)
    const projectData = await getProject(projectId)
    if (!projectData) return { success: false, error: 'Proyecto no encontrado' }
    const allColumns = [
      { field: 'number', label: 'Número', type: 'number' as const, width: 10 },
      { field: 'period', label: 'Período', type: 'text' as const, width: 12 },
      { field: 'budgetVersion', label: 'Presupuesto', type: 'text' as const, width: 15 },
      { field: 'issuedDate', label: 'Fecha Emisión', type: 'date' as const, width: 14 },
      { field: 'totalAmount', label: 'Monto', type: 'currency' as const, width: 14, align: 'right' as const },
      { field: 'status', label: 'Estado', type: 'text' as const, width: 12 },
    ]
    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))
    const data = certifications.map((cert: Record<string, unknown>) => ({
      number: cert.number,
      period: `${cert.periodMonth ?? ''}/${cert.periodYear ?? ''}`,
      budgetVersion: (cert.budgetVersion as { versionCode?: string })?.versionCode ?? '—',
      issuedDate: cert.issuedDate,
      totalAmount: cert.totalAmount ?? 0,
      status: cert.status,
    }))
    const config: ExcelConfig = {
      title: 'Certificaciones de Obra',
      subtitle: `Proyecto: ${projectData.name}`,
      includeCompanyHeader: true,
      project: { name: projectData.name, number: projectData.projectNumber },
      metadata: { date: new Date(), generatedBy: orgData?.legalName ?? orgData?.name ?? 'Sistema' },
      columns,
      data,
      sheetName: 'Certificaciones',
      freezeHeader: true,
      autoFilter: true,
    }
    const buffer = await exportToExcel(config)
    return {
      success: true,
      data: buffer.toString('base64'),
      filename: `certificaciones-${projectData.projectNumber}-${new Date().toISOString().split('T')[0]}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting certifications:', error)
    return { success: false, error: 'Error al exportar certificaciones' }
  }
}
