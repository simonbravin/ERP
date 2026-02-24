import { getSession } from '@/lib/session'
import { getOrgContext, isRestrictedToProjects, getVisibleProjectIds } from '@/lib/org-context'
import { redirectToLogin } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { getOrgKPIs, getAlerts, getRecentActivity } from '@/app/actions/dashboard'
import { getCompanyCashflowDetailed } from '@/app/actions/finance'
import { KPICards } from '@/components/dashboard/kpi-cards'
import { CashflowChart } from '@/components/dashboard/cashflow-chart'
import { CashflowSummaryStats } from '@/components/finance/cashflow-summary-stats'
import { AlertsWidget } from '@/components/dashboard/alerts-widget'
import { RecentActivityFeed } from '@/components/dashboard/recent-activity-feed'

export default async function DashboardHomePage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()
  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return redirectToLogin()

  const t = await getTranslations('dashboard')

  const allowedProjectIds = isRestrictedToProjects(orgContext)
    ? await getVisibleProjectIds(orgContext)
    : null
  const restrictedNoProjects =
    Array.isArray(allowedProjectIds) && allowedProjectIds.length === 0

  // Fetch all dashboard data in parallel; on any error use safe defaults so page does not 500
  let kpis: Awaited<ReturnType<typeof getOrgKPIs>> = {
    activeProjects: 0,
    totalBudget: 0,
    pendingCertifications: 0,
    monthExpenses: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    progressPct: null,
    pendingChangeOrders: 0,
  }
  let cashflowTimeline: Awaited<ReturnType<typeof getCompanyCashflowDetailed>>['timeline'] = []
  let cashflowSummary: Awaited<ReturnType<typeof getCompanyCashflowDetailed>>['summary'] | null = null
  let alerts: { id: string; type: 'warning' | 'error' | 'info'; title: string; message: string; link?: string }[] = []
  let recentActivity: { id: string; action: string; entityType: string; actorName: string; projectName?: string | null; createdAt: Date; details: unknown }[] = []

  try {
    const toDate = new Date()
    const fromDate = new Date(toDate.getFullYear(), toDate.getMonth() - 12, 1)
    const [kpisRes, cashflowRes, alertsRes, activityRes] = await Promise.all([
      getOrgKPIs(orgContext.orgId, allowedProjectIds),
      getCompanyCashflowDetailed({ from: fromDate, to: toDate }),
      getAlerts(orgContext.orgId, allowedProjectIds),
      getRecentActivity(orgContext.orgId, allowedProjectIds),
    ])
    kpis = kpisRes
    cashflowTimeline = cashflowRes.timeline
    cashflowSummary = cashflowRes.summary
    alerts = alertsRes
    recentActivity = activityRes
  } catch (err) {
    console.error('[dashboard] Error loading dashboard data:', err)
  }

  if (restrictedNoProjects) {
    return (
      <div className="erp-view-container space-y-6 bg-background">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('title')}</h1>
          <p className="erp-section-desc">{t('subtitle')}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
          <p className="text-muted-foreground">
            {t('noAssignedProjects', { defaultMessage: 'No tenés proyectos asignados. Contactá al administrador para que te asigne al menos un proyecto.' })}
          </p>
          <Link
            href="/projects"
            className="mt-4 inline-block text-primary underline underline-offset-2"
          >
            {t('viewProjects', { defaultMessage: 'Ver proyectos' })}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="erp-section-header">
        <h1 className="erp-page-title">{t('title')}</h1>
        <p className="erp-section-desc">{t('subtitle')}</p>
      </div>

      {/* Main KPIs: 4 cards (proyectos, presupuesto, gastos, avance) */}
      <KPICards kpis={kpis} variant="main" />

      {/* Flujo de caja + Alertas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-h-[360px] lg:col-span-2">
          <CashflowChart timeline={cashflowTimeline} />
        </div>
        <div>
          <AlertsWidget alerts={alerts} />
        </div>
      </div>

      {/* Resumen del período (cashflow empresa: generales + proyectos) */}
      {cashflowSummary && (
        <CashflowSummaryStats summary={cashflowSummary} />
      )}

      {/* Certificaciones pendientes, Cuentas por cobrar, Cuentas por pagar, Órdenes de cambio */}
      <KPICards kpis={kpis} variant="finance" />

      {/* Actividad reciente */}
      <RecentActivityFeed activities={recentActivity} />
    </div>
  )
}
