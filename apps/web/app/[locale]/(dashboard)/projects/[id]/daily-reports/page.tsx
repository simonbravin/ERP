import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import { listDailyReports, getAuthorsForProject } from '@/app/actions/daily-reports'
import { DailyReportsListClient } from '@/components/daily-reports/daily-reports-list-client'
import { getTranslations } from 'next-intl/server'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    status?: string
    author?: string
    dateFrom?: string
    dateTo?: string
    search?: string
    page?: string
    view?: 'table' | 'cards'
  }>
}

export default async function ProjectDailyReportsPage({ params, searchParams }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId } = await params
  const project = await getProject(projectId)
  if (!project) return notFound()

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const statuses = sp.status ? sp.status.split(',').filter(Boolean) : undefined
  const authors = sp.author ? sp.author.split(',').filter(Boolean) : undefined
  const dateFrom = sp.dateFrom ? new Date(sp.dateFrom) : undefined
  const dateTo = sp.dateTo ? new Date(sp.dateTo) : undefined

  const [result, authorsList] = await Promise.all([
    listDailyReports(
      projectId,
      {
        status: statuses,
        authorOrgMemberId: authors,
        dateFrom,
        dateTo,
        search: sp.search?.trim(),
      },
      page,
      25
    ),
    getAuthorsForProject(projectId),
  ])

  const canEdit = hasMinimumRole(org.role, 'EDITOR')
  const canApprove = hasMinimumRole(org.role, 'ADMIN')
  const t = await getTranslations('dailyReports')

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/projects/${projectId}`}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← {project.name}
        </Link>
      </div>
      <DailyReportsListClient
        projectId={projectId}
        projectName={project.name ?? ''}
        items={result.items}
        total={result.total}
        page={page}
        pageSize={25}
        authors={authorsList}
        canEdit={canEdit}
        canApprove={canApprove}
        initialSearch={sp.search ?? ''}
        initialStatuses={statuses ?? []}
        initialAuthors={authors ?? []}
        initialDateFrom={sp.dateFrom ?? ''}
        initialDateTo={sp.dateTo ?? ''}
        initialView={(sp.view as 'table' | 'cards') ?? 'table'}
        title={t('title')}
        subtitle={t('subtitle')}
      />
    </div>
  )
}
