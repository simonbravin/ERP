import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getProgressVsCostReport } from '@/app/actions/predefined-reports'
import { ProgressVsCostReportClient } from '@/components/reports/progress-vs-cost-report-client'

type PageProps = {
  params: Promise<{ locale: string }>
}

export default async function ProgressVsCostPage({ params }: PageProps) {
  const session = await getSession()
  const { locale } = await params
  if (!session?.user?.id) redirect(`/${locale}/login`)

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) redirect(`/${locale}/login`)

  const data = await getProgressVsCostReport()

  return (
    <div className="mx-auto max-w-6xl w-full space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Avance vs Costo
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Consumido vs avance de obra por proyecto
        </p>
      </div>

      <ProgressVsCostReportClient data={data} />
    </div>
  )
}
