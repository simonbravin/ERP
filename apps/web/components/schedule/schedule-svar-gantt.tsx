'use client'

import { useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { endOfDay, format, startOfDay } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import type { Locale as DateFnsLocale } from 'date-fns'

import '@svar-ui/react-gantt/all.css'

import { cn } from '@/lib/utils'
import {
  scheduleTasksToSvar,
  svarLinkTypeToBloqer,
  type ScheduleViewTaskLike,
} from '@/lib/schedule/svar-schedule-adapter'
import {
  buildSvarScalesForBloqerZoom,
  parseSchedulePlanDate,
} from '@/lib/schedule/svar-gantt-scales'

import type { IApi } from '@svar-ui/react-gantt'
import { defaultColumns } from '@svar-ui/react-gantt'

function SvarGanttSkeleton() {
  const t = useTranslations('schedule')
  return (
    <div
      className="flex min-h-[320px] items-center justify-center rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      {t('svarGanttLoading')}
    </div>
  )
}

const GanttClient = dynamic(
  () => import('@svar-ui/react-gantt').then((m) => m.Gantt),
  { ssr: false, loading: () => <SvarGanttSkeleton /> }
)

type UpdateTaskEv = {
  id: string | number
  inProgress?: boolean
  diff?: number
  task?: {
    start?: Date
    end?: Date
    progress?: number
    [key: string]: unknown
  }
}

type DragTaskEv = {
  id: string | number
  inProgress?: boolean
}

type AddLinkEv = {
  link?: {
    id?: string | number
    source?: string | number
    target?: string | number
    type?: string
    lag?: number
  }
}

type DeleteLinkEv = {
  id?: string | number
}

export interface ScheduleSvarGanttProps {
  scheduleData: {
    tasks: ScheduleViewTaskLike[]
    projectStartDate: string
    projectEndDate: string
  }
  visibleTaskIds: Set<string>
  visibleStartDate: Date
  visibleEndDate: Date
  zoom: 'day' | 'week' | 'month'
  weekStartsOn: 0 | 1
  readonly: boolean
  showCriticalPath: boolean
  showDependencies: boolean
  showProgress: boolean
  showTodayLine: boolean
  /** Comparar barras actuales con fechas plan del cronograma baseline (por WBS). */
  showBaseline: boolean
  baselinePlanByWbsNodeId: Record<
    string,
    { plannedStartDate: string; plannedEndDate: string }
  > | null
  className?: string
  onTaskActivate?: (taskId: string) => void
  onTaskDatesPersist: (taskId: string, start: Date, end: Date) => Promise<void>
  onTaskProgressPersist: (taskId: string, progressPercent: number) => Promise<void>
  onDependencyAdd: (input: {
    predecessorId: string
    successorId: string
    dependencyType: 'FS' | 'SS' | 'FF' | 'SF'
    lagDays: number
  }) => Promise<void>
  onDependencyRemove: (dependencyId: string) => Promise<void>
}

export function ScheduleSvarGantt({
  scheduleData,
  visibleTaskIds,
  visibleStartDate,
  visibleEndDate,
  zoom,
  weekStartsOn,
  readonly,
  showCriticalPath,
  showDependencies,
  showProgress,
  showTodayLine,
  showBaseline,
  baselinePlanByWbsNodeId,
  className,
  onTaskActivate,
  onTaskDatesPersist,
  onTaskProgressPersist,
  onDependencyAdd,
  onDependencyRemove,
}: ScheduleSvarGanttProps) {
  const intlLocale = useLocale()
  const t = useTranslations('schedule')
  const dateLocale: DateFnsLocale = intlLocale.startsWith('en') ? enUS : es

  const apiRef = useRef<IApi | null>(null)

  const { tasks, links: allLinks } = useMemo(
    () =>
      scheduleTasksToSvar(scheduleData.tasks, {
        visibleTaskIds,
        showCriticalPath,
        showProgress,
        showBaseline,
        baselinePlanByWbsNodeId,
      }),
    [
      scheduleData.tasks,
      visibleTaskIds,
      showCriticalPath,
      showProgress,
      showBaseline,
      baselinePlanByWbsNodeId,
    ]
  )

  const baselinesEnabled = useMemo(
    () =>
      showBaseline &&
      Boolean(
        baselinePlanByWbsNodeId &&
          Object.keys(baselinePlanByWbsNodeId).length > 0
      ),
    [showBaseline, baselinePlanByWbsNodeId]
  )

  const links = useMemo(
    () => (showDependencies ? allLinks : []),
    [allLinks, showDependencies]
  )

  const scales = useMemo(
    () => buildSvarScalesForBloqerZoom(zoom, weekStartsOn, dateLocale),
    [zoom, weekStartsOn, dateLocale]
  )

  const columns = useMemo(
    () =>
      defaultColumns.map((col) => {
        if (col.id !== 'start' && col.id !== 'end') {
          return col
        }
        return {
          ...col,
          template: (value: unknown) => {
            const d = value instanceof Date ? value : null
            return d ? format(d, 'dd/MM/yyyy', { locale: dateLocale }) : ''
          },
        }
      }),
    [dateLocale]
  )

  const rangeStart = useMemo(
    () => startOfDay(visibleStartDate),
    [visibleStartDate]
  )
  const rangeEnd = useMemo(
    () => endOfDay(visibleEndDate),
    [visibleEndDate]
  )

  const projectStart = useMemo(
    () => parseSchedulePlanDate(scheduleData.projectStartDate),
    [scheduleData.projectStartDate]
  )
  const projectEnd = useMemo(
    () => parseSchedulePlanDate(scheduleData.projectEndDate),
    [scheduleData.projectEndDate]
  )

  const markers = useMemo(() => {
    if (!showTodayLine) return []
    return [
      {
        start: startOfDay(new Date()),
        text: t('legendToday'),
        css: 'bloqer-svar-gantt-marker-today',
      },
    ]
  }, [showTodayLine, t])

  const persistDatesIfNeeded = useCallback(
    async (taskId: string) => {
      if (readonly) return
      const api = apiRef.current
      if (!api) return
      let parsed: ReturnType<IApi['getTask']>
      try {
        parsed = api.getTask(taskId)
      } catch {
        return
      }
      if (!parsed || parsed.type === 'summary') return
      const s = parsed.start
      const e = parsed.end
      if (!(s instanceof Date) || !(e instanceof Date)) return
      await onTaskDatesPersist(taskId, s, e)
    },
    [readonly, onTaskDatesPersist]
  )

  const handleUpdateTask = useCallback(
    async (ev: UpdateTaskEv) => {
      if (readonly || ev.inProgress) return
      const id = String(ev.id)

      if (
        ev.task &&
        typeof ev.task.progress === 'number' &&
        ev.task.start == null &&
        ev.task.end == null
      ) {
        await onTaskProgressPersist(id, ev.task.progress)
        return
      }

      if (typeof ev.diff === 'number') {
        await persistDatesIfNeeded(id)
        return
      }

      if (ev.task?.start instanceof Date && ev.task.end instanceof Date) {
        const api = apiRef.current
        const parsed = api?.getTask(id)
        if (parsed?.type === 'summary') return
        await onTaskDatesPersist(id, ev.task.start, ev.task.end)
      }
    },
    [readonly, onTaskProgressPersist, onTaskDatesPersist, persistDatesIfNeeded]
  )

  const handleDragTask = useCallback(
    async (ev: DragTaskEv) => {
      if (readonly || ev.inProgress) return
      await persistDatesIfNeeded(String(ev.id))
    },
    [readonly, persistDatesIfNeeded]
  )

  const handleAddLink = useCallback(
    async (ev: AddLinkEv) => {
      if (readonly) return
      const l = ev.link
      if (
        l?.source == null ||
        l.target == null ||
        !l.type ||
        typeof l.type !== 'string'
      ) {
        return
      }
      const depType = svarLinkTypeToBloqer(
        l.type as Parameters<typeof svarLinkTypeToBloqer>[0]
      )
      await onDependencyAdd({
        predecessorId: String(l.source),
        successorId: String(l.target),
        dependencyType: depType,
        lagDays: typeof l.lag === 'number' ? l.lag : 0,
      })
    },
    [readonly, onDependencyAdd]
  )

  const handleDeleteLink = useCallback(
    async (ev: DeleteLinkEv) => {
      if (readonly || ev.id == null) return
      await onDependencyRemove(String(ev.id))
    },
    [readonly, onDependencyRemove]
  )

  return (
    <div
      className={cn(
        'bloqer-svar-gantt min-h-0 min-w-0 flex-1 overflow-auto',
        className
      )}
    >
      <GanttClient
        tasks={tasks}
        links={links}
        columns={columns}
        markers={markers}
        start={rangeStart}
        end={rangeEnd}
        projectStart={projectStart}
        projectEnd={projectEnd}
        scales={scales}
        autoScale
        lengthUnit="day"
        durationUnit="day"
        baselines={baselinesEnabled}
        readonly={readonly}
        init={(api) => {
          apiRef.current = api
        }}
        onSelectTask={(ev: { id: string | number }) => {
          onTaskActivate?.(String(ev.id))
        }}
        onUpdateTask={handleUpdateTask}
        onDragTask={handleDragTask}
        onAddLink={handleAddLink}
        onDeleteLink={handleDeleteLink}
      />
    </div>
  )
}
