'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CertStatusBadge } from './cert-status-badge'
import { formatPeriod, formatCurrency } from '@/lib/certification-utils'
import { PlusIcon, Eye, FileDown } from 'lucide-react'
import { ExportDialog } from '@/components/export/export-dialog'
import { exportCertificationsToExcel } from '@/app/actions/export'

export type CertificationRow = {
  id: string
  number: number
  periodMonth: number
  periodYear: number
  status: string
  totalAmount: number
  issuedDate: Date | null
  issuedAt: Date | null
  issuedBy: { user: { fullName: string } } | null
  approvedBy: { user: { fullName: string } } | null
  budgetVersion: { versionCode: string }
}

interface Props {
  projectId: string
  certifications: CertificationRow[]
  approvedTotal: number
  /** When "finance", links point to finance/certifications */
  basePath: 'finance' | 'certifications'
}

const STATUS_OPTIONS = ['', 'DRAFT', 'ISSUED', 'APPROVED', 'REJECTED'] as const

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { dateStyle: 'short' })
}

const EXPORT_COLUMNS = [
  { field: 'number', label: 'Número', defaultVisible: true },
  { field: 'period', label: 'Período', defaultVisible: true },
  { field: 'budgetVersion', label: 'Presupuesto', defaultVisible: true },
  { field: 'issuedDate', label: 'Fecha Emisión', defaultVisible: true },
  { field: 'totalAmount', label: 'Monto', defaultVisible: true },
  { field: 'status', label: 'Estado', defaultVisible: true },
]

export function CertificationsListClient({
  projectId,
  certifications,
  approvedTotal,
  basePath,
}: Props) {
  const [statusFilter, setStatusFilter] = useState('')
  const [periodYearFilter, setPeriodYearFilter] = useState('')
  const [periodMonthFilter, setPeriodMonthFilter] = useState('')
  const [sortOrder, setSortOrder] = useState<'period-desc' | 'period-asc' | 'number-desc'>('period-desc')
  const [showExportDialog, setShowExportDialog] = useState(false)
  const t = useTranslations('certifications')
  const tCommon = useTranslations('common')
  const tBudget = useTranslations('budget')

  const prefix = basePath === 'finance' ? `/projects/${projectId}/finance/certifications` : `/projects/${projectId}/certifications`
  const newHref = basePath === 'finance' ? `${prefix}/new` : `${prefix}/new`
  const certHref = (certId: string) => `${prefix}/${certId}`

  const years = Array.from(new Set(certifications.map((c) => c.periodYear))).sort((a, b) => b - a)
  const months = [
    { value: '', label: 'Todos' },
    ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i] })),
  ]

  let filtered = certifications
  if (statusFilter) filtered = filtered.filter((c) => c.status === statusFilter)
  if (periodYearFilter) filtered = filtered.filter((c) => c.periodYear === Number(periodYearFilter))
  if (periodMonthFilter) filtered = filtered.filter((c) => c.periodMonth === Number(periodMonthFilter))

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'number-desc') return b.number - a.number
    const periodA = a.periodYear * 12 + a.periodMonth
    const periodB = b.periodYear * 12 + b.periodMonth
    return sortOrder === 'period-desc' ? periodB - periodA : periodA - periodB
  })

  return (
    <div className="space-y-4">
      {approvedTotal > 0 && (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
          <p className="text-sm font-medium text-muted-foreground">
            {tBudget('runningTotalApproved')}: {formatCurrency(approvedTotal)}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm text-muted-foreground">
              {t('filterByStatus')}
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-input bg-card dark:bg-background px-2 py-1 text-sm"
            >
              <option value="">{tCommon('all')}</option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="period-year" className="text-sm text-muted-foreground">
              Período (año)
            </label>
            <select
              id="period-year"
              value={periodYearFilter}
              onChange={(e) => setPeriodYearFilter(e.target.value)}
              className="rounded-md border border-input bg-card dark:bg-background px-2 py-1 text-sm"
            >
              <option value="">Todos</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="period-month" className="text-sm text-muted-foreground">
              Mes
            </label>
            <select
              id="period-month"
              value={periodMonthFilter}
              onChange={(e) => setPeriodMonthFilter(e.target.value)}
              className="rounded-md border border-input bg-card dark:bg-background px-2 py-1 text-sm"
            >
              {months.map((m) => (
                <option key={m.value || 'all'} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sort-order" className="text-sm text-muted-foreground">
              Ordenar
            </label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="rounded-md border border-input bg-card dark:bg-background px-2 py-1 text-sm"
            >
              <option value="period-desc">Período (más reciente primero)</option>
              <option value="period-asc">Período (más antiguo primero)</option>
              <option value="number-desc">Número (mayor primero)</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Link href={newHref}>
            <Button type="button">
              <PlusIcon className="mr-2 h-4 w-4" />
            Nueva Certificación
          </Button>
          </Link>
        </div>
      </div>

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        title="Exportar certificaciones del proyecto"
        columns={EXPORT_COLUMNS}
        showPdfOptions
        onExport={async (format, selectedColumns, pdfOptions) => {
          if (format === 'excel') return exportCertificationsToExcel(projectId, selectedColumns)
          const locale = typeof window !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
          const url = `/api/pdf?template=certification&id=${encodeURIComponent(projectId)}&locale=${encodeURIComponent(locale)}&showEmitidoPor=${pdfOptions?.showEmitidoPor !== false ? '1' : '0'}&showFullCompanyData=${pdfOptions?.showFullCompanyData !== false ? '1' : '0'}`
          const res = await fetch(url, { credentials: 'include' })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            return { success: false, error: data?.error ?? 'No se pudo generar el PDF' }
          }
          const blob = await res.blob()
          const disposition = res.headers.get('Content-Disposition')
          const match = disposition?.match(/filename="?([^";]+)"?/)
          const filename = match?.[1] ?? `certificaciones-${projectId}.pdf`
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = filename
          link.click()
          URL.revokeObjectURL(link.href)
          return { success: true, filename }
        }}
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('number')}</TableHead>
              <TableHead>{t('period')}</TableHead>
              <TableHead>Presupuesto Base</TableHead>
              <TableHead>Fecha Emisión</TableHead>
              <TableHead className="text-right">Monto del Período</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {t('noCertificationsYet')}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell className="font-mono">#{cert.number}</TableCell>
                  <TableCell>
                    {formatPeriod(cert.periodMonth, cert.periodYear)}
                  </TableCell>
                  <TableCell>{cert.budgetVersion?.versionCode ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(cert.issuedDate ?? cert.issuedAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(cert.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <CertStatusBadge status={cert.status} />
                  </TableCell>
                  <TableCell>
                    <Link href={certHref(cert.id)}>
                      <Button type="button" variant="ghost" size="icon" aria-label="Ver">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
