'use server'

import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { exportToExcel } from '@/lib/export/excel-exporter'
import { exportToPDF } from '@/lib/export/pdf-exporter'
import type { ExcelConfig, PDFConfig } from '@/lib/types/export'

export interface PurchaseRow {
  project: string
  projectNumber: string
  material: string
  quantity: number
  unit: string
  unitCost: number
  totalCost: number
}

/**
 * List parties (suppliers) for the org for report selector
 */
export async function getPartiesForOrg(orgId: string): Promise<{ id: string; name: string }[]> {
  const session = await getSession()
  if (!session?.user?.id) return []

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId || org.orgId !== orgId) return []

  const parties = await prisma.party.findMany({
    where: { orgId, partyType: 'SUPPLIER', active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return parties
}

/**
 * Get purchases by supplier report data (multi-project)
 */
export async function getPurchasesBySupplierReport(
  orgId: string,
  partyId: string
): Promise<PurchaseRow[]> {
  const session = await getSession()
  if (!session?.user?.id) return []

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId || org.orgId !== orgId) return []

  const transactions = await prisma.financeTransaction.findMany({
    where: {
      orgId,
      partyId,
      deleted: false,
      type: { in: ['PURCHASE', 'EXPENSE'] },
    },
    include: {
      project: { select: { name: true, projectNumber: true } },
      lines: true,
    },
    orderBy: { issueDate: 'desc' },
  })

  const rows: PurchaseRow[] = []
  for (const tx of transactions) {
    const projectName = tx.project?.name ?? 'Sin proyecto'
    const projectNumber = tx.project?.projectNumber ?? '—'
    for (const line of tx.lines) {
      rows.push({
        project: projectName,
        projectNumber,
        material: line.description,
        quantity: Number(line.quantity),
        unit: line.unit ?? 'und',
        unitCost: Number(line.unitPrice),
        totalCost: Number(line.lineTotal),
      })
    }
    if (tx.lines.length === 0) {
      rows.push({
        project: projectName,
        projectNumber,
        material: tx.description,
        quantity: 1,
        unit: 'und',
        unitCost: Number(tx.total),
        totalCost: Number(tx.total),
      })
    }
  }
  return rows
}

/**
 * Export purchases-by-supplier report to Excel
 */
export async function exportPurchasesBySupplierToExcel(
  orgId: string,
  partyId: string,
  selectedColumns: string[],
  data: PurchaseRow[]
) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId || org.orgId !== orgId) return { success: false, error: 'Unauthorized' }

  const party = await prisma.party.findFirst({
    where: { id: partyId, orgId },
    select: { name: true },
  })
  if (!party) return { success: false, error: 'Proveedor no encontrado' }

  const allColumns = [
    { field: 'project', label: 'Proyecto', type: 'text' as const, width: 25 },
    { field: 'projectNumber', label: 'Nro. Proyecto', type: 'text' as const, width: 14 },
    { field: 'material', label: 'Material', type: 'text' as const, width: 35 },
    { field: 'quantity', label: 'Cantidad', type: 'number' as const, width: 12, align: 'right' as const },
    { field: 'unit', label: 'Unidad', type: 'text' as const, width: 8 },
    { field: 'unitCost', label: 'P. Unit', type: 'currency' as const, width: 14, align: 'right' as const },
    { field: 'totalCost', label: 'Total', type: 'currency' as const, width: 16, align: 'right' as const },
  ]

  const columns = allColumns.map((col) => ({
    ...col,
    visible: selectedColumns.includes(col.field),
  }))

  const config: ExcelConfig = {
    title: 'COMPRAS POR PROVEEDOR (MULTI-PROYECTO)',
    subtitle: party.name,
    includeCompanyHeader: true,
    metadata: {
      date: new Date(),
      generatedBy: org.orgName,
      filters: [`Proveedor: ${party.name}`],
    },
    columns,
    data,
    totals: { label: 'TOTAL', fields: ['totalCost'] },
    sheetName: 'Compras por Proveedor',
    freezeHeader: true,
    autoFilter: true,
  }

  const buffer = await exportToExcel(config)
  const base64 = buffer.toString('base64')
  const safeName = party.name.replace(/\s+/g, '_').slice(0, 30)
  return {
    success: true,
    data: base64,
    filename: `compras_${safeName}_${Date.now()}.xlsx`,
  }
}

/**
 * Export purchases-by-supplier report to PDF
 */
export async function exportPurchasesBySupplierToPDF(
  orgId: string,
  partyId: string,
  selectedColumns: string[],
  data: PurchaseRow[]
) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId || org.orgId !== orgId) return { success: false, error: 'Unauthorized' }

  const party = await prisma.party.findFirst({
    where: { id: partyId, orgId },
    select: { name: true },
  })
  if (!party) return { success: false, error: 'Proveedor no encontrado' }

  const allColumns = [
    { field: 'project', label: 'Proyecto', type: 'text' as const, align: 'left' as const },
    { field: 'projectNumber', label: 'Nro.', type: 'text' as const, align: 'left' as const },
    { field: 'material', label: 'Material', type: 'text' as const, align: 'left' as const },
    { field: 'quantity', label: 'Cant.', type: 'number' as const, align: 'right' as const },
    { field: 'unit', label: 'Und', type: 'text' as const, align: 'center' as const },
    { field: 'unitCost', label: 'P.Unit', type: 'currency' as const, align: 'right' as const },
    { field: 'totalCost', label: 'Total', type: 'currency' as const, align: 'right' as const },
  ]

  const columns = allColumns.map((col) => ({
    ...col,
    visible: selectedColumns.includes(col.field),
  }))

  const config: PDFConfig = {
    title: 'COMPRAS POR PROVEEDOR (MULTI-PROYECTO)',
    subtitle: party.name,
    includeCompanyHeader: true,
    metadata: {
      date: new Date(),
      filters: [`Proveedor: ${party.name}`],
    },
    columns,
    data,
    totals: { label: 'TOTAL', fields: ['totalCost'] },
    orientation: 'landscape',
    pageSize: 'A4',
    showPageNumbers: true,
  }

  const buffer = await exportToPDF(config)
  const base64 = buffer.toString('base64')
  const safeName = party.name.replace(/\s+/g, '_').slice(0, 30)
  return {
    success: true,
    data: base64,
    filename: `compras_${safeName}_${Date.now()}.pdf`,
  }
}
