import { redirectToLogin } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { prisma } from '@repo/database'
import { SuppliersKPICards } from '@/components/suppliers/suppliers-kpi-cards'
import { SuppliersTableClient, type SupplierTableRow } from '@/components/suppliers/suppliers-table-client'
import { Button } from '@/components/ui/button'
import { Building2, Plus, UserCircle } from 'lucide-react'
import { Link } from '@/i18n/navigation'

const ACTION_CARD_CLASS =
  'flex items-center gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md min-w-0'

export default async function SuppliersDashboardPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const t = await getTranslations('suppliers')

  const [linkedSuppliers, localSuppliers, localClients] = await Promise.all([
    prisma.orgPartyLink.findMany({
      where: { orgId: org.orgId, status: 'ACTIVE' },
      include: {
        globalParty: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.party.findMany({
      where: { orgId: org.orgId, partyType: 'SUPPLIER', active: true },
      select: { id: true, name: true, email: true, phone: true, city: true },
    }),
    prisma.party.findMany({
      where: { orgId: org.orgId, partyType: 'CLIENT', active: true },
      select: { id: true, name: true, email: true, phone: true, city: true },
    }),
  ])

  const tableRows: SupplierTableRow[] = [
    ...linkedSuppliers.map((link) => ({
      id: link.id,
      name: link.localAlias ?? link.globalParty.name,
      email: null as string | null,
      phone: null as string | null,
      city: null as string | null,
      type: 'SUPPLIER' as const,
      isGlobal: true,
      detailHref: `/suppliers/global/${link.globalParty.id}`,
    })),
    ...localSuppliers.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      city: p.city,
      type: 'SUPPLIER' as const,
      isGlobal: false,
      detailHref: `/suppliers/local/${p.id}`,
    })),
    ...localClients.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      city: p.city,
      type: 'CLIENT' as const,
      isGlobal: false,
      detailHref: `/suppliers/local/${p.id}`,
    })),
  ]

  const canAddLocal = hasMinimumRole(org.role, 'EDITOR')

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('listTitle')}</h1>
          <p className="erp-section-desc">{t('subtitle')}</p>
        </div>
        {canAddLocal && (
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline">
              <Link href="/suppliers/clients/new">
                <UserCircle className="mr-2 h-4 w-4" />
                {t('addLocalClient')}
              </Link>
            </Button>
            <Button asChild variant="default">
              <Link href="/suppliers/local/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('addLocalSupplier')}
              </Link>
            </Button>
          </div>
        )}
      </div>

      <SuppliersKPICards
        totalLinked={linkedSuppliers.length}
        totalLocal={localSuppliers.length}
        totalClients={localClients.length}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/suppliers/list" className={ACTION_CARD_CLASS}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">{t('viewSuppliers')}</h3>
            <p className="text-sm text-muted-foreground">{t('viewSuppliersDesc')}</p>
          </div>
        </Link>
        <Link href="/suppliers/list?tab=local&filter=clients" className={ACTION_CARD_CLASS}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <UserCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">{t('viewClients')}</h3>
            <p className="text-sm text-muted-foreground">{t('viewClientsDesc')}</p>
          </div>
        </Link>
      </div>

      <SuppliersTableClient rows={tableRows} />
    </div>
  )
}
