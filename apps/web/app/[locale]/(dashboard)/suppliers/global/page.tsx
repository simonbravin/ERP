import { redirectToLogin } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { PageHeader } from '@/components/layout/page-header'
import { SupplierSearch } from '@/components/suppliers/supplier-search'

export default async function GlobalSuppliersPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const t = await getTranslations('suppliers')
  const tNav = await getTranslations('nav')

  const suppliers = await prisma.globalParty.findMany({
    where: { active: true },
    take: 50,
    orderBy: [{ verified: 'desc' }, { orgCount: 'desc' }],
  })

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title={t('global')}
        subtitle={t('subtitle')}
        breadcrumbs={[
          { label: tNav('suppliers'), href: '/suppliers' },
          { label: t('global') },
        ]}
      />
      <SupplierSearch initialResults={suppliers} />
    </div>
  )
}
