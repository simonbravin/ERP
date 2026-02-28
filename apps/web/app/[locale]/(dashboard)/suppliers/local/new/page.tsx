import { redirectToLogin, redirectTo } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { LocalSupplierForm } from '@/components/suppliers/local-supplier-form'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

export default async function NewLocalSupplierPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  if (!['EDITOR', 'ADMIN', 'OWNER'].includes(org.role)) {
    return redirectTo('/suppliers')
  }

  const t = await getTranslations('suppliers')

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('addLocalSupplier')}</h1>
          <p className="erp-section-desc">{t('local')}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/suppliers/list?tab=local">← {t('backToDirectory', { defaultValue: 'Volver al directorio' })}</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6">
        <LocalSupplierForm />
      </div>
    </div>
  )
}
