import { redirectToLogin, redirectTo } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { SubmittalList } from '@/components/quality/submittal-list'
import type { SubmittalRow } from '@/components/quality/submittal-list'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}

export default async function SubmittalsPage({
  params,
  searchParams,
}: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const { id: projectId } = await params
  const { status: statusFilter } = await searchParams

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
  })
  if (!project) return redirectTo('/projects')

  const t = await getTranslations('quality')
  const submittals = await prisma.submittal.findMany({
    where: {
      projectId,
      orgId: org.orgId,
      ...(statusFilter && { status: statusFilter }),
    },
    orderBy: { number: 'desc' },
    include: {
      submittedBy: { select: { name: true } },
      reviewedBy: {
        select: { user: { select: { fullName: true } } },
      },
      wbsNode: {
        select: { code: true, name: true },
      },
    },
  })

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('submittals')}</h1>
          <p className="erp-section-desc">{project.name}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${projectId}/quality`}>← {t('title')}</Link>
          </Button>
          <Button asChild variant="default" size="sm">
            <Link href={`/projects/${projectId}/quality/submittals/new`}>{t('newSubmittal')}</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6">
        <SubmittalList submittals={submittals as SubmittalRow[]} projectId={projectId} />
      </div>
    </div>
  )
}
