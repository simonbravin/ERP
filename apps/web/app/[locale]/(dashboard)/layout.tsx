import { unstable_rethrow } from 'next/navigation'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext, isRestrictedToProjects } from '@/lib/org-context'
import { getDownloadUrl } from '@/lib/r2-client'
import { prisma } from '@repo/database'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { SignOutConfirmButton } from '@/components/auth/sign-out-confirm-button'

function DashboardError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
        <h1 className="text-lg font-semibold text-red-800 dark:text-red-200">
          Error al cargar el panel
        </h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300 font-mono break-words">
          {message}
        </p>
        <p className="mt-4 text-xs text-red-600 dark:text-red-400">
          Comprueba DATABASE_URL en .env y que la base de datos esté en ejecución.
        </p>
        <SignOutConfirmButton
          className="mt-4 inline-block rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Cerrar sesión
        </SignOutConfirmButton>
      </div>
    </div>
  )
}

export default async function DashboardLayoutPage({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const session = await getSession()
    const locale = await getLocale()
    if (!session?.user?.id) {
      return redirect({ href: '/login', locale })
    }
    const orgContext = await getOrgContext(session.user.id)
    if (!orgContext) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md rounded-lg border border-status-danger/30 bg-destructive/10 p-6">
            <h1 className="text-lg font-semibold text-status-danger">
              No active organization
            </h1>
            <p className="mt-2 text-sm text-status-danger/90">
              Your account has no active organization. Please contact support or
              sign out and register again.
            </p>
            <SignOutConfirmButton
              locale={locale}
              className="mt-4 inline-block rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
            >
              Sign out
            </SignOutConfirmButton>
          </div>
        </div>
      )
    }

    let orgLogoUrl: string | null = null
    try {
      const profile = await prisma.orgProfile.findUnique({
        where: { orgId: orgContext.orgId },
        select: { logoStorageKey: true },
      })
      if (profile?.logoStorageKey) {
        const url = await getDownloadUrl(profile.logoStorageKey)
        if (url.startsWith('http') || url.startsWith('/')) orgLogoUrl = url
      }
    } catch {
      // R2 or DB; sidebar will show org name without logo
    }

    return (
      <DashboardLayout
        orgName={orgContext.orgName}
        orgLogoUrl={orgLogoUrl}
        user={{
          name: session.user.name ?? session.user.email ?? 'User',
          email: session.user.email ?? null,
        }}
        restrictedToProjects={isRestrictedToProjects(orgContext)}
      >
        {children}
      </DashboardLayout>
    )
  } catch (err) {
    unstable_rethrow(err)
    const message = err instanceof Error ? err.message : String(err)
    console.error('[dashboard layout]', err)
    return <DashboardError message={message} />
  }
}
