import { getCompanyCashflowDetailed } from '@/app/actions/finance'
import { PrintDocumentShell } from '@/components/print/print-document-shell'
import { PrintTable } from '@/components/print/print-table'
import { formatCurrency } from '@/lib/format-utils'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type Row = {
  month: string
  income: number
  expense: number
  overhead: number
  projectExpense: number
  balance: number
}

export default async function PrintCashflowPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const fromStr = typeof sp.from === 'string' ? sp.from : undefined
  const toStr = typeof sp.to === 'string' ? sp.to : undefined
  const toDate = toStr ? new Date(toStr) : new Date()
  const fromDate = fromStr ? new Date(fromStr) : new Date(toDate.getFullYear(), toDate.getMonth() - 6, 1)

  const { timeline } = await getCompanyCashflowDetailed({ from: fromDate, to: toDate })

  const rows: Row[] = timeline.map((row) => ({
    month: row.month,
    income: row.income,
    expense: row.expense,
    overhead: row.overhead,
    projectExpense: row.expense - row.overhead,
    balance: row.balance,
  }))

  const columns = [
    { key: 'month' as const, label: 'Mes', align: 'left' as const },
    {
      key: 'income' as const,
      label: 'Ingresos',
      align: 'right' as const,
      format: (val: unknown) => (typeof val === 'number' ? formatCurrency(val) : String(val)),
    },
    {
      key: 'expense' as const,
      label: 'Gastos',
      align: 'right' as const,
      format: (val: unknown) => (typeof val === 'number' ? formatCurrency(val) : String(val)),
    },
    {
      key: 'overhead' as const,
      label: 'Generales',
      align: 'right' as const,
      format: (val: unknown) => (typeof val === 'number' ? formatCurrency(val) : String(val)),
    },
    {
      key: 'projectExpense' as const,
      label: 'Gastos proyectos',
      align: 'right' as const,
      format: (val: unknown) => (typeof val === 'number' ? formatCurrency(val) : String(val)),
    },
    {
      key: 'balance' as const,
      label: 'Balance',
      align: 'right' as const,
      format: (val: unknown) => (typeof val === 'number' ? formatCurrency(val) : String(val)),
    },
  ]

  const query: Record<string, string | string[] | undefined> = { ...sp }
  if (fromStr) query.from = fromStr
  if (toStr) query.to = toStr

  return (
    <PrintDocumentShell templateId="cashflow" query={query}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Flujo de caja consolidado — {fromDate.toLocaleDateString('es-AR')} a {toDate.toLocaleDateString('es-AR')}
        </h2>
        <PrintTable<Row> columns={columns} rows={rows} />
      </div>
    </PrintDocumentShell>
  )
}
