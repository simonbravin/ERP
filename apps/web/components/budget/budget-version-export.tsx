'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ExportDialog } from '@/components/export/export-dialog'
import { exportBudgetToExcel } from '@/app/actions/export'
import { FileDown } from 'lucide-react'

interface BudgetVersionExportProps {
  versionId: string
  versionCode: string
}

const exportColumns = [
  { field: 'code', label: 'Código', defaultVisible: true },
  { field: 'description', label: 'Descripción', defaultVisible: true },
  { field: 'unit', label: 'Unidad', defaultVisible: true },
  { field: 'quantity', label: 'Cantidad', defaultVisible: true },
  { field: 'unitPrice', label: 'Precio Unitario', defaultVisible: true },
  { field: 'totalCost', label: 'Costo Total', defaultVisible: true },
  { field: 'incidenciaPct', label: 'Incidencia (Inc %)', defaultVisible: false },
  { field: 'overheadPct', label: 'GG %', defaultVisible: false },
  { field: 'profitPct', label: 'Beneficio %', defaultVisible: false },
  { field: 'taxPct', label: 'IVA %', defaultVisible: false },
]

export function BudgetVersionExport({ versionId, versionCode }: BudgetVersionExportProps) {
  const t = useTranslations('export')
  const [showExportDialog, setShowExportDialog] = useState(false)

  async function handleExport(format: 'excel' | 'pdf', selectedColumns: string[], pdfOptions?: { showEmitidoPor: boolean; showFullCompanyData: boolean }) {
    if (format === 'excel') {
      return await exportBudgetToExcel(versionId, selectedColumns)
    }
    const locale = typeof window !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
    const params = new URLSearchParams({
      template: 'budget',
      id: versionId,
      locale,
      showEmitidoPor: pdfOptions?.showEmitidoPor !== false ? '1' : '0',
      showFullCompanyData: pdfOptions?.showFullCompanyData !== false ? '1' : '0',
    })
    if (selectedColumns.length) params.set('columns', selectedColumns.join(','))
    const url = `/api/pdf?${params.toString()}`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const message = data?.detail ?? data?.error ?? 'No se pudo generar el PDF'
      return { success: false, error: message }
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition')
    const match = disposition?.match(/filename="?([^";]+)"?/)
    const filename = match?.[1] ?? `presupuesto-${versionId}.pdf`
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    return { success: true, filename }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
        <FileDown className="mr-2 h-4 w-4" />
        {t('export')}
      </Button>
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        title={`Presupuesto ${versionCode}`}
        columns={exportColumns}
        onExport={handleExport}
        showPdfOptions
      />
    </>
  )
}
