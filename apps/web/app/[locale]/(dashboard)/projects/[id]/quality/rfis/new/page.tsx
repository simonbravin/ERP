import { redirectToLogin, redirectTo } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { RfiForm } from '@/components/quality/rfi-form'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function NewRfiPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const { id: projectId } = await params

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
  })
  if (!project) return redirectTo('/projects')

  const [wbsNodes, orgMembers] = await Promise.all([
    prisma.wbsNode.findMany({
      where: { projectId, active: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    prisma.orgMember.findMany({
      where: { orgId: org.orgId, active: true },
      select: {
        id: true,
        user: { select: { fullName: true } },
      },
    }),
  ])

  const t = await getTranslations('quality')
  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('newRfi')}</h1>
          <p className="erp-section-desc">{project.name}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${projectId}/quality/rfis`}>← {t('rfis')}</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6">
        <RfiForm
          projectId={projectId}
          wbsNodes={wbsNodes}
          orgMembers={orgMembers}
        />
      </div>
    </div>
  )
}
