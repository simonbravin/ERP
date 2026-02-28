import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { prisma } from '@repo/database'
import { RfiDetail } from '@/components/quality/rfi-detail'
import { RfiCommentForm } from '@/components/quality/rfi-comment-form'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

type PageProps = {
  params: Promise<{ id: string; rfiId: string }>
}

export default async function RfiDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()

  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId, rfiId } = await params

  const rfi = await prisma.rFI.findFirst({
    where: {
      id: rfiId,
      projectId,
      orgId: org.orgId,
    },
    include: {
      raisedBy: {
        select: { user: { select: { fullName: true, email: true } } },
      },
      assignedTo: {
        select: { user: { select: { fullName: true, email: true } } },
      },
      wbsNode: {
        select: { code: true, name: true },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: { user: { select: { fullName: true } } },
          },
        },
      },
    },
  })

  if (!rfi) notFound()

  const canAnswer = hasMinimumRole(org.role, 'EDITOR')
  const t = await getTranslations('quality')

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">RFI #{rfi.number}</h1>
          <p className="erp-section-desc">{rfi.subject}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${projectId}/quality/rfis`}>← {t('rfis')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${projectId}/quality`}>{t('title')}</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6">
      <RfiDetail
        rfi={{
          id: rfi.id,
          number: rfi.number,
          subject: rfi.subject,
          question: rfi.question,
          answer: rfi.answer,
          status: rfi.status,
          priority: rfi.priority,
          dueDate: rfi.dueDate,
          answeredDate: rfi.answeredDate,
          closedDate: rfi.closedDate,
          raisedBy: rfi.raisedBy,
          assignedTo: rfi.assignedTo,
          wbsNode: rfi.wbsNode,
        }}
        projectId={projectId}
        canAnswer={canAnswer}
      />

      <div className="mt-6 border-t border-border pt-6">
        <h3 className="mb-4 text-lg font-medium">
          {t('comments')}
        </h3>
        <RfiCommentForm rfiId={rfiId} projectId={projectId} />

        <div className="mt-4 space-y-4">
          {rfi.comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-border p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {comment.author.user.fullName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">
                {comment.comment}
              </p>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}
