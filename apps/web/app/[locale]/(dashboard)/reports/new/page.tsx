import { redirectToLogin } from '@/lib/i18n-redirect'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { ReportBuilder } from '@/components/reports/report-builder'

export default async function NewReportPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const projects = await prisma.project.findMany({
    where: { orgId: org.orgId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="mx-auto w-full max-w-[min(90rem,calc(100vw-2rem))] space-y-6 bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/reports"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Reports
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground">
        Create report
      </h1>
      <ReportBuilder projects={projects} />
    </div>
  )
}
