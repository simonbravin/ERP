import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getTopMaterialsReport } from '@/app/actions/predefined-reports'
import { TopMaterialsReportClient } from '@/components/reports/top-materials-report-client'
import { PageHeader } from '@/components/layout/page-header'

type PageProps = {
  params: Promise<{ locale: string }>
}

export default async function TopMaterialsPage({ params }: PageProps) {
  const session = await getSession()
  const { locale } = await params
  if (!session?.user?.id) redirect(`/${locale}/login`)

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) redirect(`/${locale}/login`)

  const data = await getTopMaterialsReport(10)

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title="Top 10 Materiales más Caros"
        subtitle="Análisis de materiales por costo total en presupuestos aprobados"
        breadcrumbs={[
          { label: 'Reportes', href: '/reports' },
          { label: 'Predefinidos', href: '/reports/predefined' },
          { label: 'Top 10 Materiales' },
        ]}
      />
      <TopMaterialsReportClient data={data} />
    </div>
  )
}
