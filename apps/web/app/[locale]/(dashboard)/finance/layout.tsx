import { getSession } from '@/lib/session'
import { getOrgContext, isRestrictedToProjects } from '@/lib/org-context'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { FinanceTabs } from '@/components/finance/finance-tabs'

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const locale = await getLocale()
  const userId = session?.user?.id
  if (!userId) redirect({ href: '/login', locale })
  const org = await getOrgContext(userId!)
  if (!org) redirect({ href: '/login', locale })
  if (isRestrictedToProjects(org)) redirect({ href: '/projects', locale })

  return (
    <div className="erp-view-container space-y-6">
      <div className="erp-section-header">
        <h1 className="erp-page-title">Finanzas de Empresa</h1>
        <p className="erp-section-desc">
          Gestión financiera consolidada de toda la organización
        </p>
      </div>

      <FinanceTabs />

      {children}
    </div>
  )
}
