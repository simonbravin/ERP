'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ExportDialog } from '@/components/export/export-dialog'
import { formatCurrency } from '@/lib/format-utils'
import { FileDown, Loader2 } from 'lucide-react'
import { getPartiesForOrg } from '@/app/actions/export-purchases'

interface PurchasesBySupplierReportProps {
  orgId: string
}

interface PurchaseRow {
  project: string
  projectNumber: string
  material: string
  quantity: number
  unit: string
  unitCost: number
  totalCost: number
}

export function PurchasesBySupplierReport({ orgId }: PurchasesBySupplierReportProps) {
  const t = useTranslations('reports')

  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<string>('')
  const [data, setData] = useState<PurchaseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  useEffect(() => {
    async function loadSuppliers() {
      try {
        const list = await getPartiesForOrg(orgId)
        setSuppliers(list)
      } catch {
        setSuppliers([])
      }
    }
    loadSuppliers()
  }, [orgId])

  async function loadReport() {
    if (!selectedSupplier) return
    setLoading(true)
    try {
      const { getPurchasesBySupplierReport } = await import('@/app/actions/export-purchases')
      const rows = await getPurchasesBySupplierReport(orgId, selectedSupplier)
      setData(rows)
    } catch (error) {
      console.error('Error loading report:', error)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const totalCost = data.reduce((sum, item) => sum + item.totalCost, 0)
  const supplierName = suppliers.find((s) => s.id === selectedSupplier)?.name ?? selectedSupplier

  const exportColumns = [
    { field: 'project', label: 'Proyecto', defaultVisible: true },
    { field: 'projectNumber', label: 'Nro. Proyecto', defaultVisible: true },
    { field: 'material', label: 'Material', defaultVisible: true },
    { field: 'quantity', label: 'Cantidad', defaultVisible: true },
    { field: 'unit', label: 'Unidad', defaultVisible: true },
    { field: 'unitCost', label: 'Costo Unitario', defaultVisible: true },
    { field: 'totalCost', label: 'Costo Total', defaultVisible: true },
  ]

  async function handleExport(format: 'excel' | 'pdf', selectedColumns: string[]) {
    const { exportPurchasesBySupplierToExcel, exportPurchasesBySupplierToPDF } = await import(
      '@/app/actions/export-purchases'
    )
    if (format === 'excel') {
      return await exportPurchasesBySupplierToExcel(orgId, selectedSupplier, selectedColumns, data)
    }
    return await exportPurchasesBySupplierToPDF(orgId, selectedSupplier, selectedColumns, data)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('configReport')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="supplier">{t('supplier')}</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger id="supplier" className="mt-1">
                  <SelectValue placeholder={t('selectSupplier')} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={loadReport} disabled={!selectedSupplier || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('generateReport')}
              </>
            ) : (
              t('generateReport')
            )}
          </Button>
        </CardContent>
      </Card>

      {data.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('results')}</CardTitle>
              <Button variant="outline" onClick={() => setShowExportDialog(true)}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {t('totalPurchases')} {supplierName}:
              </p>
              <p className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-100">
                {formatCurrency(totalCost)}
              </p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">P. Unit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.project}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.projectNumber}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{item.material}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.quantity} {item.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.unitCost)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(item.totalCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        title={`${t('totalPurchases')} ${supplierName}`}
        columns={exportColumns}
        onExport={handleExport}
      />
    </>
  )
}
