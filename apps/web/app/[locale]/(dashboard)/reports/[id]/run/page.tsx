import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { ReportRunClient } from '@/components/reports/report-run-client'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ReportRunPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()

  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id } = await params

  const report = await prisma.savedReport.findFirst({
    where: {
      id,
      orgId: org.orgId,
      OR: [
        { visibility: 'SHARED' },
        { createdByOrgMemberId: org.memberId },
      ],
    },
  })

  if (!report) notFound()

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="mb-6">
        <Link
          href={`/reports/${id}`}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← {report.name}
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">
        Run report
      </h1>
      <ReportRunClient reportId={id} reportName={report.name} />
    </div>
  )
}
