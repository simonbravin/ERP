import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import { getDailyReport, approveDailyReport, rejectDailyReport, deleteDailyReport, publishDailyReport } from '@/app/actions/daily-reports'
import { DailyReportDetailClient } from '@/components/daily-reports/daily-report-detail-client'
import { getTranslations } from 'next-intl/server'

type PageProps = {
  params: Promise<{ id: string; reportId: string }>
}

export default async function DailyReportDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId, reportId } = await params
  const project = await getProject(projectId)
  if (!project) return notFound()

  const report = await getDailyReport(reportId)
  if (!report || report.projectId !== projectId) return notFound()

  const canEdit = hasMinimumRole(org.role, 'EDITOR')
  const canApprove = hasMinimumRole(org.role, 'ADMIN')
  const isAuthor = report.createdByOrgMemberId === org.memberId
  const canEditReport = report.status === 'DRAFT' && (isAuthor || canApprove)
  const canSubmitReport = report.status === 'DRAFT' && isAuthor
  const canApproveReport = report.status === 'SUBMITTED' && canApprove
  const canPublishReport = report.status === 'APPROVED' && canApprove

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
      <DailyReportDetailClient
        projectId={projectId}
        report={report}
        canEditReport={canEditReport}
        canSubmitReport={canSubmitReport}
        canApproveReport={canApproveReport}
        canPublishReport={canPublishReport}
        isAuthor={isAuthor}
        onApprove={approveDailyReport}
        onReject={rejectDailyReport}
        onPublish={publishDailyReport}
        onDelete={deleteDailyReport}
      />
      </div>
    </div>
  )
}
