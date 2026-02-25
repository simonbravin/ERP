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

  const user = session.user
    ? {
        fullName: (user as { name?: string }).name ?? (user as { fullName?: string }).fullName ?? user.email ?? '',
        email: user.email ?? null,
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
