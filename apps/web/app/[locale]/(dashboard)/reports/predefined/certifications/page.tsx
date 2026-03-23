import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getCertificationsByProjectReport } from '@/app/actions/predefined-reports'
import { CertificationsReportClient } from '@/components/reports/certifications-report-client'
import { PageHeader } from '@/components/layout/page-header'

type PageProps = {
  params: Promise<{ locale: string }>
}

export default async function CertificationsPage({ params }: PageProps) {
  const session = await getSession()
  const { locale } = await params
  if (!session?.user?.id) redirect(`/${locale}/login`)

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) redirect(`/${locale}/login`)

  const data = await getCertificationsByProjectReport()

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title="Evolución de Certificaciones"
        subtitle="Ingresos cobrados por proyecto (por estado)"
        breadcrumbs={[
          { label: 'Reportes', href: '/reports' },
          { label: 'Predefinidos', href: '/reports/predefined' },
          { label: 'Certificaciones' },
        ]}
      />
      <CertificationsReportClient data={data} />
    </div>
  )
}
