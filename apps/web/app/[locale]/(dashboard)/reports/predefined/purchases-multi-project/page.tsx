import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirect } from 'next/navigation'
import { PurchasesBySupplierReport } from '@/components/reports/purchases-by-supplier-report'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/layout/page-header'

type PageProps = {
  params: Promise<{ locale: string }>
}

export default async function PurchasesMultiProjectPage({ params }: PageProps) {
  const session = await getSession()
  const { locale } = await params
  if (!session?.user?.id) redirect(`/${locale}/login`)

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) redirect(`/${locale}/login`)

  const t = await getTranslations('reports')

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title={t('purchasesMultiProject')}
        subtitle={t('purchasesMultiProjectDesc')}
        breadcrumbs={[
          { label: 'Reportes', href: '/reports' },
          { label: 'Predefinidos', href: '/reports/predefined' },
          { label: t('purchasesMultiProject') },
        ]}
      />
      <PurchasesBySupplierReport orgId={org.orgId} />
    </div>
  )
}
