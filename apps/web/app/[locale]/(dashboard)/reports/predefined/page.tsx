import { redirectToLogin } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, PieChart, TrendingUp, FileCheck } from 'lucide-react'
import { Link } from '@/i18n/navigation'

export default async function PredefinedReportsPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const reports = [
    {
      title: 'Gastos por Proveedor',
      description: 'Análisis de compras consolidado multi-proyecto',
      icon: BarChart3,
      href: '/reports/predefined/expenses-by-supplier',
      color: 'text-blue-600',
    },
    {
      title: 'Presupuesto vs Real',
      description: 'Control de costos por proyecto',
      icon: TrendingUp,
      href: '/reports/predefined/budget-vs-actual',
      color: 'text-green-600',
    },
    {
      title: 'Avance vs Costo',
      description: 'Consumido vs avance de obra por proyecto',
      icon: TrendingUp,
      href: '/reports/predefined/progress-vs-cost',
      color: 'text-emerald-600',
    },
    {
      title: 'Top 10 Materiales',
      description: 'Materiales más caros de la empresa',
      icon: PieChart,
      href: '/reports/predefined/top-materials',
      color: 'text-orange-600',
    },
    {
      title: 'Certificaciones por Proyecto',
      description: 'Estado de certificaciones consolidado',
      icon: FileCheck,
      href: '/reports/predefined/certifications',
      color: 'text-purple-600',
    },
    {
      title: 'Compras Multi-Proyecto',
      description: 'Compras consolidadas por proyecto',
      icon: BarChart3,
      href: '/reports/predefined/purchases-multi-project',
      color: 'text-cyan-600',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes Predefinidos"
        subtitle="Reportes listos para usar con visualizaciones interactivas"
        breadcrumbs={[
          { label: 'Reportes', href: '/reports' },
          { label: 'Predefinidos' },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {reports.map((report) => (
          <Link key={report.title} href={report.href}>
            <Card className="h-full transition-shadow hover:shadow-lg cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{report.title}</CardTitle>
                    <CardDescription className="mt-2">{report.description}</CardDescription>
                  </div>
                  <report.icon className={`h-10 w-10 shrink-0 ${report.color}`} />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
