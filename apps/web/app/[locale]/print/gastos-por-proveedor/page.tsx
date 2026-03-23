import { getAuthContext } from '@/lib/auth-helpers'
import { getExpensesBySupplierReport } from '@/app/actions/predefined-reports'
import { PrintDocumentShell } from '@/components/print/print-document-shell'
import { PrintTable } from '@/components/print/print-table'
import { formatCurrency } from '@/lib/format-utils'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type Row = {
  supplierName: string
  total: number
  count: number
  projectCount: number
  averagePerTx: number
}

export default async function PrintGastosPorProveedorPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const projectIdsParam = typeof sp.projectIds === 'string' ? sp.projectIds : undefined
  const projectIds = projectIdsParam
    ? projectIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined

  await getAuthContext()
  const data = await getExpensesBySupplierReport(undefined, projectIds)

  const rows: Row[] = data.map((s) => ({
    supplierName: s.supplierName,
    total: s.total,
    count: s.count,
    projectCount: s.projectCount,
    averagePerTx: s.count > 0 ? s.total / s.count : 0,
  }))

  const columns = [
    { key: 'supplierName' as const, label: 'Proveedor', align: 'left' as const },
    {
      key: 'total' as const,
      label: 'Total Gastado',
      align: 'right' as const,
      format: (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v)),
    },
    { key: 'count' as const, label: 'Transacciones', align: 'right' as const },
    { key: 'projectCount' as const, label: 'Proyectos', align: 'right' as const },
    {
      key: 'averagePerTx' as const,
      label: 'Promedio/Tx',
      align: 'right' as const,
      format: (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v)),
    },
  ]

  const total = rows.reduce((sum, r) => sum + r.total, 0)

  return (
    <PrintDocumentShell templateId="gastos-por-proveedor" query={sp}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Gastos por Proveedor</h2>
        <p className="text-sm text-muted-foreground">
          Análisis de compras consolidado por proveedor
        </p>
        <PrintTable<Row>
          columns={columns}
          rows={rows}
          totals={{ total: formatCurrency(total) }}
          totalsLabel="Total"
        />
      </div>
    </PrintDocumentShell>
  )
}
