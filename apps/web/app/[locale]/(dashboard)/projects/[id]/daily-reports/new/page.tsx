import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import { getWbsNodesForProject } from '@/app/actions/daily-reports'
import { DailyReportFormWrapper } from '@/components/daily-reports/daily-report-form-wrapper'
import { DailyReportUploadPlaceholder } from '@/components/daily-reports/daily-report-upload-placeholder'
import { getTranslations } from 'next-intl/server'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function NewDailyReportPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId } = await params
  const project = await getProject(projectId)
  if (!project) return notFound()

  const canEdit = hasMinimumRole(org.role, 'EDITOR')
  if (!canEdit) return notFound()

  const wbsOptions = await getWbsNodesForProject(projectId)
  const t = await getTranslations('dailyReports')

  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href={`/projects/${projectId}/daily-reports`}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← {t('title')}
        </Link>
        <span className="text-gray-400">|</span>
        <Link
          href={`/projects/${projectId}`}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          {project.name}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('createNew')}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {project.name} — {t('subtitle')}
      </p>
      <div className="mt-6 w-full space-y-6">
        <DailyReportFormWrapper
          mode="create"
          projectId={projectId}
          wbsOptions={wbsOptions}
          onCancelHref={`/projects/${projectId}/daily-reports`}
        />
        <DailyReportUploadPlaceholder />
      </div>
      </div>
    </div>
  )
}
