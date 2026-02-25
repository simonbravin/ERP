'use client'

import { useState, useMemo, Fragment } from 'react'
import { useTranslations } from 'next-intl'
import { formatCurrency, formatCurrencyForDisplay, formatNumber } from '@/lib/format-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, ChevronDown, ChevronRight, FileDown, List, Grid3x3, FileText, Loader2 } from 'lucide-react'
import { ExportDialog } from '@/components/export/export-dialog'
import { exportMaterialsToExcel, exportMaterialsBySupplierToExcel } from '@/app/actions/export'
import { generatePurchaseOrder } from '@/app/actions/materials'
import { toast } from 'sonner'
import type { ConsolidatedMaterial } from '@/lib/types/materials'

interface ConsolidatedMaterialsTableProps {
  materials: ConsolidatedMaterial[]
  budgetVersionId: string
  onExport?: () => void
}

export function ConsolidatedMaterialsTable({
  materials,
  budgetVersionId,
  onExport,
}: ConsolidatedMaterialsTableProps) {
  const t = useTranslations('materials')
  const [showExportDialog, setShowExportDialog] = useState(false)

  const exportColumns = [
    { field: 'name', label: t('material'), defaultVisible: true },
    { field: 'description', label: t('description'), defaultVisible: true },
    { field: 'unit', label: t('unit'), defaultVisible: true },
    { field: 'totalQuantity', label: t('totalQuantity'), defaultVisible: true },
    { field: 'averageUnitCost', label: t('avgUnitCost'), defaultVisible: true },
    { field: 'totalCost', label: t('totalCost'), defaultVisible: true },
  ]

  async function handleExport(format: 'excel' | 'pdf', selectedColumns: string[]) {
    if (format === 'excel') {
      return await exportMaterialsToExcel(budgetVersionId, selectedColumns)
    }
    const locale = typeof window !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
    const url = `/api/pdf?template=materials&id=${encodeURIComponent(budgetVersionId)}&locale=${encodeURIComponent(locale)}`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, error: data?.error ?? 'No se pudo generar el PDF' }
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition')
    const match = disposition?.match(/filename="?([^";]+)"?/)
    const filename = match?.[1] ?? `materiales-${budgetVersionId}.pdf`
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    return { success: true, filename }
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'cost'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [generatingPO, setGeneratingPO] = useState<string | null>(null)

  const filteredMaterials = useMemo(() => {
    let filtered = materials
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          (m.description?.toLowerCase() ?? '').includes(query)
      )
    }
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0
      if (sortBy === 'name') comparison = a.name.localeCompare(b.name)
      else if (sortBy === 'quantity') comparison = a.totalQuantity - b.totalQuantity
      else if (sortBy === 'cost') comparison = a.totalCost - b.totalCost
      return sortOrder === 'asc' ? comparison : -comparison
    })
    return filtered
  }, [materials, searchQuery, sortBy, sortOrder])

  const totalCost = materials.reduce((sum, m) => sum + m.totalCost, 0)
  const supplierCount = new Set(materials.flatMap((m) => m.suppliers.map((s) => s.name))).size

  function toggleMaterial(materialName: string) {
    setExpandedMaterials((prev) => {
      const next = new Set(prev)
      if (next.has(materialName)) next.delete(materialName)
      else next.add(materialName)
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
      if (result.success) {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchMaterials')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(v: 'name' | 'quantity' | 'cost') => setSortBy(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{t('sortByName')}</SelectItem>
            <SelectItem value="quantity">{t('sortByQuantity')}</SelectItem>
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
          <Button variant="outline" onClick={() => setShowExportDialog(true)}>
            <FileDown className="mr-2 h-4 w-4" />
            {t('export')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('totalMaterials')}</p>
          <p className="mt-1 text-2xl font-semibold">{materials.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('totalCost')}</p>
          <p className="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400 erp-kpi-value">
            {formatCurrencyForDisplay(totalCost)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('suppliers')}</p>
          <p className="mt-1 text-2xl font-semibold">{supplierCount}</p>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMaterials.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? t('noResultsFound') : t('noMaterialsYet')}
              </p>
            </div>
          ) : (
            filteredMaterials.map((material) => (
              <div
                key={material.name}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <p className="font-medium">{material.name}</p>
                {material.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{material.description}</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">{t('unit')}</span>
                  <span className="font-mono text-right">{material.unit}</span>
                  <span className="text-muted-foreground">{t('totalQuantity')}</span>
                  <span className="font-mono text-right tabular-nums">{formatNumber(material.totalQuantity)}</span>
                  <span className="text-muted-foreground">{t('avgUnitCost')}</span>
                  <span className="font-mono text-right tabular-nums">{formatCurrency(material.averageUnitCost)}</span>
                  <span className="text-muted-foreground">{t('totalCost')}</span>
                  <span className="font-mono text-right font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                    {formatCurrency(material.totalCost)}
                  </span>
                </div>
                {material.suppliers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {material.suppliers.slice(0, 3).map((supplier, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {supplier.name}
                      </Badge>
                    ))}
                    {material.suppliers.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{material.suppliers.length - 3}</Badge>
                    )}
                  </div>
                )}
                {material.suppliers.length > 0 && (
                  <div className="mt-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="default" className="w-full">
                          {generatingPO ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          {t('generatePO')}
                          <ChevronDown className="ml-1 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                        {material.suppliers.map((supplier, idx) => (
                          <DropdownMenuItem
                            key={idx}
                            onClick={() => handleGeneratePO(supplier.name)}
                            disabled={generatingPO === supplier.name}
                          >
                            {generatingPO === supplier.name ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="mr-2 h-4 w-4" />
                            )}
                            {t('generatePOFor')} {supplier.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
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
                <TableHead className="w-[300px]">{t('material')}</TableHead>
                <TableHead className="w-[80px]">{t('unit')}</TableHead>
                <TableHead className="w-[120px] text-right">{t('totalQuantity')}</TableHead>
                <TableHead className="w-[120px] text-right">{t('avgUnitCost')}</TableHead>
                <TableHead className="w-[140px] text-right">{t('totalCost')}</TableHead>
                <TableHead className="w-[150px]">{t('suppliers')}</TableHead>
                <TableHead className="w-[160px]">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    {searchQuery ? t('noResultsFound') : t('noMaterialsYet')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMaterials.map((material) => {
                  const isExpanded = expandedMaterials.has(material.name)
                  return (
                    <Fragment key={material.name}>
                      <TableRow
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleMaterial(material.name)}
                      >
                        <TableCell className="w-[40px]">
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleMaterial(material.name)
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="w-[300px]">
                          <div>
                            <p className="font-medium">{material.name}</p>
                            {material.description && (
                              <p className="text-xs text-muted-foreground">{material.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="w-[80px]">
                          <span className="font-mono text-sm text-muted-foreground">{material.unit}</span>
                        </TableCell>
                        <TableCell className="w-[120px] text-right">
                          <span className="font-mono text-sm font-medium tabular-nums">
                            {formatNumber(material.totalQuantity)}
                          </span>
                        </TableCell>
                        <TableCell className="erp-table-cell-currency w-[120px]">
                          <span className="font-mono text-sm">
                            {formatCurrencyForDisplay(material.averageUnitCost)}
                          </span>
                        </TableCell>
                        <TableCell className="erp-table-cell-currency w-[140px]">
                          <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {formatCurrencyForDisplay(material.totalCost)}
                          </span>
                        </TableCell>
                        <TableCell className="w-[150px]">
                          <div className="flex flex-wrap gap-1">
                            {material.suppliers.slice(0, 2).map((supplier, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {supplier.name}
                              </Badge>
                            ))}
                            {material.suppliers.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{material.suppliers.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="w-[160px]" onClick={(e) => e.stopPropagation()}>
                          {material.suppliers.length > 0 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="default">
                                  {generatingPO ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <FileText className="mr-2 h-4 w-4" />
                                  )}
                                  {t('generatePO')}
                                  <ChevronDown className="ml-1 h-4 w-4 shrink-0" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {material.suppliers.map((supplier, idx) => (
                                  <DropdownMenuItem
                                    key={idx}
                                    onClick={() => handleGeneratePO(supplier.name)}
                                    disabled={generatingPO === supplier.name}
                                  >
                                    {generatingPO === supplier.name ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <FileText className="mr-2 h-4 w-4" />
                                    )}
                                    {t('generatePOFor')} {supplier.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30 p-0">
                            <div className="p-4">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                  <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                                    {t('usedIn')}:
                                  </h4>
                                  <div className="space-y-1">
                                    {material.usedInItems.map((item, idx) => (
                                      <div
                                        key={idx}
                                        className="flex justify-between text-sm"
                                      >
                                        <span className="text-muted-foreground">
                                          {item.wbsCode} - {item.wbsName}
                                        </span>
                                        <span className="font-mono tabular-nums">
                                          {formatNumber(item.quantity)} {material.unit}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {material.suppliers.length > 0 && (
                                  <div>
                                    <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                                      {t('suppliers')}:
                                    </h4>
                                    <div className="space-y-1">
                                      {material.suppliers.map((supplier, idx) => (
                                        <div
                                          key={idx}
                                          className="flex justify-between text-sm"
                                        >
                                          <span className="text-muted-foreground">{supplier.name}</span>
                                          <div className="flex gap-2">
                                            <span className="font-mono tabular-nums">
                                              {formatNumber(supplier.quantity)} {material.unit}
                                            </span>
                                            <span className="font-mono tabular-nums text-muted-foreground erp-kpi-value">
                                              @ {formatCurrencyForDisplay(supplier.unitCost)}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        title={t('title')}
        columns={exportColumns}
        onExport={handleExport}
      />
    </div>
  )
}
