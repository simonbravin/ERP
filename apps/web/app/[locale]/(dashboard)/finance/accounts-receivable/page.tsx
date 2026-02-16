import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getCompanyAccountsReceivable, getFinanceFilterOptions } from '@/app/actions/finance'
import { AccountsReceivableListClient } from '@/components/finance/accounts-receivable-list-client'

export default async function FinanceAccountsReceivablePage() {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const [items, filterOptions] = await Promise.all([
    getCompanyAccountsReceivable(),
    getFinanceFilterOptions(),
  ])

  return (
    <div className="space-y-4">
      <AccountsReceivableListClient
        initialItems={items}
        filterOptions={filterOptions ?? { projects: [], parties: [] }}
        projectId={null}
        title="Cuentas por cobrar"
      />
    </div>
  )
}
