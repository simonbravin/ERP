import { redirectToLogin } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasPermission } from '@/lib/permissions'
import { hasMinimumRole } from '@/lib/rbac'
import type { OrgRole } from '@/lib/rbac'
import { prisma } from '@repo/database'
import { SuppliersListClient } from '@/components/suppliers/suppliers-list-client'
import { AddToLocalDirectoryDropdown } from '@/components/suppliers/add-to-local-directory-dropdown'

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
  const canEditLocal = hasPermission(org.role as OrgRole, 'suppliers', 'edit', org.customPermissions ?? null)

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('listTitle')}</h1>
          <p className="erp-section-desc">{t('listSubtitle')}</p>
        </div>
        <AddToLocalDirectoryDropdown canAddLocal={canAddLocal} />
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6">
        <SuppliersListClient
          defaultTab={tab || 'linked'}
          linkedSuppliers={linkedSuppliers}
          localSuppliers={localSuppliers}
          localClients={localClients}
          globalSearchResults={globalSearch}
          canAddLocal={canAddLocal}
          canEditLocal={canEditLocal}
        />
      </div>
    </div>
  )
}
