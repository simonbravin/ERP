import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getExpensesBySupplierReport } from '@/app/actions/predefined-reports'
import { ExpensesBySupplierReportClient } from '@/components/reports/expenses-by-supplier-report-client'
import { PageHeader } from '@/components/layout/page-header'

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ projectIds?: string }>
}

export default async function GastosPorProveedorPage({ params, searchParams }: PageProps) {
  const session = await getSession()
  const { locale } = await params
  if (!session?.user?.id) redirect(`/${locale}/login`)

  const org = await getOrgContext(session.user.id)
  if (!org?.orgId) redirect(`/${locale}/login`)

  const { projectIds: projectIdsParam } = await searchParams
  const projectIds = projectIdsParam
    ? projectIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined

  const data = await getExpensesBySupplierReport(undefined, projectIds)

  return (
    <div className="h-full">
      <PageHeader
        title="Gastos por Proveedor"
        subtitle="Análisis de compras consolidado por proveedor"
        breadcrumbs={[
          { label: 'Reportes', href: '/reports' },
          { label: 'Predefinidos', href: '/reports/predefined' },
          { label: 'Gastos por Proveedor' },
        ]}
      />

      <div className="mx-auto max-w-6xl w-full space-y-6 p-6">
        <ExpensesBySupplierReportClient data={data} />
      </div>
    </div>
  )
}
