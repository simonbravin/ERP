'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ExportDialog } from '@/components/export/export-dialog'
import {
  exportCompanyCashflowToExcel,
  type CashflowExportParams,
} from '@/app/actions/export'
import { FileDown } from 'lucide-react'

type Props = {
  dateFrom: Date
  dateTo: Date
}

const CASHFLOW_EXPORT_COLUMNS = [
  { field: 'month', label: 'Mes', defaultVisible: true },
  { field: 'income', label: 'Ingresos', defaultVisible: true },
  { field: 'expense', label: 'Gastos', defaultVisible: true },
  { field: 'overhead', label: 'Generales', defaultVisible: true },
  { field: 'projectExpense', label: 'Gastos proyectos', defaultVisible: true },
  { field: 'balance', label: 'Balance', defaultVisible: true },
]

export function CashflowExportToolbar({ dateFrom, dateTo }: Props) {
  const t = useTranslations('finance')
  const [showExportDialog, setShowExportDialog] = useState(false)

  const params: CashflowExportParams = {
    dateFrom: dateFrom.toISOString().split('T')[0],
    dateTo: dateTo.toISOString().split('T')[0],
  }

  async function handleExport(format: 'excel' | 'pdf', selectedColumns: string[]) {
    if (format === 'excel') return exportCompanyCashflowToExcel(params, selectedColumns)
    const locale = typeof window !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
    const url = `/api/pdf?template=cashflow&locale=${encodeURIComponent(locale)}&from=${encodeURIComponent(params.dateFrom)}&to=${encodeURIComponent(params.dateTo)}`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, error: data?.error ?? 'No se pudo generar el PDF' }
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition')
    const match = disposition?.match(/filename="?([^";]+)"?/)
    const filename = match?.[1] ?? 'cashflow-consolidado.pdf'
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    return { success: true, filename }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowExportDialog(true)}
      >
        <FileDown className="mr-2 h-4 w-4" />
        {t('export', { defaultValue: 'Exportar' })}
      </Button>
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        title={t('exportCashflowTitle', { defaultValue: 'Exportar flujo de caja (según período actual)' })}
        columns={CASHFLOW_EXPORT_COLUMNS}
        onExport={handleExport}
      />
    </>
  )
}
