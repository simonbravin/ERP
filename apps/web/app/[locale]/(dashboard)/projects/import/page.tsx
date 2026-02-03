import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ImportBudgetWizard } from '@/components/projects/import-budget-wizard'

export default async function ImportProjectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const session = await getSession()
  const { locale } = await params
  if (!session?.user?.id) redirect(`/${locale}/login`)

  const org = await getOrgContext(session.user.id)
  if (!org) redirect(`/${locale}/login`)

  if (!['EDITOR', 'ADMIN', 'OWNER'].includes(org.role)) {
    redirect(`/${locale}/projects`)
  }

  const t = await getTranslations('projects')

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {t('importFromExcel', { defaultValue: 'Importar Proyecto desde Excel' })}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('importFromExcelDesc', { defaultValue: 'Sube un presupuesto en formato Excel oficial' })}
        </p>
      </div>

      <ImportBudgetWizard />
    </div>
  )
}
