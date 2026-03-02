import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { auth } from '@/lib/auth'
import { SuperAdminSidebar } from '@/components/layout/super-admin-sidebar'
import { SuperAdminLoginForm } from '@/components/auth/super-admin-login-form'
import { Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const locale = await getLocale()
  if (!session?.user?.id) {
    return (
      <div className="fixed inset-0 flex items-center justify-center overflow-auto bg-background p-4">
        <div
          className="w-full overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
          style={{ width: 'min(100%, 420px)', minWidth: '320px' }}
        >
          <div className="border-b border-border bg-muted/80 px-8 py-6">
            <div className="flex items-center gap-4">
              <Shield className="h-10 w-10 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Super Admin
                </h1>
                <p className="mt-1 text-base text-muted-foreground">
                  Acceso exclusivo al portal de administración
                </p>
              </div>
            </div>
          </div>
          <div className="p-8">
            <SuperAdminLoginForm />
          </div>
        </div>
      </div>
    )
  }
  if (!session.user.isSuperAdmin) {
    return redirect({ href: '/unauthorized', locale })
  }
  return (
    <div className="flex min-h-screen bg-background">
      <SuperAdminSidebar userName={session.user.name ?? session.user.email ?? undefined} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
