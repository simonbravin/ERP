'use client'

import type { RefObject } from 'react'
import { cn } from '@/lib/utils'
import type { WorkingDayOptions } from '@/lib/schedule/working-days'
import { GanttDataTable } from './gantt-data-table'
import { GanttTimelineDynamic } from './gantt-timeline-dynamic'
import { ScheduleCalendarView } from './schedule-calendar-view'

export interface GanttDataTableTask {
  id: string
  code: string
  name: string
  assignedTo?: string | null
  taskType: 'TASK' | 'SUMMARY' | 'MILESTONE'
  startDate: Date
  endDate: Date
  duration: number
  progress: number
  isCritical: boolean
  level: number
  totalFloat: number | null
  predecessorCount: number
  successorCount: number
}

export interface GanttTask {
  id: string
  wbsNodeId: string
  name: string
  startDate: Date
  endDate: Date
  progress: number
  isCritical: boolean
  level: number
  taskType: 'TASK' | 'SUMMARY' | 'MILESTONE'
  dependencies: Array<{
    id: string
    targetId: string
    type: 'FS' | 'SS' | 'FF' | 'SF'
  }>
}

export interface ScheduleGanttBlockProps {
  tableTasks: GanttDataTableTask[]
  ganttTasks: GanttTask[]
  allTableTasks: GanttDataTableTask[]
  expandedNodes: Set<string>
  onToggleExpand: (taskId: string) => void
  onTaskClick: (taskId: string) => void
  onDependenciesClick: (taskId: string) => void
  onTaskDatesChange?: (taskId: string, newStartDate: Date, newEndDate: Date) => void
  canEdit: boolean
  highlightedTask: string | null
  onHighlightTask: (taskId: string | null) => void
  searchQuery?: string
  workingDaysPerWeek: number
  /** Feriados / excepciones al calendario laborable del cronograma. */
  calendarOptions?: WorkingDayOptions
  groupBy: 'none' | 'phase' | 'assigned'
  visibleStartDate: Date
  visibleEndDate: Date
  zoom: 'day' | 'week' | 'month'
  showCriticalPath: boolean
  showDependencies: boolean
  showTodayLine: boolean
  showProgress: boolean
  onTaskDragEnd: (taskId: string, newStartDate: Date, newEndDate: Date) => void
  weekStartsOn?: 0 | 1
  viewMode?: 'gantt' | 'calendar'
  className?: string
  ganttAriaLabel?: string
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  showWbsDetailColumns?: boolean
  wbsMinimalStrip?: boolean
  showBaseline?: boolean
  baselinePlanByWbsNodeId?: Record<
    string,
    { plannedStartDate: string; plannedEndDate: string }
  > | null
}

export function ScheduleGanttBlock({
  tableTasks,
  ganttTasks,
  allTableTasks,
  expandedNodes,
  onToggleExpand,
  onTaskClick,
  onDependenciesClick,
  onTaskDatesChange,
  canEdit,
  highlightedTask,
  onHighlightTask,
  searchQuery = '',
  workingDaysPerWeek,
  calendarOptions,
  groupBy,
  visibleStartDate,
  visibleEndDate,
  zoom,
  showCriticalPath,
  showDependencies,
  showTodayLine,
  showProgress,
  onTaskDragEnd,
  weekStartsOn = 1,
  viewMode = 'gantt',
  className,
  ganttAriaLabel,
  scrollContainerRef,
  showWbsDetailColumns = true,
  wbsMinimalStrip = false,
  showBaseline = false,
  baselinePlanByWbsNodeId = null,
}: ScheduleGanttBlockProps) {
  /* Anchos alineados con columnas fijas de GanttDataTable (code+task+detail cols = 520px). */
  const wbsMinClass = wbsMinimalStrip
    ? 'w-[72px] min-w-[72px] max-w-[72px]'
    : showWbsDetailColumns
      ? 'w-[520px] min-w-[520px] max-w-[520px]'
      : 'w-[260px] min-w-[260px] max-w-[260px]'

  return (
    <div
      ref={scrollContainerRef}
      className={className ?? 'flex min-h-0 flex-1 overflow-auto'}
    >
      <div className={cn('shrink-0 border-r border-border', wbsMinClass)}>
        <GanttDataTable
          tasks={tableTasks}
          allTasks={allTableTasks}
          expandedNodes={expandedNodes}
          onToggleExpand={onToggleExpand}
          onTaskClick={onTaskClick}
          onDependenciesClick={onDependenciesClick}
          onTaskDatesChange={onTaskDatesChange}
          canEdit={canEdit}
          highlightedTask={highlightedTask}
          searchQuery={searchQuery}
          workingDaysPerWeek={workingDaysPerWeek}
          calendarOptions={calendarOptions}
          groupBy={groupBy}
          showDetailColumns={showWbsDetailColumns}
          minimalWbsOnly={wbsMinimalStrip}
          showFooter={false}
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1">
        {viewMode === 'calendar' ? (
          <ScheduleCalendarView
            tasks={tableTasks.map((t) => ({
              id: t.id,
              code: t.code,
              name: t.name,
              taskType: t.taskType,
              startDate: t.startDate,
              endDate: t.endDate,
              isCritical: t.isCritical,
            }))}
            visibleStartDate={visibleStartDate}
            visibleEndDate={visibleEndDate}
            zoom={zoom}
            weekStartsOn={weekStartsOn}
            onTaskClick={onTaskClick}
            highlightedTask={highlightedTask}
            className="h-full"
          />
        ) : (
          <GanttTimelineDynamic
            tasks={ganttTasks}
            visibleStartDate={visibleStartDate}
            visibleEndDate={visibleEndDate}
            zoom={zoom}
            showCriticalPath={showCriticalPath}
            showDependencies={showDependencies}
            showTodayLine={showTodayLine}
            showProgress={showProgress}
            showBaseline={showBaseline}
            baselinePlanByWbsNodeId={baselinePlanByWbsNodeId}
            workingDaysPerWeek={workingDaysPerWeek}
            calendarOptions={calendarOptions}
            onTaskClick={onTaskClick}
            onTaskDragEnd={onTaskDragEnd}
            highlightedTask={highlightedTask}
            onTaskHover={onHighlightTask}
            ariaLabel={ganttAriaLabel}
            weekStartsOn={weekStartsOn}
          />
        )}
      </div>
    </div>
  )
}
