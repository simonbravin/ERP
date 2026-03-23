import { getSession } from '@/lib/session'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { PageHeader } from '@/components/layout/page-header'
import { getTranslations } from 'next-intl/server'

export default async function SecuritySettingsPage() {
  const session = await getSession()
  const locale = await getLocale()
  if (!session?.user?.id) redirect({ href: '/login', locale })

  const t = await getTranslations('settings')

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title={t('security')}
        subtitle={t('securitySubtitle', {
          defaultValue: 'Configuración de seguridad de la organización',
        })}
      />
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">
          {t('comingSoon', { defaultValue: 'Próximamente' })}
        </p>
      </div>
    </div>
  )
}
