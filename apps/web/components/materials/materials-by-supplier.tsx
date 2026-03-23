'use client'

import { useState, useMemo, Fragment } from 'react'
import { useTranslations } from 'next-intl'
import { formatCurrency, formatNumber } from '@/lib/format-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ExportDialog } from '@/components/export/export-dialog'
import { toast } from 'sonner'
import { generatePurchaseOrder } from '@/app/actions/materials'
import { exportMaterialsBySupplierToExcel, exportAllMaterialsBySupplierToExcel } from '@/app/actions/export'
import { ChevronDown, ChevronRight, FileDown, FileText, Loader2, Search, List, Grid3x3 } from 'lucide-react'
import type { MaterialsBySupplier } from '@/lib/types/materials'

interface MaterialsBySupplierProps {
  suppliers: MaterialsBySupplier[]
  budgetVersionId: string
}

export function MaterialsBySupplierView({
  suppliers,
  budgetVersionId,
}: MaterialsBySupplierProps) {
  const t = useTranslations('materials')

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'supplier' | 'materials' | 'cost'>('supplier')
  const [sortOrder, _setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())
  const [generatingPO, setGeneratingPO] = useState<string | null>(null)
  const [exportingSupplier, setExportingSupplier] = useState<string | null>(null)
  const [showExportAllDialog, setShowExportAllDialog] = useState(false)

  const filteredSuppliers = useMemo(() => {
    let list = suppliers
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((s) => s.supplierName.toLowerCase().includes(q))
    }
    list = [...list].sort((a, b) => {
      let comparison = 0
      if (sortBy === 'supplier') comparison = a.supplierName.localeCompare(b.supplierName)
      else if (sortBy === 'materials') comparison = a.materials.length - b.materials.length
      else if (sortBy === 'cost') comparison = a.totalCost - b.totalCost
      return sortOrder === 'asc' ? comparison : -comparison
    })
    return list
  }, [suppliers, searchQuery, sortBy, sortOrder])

  const exportColumns = [
    { field: 'name', label: t('material'), defaultVisible: true },
    { field: 'unit', label: t('unit'), defaultVisible: true },
    { field: 'quantity', label: t('quantity'), defaultVisible: true },
    { field: 'unitCost', label: t('unitCost'), defaultVisible: true },
    { field: 'totalCost', label: t('totalCost'), defaultVisible: true },
  ]

  const exportAllColumns = [
    { field: 'supplier', label: t('supplier'), defaultVisible: true },
    { field: 'name', label: t('material'), defaultVisible: true },
    { field: 'unit', label: t('unit'), defaultVisible: true },
    { field: 'quantity', label: t('quantity'), defaultVisible: true },
    { field: 'unitCost', label: t('unitCost'), defaultVisible: true },
    { field: 'totalCost', label: t('totalCost'), defaultVisible: true },
  ]

  async function handleExportSupplier(
    format: 'excel' | 'pdf',
    selectedColumns: string[]
  ) {
    if (!exportingSupplier) return { success: false, error: 'No supplier selected' }
    if (format !== 'excel') {
      return { success: false, error: 'Solo exportación Excel disponible por proveedor' }
    }
    return await exportMaterialsBySupplierToExcel(
      budgetVersionId,
      exportingSupplier,
      selectedColumns
    )
  }

  function toggleSupplier(supplierName: string) {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev)
      if (next.has(supplierName)) next.delete(supplierName)
      else next.add(supplierName)
      return next
    })
  }

  function downloadExcel(base64: string, filename: string) {
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i)
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

  async function handleGeneratePO(supplierName: string) {
    setGeneratingPO(supplierName)
    try {
      const result = await generatePurchaseOrder(budgetVersionId, supplierName)
      if (result.success === true) {
        const exportResult = await exportMaterialsBySupplierToExcel(
          budgetVersionId,
          supplierName,
          ['name', 'unit', 'quantity', 'unitCost', 'totalCost']
        )
        if (exportResult.success && exportResult.data && exportResult.filename) {
          downloadExcel(exportResult.data, exportResult.filename)
          toast.success(t('poGenerated'), { description: t('poDownloadedDesc') })
        } else {
          toast.success(t('poGenerated'), { description: t('poGeneratedDesc') })
        }
      } else {
        toast.error(t('error'), { description: result.error ?? t('poGenerationError') })
      }
    } catch {
      toast.error(t('error'), { description: t('poGenerationError') })
    } finally {
      setGeneratingPO(null)
    }
  }

  async function handleExportAll(format: 'excel' | 'pdf', selectedColumns: string[]) {
    if (format !== 'excel') {
      return { success: false, error: 'Solo exportación Excel disponible' }
    }
    return await exportAllMaterialsBySupplierToExcel(budgetVersionId, selectedColumns)
  }

  const totalCost = filteredSuppliers.reduce((sum, s) => sum + s.totalCost, 0)
  const totalMaterialsCount = filteredSuppliers.reduce((sum, s) => sum + s.materials.length, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchBySupplier')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(v: 'supplier' | 'materials' | 'cost') => setSortBy(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="supplier">{t('sortBySupplierName')}</SelectItem>
            <SelectItem value="materials">{t('sortByMaterialsCount')}</SelectItem>
            <SelectItem value="cost">{t('sortByCost')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-8 px-3"
            >
              <List className="mr-1.5 h-4 w-4" />
              {t('viewTable')}
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8 px-3"
            >
              <Grid3x3 className="mr-1.5 h-4 w-4" />
              {t('viewCards')}
            </Button>
          </div>
          <Button variant="outline" onClick={() => setShowExportAllDialog(true)}>
            <FileDown className="mr-2 h-4 w-4" />
            {t('export')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('totalSuppliers')}</p>
          <p className="mt-1 text-2xl font-semibold">{filteredSuppliers.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('totalCost')}</p>
          <p className="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400">
            {formatCurrency(totalCost)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('totalMaterials')}</p>
          <p className="mt-1 text-2xl font-semibold">{totalMaterialsCount}</p>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSuppliers.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? t('noResultsFound') : t('noMaterialsYet')}
              </p>
            </div>
          ) : (
            filteredSuppliers.map((supplier) => (
              <div
                key={supplier.supplierName}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <p className="font-medium">{supplier.supplierName}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">{t('materials')}</span>
                  <span className="font-mono text-right tabular-nums">{supplier.materials.length}</span>
                  <span className="text-muted-foreground">{t('totalCost')}</span>
                  <span className="font-mono text-right font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                    {formatCurrency(supplier.totalCost)}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setExportingSupplier(supplier.supplierName)}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {t('export')}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1"
                    onClick={() => handleGeneratePO(supplier.supplierName)}
                    disabled={generatingPO === supplier.supplierName}
                  >
                    {generatingPO === supplier.supplierName ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    {t('generatePO')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead className="w-[300px]">{t('supplier')}</TableHead>
                <TableHead className="w-[120px] text-right">{t('materials')}</TableHead>
                <TableHead className="w-[140px] text-right">{t('totalCost')}</TableHead>
                <TableHead className="w-[150px]">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => {
              const isExpanded = expandedSuppliers.has(supplier.supplierName)
              const isGenerating = generatingPO === supplier.supplierName
              return (
                <Fragment key={supplier.supplierName}>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell className="w-[40px]">
                      <button
                        type="button"
                        className="rounded p-1 hover:bg-muted"
                        onClick={() => toggleSupplier(supplier.supplierName)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="w-[300px]">
                      <p className="font-medium">{supplier.supplierName}</p>
                    </TableCell>
                    <TableCell className="w-[120px] text-right">
                      <span className="font-mono text-sm tabular-nums">
                        {supplier.materials.length}
                      </span>
                    </TableCell>
                    <TableCell className="w-[140px] text-right">
                      <span className="font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                        {formatCurrency(supplier.totalCost)}
                      </span>
                    </TableCell>
                    <TableCell className="w-[150px]">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExportingSupplier(supplier.supplierName)}
                        >
                          <FileDown className="mr-2 h-4 w-4" />
                          {t('export')}
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleGeneratePO(supplier.supplierName)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          {t('generatePO')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/30 p-0">
                        <div className="p-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[280px]">{t('material')}</TableHead>
                                <TableHead className="w-[140px] text-right">{t('quantity')}</TableHead>
                                <TableHead className="w-[120px] text-right">{t('unitCost')}</TableHead>
                                <TableHead className="w-[120px] text-right">{t('totalCost')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {supplier.materials.map((material, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="w-[280px] text-sm">{material.name}</TableCell>
                                  <TableCell className="w-[140px] text-right text-sm">
                                    <span className="font-mono tabular-nums">
                                      {formatNumber(material.quantity)} {material.unit}
                                    </span>
                                  </TableCell>
                                  <TableCell className="w-[120px] text-right text-sm">
                                    <span className="font-mono tabular-nums">
                                      {formatCurrency(material.unitCost)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="w-[120px] text-right text-sm">
                                    <span className="font-mono font-medium tabular-nums">
                                      {formatCurrency(material.totalCost)}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
      )}

      {exportingSupplier && (
        <ExportDialog
          open={!!exportingSupplier}
          onOpenChange={(open) => !open && setExportingSupplier(null)}
          title={`${t('material')} - ${exportingSupplier}`}
          columns={exportColumns}
          onExport={handleExportSupplier}
        />
      )}

      {showExportAllDialog && (
        <ExportDialog
          open={showExportAllDialog}
          onOpenChange={setShowExportAllDialog}
          title={t('tabBySupplier')}
          columns={exportAllColumns}
          onExport={handleExportAll}
        />
      )}
    </div>
  )
}
