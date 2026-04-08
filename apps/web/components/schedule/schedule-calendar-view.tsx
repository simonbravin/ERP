'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  format,
  eachDayOfInterval,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  addDays,
  addMonths,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isAfter,
  differenceInCalendarDays,
} from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { cn } from '@/lib/utils'

export interface CalendarTask {
  id: string
  code: string
  name: string
  taskType: 'TASK' | 'SUMMARY' | 'MILESTONE'
  startDate: Date
  endDate: Date
  isCritical: boolean
}

interface ScheduleCalendarViewProps {
  tasks: CalendarTask[]
  visibleStartDate: Date
  visibleEndDate: Date
  zoom: 'day' | 'week' | 'month'
  weekStartsOn: 0 | 1
  onTaskClick?: (taskId: string) => void
  highlightedTask: string | null
  className?: string
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

/** Misma semántica de color que la leyenda del Gantt (tarea / hito / crítico). */
function calendarTaskChipClass(
  task: Pick<CalendarTask, 'isCritical' | 'taskType'>,
  highlighted: boolean
) {
  return cn(
    'w-full truncate rounded border border-border/70 bg-background text-left transition-colors hover:bg-muted/80',
    'border-l-[3px]',
    task.isCritical && 'border-l-red-600 bg-destructive/10',
    !task.isCritical &&
      task.taskType === 'MILESTONE' &&
      'border-l-amber-500',
    !task.isCritical &&
      task.taskType !== 'MILESTONE' &&
      'border-l-blue-500',
    highlighted && 'ring-1 ring-primary'
  )
}

const MONTH_CELL_MAX_TASKS = 4
const DAY_LIST_MAX = 40

export function ScheduleCalendarView({
  tasks,
  visibleStartDate,
  visibleEndDate,
  zoom,
  weekStartsOn,
  onTaskClick,
  highlightedTask,
  className,
}: ScheduleCalendarViewProps) {
  const t = useTranslations('schedule')
  const localeCode = useLocale()
  const localeObj: Locale = localeCode.startsWith('en') ? enUS : es

  const weekDayLabels = useMemo(() => {
    const ref = startOfWeek(new Date(), { weekStartsOn })
    return Array.from({ length: 7 }, (_, i) =>
      format(addDays(ref, i), 'EEE', { locale: localeObj })
    )
  }, [localeObj, weekStartsOn])

  const getTasksForDay = (day: Date) =>
    tasks.filter((task) => {
      if (task.taskType === 'SUMMARY') return false
      const start = new Date(task.startDate)
      const end = new Date(task.endDate)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return isWithinInterval(day, { start, end })
    })

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: visibleStartDate,
        end: visibleEndDate,
      }),
    [visibleStartDate, visibleEndDate]
  )

  if (zoom === 'day') {
    return (
      <div
        className={cn(
          'flex flex-col gap-3 overflow-auto rounded-lg border border-border bg-card p-3',
          className
        )}
      >
        {days.map((day) => {
          const dayTasks = getTasksForDay(day)
          const shown = dayTasks.slice(0, DAY_LIST_MAX)
          const extra = dayTasks.length - shown.length
          return (
            <div
              key={day.toISOString()}
              className="min-h-[88px] rounded-md border border-border bg-card p-3 shadow-sm"
            >
              <div className="mb-2 text-xs font-semibold text-foreground">
                {format(day, 'EEEE d MMMM yyyy', { locale: localeObj })}
              </div>
              <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {shown.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onTaskClick?.(task.id)}
                      className={cn(
                        'px-2 py-1.5 text-xs',
                        calendarTaskChipClass(task, highlightedTask === task.id)
                      )}
                      title={`${task.code} ${task.name}`}
                    >
                      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                        {task.code}
                      </span>{' '}
                      <span className="line-clamp-2">
                        {task.taskType === 'MILESTONE' ? '◆ ' : ''}
                        {task.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {extra > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t('calendarMoreTasks', { count: extra })}
                </p>
              )}
              {dayTasks.length === 0 && (
                <p className="text-[10px] text-muted-foreground">{t('calendarNoTasksThisDay')}</p>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (zoom === 'month') {
    const months: Date[] = []
    let cursor = startOfMonth(visibleStartDate)
    const last = endOfMonth(visibleEndDate)
    while (!isAfter(cursor, last)) {
      months.push(cursor)
      cursor = addMonths(cursor, 1)
    }

    return (
      <div className={cn('flex flex-col gap-6 overflow-auto rounded-lg border border-border bg-card p-3', className)}>
        {months.map((monthDate) => {
          const mStart = startOfMonth(monthDate)
          const mEnd = endOfMonth(monthDate)
          const calStart = startOfWeek(mStart, { weekStartsOn })
          const calEnd = endOfWeek(mEnd, { weekStartsOn })
          const calDays = eachDayOfInterval({ start: calStart, end: calEnd })
          const rows = chunk(calDays, 7)

          return (
            <div key={monthDate.toISOString()}>
              <h3 className="mb-2 text-sm font-semibold capitalize">
                {format(mStart, 'MMMM yyyy', { locale: localeObj })}
              </h3>
              <div className="sticky top-0 z-10 grid grid-cols-7 border border-b-0 border-border bg-muted/50 text-[10px] font-medium text-muted-foreground">
                {weekDayLabels.map((name) => (
                  <div key={name} className="border-r border-border p-1.5 last:border-r-0">
                    {name}
                  </div>
                ))}
              </div>
              {rows.map((week, wi) => (
                <div
                  key={wi}
                  className="grid grid-cols-7 border border-border border-t-0 last:rounded-b-md"
                >
                  {week.map((day) => {
                    const inVisible = isWithinInterval(day, {
                      start: visibleStartDate,
                      end: visibleEndDate,
                    })
                    const inMonth = isSameMonth(day, mStart)
                    const dayTasks = getTasksForDay(day)
                    const shown = dayTasks.slice(0, MONTH_CELL_MAX_TASKS)
                    const extra = dayTasks.length - shown.length

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          'flex min-h-[80px] flex-col border-r border-border p-1 last:border-r-0',
                          !inMonth && 'bg-muted/30',
                          !inVisible && 'opacity-50'
                        )}
                      >
                        <div
                          className={cn(
                            'mb-0.5 text-[10px] font-medium',
                            isSameDay(day, new Date()) && 'text-red-600'
                          )}
                        >
                          {format(day, 'd', { locale: localeObj })}
                        </div>
                        <div className="max-h-[5.5rem] min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                          {shown.map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => onTaskClick?.(task.id)}
                              className={cn(
                                'block w-full px-0.5 py-0.5 text-left text-[10px] leading-tight',
                                calendarTaskChipClass(task, highlightedTask === task.id)
                              )}
                              title={`${task.code} ${task.name}`}
                            >
                              <span className="block font-mono text-[10px] text-muted-foreground tabular-nums">
                                {task.code}
                              </span>
                              <span className="line-clamp-2 break-words">
                                {task.taskType === 'MILESTONE' ? '◆ ' : ''}
                                {task.name}
                              </span>
                            </button>
                          ))}
                        </div>
                        {extra > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{extra}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  // week (default): 7-column grid with leading padding
  const gridWeekStart = startOfWeek(visibleStartDate, { weekStartsOn })
  const leadingPad = Math.min(
    6,
    Math.max(0, differenceInCalendarDays(visibleStartDate, gridWeekStart))
  )
  const cells: (Date | null)[] = [...Array(leadingPad).fill(null), ...days]
  const weeks = chunk(cells, 7)
  const weekDays = 7

  return (
    <div className={cn('flex flex-col overflow-auto rounded-lg border border-border bg-card', className)}>
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
        {weekDayLabels.map((name) => (
          <div key={name} className="border-r border-border p-2 last:border-r-0">
            {name}
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day, di) => {
              if (!day) {
                return (
                  <div
                    key={`pad-${wi}-${di}`}
                    className="min-h-[88px] border-r border-border bg-muted/10 last:border-r-0"
                  />
                )
              }
              const dayTasks = getTasksForDay(day)
              const shown = dayTasks.slice(0, 8)
              const extra = dayTasks.length - shown.length
              return (
                <div
                  key={day.toISOString()}
                  className="min-h-[88px] border-r border-border p-1.5 last:border-r-0"
                >
                  <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                    {format(day, 'd MMM', { locale: localeObj })}
                  </div>
                  <div className="max-h-28 space-y-0.5 overflow-y-auto">
                    {shown.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onTaskClick?.(task.id)}
                        className={cn(
                          'block px-1 py-0.5 text-[10px]',
                          calendarTaskChipClass(task, highlightedTask === task.id)
                        )}
                        title={`${task.code} ${task.name}`}
                      >
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {task.code}
                        </span>{' '}
                        {task.taskType === 'MILESTONE' ? '◆ ' : ''}
                        {task.name}
                      </button>
                    ))}
                  </div>
                  {extra > 0 && (
                    <span className="text-[9px] text-muted-foreground">+{extra}</span>
                  )}
                </div>
              )
            })}
            {week.length < weekDays &&
              Array.from({ length: weekDays - week.length }).map((_, i) => (
                <div
                  key={`empty-${wi}-${i}`}
                  className="min-h-[88px] border-r border-border bg-muted/20 last:border-r-0"
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}
