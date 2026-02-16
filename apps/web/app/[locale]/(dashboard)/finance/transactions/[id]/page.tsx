import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import {
  getFinanceTransaction,
  submitFinanceTransaction,
  approveFinanceTransaction,
  rejectFinanceTransaction,
  markFinanceTransactionPaid,
  voidFinanceTransaction,
} from '@/app/actions/finance'
import { TransactionDetail, type TransactionDetailData } from '@/components/finance/transaction-detail'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function FinanceTransactionDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id } = await params
  const tx = await getFinanceTransaction(id)
  if (!tx) return notFound()

  const canEdit = hasMinimumRole(org.role, 'ACCOUNTANT')
  const canApprove = hasMinimumRole(org.role, 'ADMIN')
  const canMarkPaid = hasMinimumRole(org.role, 'ACCOUNTANT')
  const canVoid = hasMinimumRole(org.role, 'ADMIN')

  const detail: TransactionDetailData = {
    id: tx.id,
    transactionNumber: tx.transactionNumber,
    type: tx.type,
    documentType: tx.documentType ?? undefined,
    status: tx.status,
    issueDate: tx.issueDate,
    dueDate: tx.dueDate ?? undefined,
    description: tx.description,
    reference: tx.reference,
    currency: tx.currency,
    total: tx.total,
    amountBaseCurrency: tx.amountBaseCurrency,
    retentionAmount: tx.retentionAmount,
    adjustmentAmount: tx.adjustmentAmount,
    adjustmentNotes: tx.adjustmentNotes ?? undefined,
    exchangeRateSnapshot: tx.exchangeRateSnapshot,
    project: tx.project,
    party: tx.party,
    createdBy: tx.createdBy,
    lines: tx.lines,
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/finance/transactions"
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← Transactions
        </Link>
      </div>
      <TransactionDetail
        transaction={detail}
        canEdit={canEdit}
        canApprove={canApprove}
        canMarkPaid={canMarkPaid}
        canVoid={canVoid}
        onSubmit={submitFinanceTransaction}
        onApprove={approveFinanceTransaction}
        onReject={rejectFinanceTransaction}
        onMarkPaid={markFinanceTransactionPaid}
        onVoid={voidFinanceTransaction}
      />
    </div>
  )
}
