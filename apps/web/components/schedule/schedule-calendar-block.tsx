'use client'

import type { RefObject } from 'react'
import { cn } from '@/lib/utils'
import type { WorkingDayOptions } from '@/lib/schedule/working-days'
import { ScheduleWbsPanel } from './schedule-wbs-panel'
import { ScheduleCalendarView } from './schedule-calendar-view'

export interface ScheduleCalendarTableTask {
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

/** Panel WBS + vista calendario. La vista Gantt interactiva vive en `ScheduleSvarGantt`. */
export interface ScheduleCalendarBlockProps {
  tableTasks: ScheduleCalendarTableTask[]
  allTableTasks: ScheduleCalendarTableTask[]
  expandedNodes: Set<string>
  onToggleExpand: (taskId: string) => void
  onTaskClick: (taskId: string) => void
  onDependenciesClick: (taskId: string) => void
  onTaskDatesChange?: (taskId: string, newStartDate: Date, newEndDate: Date) => void
  canEdit: boolean
  highlightedTask: string | null
  searchQuery?: string
  workingDaysPerWeek: number
  calendarOptions?: WorkingDayOptions
  groupBy: 'none' | 'phase' | 'assigned'
  visibleStartDate: Date
  visibleEndDate: Date
  zoom: 'day' | 'week' | 'month'
  weekStartsOn?: 0 | 1
  className?: string
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  showWbsDetailColumns?: boolean
  wbsMinimalStrip?: boolean
}

export function ScheduleCalendarBlock({
  tableTasks,
  allTableTasks,
  expandedNodes,
  onToggleExpand,
  onTaskClick,
  onDependenciesClick,
  onTaskDatesChange,
  canEdit,
  highlightedTask,
  searchQuery = '',
  workingDaysPerWeek,
  calendarOptions,
  groupBy,
  visibleStartDate,
  visibleEndDate,
  zoom,
  weekStartsOn = 1,
  className,
  scrollContainerRef,
  showWbsDetailColumns = true,
  wbsMinimalStrip = false,
}: ScheduleCalendarBlockProps) {
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
        <ScheduleWbsPanel
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
      </div>
    </div>
  )
}
