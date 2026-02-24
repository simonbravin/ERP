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

  const saldoCobrar = items.reduce((s, i) => s + (i.amountBaseCurrency ?? i.total ?? 0), 0)

  return (
    <div className="space-y-6">
      <AccountsReceivableListClient
        initialItems={items}
        filterOptions={filterOptions ?? { projects: [], parties: [] }}
        projectId={projectId}
        title="Cuentas por cobrar (proyecto)"
        saldoCobrar={saldoCobrar}
      />
    </div>
  )
}
