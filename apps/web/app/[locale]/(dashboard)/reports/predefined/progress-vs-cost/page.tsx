import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getProgressVsCostReport } from '@/app/actions/predefined-reports'
import { ProgressVsCostReportClient } from '@/components/reports/progress-vs-cost-report-client'
import { PageHeader } from '@/components/layout/page-header'

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
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title="Avance vs Costo"
        subtitle="Consumido vs avance de obra por proyecto"
        breadcrumbs={[
          { label: 'Reportes', href: '/reports' },
          { label: 'Predefinidos', href: '/reports/predefined' },
          { label: 'Avance vs Costo' },
        ]}
      />
      <ProgressVsCostReportClient data={data} />
    </div>
  )
}
