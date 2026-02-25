import { notFound } from 'next/navigation'
import { getProject } from '@/app/actions/projects'
import { getProjectCertifications } from '@/app/actions/certifications'
import { PrintDocumentShell } from '@/components/print/print-document-shell'
import { PrintTable } from '@/components/print/print-table'
import { formatCurrency } from '@/lib/certification-utils'

type PageProps = {
  params: Promise<{ projectId: string }>
}

type CertRow = {
  number: number
  period: string
  budgetVersion: string
  issuedDate: string
  totalAmount: number
  status: string
}

export default async function PrintCertificationPage({ params }: PageProps) {
  const { projectId } = await params

  const [project, certifications] = await Promise.all([
    getProject(projectId),
    getProjectCertifications(projectId),
  ])

  if (!project) return notFound()

  const rows: CertRow[] = certifications.map((cert) => ({
    number: cert.number,
    period: `${cert.periodMonth ?? ''}/${cert.periodYear ?? ''}`,
    budgetVersion: cert.budgetVersion?.versionCode ?? '—',
    issuedDate: cert.issuedDate
      ? new Date(cert.issuedDate).toLocaleDateString('es-AR', { dateStyle: 'short' })
      : '—',
    totalAmount: cert.totalAmount ?? 0,
    status: cert.status,
  }))

  const totalAmount = rows.reduce((sum, r) => sum + r.totalAmount, 0)

  const columns: { key: keyof CertRow; label: string; align: 'left' | 'center' | 'right'; format?: (val: unknown) => string }[] = [
    { key: 'number' as const, label: 'Número', align: 'center' as const },
    { key: 'period' as const, label: 'Período', align: 'left' as const },
    { key: 'budgetVersion' as const, label: 'Presupuesto', align: 'left' as const },
    { key: 'issuedDate' as const, label: 'Fecha Emisión', align: 'left' as const },
    {
      key: 'totalAmount' as const,
      label: 'Monto',
      align: 'right' as const,
      format: (val: unknown) => (typeof val === 'number' ? formatCurrency(val) : String(val)),
    },
    { key: 'status' as const, label: 'Estado', align: 'left' as const },
  ]

  return (
    <PrintDocumentShell
      templateId="certification"
      id={projectId}
      project={{ name: project.name, projectNumber: project.projectNumber }}
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Certificaciones de Obra — {project.name}
          {project.projectNumber ? ` (${project.projectNumber})` : ''}
        </h2>
        <PrintTable<CertRow>
          columns={columns}
          rows={rows}
          totals={{ totalAmount: formatCurrency(totalAmount) }}
          totalsLabel="Total certificado"
        />
      </div>
    </PrintDocumentShell>
  )
}
