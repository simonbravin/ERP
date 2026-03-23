'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp,
  GitBranch,
  Download,
  Eye,
  Filter,
  FileSpreadsheet,
} from 'lucide-react'

interface GanttControlPanelProps {
  showCriticalPath: boolean
  onShowCriticalPathChange: (show: boolean) => void
  showBaseline: boolean
  onShowBaselineChange: (show: boolean) => void
  baselineOverlayAvailable: boolean
  showProgress: boolean
  onShowProgressChange: (show: boolean) => void
  showDependencies: boolean
  onShowDependenciesChange: (show: boolean) => void
  groupBy: 'none' | 'phase' | 'assigned'
  onGroupByChange: (groupBy: 'none' | 'phase' | 'assigned') => void
  weekStartsOn?: 0 | 1
  onWeekStartsOnChange?: (value: 0 | 1) => void
  onExportPDF: () => void
  onExportPDFView: () => void
  exportingPDFView?: boolean
  onExportExcel: () => void
  exportingExcel?: boolean
}

export function GanttControlPanel({
  showCriticalPath,
  onShowCriticalPathChange,
  showBaseline,
  onShowBaselineChange,
  baselineOverlayAvailable,
  showProgress,
  onShowProgressChange,
  showDependencies,
  onShowDependenciesChange,
  groupBy,
  onGroupByChange,
  weekStartsOn = 1,
  onWeekStartsOnChange,
  onExportPDF,
  onExportPDFView,
  exportingPDFView = false,
  onExportExcel,
  exportingExcel = false,
}: GanttControlPanelProps) {
  const t = useTranslations('schedule')

  return (
    <Card>
      <CardContent className="p-2">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('display')}</Label>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-600" />
                <span className="text-sm">{t('criticalPath')}</span>
              </div>
              <Switch
                checked={showCriticalPath}
                onCheckedChange={onShowCriticalPathChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-slate-600" />
                <span className="text-sm">{t('dependencies')}</span>
              </div>
              <Switch
                checked={showDependencies}
                onCheckedChange={onShowDependenciesChange}
              />
            </div>
            {onWeekStartsOnChange && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">{t('weekStartsOn')}</span>
                <Select
                  value={String(weekStartsOn)}
                  onValueChange={(v) => onWeekStartsOnChange(v === '0' ? 0 : 1)}
                >
                  <SelectTrigger className="h-8 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('weekStartMonday')}</SelectItem>
                    <SelectItem value="0">{t('weekStartSunday')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('tracking')}</Label>
            <div
              className="flex items-center justify-between"
              title={
                baselineOverlayAvailable ? undefined : t('baselineUnavailableHint')
              }
            >
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-600" />
                <span className="text-sm">{t('baseline')}</span>
              </div>
              <Switch
                checked={showBaseline}
                onCheckedChange={onShowBaselineChange}
                disabled={!baselineOverlayAvailable}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm">{t('progress')}</span>
              </div>
              <Switch
                checked={showProgress}
                onCheckedChange={onShowProgressChange}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('actions')}</Label>
            <div className="space-y-2">
              <Select
                value={groupBy}
                onValueChange={(v) =>
                  onGroupByChange(v as 'none' | 'phase' | 'assigned')
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <Filter className="h-3 w-3" />
                      {groupBy === 'none' && t('noGrouping')}
                      {groupBy === 'phase' && t('groupByPhase')}
                      {groupBy === 'assigned' && t('groupByAssigned')}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noGrouping')}</SelectItem>
                  <SelectItem value="phase">{t('groupByPhase')}</SelectItem>
                  <SelectItem value="assigned">
                    {t('groupByAssigned')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={onExportPDF}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                {t('exportPDF')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onExportPDFView}
                disabled={exportingPDFView}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                {exportingPDFView ? t('exporting') : t('exportPDFView')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onExportExcel}
                disabled={exportingExcel}
                className="w-full"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {exportingExcel ? t('exportingExcel') : t('exportExcel')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
