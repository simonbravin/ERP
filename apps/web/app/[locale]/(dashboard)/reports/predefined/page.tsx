import { redirectToLogin } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, PieChart, TrendingUp, FileCheck } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

export default async function PredefinedReportsPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const t = await getTranslations('reports')

  const reports = [
    {
      title: t('expensesBySupplier'),
      description: t('predefinedDescGastosPorProveedor'),
      icon: BarChart3,
      href: '/reports/predefined/gastos-por-proveedor',
      color: 'text-blue-600',
    },
    {
      title: t('predefinedTitleBudgetVsReal'),
      description: t('predefinedDescBudgetVsReal'),
      icon: TrendingUp,
      href: '/reports/predefined/budget-vs-actual',
      color: 'text-green-600',
    },
    {
      title: t('predefinedTitleProgressVsCost'),
      description: t('predefinedDescProgressVsCost'),
      icon: TrendingUp,
      href: '/reports/predefined/progress-vs-cost',
      color: 'text-emerald-600',
    },
    {
      title: t('predefinedTitleTop10Materials'),
      description: t('predefinedDescTop10Materials'),
      icon: PieChart,
      href: '/reports/predefined/top-materials',
      color: 'text-orange-600',
    },
    {
      title: t('predefinedTitleCertificationsByProject'),
      description: t('predefinedDescCertificationsByProject'),
      icon: FileCheck,
      href: '/reports/predefined/certifications',
      color: 'text-purple-600',
    },
    {
      title: t('purchasesMultiProject'),
      description: t('predefinedDescPurchasesMultiProjectCard'),
      icon: BarChart3,
      href: '/reports/predefined/purchases-multi-project',
      color: 'text-cyan-600',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('predefinedReports')}
        subtitle={t('predefinedListingSubtitle')}
        breadcrumbs={[
          { label: t('title'), href: '/reports' },
          { label: t('predefinedListingBreadcrumb') },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {reports.map((report) => (
          <Link key={report.href} href={report.href}>
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
