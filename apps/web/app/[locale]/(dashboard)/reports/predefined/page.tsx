import { redirectToLogin } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { PageHeader } from '@/components/layout/page-header'
import { BarChart3, PieChart, TrendingUp, FileCheck, ShoppingCart } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'

const REPORT_CARD_CLASS =
  'group flex h-full min-w-0 items-start gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md'

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
      iconWrap: 'bg-primary/10 text-primary',
    },
    {
      title: t('predefinedTitleBudgetVsReal'),
      description: t('predefinedDescBudgetVsReal'),
      icon: TrendingUp,
      href: '/reports/predefined/budget-vs-actual',
      iconWrap: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      title: t('predefinedTitleProgressVsCost'),
      description: t('predefinedDescProgressVsCost'),
      icon: TrendingUp,
      href: '/reports/predefined/progress-vs-cost',
      iconWrap: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    },
    {
      title: t('predefinedTitleTop10Materials'),
      description: t('predefinedDescTop10Materials'),
      icon: PieChart,
      href: '/reports/predefined/top-materials',
      iconWrap: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      title: t('predefinedTitleCertificationsByProject'),
      description: t('predefinedDescCertificationsByProject'),
      icon: FileCheck,
      href: '/reports/predefined/certifications',
      iconWrap: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    {
      title: t('purchasesMultiProject'),
      description: t('predefinedDescPurchasesMultiProjectCard'),
      icon: ShoppingCart,
      href: '/reports/predefined/purchases-multi-project',
      iconWrap: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    },
  ]

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title={t('predefinedReports')}
        subtitle={t('predefinedListingSubtitle')}
        breadcrumbs={[
          { label: t('title'), href: '/reports' },
          { label: t('predefinedListingBreadcrumb') },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon
          return (
            <Link key={report.href} href={report.href} className={cn(REPORT_CARD_CLASS)}>
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                  report.iconWrap
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground group-hover:text-primary">
                  {report.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
