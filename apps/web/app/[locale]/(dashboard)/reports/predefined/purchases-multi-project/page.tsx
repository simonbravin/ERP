import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirect } from 'next/navigation'
import { PurchasesBySupplierReport } from '@/components/reports/purchases-by-supplier-report'
import { getTranslations } from 'next-intl/server'

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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {t('purchasesMultiProject')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('purchasesMultiProjectDesc')}
        </p>
      </div>

      <PurchasesBySupplierReport orgId={org.orgId} />
    </div>
  )
}
