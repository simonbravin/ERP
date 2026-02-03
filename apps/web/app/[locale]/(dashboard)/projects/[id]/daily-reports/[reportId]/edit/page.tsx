import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import { getDailyReport, getWbsNodesForProject } from '@/app/actions/daily-reports'
import { DailyReportFormWrapper } from '@/components/daily-reports/daily-report-form-wrapper'
import { DailyReportUploadSection } from '@/components/daily-reports/daily-report-upload-section'
import { getTranslations } from 'next-intl/server'
import type { LaborEntryInput } from '@repo/validators'

type PageProps = {
  params: Promise<{ id: string; reportId: string }>
}

export default async function EditDailyReportPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId, reportId } = await params
  const project = await getProject(projectId)
  if (!project) return notFound()

  const report = await getDailyReport(reportId)
  if (!report || report.projectId !== projectId) return notFound()
  if (report.status !== 'DRAFT') return notFound()

  const isAuthor = report.createdByOrgMemberId === org.memberId
  const canApprove = hasMinimumRole(org.role, 'ADMIN')
  if (!isAuthor && !canApprove) return notFound()

  const wbsOptions = await getWbsNodesForProject(projectId)
  const laborEntries: LaborEntryInput[] = report.labor.map((l) => ({
    speciality: l.trade,
    quantity: l.workerCount,
    hours: Number(l.hoursWorked),
  }))

  const t = await getTranslations('dailyReports')

  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href={`/projects/${projectId}/daily-reports/${reportId}`}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← {t('title')}
        </Link>
        <span className="text-gray-400">|</span>
        <Link
          href={`/projects/${projectId}/daily-reports`}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          {project.name}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('editReport')}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {project.name} — {new Date(report.reportDate).toLocaleDateString()}
      </p>
      <div className="mx-auto mt-6 w-full max-w-5xl space-y-6">
        <DailyReportFormWrapper
          mode="edit"
          projectId={projectId}
          reportId={reportId}
          defaultValues={{
            reportDate: report.reportDate,
            summary: report.summary,
            workAccomplished: report.workAccomplished ?? undefined,
            weather: report.weather ?? null,
            observations: report.observations ?? null,
            wbsNodeId: report.wbsNodeId ?? null,
            wbsNodeIds:
              report.wbsNodes?.map((n) => n.wbsNode.id) ?? (report.wbsNodeId ? [report.wbsNodeId] : []),
            laborEntries,
          }}
          wbsOptions={wbsOptions}
          onCancelHref={`/projects/${projectId}/daily-reports/${reportId}`}
        />
        <DailyReportUploadSection
          reportId={reportId}
          projectId={projectId}
          photoCount={report.photos?.length ?? 0}
          canUpload={true}
        />
      </div>
      </div>
    </div>
  )
}
