import { getCompanyTransactions, type CompanyTransactionsFilters } from '@/app/actions/finance'
import { PrintDocumentShell } from '@/components/print/print-document-shell'
import { PrintTable } from '@/components/print/print-table'
import { formatCurrency } from '@/lib/format-utils'
import { getStatusLabel, TYPE_LABELS } from '@/lib/finance-labels'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type Row = {
  issueDate: string
  transactionNumber: string
  type: string
  projectName: string
  description: string
  partyName: string
  total: number
  status: string
}

export default async function PrintTransactionsPage({ searchParams }: PageProps) {
  const sp = await searchParams

  const filters: CompanyTransactionsFilters = {}
  const projectId = typeof sp.projectId === 'string' ? sp.projectId : undefined
  if (projectId) filters.projectId = projectId
  const type = typeof sp.type === 'string' ? sp.type : undefined
  if (type) filters.type = type
  const partyId = typeof sp.partyId === 'string' ? sp.partyId : undefined
  if (partyId) filters.partyId = partyId
  const status = typeof sp.status === 'string' ? sp.status : undefined
  if (status) filters.status = status
  const dateFrom = typeof sp.dateFrom === 'string' ? sp.dateFrom : undefined
  if (dateFrom) filters.dateFrom = dateFrom
  const dateTo = typeof sp.dateTo === 'string' ? sp.dateTo : undefined
  if (dateTo) filters.dateTo = dateTo
  const search = typeof sp.search === 'string' ? sp.search : undefined
  if (search) filters.search = search

  const list = await getCompanyTransactions(filters)

  const rows: Row[] = list.map((t: Record<string, unknown>) => ({
    issueDate: t.issueDate
      ? new Date(t.issueDate as string).toLocaleDateString('es-AR', { dateStyle: 'short' })
      : '—',
    transactionNumber: String(t.transactionNumber ?? '—'),
    type: TYPE_LABELS[t.type as keyof typeof TYPE_LABELS] ?? String(t.type),
    projectName: (t.project as { name?: string })?.name ?? 'Generales',
    description: String(t.description ?? '—'),
    partyName: (t.party as { name?: string })?.name ?? '—',
    total: typeof t.amountBaseCurrency === 'number' ? t.amountBaseCurrency : Number(t.total ?? 0),
    status: getStatusLabel(t.status as string),
  }))

  const total = rows.reduce((sum, r) => sum + r.total, 0)

  const columns = [
    { key: 'issueDate' as const, label: 'Fecha', align: 'left' as const },
    { key: 'transactionNumber' as const, label: 'Número', align: 'left' as const },
    { key: 'type' as const, label: 'Tipo', align: 'left' as const },
    { key: 'projectName' as const, label: 'Proyecto', align: 'left' as const },
    { key: 'description' as const, label: 'Descripción', align: 'left' as const },
    { key: 'partyName' as const, label: 'Proveedor/Cliente', align: 'left' as const },
    {
      key: 'total' as const,
      label: 'Monto',
      align: 'right' as const,
      format: (val: unknown) => (typeof val === 'number' ? formatCurrency(val) : String(val)),
    },
    { key: 'status' as const, label: 'Estado', align: 'left' as const },
  ]

  const query: Record<string, string | undefined> = {}
  if (dateFrom) query.dateFrom = dateFrom
  if (dateTo) query.dateTo = dateTo

  return (
    <PrintDocumentShell templateId="transactions" query={sp}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Transacciones de Empresa</h2>
        <PrintTable<Row>
          columns={columns}
          rows={rows}
          totals={{ total: formatCurrency(total) }}
          totalsLabel="Total"
        />
      </div>
    </PrintDocumentShell>
  )
}
