'use client'

import { format, eachDayOfInterval, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
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
  onTaskClick?: (taskId: string) => void
  highlightedTask: string | null
  className?: string
}

export function ScheduleCalendarView({
  tasks,
  visibleStartDate,
  visibleEndDate,
  onTaskClick,
  highlightedTask,
  className,
}: ScheduleCalendarViewProps) {
  const days = eachDayOfInterval({ start: visibleStartDate, end: visibleEndDate })

  const getTasksForDay = (day: Date) =>
    tasks.filter((task) => {
      const start = new Date(task.startDate)
      const end = new Date(task.endDate)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return isWithinInterval(day, { start, end })
    })

  const weekDays = 7
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += weekDays) {
    weeks.push(days.slice(i, i + weekDays))
  }

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return (
    <div className={cn('flex flex-col overflow-auto rounded-lg border border-border bg-card', className)}>
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
        {dayNames.map((name) => (
          <div key={name} className="border-r border-border p-2 last:border-r-0">
            {name}
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day) => (
              <div
                key={day.toISOString()}
                className="min-h-[80px] border-r border-border p-1.5 last:border-r-0"
              >
                <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                  {format(day, 'd MMM', { locale: es })}
                </div>
                <div className="space-y-0.5">
                  {getTasksForDay(day)
                    .filter((t) => t.taskType === 'TASK' || t.taskType === 'MILESTONE')
                    .slice(0, 5)
                    .map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onTaskClick?.(task.id)}
                        className={cn(
                          'block w-full truncate rounded px-1 py-0.5 text-left text-[10px] transition-colors hover:bg-muted',
                          task.isCritical && 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
                          highlightedTask === task.id && 'ring-1 ring-primary'
                        )}
                        title={`${task.code} ${task.name}`}
                      >
                        {task.taskType === 'MILESTONE' ? '◆ ' : ''}
                        {task.name}
                      </button>
                    ))}
                  {getTasksForDay(day).filter((t) => t.taskType === 'TASK' || t.taskType === 'MILESTONE').length > 5 && (
                    <span className="text-[9px] text-muted-foreground">
                      +{getTasksForDay(day).filter((t) => t.taskType === 'TASK' || t.taskType === 'MILESTONE').length - 5}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {week.length < weekDays &&
              Array.from({ length: weekDays - week.length }).map((_, i) => (
                <div key={`empty-${wi}-${i}`} className="min-h-[80px] border-r border-border bg-muted/20 last:border-r-0" />
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}
