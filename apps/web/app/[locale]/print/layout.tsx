import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirectToLogin } from '@/lib/i18n-redirect'
import { prisma } from '@repo/database'
import { getDownloadUrl } from '@/lib/r2-client'
import { PrintProvider } from '@/components/print/print-context'
import './print.css'

export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) return redirectToLogin()

  let orgProfile: {
    legalName: string | null
    taxId: string | null
    country: string | null
    address: string | null
    email: string | null
    phone: string | null
  } | null = null
  let logoUrl: string | null = null

  try {
    const profile = await prisma.orgProfile.findUnique({
      where: { orgId: org.orgId },
      select: {
        legalName: true,
        taxId: true,
        country: true,
        address: true,
        email: true,
        phone: true,
        logoStorageKey: true,
      },
    })
    if (profile) {
      orgProfile = {
        legalName: profile.legalName ?? null,
        taxId: profile.taxId ?? null,
        country: profile.country ?? null,
        address: profile.address ?? null,
        email: profile.email ?? null,
        phone: profile.phone ?? null,
      }
      if (profile.logoStorageKey) {
        const url = await getDownloadUrl(profile.logoStorageKey)
        if (url.startsWith('http') || url.startsWith('/')) logoUrl = url
      }
    }
  } catch {
    // R2/DB optional; header still shows org name
  }

  const sessionUser = session.user
  const user = sessionUser
    ? {
        fullName: (sessionUser as { name?: string }).name ?? (sessionUser as { fullName?: string }).fullName ?? sessionUser.email ?? '',
        email: sessionUser.email ?? null,
      }
    : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrintProvider
        org={{ orgId: org.orgId, orgName: org.orgName ?? 'Organización' }}
        orgProfile={orgProfile}
        user={user}
        logoUrl={logoUrl}
      >
        <main className="print-main px-4 pb-8">{children}</main>
      </PrintProvider>
    </div>
  )
}
