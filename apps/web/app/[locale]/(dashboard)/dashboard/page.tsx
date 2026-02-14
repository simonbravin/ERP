import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirectToLogin } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import {
  getOrgKPIs,
  getCashflowData,
  getAlerts,
  getRecentActivity,
} from '@/app/actions/dashboard'
import { KPICards } from '@/components/dashboard/kpi-cards'
import { CashflowChart } from '@/components/dashboard/cashflow-chart'
import { AlertsWidget } from '@/components/dashboard/alerts-widget'
import { RecentActivityFeed } from '@/components/dashboard/recent-activity-feed'

export default async function DashboardHomePage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()
  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return redirectToLogin()

  const t = await getTranslations('dashboard')

  // Fetch all dashboard data in parallel; on any error use safe defaults so page does not 500
  let kpis = { activeProjects: 0, totalBudget: 0, pendingCertifications: 0, monthExpenses: 0 }
  let cashflowData: { month: string; income: number; expenses: number; net: number }[] = []
  let alerts: { id: string; type: 'warning' | 'error' | 'info'; title: string; message: string; link?: string }[] = []
  let recentActivity: { id: string; action: string; entityType: string; actorName: string; projectName?: string | null; createdAt: Date; details: unknown }[] = []

  try {
    const [kpisRes, cashflowRes, alertsRes, activityRes] = await Promise.all([
      getOrgKPIs(orgContext.orgId),
      getCashflowData(orgContext.orgId),
      getAlerts(orgContext.orgId),
      getRecentActivity(orgContext.orgId),
    ])
    kpis = kpisRes
    cashflowData = cashflowRes
    alerts = alertsRes
    recentActivity = activityRes
  } catch (err) {
    console.error('[dashboard] Error loading dashboard data:', err)
  }

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="erp-section-header">
        <h1 className="erp-page-title">{t('title')}</h1>
        <p className="erp-section-desc">{t('subtitle')}</p>
      </div>

      {/* KPI Cards */}
      <KPICards kpis={kpis} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cashflow chart - takes 2 columns; min-height so ResponsiveContainer gets valid dimensions */}
        <div className="lg:col-span-2 min-h-[360px]">
          <CashflowChart data={cashflowData} />
        </div>

        {/* Alerts widget */}
        <div>
          <AlertsWidget alerts={alerts} />
        </div>
      </div>

      {/* Recent activity */}
      <RecentActivityFeed activities={recentActivity} />
    </div>
  )
}
