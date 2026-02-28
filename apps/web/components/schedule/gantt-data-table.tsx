'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { addWorkingDays, countWorkingDays } from '@/lib/schedule/working-days'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Edit,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GANTT_HEADER_HEIGHT, GANTT_ROW_HEIGHT } from '@/lib/schedule/gantt-constants'

interface GanttDataTableTask {
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

interface GanttDataTableProps {
  tasks: GanttDataTableTask[]
  allTasks?: GanttDataTableTask[]
  expandedNodes: Set<string>
  onToggleExpand: (taskId: string) => void
  onTaskClick: (taskId: string) => void
  onDependenciesClick: (taskId: string) => void
  onTaskDatesChange?: (taskId: string, newStartDate: Date, newEndDate: Date) => void
  canEdit: boolean
  highlightedTask: string | null
  searchQuery?: string
  workingDaysPerWeek?: number
}

export function GanttDataTable({
  tasks,
  allTasks: allTasksProp,
  expandedNodes,
  onToggleExpand,
  onTaskClick,
  onDependenciesClick,
  onTaskDatesChange,
  canEdit,
  highlightedTask,
  searchQuery = '',
  workingDaysPerWeek = 5,
}: GanttDataTableProps) {
  const allTasks = allTasksProp ?? tasks
  const t = useTranslations('schedule')
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: 'start' | 'end' | 'days' } | null>(null)

  const visibleTasks = tasks

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex-1 overflow-visible">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted [&_tr]:border-0">
            <TableRow style={{ height: GANTT_HEADER_HEIGHT }} className="[&>th]:!py-0 [&>th]:!min-h-0 [&>th]:leading-none [&>th]:align-middle">
              <TableHead className="w-[72px] px-1 text-[10px] text-muted-foreground" style={{ height: GANTT_HEADER_HEIGHT }}>
                {t('code')}
              </TableHead>
              <TableHead className="min-w-[140px] px-1 text-[10px] text-muted-foreground" style={{ height: GANTT_HEADER_HEIGHT }}>
                {t('task')}
              </TableHead>
              <TableHead className="w-[72px] px-1 text-[10px] text-muted-foreground" style={{ height: GANTT_HEADER_HEIGHT }}>
                {t('start')}
              </TableHead>
              <TableHead className="w-[72px] px-1 text-[10px] text-muted-foreground" style={{ height: GANTT_HEADER_HEIGHT }}>
                {t('end')}
              </TableHead>
              <TableHead className="w-[44px] px-1 text-right text-[10px] text-muted-foreground" style={{ height: GANTT_HEADER_HEIGHT }}>
                {t('days')}
              </TableHead>
              <TableHead className="w-[40px] px-1 text-right text-[10px] text-muted-foreground" style={{ height: GANTT_HEADER_HEIGHT }}>
                %
              </TableHead>
              <TableHead className="w-[40px] px-1 text-center text-[10px] text-muted-foreground" style={{ height: GANTT_HEADER_HEIGHT }}>
                {t('deps')}
              </TableHead>
              <TableHead className="w-[40px] px-1 text-center text-[10px] text-muted-foreground" style={{ height: GANTT_HEADER_HEIGHT }}>
                {t('actions')}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visibleTasks.map((task) => {
              const isTopLevel = task.level === 0
              const hasChildren = isTopLevel && allTasks.some((t) =>
                t.code.startsWith(task.code + '.')
              )
              const isExpanded = expandedNodes.has(task.id)
              const isHighlighted = highlightedTask === task.id
              const isEditing = editingCell?.taskId === task.id
              const canEditDates = canEdit && onTaskDatesChange && task.taskType !== 'SUMMARY'

              return (
                <TableRow
                  key={task.id}
                  style={{ height: GANTT_ROW_HEIGHT }}
                  className={cn(
                    'transition-colors hover:bg-muted/50 [&>td]:py-0 [&>td]:leading-none',
                    isHighlighted && 'bg-blue-50',
                    task.isCritical && 'bg-red-50'
                  )}
                >
                  <TableCell className="px-1 py-0.5 font-mono text-[10px]">
                    {task.code}
                  </TableCell>

                  <TableCell className="px-1 py-0.5">
                    <div
                      className="flex items-center gap-0.5"
                      style={{ paddingLeft: `${task.level * 10}px` }}
                    >
                      {hasChildren && (
                        <button
                          type="button"
                          onClick={() => onToggleExpand(task.id)}
                          className="rounded p-0.5 hover:bg-muted"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                      )}

                      <span
                        className={cn(
                          'truncate text-xs',
                          task.taskType === 'SUMMARY' && 'font-semibold'
                        )}
                        title={task.name}
                      >
                        {task.name}
                      </span>

                      {task.isCritical && (
                        <Badge
                          variant="danger"
                          className="h-4 px-1 text-[8px]"
                        >
                          {t('critical')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="px-1 py-0.5">
                    {canEditDates && (isEditing && editingCell?.field === 'start') ? (
                      <Input
                        type="date"
                        defaultValue={format(task.startDate, 'yyyy-MM-dd')}
                        onBlur={(e) => {
                          const start = new Date(e.target.value)
                          const end = addWorkingDays(start, task.duration, workingDaysPerWeek)
                          onTaskDatesChange(task.id, start, end)
                          setEditingCell(null)
                        }}
                        className="h-5 w-full min-w-0 text-[10px]"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={cn('block text-[10px]', canEditDates && 'cursor-pointer rounded px-0.5 hover:bg-muted/50')}
                        title={canEditDates ? t('clickToEdit') : undefined}
                        onClick={() => canEditDates && setEditingCell({ taskId: task.id, field: 'start' })}
                      >
                        {format(task.startDate, 'dd/MM/yy')}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="px-1 py-0.5">
                    {canEditDates && (isEditing && editingCell?.field === 'end') ? (
                      <Input
                        type="date"
                        defaultValue={format(task.endDate, 'yyyy-MM-dd')}
                        onBlur={(e) => {
                          const start = new Date(task.startDate)
                          const end = new Date(e.target.value)
                          onTaskDatesChange(task.id, start, end)
                          setEditingCell(null)
                        }}
                        className="h-5 w-full min-w-0 text-[10px]"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={cn('block text-[10px]', canEditDates && 'cursor-pointer rounded px-0.5 hover:bg-muted/50')}
                        title={canEditDates ? t('clickToEdit') : undefined}
                        onClick={() => canEditDates && setEditingCell({ taskId: task.id, field: 'end' })}
                      >
                        {format(task.endDate, 'dd/MM/yy')}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="px-1 py-0.5 text-right">
                    {canEditDates && (isEditing && editingCell?.field === 'days') ? (
                      <Input
                        type="number"
                        min={1}
                        defaultValue={task.duration}
                        onBlur={(e) => {
                          const dur = Math.max(1, parseInt(e.target.value, 10) || 1)
                          const start = new Date(task.startDate)
                          const end = addWorkingDays(start, dur, workingDaysPerWeek)
                          onTaskDatesChange(task.id, start, end)
                          setEditingCell(null)
                        }}
                        className="h-5 w-12 text-right text-[10px]"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={cn('block font-mono text-[10px]', canEditDates && 'cursor-pointer rounded px-0.5 hover:bg-muted/50')}
                        title={canEditDates ? t('clickToEdit') : undefined}
                        onClick={() => canEditDates && setEditingCell({ taskId: task.id, field: 'days' })}
                      >
                        {task.duration}d
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="px-1 py-0.5">
                    <div className="flex items-center gap-0.5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full transition-all',
                            task.progress === 100
                              ? 'bg-status-success'
                              : 'bg-accent'
                          )}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {task.progress}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="px-1 py-0.5 text-center">
                    {(task.predecessorCount > 0 ||
                      task.successorCount > 0) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDependenciesClick(task.id)}
                        className="h-6 w-6 p-0"
                      >
                        <GitBranch className="h-3 w-3 text-muted-foreground" />
                        <span className="ml-1 text-[9px]">
                          {task.predecessorCount + task.successorCount}
                        </span>
                      </Button>
                    )}
                  </TableCell>

                  <TableCell className="px-1 py-0.5 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTaskClick(task.id)}
                      disabled={!canEdit}
                      className="h-6 w-6 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="border-t border-border bg-muted px-2 py-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            {visibleTasks.length} {t('tasksShown')}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-red-600" />
              <span>
                {tasks.filter((t) => t.isCritical).length} {t('critical')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
