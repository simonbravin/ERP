import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasPermission } from '@/lib/permissions'
import type { OrgRole } from '@/lib/rbac'
import { prisma } from '@repo/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { Link } from '@/i18n/navigation'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function LocalSupplierDetailPage({ params }: PageProps) {
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

  const canEdit = hasPermission(org.role as OrgRole, 'suppliers', 'edit', org.customPermissions ?? null)
  const isSupplier = party.partyType === 'SUPPLIER'
  const subtitle = isSupplier ? t('local') : t('totalClients')
  const backHref = isSupplier ? '/suppliers/list?tab=local' : '/suppliers/list?tab=local&filter=clients'
  const backLabel = isSupplier ? t('viewSuppliers') : t('viewClients')

  const partyCategory = (party as { category?: string | null }).category
  const fields = [
    { label: t('name'), value: party.name },
    ...(partyCategory ? [{ label: t('category'), value: partyCategory.replace(/_/g, ' ') }] : []),
    { label: t('taxId'), value: party.taxId },
    { label: t('email'), value: party.email },
    { label: t('phone'), value: party.phone },
    { label: t('address'), value: party.address },
    { label: t('city'), value: party.city },
    { label: t('country'), value: party.country },
    { label: t('website'), value: party.website },
  ]

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{party.name}</h1>
          <p className="erp-section-desc">{subtitle}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>← {backLabel}</Link>
          </Button>
          {canEdit && (
            <Button asChild variant="default" size="sm">
              <Link href={`/suppliers/local/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('edit')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-sm">
                {value ? (
                  label === t('email') ? (
                    <a href={`mailto:${value}`} className="text-primary hover:underline">
                      {value}
                    </a>
                  ) : label === t('website') ? (
                    <a
                      href={value.startsWith('http') ? value : `https://${value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )
                ) : (
                  '—'
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
