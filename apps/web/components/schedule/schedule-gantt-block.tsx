'use client'

import { GanttDataTable } from './gantt-data-table'
import { GanttTimelineDynamic } from './gantt-timeline-dynamic'
import { ScheduleCalendarView } from './schedule-calendar-view'

export interface GanttDataTableTask {
  id: string
  code: string
  name: string
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
}: ScheduleGanttBlockProps) {
  return (
    <div className={className ?? 'flex min-h-0 flex-1 overflow-auto'}>
      <div className="min-w-[420px] shrink-0 border-r border-border">
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
          groupBy={groupBy}
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
            workingDaysPerWeek={workingDaysPerWeek}
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
