'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { addWorkingDays, type WorkingDayOptions } from '@/lib/schedule/working-days'
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
import {
  SCHEDULE_WBS_HEADER_HEIGHT,
  SCHEDULE_WBS_ROW_HEIGHT,
} from '@/lib/schedule/schedule-wbs-layout'

export interface ScheduleWbsPanelTask {
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

interface ScheduleWbsPanelProps {
  tasks: ScheduleWbsPanelTask[]
  allTasks?: ScheduleWbsPanelTask[]
  expandedNodes: Set<string>
  onToggleExpand: (taskId: string) => void
  /** Un clic: seleccionar / resaltar (Gantt y calendario alineados). */
  onTaskClick: (taskId: string) => void
  /** Doble clic en nombre o botón editar: abrir formulario de tarea. */
  onTaskEditClick: (taskId: string) => void
  onDependenciesClick: (taskId: string) => void
  onTaskDatesChange?: (taskId: string, newStartDate: Date, newEndDate: Date) => void
  canEdit: boolean
  highlightedTask: string | null
  searchQuery?: string
  workingDaysPerWeek?: number
  calendarOptions?: WorkingDayOptions
  groupBy?: 'none' | 'phase' | 'assigned'
  showDetailColumns?: boolean
  minimalWbsOnly?: boolean
  /** Falso junto al calendario: el pie extra desalineaba filas respecto a la grilla. */
  showFooter?: boolean
  /** Alinear tipografía y bordes con la grilla izquierda del Gantt SVAR. */
  matchGanttGrid?: boolean
  rootClassName?: string
}

export function ScheduleWbsPanel({
  tasks,
  allTasks: allTasksProp,
  expandedNodes,
  onToggleExpand,
  onTaskClick,
  onTaskEditClick,
  onDependenciesClick,
  onTaskDatesChange,
  canEdit,
  highlightedTask,
  searchQuery: _searchQuery = '',
  workingDaysPerWeek = 5,
  calendarOptions,
  groupBy: _groupBy = 'none',
  showDetailColumns = true,
  minimalWbsOnly = false,
  showFooter = true,
  matchGanttGrid = false,
  rootClassName,
}: ScheduleWbsPanelProps) {
  const allTasks = allTasksProp ?? tasks
  const t = useTranslations('schedule')
  const [editingCell, setEditingCell] = useState<{
    taskId: string
    field: 'start' | 'end' | 'days'
  } | null>(null)

  const visibleTasks = tasks

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col bg-card',
        matchGanttGrid && 'text-[11px] leading-tight',
        rootClassName
      )}
    >
      <div className="min-h-0 shrink-0 overflow-visible">
        <Table
          className={cn(
            minimalWbsOnly
              ? 'table-fixed w-full'
              : showDetailColumns
                ? 'table-fixed w-[520px]'
                : 'table-fixed w-[260px]',
            matchGanttGrid && '[&_tbody_tr]:border-b [&_tbody_tr]:border-border/80'
          )}
        >
          <TableHeader
            className={cn(
              'sticky top-0 z-10 [&_tr]:border-0',
              matchGanttGrid
                ? 'border-b border-border bg-card'
                : 'bg-muted'
            )}
          >
            <TableRow
              style={{ height: SCHEDULE_WBS_HEADER_HEIGHT }}
              className="[&>th]:!min-h-0 [&>th]:!py-0 [&>th]:align-middle [&>th]:leading-none"
            >
              {minimalWbsOnly ? (
                <TableHead
                  className={cn(
                    'w-full max-w-[72px] px-0.5 text-center text-[10px] text-muted-foreground',
                    matchGanttGrid && 'pl-2'
                  )}
                  style={{ height: SCHEDULE_WBS_HEADER_HEIGHT }}
                >
                  {t('code')}
                </TableHead>
              ) : (
                <>
                  <TableHead
                    className={cn(
                      'w-[72px] px-1 text-[10px] text-muted-foreground',
                      matchGanttGrid && 'pl-3.5'
                    )}
                    style={{ height: SCHEDULE_WBS_HEADER_HEIGHT }}
                  >
                    {t('code')}
                  </TableHead>
                  <TableHead
                    className={cn(
                      showDetailColumns
                        ? 'w-[140px] px-1 text-[10px] text-muted-foreground'
                        : 'w-[188px] px-1 text-[10px] text-muted-foreground',
                      matchGanttGrid && 'font-medium'
                    )}
                    style={{ height: SCHEDULE_WBS_HEADER_HEIGHT }}
                  >
                    {t('task')}
                  </TableHead>
                  {showDetailColumns ? (
                    <>
                      <TableHead
                        className="w-[72px] px-1 text-[10px] text-muted-foreground"
                        style={{ height: SCHEDULE_WBS_HEADER_HEIGHT }}
                      >
                        {t('start')}
                      </TableHead>
                      <TableHead
                        className="w-[72px] px-1 text-[10px] text-muted-foreground"
                        style={{ height: SCHEDULE_WBS_HEADER_HEIGHT }}
                      >
                        {t('end')}
                      </TableHead>
                      <TableHead
                        className="w-[44px] px-1 text-right text-[10px] text-muted-foreground"
                        style={{ height: SCHEDULE_WBS_HEADER_HEIGHT }}
                      >
                        {t('days')}
                      </TableHead>
                      <TableHead
                        className="w-[40px] px-1 text-right text-[10px] text-muted-foreground"
                        style={{ height: SCHEDULE_WBS_HEADER_HEIGHT }}
                      >
                        %
                      </TableHead>
                      <TableHead
                        className="w-[40px] px-1 text-center text-[10px] text-muted-foreground"
                        style={{ height: SCHEDULE_WBS_HEADER_HEIGHT }}
                      >
                        {t('deps')}
                      </TableHead>
                      <TableHead
                        className="w-[40px] px-1 text-center text-[10px] text-muted-foreground"
                        style={{ height: SCHEDULE_WBS_HEADER_HEIGHT }}
                      >
                        {t('actions')}
                      </TableHead>
                    </>
                  ) : null}
                </>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {visibleTasks.map((task) => {
              const hasChildren = allTasks.some(
                (x) => x.code.startsWith(`${task.code}.`) && x.code !== task.code
              )
              const isExpanded = expandedNodes.has(task.id)
              const isHighlighted = highlightedTask === task.id
              const isEditing = editingCell?.taskId === task.id
              const canEditDates =
                canEdit && onTaskDatesChange && task.taskType !== 'SUMMARY'

              const rowTitle = `${task.code} ${task.name}`

              return (
                <TableRow
                  key={task.id}
                  style={{ height: SCHEDULE_WBS_ROW_HEIGHT }}
                  className={cn(
                    'transition-colors hover:bg-muted/50 [&>td]:py-0 [&>td]:leading-none',
                    matchGanttGrid && 'hover:bg-muted/40',
                    isHighlighted && 'bg-primary/10',
                    task.isCritical && 'bg-destructive/10'
                  )}
                >
                  {minimalWbsOnly ? (
                    <TableCell className="max-w-[72px] px-0.5 py-0.5">
                      <div
                        className="flex min-w-0 items-center gap-0.5"
                        style={{ paddingLeft: `${task.level * 6}px` }}
                      >
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => onToggleExpand(task.id)}
                            className="shrink-0 rounded p-0.5 hover:bg-muted"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </button>
                        ) : (
                          <span className="inline-block w-4 shrink-0" />
                        )}
                        <button
                          type="button"
                          title={rowTitle}
                          onClick={() => onTaskClick(task.id)}
                          onDoubleClick={(e) => {
                            e.preventDefault()
                            onTaskEditClick(task.id)
                          }}
                          className="min-w-0 truncate text-left font-mono text-[9px] hover:underline"
                        >
                          {task.code}
                        </button>
                      </div>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell
                        className={cn(
                          'px-1 py-0.5 font-mono text-[10px]',
                          matchGanttGrid && 'pl-3.5 text-[11px]'
                        )}
                      >
                        {task.code}
                      </TableCell>

                      <TableCell className={cn('px-1 py-0.5', matchGanttGrid && 'text-[11px]')}>
                        <div
                          className="flex min-w-0 items-center gap-0.5"
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

                          <button
                            type="button"
                            className={cn(
                              'min-w-0 truncate text-left hover:underline',
                              matchGanttGrid ? 'text-[11px]' : 'text-xs',
                              task.taskType === 'SUMMARY' && 'font-semibold'
                            )}
                            title={task.name}
                            onClick={() => onTaskClick(task.id)}
                            onDoubleClick={(e) => {
                              e.preventDefault()
                              onTaskEditClick(task.id)
                            }}
                          >
                            {task.name}
                          </button>

                          {task.isCritical && (
                            <Badge variant="danger" className="h-4 shrink-0 px-1 text-[8px]">
                              {t('critical')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {showDetailColumns ? (
                        <>
                          <TableCell className="px-1 py-0.5">
                            {canEditDates &&
                            isEditing &&
                            editingCell?.field === 'start' ? (
                              <Input
                                type="date"
                                defaultValue={format(task.startDate, 'yyyy-MM-dd')}
                                onBlur={(e) => {
                                  const start = new Date(e.target.value)
                                  const end = addWorkingDays(
                                    start,
                                    task.duration,
                                    workingDaysPerWeek,
                                    calendarOptions
                                  )
                                  onTaskDatesChange(task.id, start, end)
                                  setEditingCell(null)
                                }}
                                className="h-5 w-full min-w-0 text-[10px]"
                                autoFocus
                              />
                            ) : (
                              <span
                                className={cn(
                                  'block text-[10px]',
                                  canEditDates &&
                                    'cursor-pointer rounded px-0.5 hover:bg-muted/50'
                                )}
                                title={canEditDates ? t('clickToEdit') : undefined}
                                onClick={() =>
                                  canEditDates &&
                                  setEditingCell({ taskId: task.id, field: 'start' })
                                }
                              >
                                {format(task.startDate, 'dd/MM/yyyy')}
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="px-1 py-0.5">
                            {canEditDates && isEditing && editingCell?.field === 'end' ? (
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
                                className={cn(
                                  'block text-[10px]',
                                  canEditDates &&
                                    'cursor-pointer rounded px-0.5 hover:bg-muted/50'
                                )}
                                title={canEditDates ? t('clickToEdit') : undefined}
                                onClick={() =>
                                  canEditDates &&
                                  setEditingCell({ taskId: task.id, field: 'end' })
                                }
                              >
                                {format(task.endDate, 'dd/MM/yyyy')}
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="px-1 py-0.5 text-right">
                            {canEditDates && isEditing && editingCell?.field === 'days' ? (
                              <Input
                                type="number"
                                min={1}
                                defaultValue={task.duration}
                                onBlur={(e) => {
                                  const dur = Math.max(1, parseInt(e.target.value, 10) || 1)
                                  const start = new Date(task.startDate)
                                  const end = addWorkingDays(
                                    start,
                                    dur,
                                    workingDaysPerWeek,
                                    calendarOptions
                                  )
                                  onTaskDatesChange(task.id, start, end)
                                  setEditingCell(null)
                                }}
                                className="h-5 w-12 text-right text-[10px]"
                                autoFocus
                              />
                            ) : (
                              <span
                                className={cn(
                                  'block font-mono text-[10px]',
                                  canEditDates &&
                                    'cursor-pointer rounded px-0.5 hover:bg-muted/50'
                                )}
                                title={canEditDates ? t('clickToEdit') : undefined}
                                onClick={() =>
                                  canEditDates &&
                                  setEditingCell({ taskId: task.id, field: 'days' })
                                }
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
                              <span className="font-mono text-[9px] text-muted-foreground">
                                {task.progress}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="px-1 py-0.5 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDependenciesClick(task.id)}
                              className="h-6 w-6 p-0"
                              title={
                                task.predecessorCount + task.successorCount > 0
                                  ? `${task.predecessorCount + task.successorCount} ${t('deps')}`
                                  : t('manageDependencies')
                              }
                            >
                              <GitBranch className="h-3 w-3 text-muted-foreground" />
                              <span className="ml-1 text-[9px]">
                                {task.predecessorCount + task.successorCount || '−'}
                              </span>
                            </Button>
                          </TableCell>

                          <TableCell className="px-1 py-0.5 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onTaskEditClick(task.id)}
                              disabled={!canEdit}
                              className="h-6 w-6 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </>
                      ) : null}
                    </>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {showFooter && !minimalWbsOnly ? (
        <div className="border-t border-border bg-muted px-2 py-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {visibleTasks.length} {t('tasksShown')}
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-destructive" />
                <span>
                  {tasks.filter((x) => x.isCritical).length} {t('critical')}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
