import { getAuthContext } from '@/lib/auth-helpers'
import { getPurchasesBySupplierReport } from '@/app/actions/export-purchases'
import { PrintDocumentShell } from '@/components/print/print-document-shell'
import { PrintTable } from '@/components/print/print-table'
import { formatCurrency } from '@/lib/format-utils'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type Row = {
  project: string
  projectNumber: string
  material: string
  quantity: number
  unit: string
  unitCost: number
  totalCost: number
}

export default async function PrintPurchasesBySupplierPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const partyId = typeof sp.partyId === 'string' ? sp.partyId : undefined
  if (!partyId) {
    return (
      <PrintDocumentShell templateId="purchases-by-supplier">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Compras por proveedor</h2>
          <p className="text-muted-foreground">Seleccione un proveedor (partyId) en la URL.</p>
        </div>
      </PrintDocumentShell>
    )
  }

  const { org } = await getAuthContext()
  const rows = await getPurchasesBySupplierReport(org.orgId, partyId)

  const columns = [
    { key: 'project' as const, label: 'Proyecto', align: 'left' as const },
    { key: 'projectNumber' as const, label: 'Nº Proyecto', align: 'left' as const },
    { key: 'material' as const, label: 'Material', align: 'left' as const },
    { key: 'quantity' as const, label: 'Cantidad', align: 'right' as const },
    { key: 'unit' as const, label: 'Unidad', align: 'center' as const },
    {
      key: 'unitCost' as const,
      label: 'Costo unit.',
      align: 'right' as const,
      format: (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v)),
    },
    {
      key: 'totalCost' as const,
      label: 'Total',
      align: 'right' as const,
      format: (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v)),
    },
  ]

  const total = rows.reduce((sum, r) => sum + r.totalCost, 0)

  return (
    <PrintDocumentShell templateId="purchases-by-supplier" query={{ partyId }}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Compras por proveedor</h2>
        <PrintTable<Row>
          columns={columns}
          rows={rows}
          totals={{ totalCost: formatCurrency(total) }}
          totalsLabel="Total"
        />
      </div>
    </PrintDocumentShell>
  )
}
