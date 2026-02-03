'use client'

import { useState, useMemo } from 'react'
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
import { Search, ChevronDown, ChevronRight, FileDown } from 'lucide-react'
import { ExportDialog } from '@/components/export/export-dialog'
import { exportMaterialsToExcel, exportMaterialsToPDF } from '@/app/actions/export'
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
    return await exportMaterialsToPDF(budgetVersionId, selectedColumns)
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'cost'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set())

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
        <Button variant="outline" onClick={() => setShowExportDialog(true)}>
          <FileDown className="mr-2 h-4 w-4" />
          {t('export')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('totalMaterials')}</p>
          <p className="mt-1 text-2xl font-semibold">{materials.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('totalCost')}</p>
          <p className="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400">
            {formatCurrency(totalCost)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('suppliers')}</p>
          <p className="mt-1 text-2xl font-semibold">{supplierCount}</p>
        </div>
      </div>

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMaterials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {searchQuery ? t('noResultsFound') : t('noMaterialsYet')}
                </TableCell>
              </TableRow>
            ) : (
              filteredMaterials.map((material) => {
                const isExpanded = expandedMaterials.has(material.name)
                return (
                  <tbody key={material.name} className="[&>tr]:border-b">
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
                      <TableCell>
                        <div>
                          <p className="font-medium">{material.name}</p>
                          {material.description && (
                            <p className="text-xs text-muted-foreground">{material.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-muted-foreground">{material.unit}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-sm font-medium tabular-nums">
                          {formatNumber(material.totalQuantity)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-sm tabular-nums">
                          {formatCurrency(material.averageUnitCost)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                          {formatCurrency(material.totalCost)}
                        </span>
                      </TableCell>
                      <TableCell>
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
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
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
                                          <span className="font-mono tabular-nums text-muted-foreground">
                                            @ {formatCurrency(supplier.unitCost)}
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
                  </tbody>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

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
