import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { getTranslations } from 'next-intl/server'
import { SettingsTabs } from '@/components/settings/settings-tabs'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const locale = await getLocale()
  if (!session?.user?.id) redirect({ href: '/login', locale })

  const orgContext = await getOrgContext(session!.user!.id)
  if (!orgContext) redirect({ href: '/login', locale })

  const t = await getTranslations('settings')

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="erp-page-title">
          {t('settings')}
        </h1>
        <p className="mt-1 erp-section-desc">
          {t('settingsSubtitle', {
            defaultValue: 'Gestiona la configuración de tu organización y perfil',
          })}
        </p>
      </div>

      <SettingsTabs userRole={orgContext!.role} />

      <div className="mt-6">{children}</div>
    </div>
  )
}
