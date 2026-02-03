'use server'

import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { exportToExcel } from '@/lib/export/excel-exporter'
import { exportToPDF } from '@/lib/export/pdf-exporter'
import type { ExcelConfig, PDFConfig } from '@/lib/types/export'

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

export async function exportMaterialsToPDF(
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
      { field: 'name', label: 'Material', type: 'text' as const, align: 'left' as const },
      { field: 'unit', label: 'Und', type: 'text' as const, align: 'center' as const },
      { field: 'totalQuantity', label: 'Cantidad', type: 'number' as const, align: 'right' as const },
      { field: 'averageUnitCost', label: 'P.Unit', type: 'currency' as const, align: 'right' as const },
      { field: 'totalCost', label: 'Total', type: 'currency' as const, align: 'right' as const },
    ]

    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))

    const config: PDFConfig = {
      title: 'LISTADO DE MATERIALES',
      subtitle: version.project.name,
      includeCompanyHeader: true,
      project: {
        name: version.project.name,
        number: version.project.projectNumber,
        client: version.project.clientName ?? undefined,
      },
      metadata: {
        version: version.versionCode,
        date: new Date(),
      },
      columns,
      data: materials,
      totals: {
        label: 'TOTAL',
        fields: ['totalCost'],
      },
      orientation: 'portrait',
      pageSize: 'A4',
      showPageNumbers: true,
    }

    const buffer = await exportToPDF(config)
    const base64 = buffer.toString('base64')

    return {
      success: true,
      data: base64,
      filename: `materiales_${version.project.projectNumber}_${version.versionCode}_${Date.now()}.pdf`,
    }
  } catch (error) {
    console.error('Error exporting materials PDF:', error)
    return { success: false, error: 'Error al exportar PDF' }
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
    const version = await prisma.budgetVersion.findFirst({
      where: { id: budgetVersionId, orgId: org.orgId },
      include: {
        project: true,
        lines: {
          include: { wbsNode: true },
          orderBy: { wbsNode: { code: 'asc' } },
        },
      },
    })

    if (!version) {
      return { success: false, error: 'Version not found' }
    }

    const data = version.lines.map((line) => {
      const qty = Number(line.quantity) || 1
      const directCost = Number(line.directCostTotal)
      return {
        code: line.wbsNode.code,
        description: line.description,
        unit: line.unit,
        quantity: qty,
        unitPrice: qty > 0 ? directCost / qty : 0,
        totalCost: directCost,
        overheadPct: Number(line.overheadPct),
        profitPct: Number(line.profitPct),
        taxPct: Number(line.taxPct),
      }
    })

    const allColumns = [
      { field: 'code', label: 'Código', type: 'text' as const, width: 12 },
      { field: 'description', label: 'Descripción', type: 'text' as const, width: 40 },
      { field: 'unit', label: 'Und', type: 'text' as const, width: 8 },
      { field: 'quantity', label: 'Cantidad', type: 'number' as const, width: 12, align: 'right' as const },
      { field: 'unitPrice', label: 'P.Unit', type: 'currency' as const, width: 15, align: 'right' as const },
      { field: 'totalCost', label: 'Total', type: 'currency' as const, width: 18, align: 'right' as const },
      { field: 'overheadPct', label: 'GG %', type: 'percentage' as const, width: 10, align: 'right' as const },
      { field: 'profitPct', label: 'Benef %', type: 'percentage' as const, width: 10, align: 'right' as const },
      { field: 'taxPct', label: 'IVA %', type: 'percentage' as const, width: 10, align: 'right' as const },
    ]

    const columns = allColumns.map((col) => ({
      ...col,
      visible: selectedColumns.includes(col.field),
    }))

    const config: ExcelConfig = {
      title: 'PRESUPUESTO OFICIAL',
      subtitle: `${version.project.name} - ${version.versionCode}`,
      includeCompanyHeader: true,
      project: {
        name: version.project.name,
        number: version.project.projectNumber,
        client: version.project.clientName ?? undefined,
      },
      metadata: {
        version: version.versionCode,
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
      filename: `presupuesto_${version.project.projectNumber}_${version.versionCode}_${Date.now()}.xlsx`,
    }
  } catch (error) {
    console.error('Error exporting budget:', error)
    return { success: false, error: 'Error al exportar presupuesto' }
  }
}
