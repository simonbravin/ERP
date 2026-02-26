'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { FileSpreadsheet, FileText, Loader2, Download } from 'lucide-react'

interface ExportColumn {
  field: string
  label: string
  defaultVisible?: boolean
}

export type ExportPdfOptions = {
  showEmitidoPor: boolean
  showFullCompanyData: boolean
}

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  columns: ExportColumn[]
  onExport: (format: 'excel' | 'pdf', selectedColumns: string[], pdfOptions?: ExportPdfOptions) => Promise<{
    success: boolean
    data?: string
    filename?: string
    error?: string
  }>
  /** When true, show PDF-specific checkboxes (Emitido por, Datos empresa) when PDF tab is selected */
  showPdfOptions?: boolean
}

export function ExportDialog({
  open,
  onOpenChange,
  title,
  columns,
  onExport,
  showPdfOptions = false,
}: ExportDialogProps) {
  const t = useTranslations('export')
  const [isPending, startTransition] = useTransition()

  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(columns.filter((col) => col.defaultVisible !== false).map((col) => col.field))
  )
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel')
  const [pdfShowEmitidoPor, setPdfShowEmitidoPor] = useState(true)
  const [pdfShowFullCompanyData, setPdfShowFullCompanyData] = useState(true)

  function toggleColumn(field: string) {
    const newSelected = new Set(selectedColumns)
    if (newSelected.has(field)) {
      newSelected.delete(field)
    } else {
      newSelected.add(field)
    }
    setSelectedColumns(newSelected)
  }

  function selectAll() {
    setSelectedColumns(new Set(columns.map((col) => col.field)))
  }

  function selectNone() {
    setSelectedColumns(new Set())
  }

  async function handleExport() {
    if (selectedColumns.size === 0) {
      toast.error(t('selectAtLeastOneColumn'))
      return
    }

    startTransition(async () => {
      try {
        const pdfOptions =
          exportFormat === 'pdf' && showPdfOptions
            ? { showEmitidoPor: pdfShowEmitidoPor, showFullCompanyData: pdfShowFullCompanyData }
            : undefined
        const result = await onExport(exportFormat, Array.from(selectedColumns), pdfOptions)

        if (result.success && result.data && result.filename) {
          downloadFile(result.data, result.filename, exportFormat)
          toast.success(t('fileDownloaded'))
          onOpenChange(false)
        } else if (result.success && result.filename) {
          // PDF (or other) already triggered download in onExport
          toast.success(t('fileDownloaded'))
          onOpenChange(false)
        } else {
          toast.error(result.error ?? t('exportError'))
        }
      } catch {
        toast.error(t('exportError'))
      }
    })
  }

  function downloadFile(base64: string, filename: string, format: 'excel' | 'pdf') {
    const mimeType =
      format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf'

    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: mimeType })

    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl min-w-[min(28rem,95vw)]">
        <DialogHeader>
          <DialogTitle>{t('exportTitle')}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <Tabs value={exportFormat} onValueChange={(v) => setExportFormat(v as 'excel' | 'pdf')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="excel">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </TabsTrigger>
            <TabsTrigger value="pdf">
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="excel" className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                El archivo Excel incluirá datos de la empresa en el header y permitirá filtrado y
                ordenamiento.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="pdf" className="space-y-4">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950/30">
              <p className="text-sm text-purple-900 dark:text-purple-100">
                El PDF incluirá logo y datos de la empresa con formato profesional.
              </p>
            </div>
            {showPdfOptions && (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium text-foreground">{t('pdfOptions', { defaultValue: 'Opciones del PDF' })}</p>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pdf-show-emitido"
                      checked={pdfShowEmitidoPor}
                      onCheckedChange={(v) => setPdfShowEmitidoPor(v === true)}
                    />
                    <Label htmlFor="pdf-show-emitido" className="cursor-pointer text-sm font-normal">
                      {t('pdfShowEmitidoPor', { defaultValue: "Incluir 'Emitido por'" })}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pdf-full-company"
                      checked={pdfShowFullCompanyData}
                      onCheckedChange={(v) => setPdfShowFullCompanyData(v === true)}
                    />
                    <Label htmlFor="pdf-full-company" className="cursor-pointer text-sm font-normal">
                      {t('pdfFullCompanyData', { defaultValue: 'Datos completos de la empresa (solo nombre si se desmarca)' })}
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">{t('selectColumns')}</Label>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                {t('selectAll')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={selectNone}>
                {t('selectNone')}
              </Button>
            </div>
          </div>

          <div className="grid max-h-64 grid-cols-2 gap-3 overflow-y-auto rounded-lg border border-border bg-muted/50 p-4">
            {columns.map((column) => (
              <div key={column.field} className="flex items-center space-x-2">
                <Checkbox
                  id={column.field}
                  checked={selectedColumns.has(column.field)}
                  onCheckedChange={() => toggleColumn(column.field)}
                />
                <Label
                  htmlFor={column.field}
                  className="cursor-pointer text-sm font-normal"
                >
                  {column.label}
                </Label>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {selectedColumns.size} de {columns.length} columnas seleccionadas
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={handleExport} disabled={isPending || selectedColumns.size === 0}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('exporting')}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {t('export')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
