import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { prisma } from '@repo/database'
import { resolveLogoUrl } from '@/lib/media-urls'
import { OrganizationSettingsForm } from '@/components/settings/organization-settings-form'

export default async function OrganizationSettingsPage() {
  const session = await getSession()
  const locale = await getLocale()
  if (!session?.user?.id) redirect({ href: '/login', locale })

  const orgContext = await getOrgContext(session!.user!.id)
  if (!orgContext) redirect({ href: '/login', locale })

  if (!['ADMIN', 'OWNER'].includes(orgContext!.role)) {
    redirect({ href: '/settings/profile', locale })
  }

  const organization = await prisma.organization.findUnique({
    where: { id: orgContext!.orgId },
    include: { profile: true },
  })

  if (!organization) redirect({ href: '/dashboard', locale })

  const orgData = {
    id: organization!.id,
    name: organization!.name,
    slug: organization!.slug,
    taxId: organization!.taxId,
    country: organization!.country,
    city: organization!.city,
    address: organization!.address,
  }

  const profileData = organization!.profile
    ? {
        legalName: organization!.profile.legalName,
        taxId: organization!.profile.taxId,
        address: organization!.profile.address,
        city: organization!.profile.city,
        country: organization!.profile.country,
        phone: organization!.profile.phone,
        email: organization!.profile.email,
        website: organization!.profile.website,
        baseCurrency: organization!.profile.baseCurrency,
        defaultTaxPct: Number(organization!.profile.defaultTaxPct),
        documentFooterText: organization!.profile.documentFooterText,
      }
    : null

  const logoUrl = organization!.profile?.logoStorageKey
    ? await resolveLogoUrl(organization!.profile.logoStorageKey)
    : null

  return (
    <div className="mx-auto max-w-4xl">
      <OrganizationSettingsForm
        organization={orgData}
        profile={profileData}
        logoUrl={logoUrl}
      />
    </div>
  )
}
