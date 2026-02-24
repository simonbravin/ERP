import { redirectToLogin, redirectTo } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { LocalClientForm } from '@/components/suppliers/local-client-form'
import { Card, CardContent } from '@/components/ui/card'

export default async function NewLocalClientPage() {
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
      <div className="erp-section-header">
        <h1 className="erp-page-title">{t('addLocalClient')}</h1>
        <p className="erp-section-desc">{t('addLocalClientDesc')}</p>
      </div>
      <Card className="rounded-xl border border-border/60 bg-card shadow-sm">
        <CardContent className="pt-6">
          <LocalClientForm />
        </CardContent>
      </Card>
    </div>
  )
}
