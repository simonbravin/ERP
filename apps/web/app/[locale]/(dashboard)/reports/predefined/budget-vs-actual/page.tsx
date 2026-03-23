import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getBudgetVsActualReport } from '@/app/actions/predefined-reports'
import { BudgetVsActualReportClient } from '@/components/reports/budget-vs-actual-report-client'
import { PageHeader } from '@/components/layout/page-header'

type PageProps = {
  params: Promise<{ locale: string }>
}

export default async function BudgetVsActualPage({ params }: PageProps) {
  const session = await getSession()
  const { locale } = await params
  if (!session?.user?.id) redirect(`/${locale}/login`)

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) redirect(`/${locale}/login`)

  const data = await getBudgetVsActualReport()

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title="Presupuesto vs Real"
        subtitle="Control de costos por proyecto"
        breadcrumbs={[
          { label: 'Reportes', href: '/reports' },
          { label: 'Predefinidos', href: '/reports/predefined' },
          { label: 'Presupuesto vs Real' },
        ]}
      />
      <BudgetVsActualReportClient data={data} />
    </div>
  )
}
