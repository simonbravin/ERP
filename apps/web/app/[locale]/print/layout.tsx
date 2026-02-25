import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirectToLogin } from '@/lib/i18n-redirect'
import { prisma } from '@repo/database'
import { getDownloadUrl } from '@/lib/r2-client'
import { DocumentHeader } from '@/components/print/document-header'
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

  let orgLegalName: string | null = null
  let logoUrl: string | null = null
  try {
    const profile = await prisma.orgProfile.findUnique({
      where: { orgId: org.orgId },
      select: { legalName: true, logoStorageKey: true },
    })
    orgLegalName = profile?.legalName ?? null
    if (profile?.logoStorageKey) {
      const url = await getDownloadUrl(profile.logoStorageKey)
      if (url.startsWith('http') || url.startsWith('/')) logoUrl = url
    }
  } catch {
    // R2/DB optional; header still shows org name
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DocumentHeader
        orgName={org.orgName ?? 'Organización'}
        orgLegalName={orgLegalName}
        logoUrl={logoUrl}
      />
      <main className="print-main px-4 pb-8">{children}</main>
    </div>
  )
}
