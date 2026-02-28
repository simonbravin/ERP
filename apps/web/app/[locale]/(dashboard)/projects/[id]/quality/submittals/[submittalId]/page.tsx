import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { prisma } from '@repo/database'
import { SubmittalDetail } from '@/components/quality/submittal-detail'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

type PageProps = {
  params: Promise<{ id: string; submittalId: string }>
}

export default async function SubmittalDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()

  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId, submittalId } = await params

  const submittal = await prisma.submittal.findFirst({
    where: {
      id: submittalId,
      projectId,
      orgId: org.orgId,
    },
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

  if (!submittal) notFound()

  const canEdit = hasMinimumRole(org.role, 'EDITOR')
  const t = await getTranslations('quality')

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('submittals')} #{submittal.number}</h1>
          <p className="erp-section-desc">{submittal.specSection ?? submittal.submittalType}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${projectId}/quality/submittals`}>← {t('submittals')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${projectId}/quality`}>{t('title')}</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6">
        <SubmittalDetail
          submittal={{
            id: submittal.id,
            number: submittal.number,
            submittalType: submittal.submittalType,
            specSection: submittal.specSection,
            status: submittal.status,
            revisionNumber: submittal.revisionNumber,
            dueDate: submittal.dueDate,
            submittedDate: submittal.submittedDate,
            reviewedDate: submittal.reviewedDate,
            reviewComments: submittal.reviewComments,
            submittedBy: submittal.submittedBy,
            reviewedBy: submittal.reviewedBy,
            wbsNode: submittal.wbsNode,
          }}
          projectId={projectId}
          canEdit={canEdit}
        />
      </div>
    </div>
  )
}
