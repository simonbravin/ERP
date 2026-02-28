import { notFound } from 'next/navigation'
import { getProject } from '@/app/actions/projects'
import { getProjectDashboardData } from '@/app/actions/project-dashboard'
import { PrintDocumentShell } from '@/components/print/print-document-shell'
import { PrintTable } from '@/components/print/print-table'
import { formatCurrency } from '@/lib/format-utils'

type PageProps = {
  params: Promise<{ projectId: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function PrintProjectDashboardPage({ params, searchParams }: PageProps) {
  const { projectId } = await params
  const sp = searchParams ? await searchParams : {}

  const [project, data] = await Promise.all([
    getProject(projectId),
    getProjectDashboardData(projectId),
  ])

  if (!project) return notFound()

  const budget = data.budget
  const cashflowColumns = [
    { key: 'month' as const, label: 'Mes', align: 'left' as const },
    {
      key: 'income' as const,
      label: 'Ingresos',
      align: 'right' as const,
      format: (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v)),
    },
    {
      key: 'expense' as const,
      label: 'Gastos',
      align: 'right' as const,
      format: (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v)),
    },
    {
      key: 'balance' as const,
      label: 'Balance',
      align: 'right' as const,
      format: (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v)),
    },
  ]

  return (
    <PrintDocumentShell
      templateId="project-dashboard"
      id={projectId}
      query={sp}
      project={{ name: project.name, projectNumber: project.projectNumber }}
    >
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">
          Dashboard — {project.name}
          {project.projectNumber ? ` (${project.projectNumber})` : ''}
        </h2>
        <div className="grid gap-4 text-sm">
        <p>
          <strong>Presupuesto:</strong> {formatCurrency(budget.total)} ·{' '}
          <strong>Gastado:</strong> {formatCurrency(budget.spent)} ·{' '}
          <strong>Comprometido:</strong> {formatCurrency(budget.committed)} ·{' '}
          <strong>Restante:</strong> {formatCurrency(budget.remaining)}
        </p>
      </div>
      {data.cashflow.length > 0 && (
        <section>
          <h3 className="mb-2 font-medium">Flujo de caja (últimos meses)</h3>
          <PrintTable
            columns={cashflowColumns}
            rows={data.cashflow.map((r) => ({
              month: r.month,
              income: r.income,
              expense: r.expense,
              balance: r.balance,
            }))}
          />
        </section>
      )}
      </div>
    </PrintDocumentShell>
  )
}
