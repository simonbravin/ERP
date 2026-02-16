import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import {
  getFinanceTransaction,
  updateFinanceTransaction,
  addFinanceLine,
  updateFinanceLine,
  deleteFinanceLine,
  listWbsNodesForProject,
} from '@/app/actions/finance'
import { TransactionEditClient } from '@/components/finance/transaction-edit-client'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function FinanceTransactionEditPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id } = await params
  const tx = await getFinanceTransaction(id)
  if (!tx) return notFound()
  if (tx.status !== 'DRAFT') return notFound()

  const canEdit = hasMinimumRole(org.role, 'ACCOUNTANT')
  if (!canEdit) return notFound()

  const wbsOptions = tx.projectId ? await listWbsNodesForProject(tx.projectId) : []
  const t = await getTranslations('finance')

  return (
    <div className="erp-view-container space-y-6 p-6">
      <div className="mb-4">
        <Link
          href={`/finance/transactions/${id}`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← {tx.transactionNumber}
        </Link>
        <span className="mx-2 text-muted-foreground">|</span>
        <Link
          href="/finance/transactions"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t('backToTransactions')}
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-foreground">
        {t('edit')} {tx.transactionNumber}
      </h1>
      <TransactionEditClient
        transactionId={id}
        transaction={tx}
        wbsOptions={wbsOptions}
        updateTransaction={updateFinanceTransaction}
        addLine={addFinanceLine}
        updateLine={updateFinanceLine}
        deleteLine={deleteFinanceLine}
        fetchWbs={listWbsNodesForProject}
      />
    </div>
  )
}
