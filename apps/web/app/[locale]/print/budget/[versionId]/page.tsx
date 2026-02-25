import { notFound } from 'next/navigation'
import { getBudgetVersion, listBudgetLines } from '@/app/actions/budget'
import { getProject } from '@/app/actions/projects'
import { PrintTable } from '@/components/print/print-table'
import { formatCurrency } from '@/lib/format-utils'

type PageProps = {
  params: Promise<{ versionId: string }>
}

type BudgetRow = {
  code: string
  description: string
  unit: string
  quantity: number
  unitPrice: number
  totalCost: number
}

export default async function PrintBudgetPage({ params }: PageProps) {
  const { versionId } = await params

  const [version, lines] = await Promise.all([
    getBudgetVersion(versionId),
    listBudgetLines(versionId),
  ])

  if (!version) return notFound()
  const project = await getProject(version.projectId)
  if (!project) return notFound()

  const rows: BudgetRow[] = (lines ?? []).map((line: { wbsNode: { code: string; name: string }; quantity: number; unit: string | null; description: string | null; directCostTotal?: unknown }) => {
    const qty = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity) || 1
    const total = Number((line as { directCostTotal?: number }).directCostTotal ?? 0)
    const unitPrice = qty > 0 ? total / qty : 0
    return {
      code: line.wbsNode.code,
      description: line.description ?? line.wbsNode.name ?? '—',
      unit: line.unit ?? '—',
      quantity: qty,
      unitPrice,
      totalCost: total,
    }
  })

  const grandTotal = rows.reduce((sum, r) => sum + r.totalCost, 0)

  const columns = [
    { key: 'code' as const, label: 'Código', align: 'left' as const },
    { key: 'description' as const, label: 'Descripción', align: 'left' as const },
    { key: 'unit' as const, label: 'Und', align: 'center' as const },
    { key: 'quantity' as const, label: 'Cantidad', align: 'right' as const },
    {
      key: 'unitPrice' as const,
      label: 'P.Unit',
      align: 'right' as const,
      format: (val: unknown) => (typeof val === 'number' ? formatCurrency(val) : String(val)),
    },
    {
      key: 'totalCost' as const,
      label: 'Total',
      align: 'right' as const,
      format: (val: unknown) => (typeof val === 'number' ? formatCurrency(val) : String(val)),
    },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        Presupuesto — {project.name}
        {project.projectNumber ? ` (${project.projectNumber})` : ''} — {version.versionCode}
      </h2>
      <PrintTable<BudgetRow>
        columns={columns}
        rows={rows}
        totals={{ totalCost: formatCurrency(grandTotal) }}
        totalsLabel="Total presupuesto"
      />
    </div>
  )
}
