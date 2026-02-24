import { redirectToLogin } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { prisma } from '@repo/database'
import { PageHeader } from '@/components/layout/page-header'
import { SuppliersListClient } from '@/components/suppliers/suppliers-list-client'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'

type PageProps = {
  searchParams: Promise<{ q?: string; category?: string; tab?: string; filter?: string }>
}

export default async function SuppliersListPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const t = await getTranslations('suppliers')
  const { q, category, tab } = await searchParams

  const linkedSuppliers = await prisma.orgPartyLink.findMany({
    where: { orgId: org.orgId, status: 'ACTIVE' },
    include: {
      globalParty: {
        select: {
          id: true,
          name: true,
          category: true,
          verified: true,
          avgRating: true,
          countries: true,
        },
      },
    },
  })

  const [localSuppliers, localClients] = await Promise.all([
    prisma.party.findMany({
      where: { orgId: org.orgId, partyType: 'SUPPLIER', active: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
      },
    }),
    prisma.party.findMany({
      where: { orgId: org.orgId, partyType: 'CLIENT', active: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
      },
    }),
  ])

  const globalSearch = q
    ? await prisma.globalParty.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
          ],
          ...(category && { category }),
        },
        take: 20,
      })
    : await prisma.globalParty.findMany({
        where: { active: true },
        take: 20,
        orderBy: [{ verified: 'desc' }, { orgCount: 'desc' }],
      })

  const canAddLocal = hasMinimumRole(org.role, 'EDITOR')
  const totalCount = linkedSuppliers.length + localSuppliers.length + localClients.length

  return (
    <div className="h-full">
      <PageHeader
        title={t('listTitle')}
        subtitle={`${totalCount} ${totalCount === 1 ? t('oneSupplier') : t('manySuppliers')}`}
        actions={
          canAddLocal ? (
            <Button asChild variant="default">
              <Link href="/suppliers/local/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('addLocalSupplier')}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="p-6">
        <SuppliersListClient
          defaultTab={tab || 'linked'}
          linkedSuppliers={linkedSuppliers}
          localSuppliers={localSuppliers}
          localClients={localClients}
          globalSearchResults={globalSearch}
          canAddLocal={canAddLocal}
        />
      </div>
    </div>
  )
}
