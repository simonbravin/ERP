import { notFound } from 'next/navigation'
import { getProject } from '@/app/actions/projects'
import { getProjectAccountsReceivable, getFinanceFilterOptions } from '@/app/actions/finance'
import { AccountsReceivableListClient } from '@/components/finance/accounts-receivable-list-client'

interface PageProps {
  params: Promise<{ id: string; locale: string }>
}

export default async function ProjectAccountsReceivablePage({ params }: PageProps) {
  const { id: projectId } = await params

  const [project, items, filterOptions] = await Promise.all([
    getProject(projectId),
    getProjectAccountsReceivable(projectId),
    getFinanceFilterOptions(),
  ])

  if (!project) notFound()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cuentas por cobrar</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Cobros pendientes del proyecto {project.name} (incl. certificaciones / anticipos)
        </p>
      </div>

      <AccountsReceivableListClient
        initialItems={items}
        filterOptions={filterOptions ?? { projects: [], parties: [] }}
        projectId={projectId}
        title="Cuentas por cobrar (proyecto)"
      />
    </div>
  )
}
