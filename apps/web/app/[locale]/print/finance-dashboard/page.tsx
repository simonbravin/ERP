import { getFinanceExecutiveDashboard } from '@/app/actions/finance'
import { PrintTable } from '@/components/print/print-table'
import { formatCurrency } from '@/lib/format-utils'

type Row = { month: string; income: number; expense: number; balance: number }

export default async function PrintFinanceDashboardPage() {
  const data = await getFinanceExecutiveDashboard()

  const summary = data.summary
  const trendRows: Row[] = data.monthlyTrend.map((r) => ({
    month: r.month,
    income: r.income,
    expense: r.expense,
    balance: r.balance,
  }))

  const trendColumns = [
    { key: 'month' as const, label: 'Mes', align: 'left' as const },
    {
      key: 'income' as const,
      label: 'Ingresos',
      align: 'right' as const,
      format: (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v)),
    },
    {
      key: 'expense' as const,
      label: 'Gastos',
      align: 'right' as const,
      format: (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v)),
    },
    {
      key: 'balance' as const,
      label: 'Balance',
      align: 'right' as const,
      format: (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v)),
    },
  ]

  const projectColumns = [
    { key: 'projectName' as const, label: 'Proyecto', align: 'left' as const },
    { key: 'projectNumber' as const, label: 'Número', align: 'left' as const },
    {
      key: 'total' as const,
      label: 'Total gastos',
      align: 'right' as const,
      format: (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v)),
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Dashboard Finanzas — Resumen</h2>
      <div className="grid gap-4 text-sm">
        <p>
          <strong>Ingresos totales:</strong> {formatCurrency(summary.totalIncome)} ·{' '}
          <strong>Gastos totales:</strong> {formatCurrency(summary.totalExpense)} ·{' '}
          <strong>Balance:</strong> {formatCurrency(summary.balance)}
        </p>
      </div>
      <section>
        <h3 className="mb-2 font-medium">Tendencia mensual</h3>
        <PrintTable<Row> columns={trendColumns} rows={trendRows} />
      </section>
      {data.topProjectsByExpense.length > 0 && (
        <section>
          <h3 className="mb-2 font-medium">Top proyectos por gasto</h3>
          <PrintTable
            columns={projectColumns}
            rows={data.topProjectsByExpense.map((p) => ({
              projectName: p.projectName,
              projectNumber: p.projectNumber,
              total: p.total,
            }))}
          />
        </section>
      )}
    </div>
  )
}
