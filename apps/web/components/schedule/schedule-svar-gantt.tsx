'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { endOfDay, format, startOfDay } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import type { Locale as DateFnsLocale } from 'date-fns'

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

/** Sin import estático de @svar-ui (webpack en CI); mismo shape que IApi.getTask. */
type SvarGanttApi = {
  getTask: (id: string | number) => {
    type?: string
    start?: Date
    end?: Date
  }
}

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

/**
 * SVAR aplica colores de barras vía variables CSS en `.wx-willow-theme` / tema oscuro.
 * Sin `Willow`/`WillowDark`, `--wx-gantt-task-color` etc. quedan sin definir → barras “vacías”
 * y solo se ve el texto de la tarea en la zona del timeline.
 */
const GanttThemed = dynamic(
  () =>
    import('@svar-ui/react-gantt/all.css')
      .then(() => import('@svar-ui/react-gantt'))
      .then((m) => {
        type GanttProps = ComponentProps<typeof m.Gantt>
        function SvarGanttThemed(
          props: GanttProps & { useDarkTheme?: boolean }
        ) {
          const { useDarkTheme, ...ganttProps } = props
          const Theme = useDarkTheme ? m.WillowDark : m.Willow
          return (
            <Theme fonts={false}>
              <m.Gantt {...ganttProps} />
            </Theme>
          )
        }
        return SvarGanttThemed
      }),
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

type RawColumn = Record<string, unknown> & { id?: string }

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
  const { resolvedTheme } = useTheme()
  const useDarkTheme = resolvedTheme === 'dark'
  const dateLocale: DateFnsLocale = intlLocale.startsWith('en') ? enUS : es

  const [rawColumns, setRawColumns] = useState<readonly RawColumn[] | null>(null)
  useEffect(() => {
    let cancelled = false
    void import('@svar-ui/react-gantt').then((m) => {
      if (!cancelled) {
        setRawColumns(m.defaultColumns as readonly RawColumn[])
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const apiRef = useRef<SvarGanttApi | null>(null)

  const sourceTasks = useMemo(
    () => (Array.isArray(scheduleData.tasks) ? scheduleData.tasks : []),
    [scheduleData.tasks]
  )

  const { tasks, links: allLinks } = useMemo(
    () =>
      scheduleTasksToSvar(sourceTasks, {
        visibleTaskIds,
        showCriticalPath,
        showProgress,
        showBaseline,
        baselinePlanByWbsNodeId,
      }),
    [
      sourceTasks,
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

  const columns = useMemo(() => {
    if (!rawColumns) return null
    return rawColumns.map((col) => {
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
    })
  }, [rawColumns, dateLocale])

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
      let parsed: ReturnType<SvarGanttApi['getTask']>
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

  if (!columns || columns.length === 0) {
    return (
      <div
        className={cn(
          'bloqer-svar-gantt min-h-0 min-w-0 flex-1 overflow-auto',
          className
        )}
      >
        <SvarGanttSkeleton />
      </div>
    )
  }

  if (tasks.length === 0) {
    const hasAnyTasks = sourceTasks.length > 0
    return (
      <div
        className={cn(
          'bloqer-svar-gantt flex min-h-[320px] min-w-0 flex-1 items-center justify-center rounded-lg border border-border bg-muted/20 px-4 py-12',
          className
        )}
        role="status"
      >
        <p className="max-w-xl text-center text-sm text-muted-foreground">
          {hasAnyTasks
            ? t('ganttEmptyFiltered')
            : t('ganttEmpty')}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bloqer-svar-gantt min-h-0 min-w-0 flex-1 overflow-auto',
        className
      )}
    >
      <GanttThemed
        useDarkTheme={useDarkTheme}
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
        init={(api: SvarGanttApi) => {
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
