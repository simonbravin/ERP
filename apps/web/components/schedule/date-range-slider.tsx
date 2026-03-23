'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'
import { format, addDays, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

/** Parse yyyy-MM-dd as local calendar day (avoids UTC shift from `new Date('yyyy-MM-dd')`). */
function parseLocalDateInput(ymd: string): Date {
  const parts = ymd.split('-').map((x) => parseInt(x, 10))
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return startOfDay(new Date())
  return startOfDay(new Date(y, m - 1, d))
}

interface DateRangeSliderProps {
  projectStartDate: Date
  projectEndDate: Date
  currentStartDate: Date
  currentEndDate: Date
  onRangeChange: (startDate: Date, endDate: Date) => void
}

export function DateRangeSlider({
  projectStartDate,
  projectEndDate,
  currentStartDate,
  currentEndDate,
  onRangeChange,
}: DateRangeSliderProps) {
  const t = useTranslations('schedule')

  const [rangeStart, setRangeStart] = useState(
    format(currentStartDate, 'yyyy-MM-dd')
  )
  const [rangeEnd, setRangeEnd] = useState(
    format(currentEndDate, 'yyyy-MM-dd')
  )
  const [daysToShow, setDaysToShow] = useState(
    Math.ceil(
      (currentEndDate.getTime() - currentStartDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  )

  useEffect(() => {
    setRangeStart(format(currentStartDate, 'yyyy-MM-dd'))
    setRangeEnd(format(currentEndDate, 'yyyy-MM-dd'))
    setDaysToShow(
      Math.ceil(
        (currentEndDate.getTime() - currentStartDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    )
  }, [currentStartDate, currentEndDate])

  function handleDaysChange(days: number) {
    const newDays = Math.max(5, Math.min(365, days))
    setDaysToShow(newDays)

    const start = new Date(rangeStart)
    const end = addDays(start, newDays)

    setRangeEnd(format(end, 'yyyy-MM-dd'))
    onRangeChange(start, end)
  }

  function handleStartChange(newStart: string) {
    setRangeStart(newStart)

    const start = new Date(newStart)
    const end = addDays(start, daysToShow)

    setRangeEnd(format(end, 'yyyy-MM-dd'))
    onRangeChange(start, end)
  }

  function handleEndChange(newEnd: string) {
    setRangeEnd(newEnd)

    const start = new Date(rangeStart)
    const end = new Date(newEnd)
    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    )

    setDaysToShow(Math.max(5, days))
    onRangeChange(start, end)
  }

  function handleResetToProject() {
    setRangeStart(format(projectStartDate, 'yyyy-MM-dd'))
    setRangeEnd(format(projectEndDate, 'yyyy-MM-dd'))

    const days = Math.ceil(
      (projectEndDate.getTime() - projectStartDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
    setDaysToShow(days)

    onRangeChange(projectStartDate, projectEndDate)
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-semibold">{t('visibility')}</Label>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleResetToProject}>
          {t('resetToProject')}
        </Button>
      </div>

      {/* Fila 2: Ver desde / Ver hasta + slider de días */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_auto_1fr] sm:items-end">
        <div className="min-w-0">
          <Label htmlFor="rangeStart" className="text-xs">
            {t('viewFrom')}
          </Label>
          <div className="relative mt-0.5">
            <Calendar className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
            <Input
              id="rangeStart"
              type="date"
              value={rangeStart}
              onChange={(e) => handleStartChange(e.target.value)}
              className="h-7 pl-6 text-xs"
            />
          </div>
        </div>

        <div className="min-w-0">
          <Label htmlFor="rangeEnd" className="text-xs">
            {t('viewTo')}
          </Label>
          <div className="relative mt-0.5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Calendar className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <Input
                id="rangeEnd"
                type="date"
                value={rangeEnd}
                onChange={(e) => handleEndChange(e.target.value)}
                className="h-7 pl-6 text-xs"
              />
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:min-w-[140px]">
              <input
                id="daysSlider"
                type="range"
                min={5}
                max={365}
                step={1}
                value={daysToShow}
                onChange={(e) => handleDaysChange(parseInt(e.target.value, 10))}
                className="w-24 flex-1 min-w-[80px] sm:w-40"
              />
              <span className="w-7 shrink-0 text-[10px] text-slate-500">{daysToShow}d</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-500">
        {t('showingDaysInfo', {
          start: format(parseLocalDateInput(rangeStart), 'dd MMM', { locale: es }),
          end: format(parseLocalDateInput(rangeEnd), 'dd MMM', { locale: es }),
        })}
      </p>
    </div>
  )
}
