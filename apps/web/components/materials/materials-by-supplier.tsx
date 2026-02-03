'use client'

import { useState, Fragment } from 'react'
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
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { generatePurchaseOrder } from '@/app/actions/materials'
import { ChevronDown, ChevronRight, FileText, Loader2 } from 'lucide-react'
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

  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())
  const [generatingPO, setGeneratingPO] = useState<string | null>(null)

  function toggleSupplier(supplierName: string) {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev)
      if (next.has(supplierName)) next.delete(supplierName)
      else next.add(supplierName)
      return next
    })
  }

  async function handleGeneratePO(supplierName: string) {
    setGeneratingPO(supplierName)
    try {
      const result = await generatePurchaseOrder(budgetVersionId, supplierName)
      if (result.success) {
        toast.success(t('poGenerated'), { description: t('poGeneratedDesc') })
      } else {
        toast.error(t('error'), { description: result.error ?? t('poGenerationError') })
      }
    } catch {
      toast.error(t('error'), { description: t('poGenerationError') })
    } finally {
      setGeneratingPO(null)
    }
  }

  const totalCost = suppliers.reduce((sum, s) => sum + s.totalCost, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('totalSuppliers')}</p>
          <p className="mt-1 text-2xl font-semibold">{suppliers.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('totalCost')}</p>
          <p className="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400">
            {formatCurrency(totalCost)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead className="w-[250px]">{t('supplier')}</TableHead>
              <TableHead className="w-[120px] text-right">{t('materials')}</TableHead>
              <TableHead className="w-[140px] text-right">{t('totalCost')}</TableHead>
              <TableHead className="w-[150px]">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => {
              const isExpanded = expandedSuppliers.has(supplier.supplierName)
              const isGenerating = generatingPO === supplier.supplierName
              return (
                <Fragment key={supplier.supplierName}>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell>
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
                    <TableCell>
                      <p className="font-medium">{supplier.supplierName}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm tabular-nums">
                        {supplier.materials.length}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                        {formatCurrency(supplier.totalCost)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
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
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/30 p-0">
                        <div className="p-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t('material')}</TableHead>
                                <TableHead className="text-right">{t('quantity')}</TableHead>
                                <TableHead className="text-right">{t('unitCost')}</TableHead>
                                <TableHead className="text-right">{t('totalCost')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {supplier.materials.map((material, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="text-sm">{material.name}</TableCell>
                                  <TableCell className="text-right text-sm">
                                    <span className="font-mono tabular-nums">
                                      {formatNumber(material.quantity)} {material.unit}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    <span className="font-mono tabular-nums">
                                      {formatCurrency(material.unitCost)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
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
    </div>
  )
}
