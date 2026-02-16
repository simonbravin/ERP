import { notFound } from 'next/navigation'
import { getProject } from '@/app/actions/projects'
import { getProjectAccountsPayable, getFinanceFilterOptions } from '@/app/actions/finance'
import { AccountsPayableListClient } from '@/components/finance/accounts-payable-list-client'

interface PageProps {
  params: Promise<{ id: string; locale: string }>
}

export default async function ProjectAccountsPayablePage({ params }: PageProps) {
  const { id: projectId } = await params

  const [project, items, filterOptions] = await Promise.all([
    getProject(projectId),
    getProjectAccountsPayable(projectId),
    getFinanceFilterOptions(),
  ])

  if (!project) notFound()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cuentas por pagar</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Pagos pendientes del proyecto {project.name}
        </p>
      </div>

      <AccountsPayableListClient
        initialItems={items}
        filterOptions={filterOptions ?? { projects: [], parties: [] }}
        projectId={projectId}
        title="Cuentas por pagar (proyecto)"
      />
    </div>
  )
}
