import { getFinanceExecutiveDashboard } from '@/app/actions/finance'
import { FinanceExecutiveDashboardClient } from '@/components/finance/finance-executive-dashboard-client'

export default async function FinanceDashboardPage() {
  const dashboardData = await getFinanceExecutiveDashboard()

  return (
    <div className="space-y-6">
      <div className="erp-section-header">
        <h2 className="erp-section-title">Dashboard Financiero</h2>
        <p className="erp-section-desc">
          Vista ejecutiva de la salud financiera de la empresa
        </p>
      </div>

      <FinanceExecutiveDashboardClient data={dashboardData} />
    </div>
  )
}
