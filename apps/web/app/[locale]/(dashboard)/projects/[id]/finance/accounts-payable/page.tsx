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

  const saldoPagar = items.reduce((s, i) => s + (i.amountBaseCurrency ?? i.total ?? 0), 0)

  return (
    <div className="space-y-6">
      <AccountsPayableListClient
        initialItems={items}
        filterOptions={filterOptions ?? { projects: [], parties: [] }}
        projectId={projectId}
        title="Cuentas por pagar (proyecto)"
        saldoPagar={saldoPagar}
      />
    </div>
  )
}
