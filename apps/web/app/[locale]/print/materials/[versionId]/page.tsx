import { notFound } from 'next/navigation'
import { getBudgetVersion } from '@/app/actions/budget'
import { getProject } from '@/app/actions/projects'
import { getConsolidatedMaterials } from '@/app/actions/materials'
import { PrintDocumentShell } from '@/components/print/print-document-shell'
import { PrintTable } from '@/components/print/print-table'
import { formatCurrency } from '@/lib/format-utils'

type PageProps = {
  params: Promise<{ versionId: string }>
}

type MaterialRow = {
  name: string
  description: string
  unit: string
  totalQuantity: number
  averageUnitCost: number
  totalCost: number
}

export default async function PrintMaterialsPage({ params }: PageProps) {
  const { versionId } = await params

  const [version, materials] = await Promise.all([
    getBudgetVersion(versionId),
    getConsolidatedMaterials(versionId),
  ])

  if (!version) return notFound()
  const project = await getProject(version.projectId)
  if (!project) return notFound()

  const rows: MaterialRow[] = materials.map((m) => ({
    name: m.name,
    description: m.description ?? '—',
    unit: m.unit ?? '—',
    totalQuantity: m.totalQuantity,
    averageUnitCost: m.averageUnitCost,
    totalCost: m.totalCost,
  }))

  const grandTotal = rows.reduce((sum, r) => sum + r.totalCost, 0)

  const columns = [
    { key: 'name' as const, label: 'Material', align: 'left' as const },
    { key: 'description' as const, label: 'Descripción', align: 'left' as const },
    { key: 'unit' as const, label: 'Unidad', align: 'center' as const },
    { key: 'totalQuantity' as const, label: 'Cantidad Total', align: 'right' as const },
    {
      key: 'averageUnitCost' as const,
      label: 'Costo Unit. Prom.',
      align: 'right' as const,
      format: (val: unknown) => (typeof val === 'number' ? formatCurrency(val) : String(val)),
    },
    {
      key: 'totalCost' as const,
      label: 'Costo Total',
      align: 'right' as const,
      format: (val: unknown) => (typeof val === 'number' ? formatCurrency(val) : String(val)),
    },
  ]

  return (
    <PrintDocumentShell
      templateId="materials"
      id={versionId}
      project={{ name: project.name, projectNumber: project.projectNumber }}
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Listado de materiales — {project.name}
          {project.projectNumber ? ` (${project.projectNumber})` : ''} — {version.versionCode}
        </h2>
        <PrintTable<MaterialRow>
          columns={columns}
          rows={rows}
          totals={{ totalCost: formatCurrency(grandTotal) }}
          totalsLabel="Total general"
        />
      </div>
    </PrintDocumentShell>
  )
}
