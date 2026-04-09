'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'
import { useLocale } from 'next-intl'
import { format } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import { parseLocalYmd } from '@/lib/parse-local-ymd'

interface DateRangeSliderProps {
  projectStartDate: Date
  projectEndDate: Date
  currentStartDate: Date
  currentEndDate: Date
  onRangeChange: (startDate: Date, endDate: Date) => void
  /** Sin caja propia: va dentro de la tarjeta del cronograma. */
  embedded?: boolean
}

export function DateRangeSlider({
  projectStartDate,
  projectEndDate,
  currentStartDate,
  currentEndDate,
  onRangeChange,
  embedded = false,
}: DateRangeSliderProps) {
  const t = useTranslations('schedule')
  const intlLocale = useLocale()
  const dateLocale = intlLocale.startsWith('en') ? enUS : es

  const [rangeStart, setRangeStart] = useState(
    format(currentStartDate, 'yyyy-MM-dd')
  )
  const [rangeEnd, setRangeEnd] = useState(
    format(currentEndDate, 'yyyy-MM-dd')
  )

  useEffect(() => {
    setRangeStart(format(currentStartDate, 'yyyy-MM-dd'))
    setRangeEnd(format(currentEndDate, 'yyyy-MM-dd'))
  }, [currentStartDate, currentEndDate])

  function handleStartChange(newStart: string) {
    setRangeStart(newStart)
    const start = parseLocalYmd(newStart)
    let end = parseLocalYmd(rangeEnd)
    if (end < start) {
      end = start
      setRangeEnd(format(end, 'yyyy-MM-dd'))
    }
    onRangeChange(start, end)
  }

  function handleEndChange(newEnd: string) {
    setRangeEnd(newEnd)
    let start = parseLocalYmd(rangeStart)
    const end = parseLocalYmd(newEnd)
    if (end < start) {
      start = end
      setRangeStart(format(start, 'yyyy-MM-dd'))
    }
    onRangeChange(start, end)
  }

  function handleResetToProject() {
    const ps = format(projectStartDate, 'yyyy-MM-dd')
    const pe = format(projectEndDate, 'yyyy-MM-dd')
    setRangeStart(ps)
    setRangeEnd(pe)
    onRangeChange(projectStartDate, projectEndDate)
  }

  return (
    <div
      className={cn(
        'space-y-3',
        embedded ? '' : 'rounded-lg border border-border bg-card p-4'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-semibold text-foreground">
          {t('visibility')}
        </Label>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm font-medium text-primary"
          onClick={handleResetToProject}
        >
          {t('resetToProject')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t('visibilitySvarHint')}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <Label htmlFor="rangeStart" className="text-xs text-muted-foreground">
            {t('viewFrom')}
          </Label>
          <div className="relative mt-1">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="rangeStart"
              type="date"
              value={rangeStart}
              onChange={(e) => handleStartChange(e.target.value)}
              className="h-10 border-border bg-background pl-10 text-sm"
            />
          </div>
        </div>

        <div className="min-w-0">
          <Label htmlFor="rangeEnd" className="text-xs text-muted-foreground">
            {t('viewTo')}
          </Label>
          <div className="relative mt-1">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="rangeEnd"
              type="date"
              value={rangeEnd}
              onChange={(e) => handleEndChange(e.target.value)}
              className="h-10 border-border bg-background pl-10 text-sm"
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('showingDaysInfo', {
          start: format(parseLocalYmd(rangeStart), 'dd/MM/yyyy', { locale: dateLocale }),
          end: format(parseLocalYmd(rangeEnd), 'dd/MM/yyyy', { locale: dateLocale }),
        })}
      </p>
    </div>
  )
}
