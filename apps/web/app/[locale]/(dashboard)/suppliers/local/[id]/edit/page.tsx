import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasPermission } from '@/lib/permissions'
import type { OrgRole } from '@/lib/rbac'
import { prisma } from '@repo/database'
import { LocalSupplierEditForm } from '@/components/suppliers/local-supplier-edit-form'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function LocalSupplierEditPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) notFound()

  const org = await getOrgContext(session.user.id)
  if (!org) notFound()

  const t = await getTranslations('suppliers')
  const { id } = await params

  const party = await prisma.party.findFirst({
    where: {
      id,
      orgId: org.orgId,
      partyType: { in: ['SUPPLIER', 'CLIENT'] },
      active: true,
    },
  })

  if (!party) notFound()
  if (!hasPermission(org.role as OrgRole, 'suppliers', 'edit', org.customPermissions ?? null)) notFound()

  const subtitle = party.partyType === 'SUPPLIER' ? t('local') : t('totalClients')
  const defaultValues = {
    name: party.name,
    category: (party as { category?: string | null }).category ?? '',
    taxId: party.taxId ?? '',
    email: party.email ?? '',
    phone: party.phone ?? '',
    address: party.address ?? '',
    city: party.city ?? '',
    country: party.country ?? '',
    website: party.website ?? '',
  }

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('edit')}: {party.name}</h1>
          <p className="erp-section-desc">{subtitle}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={party.partyType === 'SUPPLIER' ? '/suppliers/list?tab=local' : '/suppliers/list?tab=local&filter=clients'}>
            ← {t('backToDirectory', { defaultValue: 'Volver al directorio' })}
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6">
        <LocalSupplierEditForm partyId={id} defaultValues={defaultValues} />
      </div>
    </div>
  )
}
