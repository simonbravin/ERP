'use client'

import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TrendingUp, GitBranch, Eye, Filter, Calendar } from 'lucide-react'

interface GanttControlPanelProps {
  showCriticalPath: boolean
  onShowCriticalPathChange: (show: boolean) => void
  showBaseline: boolean
  onShowBaselineChange: (show: boolean) => void
  baselineOverlayAvailable: boolean
  /** When false, the baseline toggle is disabled (e.g. calendar view: comparison only in Gantt). */
  baselineChartOverlaySupported?: boolean
  showProgress: boolean
  onShowProgressChange: (show: boolean) => void
  showDependencies: boolean
  onShowDependenciesChange: (show: boolean) => void
  /** Línea "hoy" en el Gantt (SVAR). */
  showTodayLine: boolean
  onShowTodayLineChange: (show: boolean) => void
  /** Ocultar interruptor de hoy cuando la vista activa no es Gantt. */
  todayLineApplicable?: boolean
  groupBy: 'none' | 'phase' | 'assigned'
  onGroupByChange: (groupBy: 'none' | 'phase' | 'assigned') => void
  weekStartsOn?: 0 | 1
  onWeekStartsOnChange?: (value: 0 | 1) => void
}

export function GanttControlPanel({
  showCriticalPath,
  onShowCriticalPathChange,
  showBaseline,
  onShowBaselineChange,
  baselineOverlayAvailable,
  baselineChartOverlaySupported = true,
  showProgress,
  onShowProgressChange,
  showDependencies,
  onShowDependenciesChange,
  showTodayLine,
  onShowTodayLineChange,
  todayLineApplicable = true,
  groupBy,
  onGroupByChange,
  weekStartsOn = 1,
  onWeekStartsOnChange,
}: GanttControlPanelProps) {
  const t = useTranslations('schedule')
  const baselineToggleDisabled =
    !baselineOverlayAvailable || !baselineChartOverlaySupported
  const baselineToggleTitle = !baselineOverlayAvailable
    ? t('baselineUnavailableHint')
    : !baselineChartOverlaySupported
      ? t('baselineGanttViewOnly')
      : undefined

  return (
    <div className="erp-card p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                {t('display')}
              </Label>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-foreground">{t('criticalPath')}</span>
                </div>
                <Switch
                  checked={showCriticalPath}
                  onCheckedChange={onShowCriticalPathChange}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{t('dependencies')}</span>
                </div>
                <Switch
                  checked={showDependencies}
                  onCheckedChange={onShowDependenciesChange}
                />
              </div>
              {todayLineApplicable && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{t('todayLineToggle')}</span>
                  </div>
                  <Switch
                    checked={showTodayLine}
                    onCheckedChange={onShowTodayLineChange}
                  />
                </div>
              )}
              {onWeekStartsOnChange && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-foreground">{t('weekStartsOn')}</span>
                  <Select
                    value={String(weekStartsOn)}
                    onValueChange={(v) => onWeekStartsOnChange(v === '0' ? 0 : 1)}
                  >
                    <SelectTrigger className="h-10 w-full sm:w-[140px]">
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
              <Label className="text-sm font-medium text-foreground">
                {t('tracking')}
              </Label>
              <div
                className="flex items-center justify-between gap-3"
                title={baselineToggleTitle}
              >
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground">{t('baseline')}</span>
                </div>
                <Switch
                  checked={showBaseline}
                  onCheckedChange={onShowBaselineChange}
                  disabled={baselineToggleDisabled}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm text-foreground">{t('progress')}</span>
                </div>
                <Switch
                  checked={showProgress}
                  onCheckedChange={onShowProgressChange}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                {t('groupingLabel')}
              </Label>
              <Select
                value={groupBy}
                onValueChange={(v) =>
                  onGroupByChange(v as 'none' | 'phase' | 'assigned')
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <Filter className="h-3.5 w-3.5 shrink-0" />
                      {groupBy === 'none' && t('noGrouping')}
                      {groupBy === 'phase' && t('groupByPhase')}
                      {groupBy === 'assigned' && t('groupByAssigned')}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noGrouping')}</SelectItem>
                  <SelectItem value="phase">{t('groupByPhase')}</SelectItem>
                  <SelectItem value="assigned">{t('groupByAssigned')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
    </div>
  )
}
