'use client'

import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Filter } from 'lucide-react'

interface GanttControlPanelProps {
  groupBy: 'none' | 'phase' | 'assigned'
  onGroupByChange: (groupBy: 'none' | 'phase' | 'assigned') => void
  weekStartsOn?: 0 | 1
  onWeekStartsOnChange?: (value: 0 | 1) => void
  /** Sin borde de tarjeta: dentro de la tarjeta del cronograma. */
  embedded?: boolean
}

/**
 * Opciones que siguen siendo propias de Bloqer (agrupación / inicio de semana).
 * La ruta crítica, dependencias, progreso y marcadores los maneja SVAR con datos del servidor.
 */
export function GanttControlPanel({
  groupBy,
  onGroupByChange,
  weekStartsOn = 1,
  onWeekStartsOnChange,
  embedded = false,
}: GanttControlPanelProps) {
  const t = useTranslations('schedule')

  return (
    <div className={embedded ? 'pt-1' : 'erp-card p-4 sm:p-5'}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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

        {onWeekStartsOnChange && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              {t('weekStartsOn')}
            </Label>
            <Select
              value={String(weekStartsOn)}
              onValueChange={(v) => onWeekStartsOnChange(v === '0' ? 0 : 1)}
            >
              <SelectTrigger className="h-10 w-full sm:max-w-[220px]">
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
    </div>
  )
}
