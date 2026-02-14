import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import {
  getCompanyTransactions,
  getFinanceFilterOptions,
} from '@/app/actions/finance'
import { CompanyTransactionsListClient } from '@/components/finance/company-transactions-list-client'

export default async function FinanceTransactionsPage() {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const [transactions, filterOptions] = await Promise.all([
    getCompanyTransactions(),
    getFinanceFilterOptions(),
  ])
  const canCreate = hasMinimumRole(org.role, 'ACCOUNTANT')

  return (
    <div className="space-y-4">
      <CompanyTransactionsListClient
        initialTransactions={transactions ?? []}
        filterOptions={filterOptions ?? { projects: [], parties: [] }}
        canCreate={canCreate}
      />
    </div>
  )
}
