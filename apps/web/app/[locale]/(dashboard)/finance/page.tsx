import { getFinanceExecutiveDashboard, getCompanyFinanceAlerts } from '@/app/actions/finance'
import { FinanceExecutiveDashboardClient } from '@/components/finance/finance-executive-dashboard-client'

export default async function FinanceDashboardPage() {
  const [dashboardData, alerts] = await Promise.all([
    getFinanceExecutiveDashboard(),
    getCompanyFinanceAlerts(),
  ])

  return (
    <>
      <div className="erp-section-header mb-4 md:mb-6">
        <h2 className="erp-section-title">Dashboard Financiero</h2>
        <p className="erp-section-desc">
          Vista ejecutiva de la salud financiera de la empresa
        </p>
      </div>
      <FinanceExecutiveDashboardClient data={dashboardData} alerts={alerts} />
    </>
  )
}
