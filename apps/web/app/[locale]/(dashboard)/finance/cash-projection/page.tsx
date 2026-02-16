import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getCompanyCashProjection } from '@/app/actions/finance'
import { CashProjectionClient } from '@/components/finance/cash-projection-client'

export default async function FinanceCashProjectionPage() {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const asOfDate = new Date()
  const initialProjection = await getCompanyCashProjection(asOfDate)

  return (
    <div className="space-y-4">
      <CashProjectionClient
        initialProjection={initialProjection}
        projectId={null}
        title="Proyección de caja (empresa)"
      />
    </div>
  )
}
