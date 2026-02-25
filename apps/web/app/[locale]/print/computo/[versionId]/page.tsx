import { notFound } from 'next/navigation'
import { getBudgetVersion, listBudgetLines } from '@/app/actions/budget'
import { getProject } from '@/app/actions/projects'
import { PrintDocumentShell } from '@/components/print/print-document-shell'
import { PrintTable } from '@/components/print/print-table'
import { formatCurrency } from '@/lib/format-utils'

type PageProps = {
  params: Promise<{ versionId: string }>
}

type ComputeRow = {
  code: string
  name: string
  unit: string
  quantity: number
  unitPrice: number
  total: number
}

export default async function PrintComputoPage({ params }: PageProps) {
  const { versionId } = await params

  const [version, lines] = await Promise.all([
    getBudgetVersion(versionId),
    listBudgetLines(versionId),
  ])

  if (!version) return notFound()
  const project = await getProject(version.projectId)
  if (!project) return notFound()

  const computeRows: ComputeRow[] = (lines ?? [])
    .map((line: { wbsNode: { code: string; name: string }; quantity: number; unit: string; salePriceTotal?: number; directCostTotal?: number }) => {
      const qty = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity)
      const total =
        line.salePriceTotal != null
          ? typeof line.salePriceTotal === 'number'
            ? line.salePriceTotal
            : Number(line.salePriceTotal)
          : typeof (line as { directCostTotal?: number }).directCostTotal === 'number'
            ? (line as { directCostTotal: number }).directCostTotal
            : Number((line as { directCostTotal?: unknown }).directCostTotal ?? 0)
      const unitPrice = qty > 0 ? total / qty : 0
      return {
        code: line.wbsNode.code,
        name: line.wbsNode.name,
        unit: line.unit ?? '—',
        quantity: qty,
        unitPrice,
        total,
      }
    })
    .sort((a, b) => a.code.localeCompare(b.code))

  const grandTotal = computeRows.reduce((sum, r) => sum + r.total, 0)

  const columns = [
    { key: 'code' as const, label: 'Código', align: 'left' as const },
    { key: 'name' as const, label: 'Descripción', align: 'left' as const },
    { key: 'unit' as const, label: 'Unidad', align: 'center' as const },
    { key: 'quantity' as const, label: 'Cantidad', align: 'right' as const },
    { key: 'unitPrice' as const, label: 'P. unit.', align: 'right' as const, format: (_: unknown, row: ComputeRow) => formatCurrency(row.unitPrice) },
    { key: 'total' as const, label: 'Total', align: 'right' as const, format: (_: unknown, row: ComputeRow) => formatCurrency(row.total) },
  ]

  const totalsRow: Partial<Record<string, string | number>> = {
    code: '',
    name: 'Total',
    unit: '',
    quantity: '',
    unitPrice: '',
    total: formatCurrency(grandTotal),
  }

  return (
    <PrintDocumentShell
      templateId="computo"
      id={versionId}
      project={{ name: project.name, projectNumber: project.projectNumber }}
    >
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">
          Planilla de cómputo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {project.projectNumber} — {project.name} · {version.versionCode}
        </p>
      </div>
      <PrintTable<ComputeRow>
        columns={columns}
        rows={computeRows}
        totals={totalsRow}
        totalsLabel="Total"
      />
    </PrintDocumentShell>
  )
}
