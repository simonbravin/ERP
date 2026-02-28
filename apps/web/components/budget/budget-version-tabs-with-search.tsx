'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MarkupConfiguration } from '@/components/budget/markup-configuration'
import { BudgetLinesCompactTable } from '@/components/budget/budget-lines-compact-table'
import { BudgetClientView } from '@/components/budget/budget-client-view'
import type { BudgetTreeNode } from '@/components/budget/budget-tree-table-admin'
import { reorderWBSItems } from '@/app/actions/wbs'
import { toast } from 'sonner'
import { Search, Eye, EyeOff } from 'lucide-react'

type VersionForTabs = {
  id: string
  markupMode: string
  globalOverheadPct: number
  globalFinancialPct: number
  globalProfitPct: number
  globalTaxPct: number
}

type SummaryLine = {
  code: string
  description: string
  unit: string
  quantity: number
  unitPrice: number
  total: number
  overheadPct: number
  financialPct: number
  profitPct: number
  taxPct: number
}

type BudgetVersionTabsWithSearchProps = {
  treeData: BudgetTreeNode[]
  version: VersionForTabs
  totalDirectCostNum: number
  summaryData: SummaryLine[]
  projectTotalSale: number
  canEdit: boolean
  canSeeAdmin: boolean
  projectId: string
  wbsTemplates: Array<{ id: string; name: string; code: string; unit: string; hasResources?: boolean }>
}

export function BudgetVersionTabsWithSearch({
  treeData,
  version,
  totalDirectCostNum,
  summaryData,
  projectTotalSale,
  canEdit,
  canSeeAdmin,
  projectId,
  wbsTemplates,
}: BudgetVersionTabsWithSearchProps) {
  const t = useTranslations('budget')
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<string>('breakdown')
  const [summaryViewMode, setSummaryViewMode] = useState<'admin' | 'client'>('client')

  async function handleReorder(parentId: string | null, orderedWbsNodeIds: string[]) {
    const result = await reorderWBSItems(projectId, parentId, orderedWbsNodeIds)
    if (result && 'error' in result) {
      toast.error(t('error'), { description: result.error })
      return
    }
    router.refresh()
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <TabsList className="inline-flex h-9 gap-1 rounded-lg border border-border bg-card p-1">
          <TabsTrigger value="breakdown" className="px-3 py-1.5 text-sm font-medium">
            {t('breakdownTab')}
          </TabsTrigger>
          <TabsTrigger value="totals" className="px-3 py-1.5 text-sm font-medium">
            {t('totalsTab')}
          </TabsTrigger>
          <TabsTrigger value="summary" className="px-3 py-1.5 text-sm font-medium">
            {t('summaryTab')}
          </TabsTrigger>
        </TabsList>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('searchByCodeOrDescription')}
            className="h-9 pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Planilla Final: note left, toggle right; admin = costos con desplegables, client = venta */}
      <TabsContent value="summary" className="mt-4 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <p className="text-sm text-muted-foreground">
            {t('planillaFinalNote')}
          </p>
          <div className="flex items-center gap-2">
            {canSeeAdmin && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-1">
                <Button
                  type="button"
                  variant={summaryViewMode === 'admin' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7"
                  onClick={() => setSummaryViewMode('admin')}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  {t('viewModeAdmin')}
                </Button>
                <Button
                  type="button"
                  variant={summaryViewMode === 'client' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7"
                  onClick={() => setSummaryViewMode('client')}
                >
                  <EyeOff className="mr-1 h-3 w-3" />
                  {t('viewModeClient')}
                </Button>
            </div>
          )}
          </div>
        </div>
        {summaryData.length === 0 && canSeeAdmin && summaryViewMode === 'admin' ? (
          <p className="text-sm text-muted-foreground">{t('noSummaryLinesInVersion')}</p>
        ) : canSeeAdmin && summaryViewMode === 'admin' ? (
          <>
            <BudgetLinesCompactTable
              data={treeData}
              versionId={version.id}
              projectId={projectId}
              canEdit={false}
              markupMode={version.markupMode}
              wbsTemplates={wbsTemplates}
              searchQuery={searchQuery}
              columnView="totals"
              projectTotalSale={projectTotalSale}
              onReorder={handleReorder}
              hideActions
            />
            {summaryData.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <p className="font-medium text-foreground">{t('grandTotal')}</p>
                <p className="mt-1 text-muted-foreground">
                  {t('totalSale', { defaultValue: 'Total venta' })}: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(projectTotalSale)}
                </p>
              </div>
            )}
          </>
        ) : (
          <BudgetClientView
            data={treeData}
            projectTotal={projectTotalSale}
            globalMarkups={{
              overheadPct: Number(version.globalOverheadPct),
              financialPct: Number(version.globalFinancialPct),
              profitPct: Number(version.globalProfitPct),
              taxPct: Number(version.globalTaxPct),
            }}
          />
        )}
      </TabsContent>

      <TabsContent value="totals" className="mt-4 space-y-6">
        <BudgetLinesCompactTable
          data={treeData}
          versionId={version.id}
          projectId={projectId}
          canEdit={canEdit}
          markupMode={version.markupMode}
          wbsTemplates={wbsTemplates}
          searchQuery={searchQuery}
          columnView="totals"
          projectTotalSale={projectTotalSale}
          onReorder={handleReorder}
        />
        <MarkupConfiguration
          versionId={version.id}
          currentMode={version.markupMode}
          currentMarkups={{
            overheadPct: Number(version.globalOverheadPct),
            financialPct: Number(version.globalFinancialPct),
            profitPct: Number(version.globalProfitPct),
            taxPct: Number(version.globalTaxPct),
          }}
          directCostTotal={totalDirectCostNum}
          canEdit={canEdit}
        />
      </TabsContent>

      <TabsContent value="breakdown" className="mt-4 space-y-6">
        <BudgetLinesCompactTable
          data={treeData}
          versionId={version.id}
          projectId={projectId}
          canEdit={canEdit}
          markupMode={version.markupMode}
          wbsTemplates={wbsTemplates}
          searchQuery={searchQuery}
          columnView="breakdown"
          projectTotalSale={projectTotalSale}
          onReorder={handleReorder}
        />
        <MarkupConfiguration
          versionId={version.id}
          currentMode={version.markupMode}
          currentMarkups={{
            overheadPct: Number(version.globalOverheadPct),
            financialPct: Number(version.globalFinancialPct),
            profitPct: Number(version.globalProfitPct),
            taxPct: Number(version.globalTaxPct),
          }}
          directCostTotal={totalDirectCostNum}
          canEdit={canEdit}
        />
      </TabsContent>
    </Tabs>
  )
}
