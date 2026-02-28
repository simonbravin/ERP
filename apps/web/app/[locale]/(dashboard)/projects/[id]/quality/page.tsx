import { redirectToLogin, redirectTo } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { QualityDashboard } from '@/components/quality/quality-dashboard'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function QualityPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const { id: projectId } = await params

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true, name: true, projectNumber: true },
  })

  if (!project) return redirectTo('/projects')

  const t = await getTranslations('quality')
  const [rfiCount, submittalCount, openRfis, pendingSubmittals] = await Promise.all([
    prisma.rFI.count({ where: { projectId, orgId: org.orgId } }),
    prisma.submittal.count({ where: { projectId, orgId: org.orgId } }),
    prisma.rFI.count({
      where: { projectId, orgId: org.orgId, status: 'OPEN' },
    }),
    prisma.submittal.count({
      where: {
        projectId,
        orgId: org.orgId,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
      },
    }),
  ])

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('title')}</h1>
          <p className="erp-section-desc">{project.name} ({project.projectNumber})</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${projectId}`}>← {project.name}</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6">
        <QualityDashboard
          projectId={projectId}
          stats={{
            totalRfis: rfiCount,
            totalSubmittals: submittalCount,
            openRfis,
            pendingSubmittals,
          }}
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Link
            href={`/projects/${projectId}/quality/rfis`}
            className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
          >
            <h3 className="font-medium">{t('rfis')}</h3>
            <p className="text-sm text-muted-foreground">
              {openRfis} open, {rfiCount} total
            </p>
          </Link>
          <Link
            href={`/projects/${projectId}/quality/submittals`}
            className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
          >
            <h3 className="font-medium">{t('submittals')}</h3>
            <p className="text-sm text-muted-foreground">
              {pendingSubmittals} pending, {submittalCount} total
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
