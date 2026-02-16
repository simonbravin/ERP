import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getCompanyAccountsPayable, getFinanceFilterOptions } from '@/app/actions/finance'
import { AccountsPayableListClient } from '@/components/finance/accounts-payable-list-client'

export default async function FinanceAccountsPayablePage() {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const [items, filterOptions] = await Promise.all([
    getCompanyAccountsPayable(),
    getFinanceFilterOptions(),
  ])

  return (
    <div className="space-y-4">
      <AccountsPayableListClient
        initialItems={items}
        filterOptions={filterOptions ?? { projects: [], parties: [] }}
        projectId={null}
        title="Cuentas por pagar"
      />
    </div>
  )
}
