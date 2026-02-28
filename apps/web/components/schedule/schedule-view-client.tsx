'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useMessageBus } from '@/hooks/use-message-bus'
import { GanttTimelineDynamic } from './gantt-timeline-dynamic'
import { GanttDataTable } from './gantt-data-table'
import { GanttControlPanel } from './gantt-control-panel'
import { DependencyManager } from './dependency-manager'
import { TaskEditDialog } from './task-edit-dialog'
import { DateRangeSlider } from './date-range-slider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import {
  setScheduleAsBaseline,
  approveSchedule,
  updateTaskDates,
} from '@/app/actions/schedule'
import type { getScheduleForView } from '@/app/actions/schedule'
import {
  Calendar,
  TrendingUp,
  CheckCircle2,
  Download,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export type ScheduleViewData = NonNullable<
  Awaited<ReturnType<typeof getScheduleForView>>
>

interface ScheduleViewClientProps {
  scheduleData: ScheduleViewData
  canEdit: boolean
  canSetBaseline: boolean
}

export function ScheduleViewClient({
  scheduleData,
  canEdit,
  canSetBaseline,
}: ScheduleViewClientProps) {
  const t = useTranslations('schedule')
  const router = useRouter()

  useMessageBus('WBS_NODE.CREATED', () => router.refresh())
  useMessageBus('WBS_NODE.UPDATED', () => router.refresh())
  useMessageBus('WBS_NODE.DELETED', () => router.refresh())
  useMessageBus('WBS_NODE.REORDERED', () => router.refresh())
  useMessageBus('PROJECT.UPDATED', () => router.refresh())

  const [exporting, setExporting] = useState(false)
  const [approving, setApproving] = useState(false)

  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('week')
  const [showCriticalPath, setShowCriticalPath] = useState(true)
  const [showBaseline, setShowBaseline] = useState(false)
  const [showProgress, setShowProgress] = useState(true)
  const [showDependencies, setShowDependencies] = useState(true)
  const [showTodayLine, setShowTodayLine] = useState(true)
  const [groupBy, setGroupBy] = useState<'none' | 'phase' | 'assigned'>('none')

  const [visibleStartDate, setVisibleStartDate] = useState(
    () => new Date(scheduleData.projectStartDate)
  )
  const [visibleEndDate, setVisibleEndDate] = useState(
    () => new Date(scheduleData.projectEndDate)
  )

  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<string | null>(
    null
  )
  const [selectedTaskForDependency, setSelectedTaskForDependency] = useState<
    string | null
  >(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [highlightedTask, setHighlightedTask] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const schedule = {
    ...scheduleData,
    projectStartDate: new Date(scheduleData.projectStartDate),
    projectEndDate: new Date(scheduleData.projectEndDate),
    tasks: scheduleData.tasks.map((task: (typeof scheduleData.tasks)[0]) => ({
      ...task,
      plannedStartDate: new Date(task.plannedStartDate),
      plannedEndDate: new Date(task.plannedEndDate),
      actualStartDate: task.actualStartDate
        ? new Date(task.actualStartDate)
        : null,
      actualEndDate: task.actualEndDate ? new Date(task.actualEndDate) : null,
    })),
  }

  useEffect(() => {
    if (scheduleData.tasks.length > 0) {
      setExpandedNodes(
        new Set(scheduleData.tasks.map((t: { id: string }) => t.id))
      )
    }
  }, [scheduleData.id, scheduleData.tasks.length])

  const ganttTasks = schedule.tasks.map((task: (typeof schedule.tasks)[0]) => {
    const level = task.wbsNode.code.split('.').length - 1
    return {
      id: task.id,
      name: `${task.wbsNode.code} ${task.wbsNode.name}`,
      startDate: task.plannedStartDate,
      endDate: task.plannedEndDate,
      progress: Number(task.progressPercent),
      isCritical: task.isCritical,
      level,
      taskType: (task.taskType as 'TASK' | 'SUMMARY' | 'MILESTONE') || 'TASK',
      dependencies: (task.successors as { id: string; successorId: string; dependencyType: string }[]).map(
        (dep) => ({
          id: dep.id,
          targetId: dep.successorId,
          type: dep.dependencyType as 'FS' | 'SS' | 'FF' | 'SF',
        })
      ),
    }
  })

  function shouldShowTask(
    task: { code: string; id: string },
    allTasks: { code: string; id: string }[]
  ): boolean {
    if (searchQuery) return true
    const levelCodes = task.code.split('.')
    for (let i = 1; i < levelCodes.length; i++) {
      const parentCode = levelCodes.slice(0, i).join('.')
      const parentTask = allTasks.find((t) => t.code === parentCode)
      if (parentTask && !expandedNodes.has(parentTask.id)) return false
    }
    return true
  }

  const tableTasks = schedule.tasks.map((task: (typeof schedule.tasks)[0]) => {
    const level = task.wbsNode.code.split('.').length - 1
    const predecessors = (task.predecessors || []) as {
      id: string
      predecessorId: string
      successorId: string
      dependencyType: string
      lagDays: number
      predecessor?: { wbsNode?: { name: string } }
    }[]
    const successors = (task.successors || []) as {
      id: string
      predecessorId: string
      successorId: string
      dependencyType: string
      lagDays: number
      successor?: { wbsNode?: { name: string } }
    }[]
    return {
      id: task.id,
      code: task.wbsNode.code,
      name: task.wbsNode.name,
      taskType: (task.taskType as 'TASK' | 'SUMMARY' | 'MILESTONE') || 'TASK',
      startDate: task.plannedStartDate,
      endDate: task.plannedEndDate,
      duration: task.plannedDuration,
      progress: Number(task.progressPercent),
      isCritical: task.isCritical,
      level,
      totalFloat: task.totalFloat,
      predecessorCount: predecessors.length,
      successorCount: successors.length,
    }
  })

  const filteredTableTasks = tableTasks.filter(
    (task) =>
      task.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const visibleTableTasks = filteredTableTasks.filter((task) =>
    shouldShowTask(task, tableTasks)
  )
  const visibleGanttTasks = ganttTasks.filter((t) =>
    visibleTableTasks.some((v) => v.id === t.id)
  )

  const totalTasks = schedule.tasks.length
  const criticalTasks = schedule.tasks.filter(
    (t: (typeof schedule.tasks)[0]) => t.isCritical
  ).length
  const completedTasks = schedule.tasks.filter(
    (t: (typeof schedule.tasks)[0]) => Number(t.progressPercent) === 100
  ).length
  const avgProgress =
    totalTasks > 0
      ? schedule.tasks.reduce(
          (sum: number, t: (typeof schedule.tasks)[0]) =>
            sum + Number(t.progressPercent),
          0
        ) / totalTasks
      : 0

  const projectDuration = Math.ceil(
    (schedule.projectEndDate.getTime() - schedule.projectStartDate.getTime()) /
      (1000 * 60 * 60 * 24)
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const delayedTasks = schedule.tasks.filter(
    (t: (typeof schedule.tasks)[0]) => {
      if (t.taskType !== 'TASK' || Number(t.progressPercent) >= 100) return false
      const planEnd = new Date(t.plannedEndDate)
      planEnd.setHours(0, 0, 0, 0)
      return planEnd.getTime() < today.getTime()
    }
  )

  async function handleExportPDF() {
    setExporting(true)
    try {
      const locale = typeof document !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
      const url = `/api/pdf?template=schedule&id=${encodeURIComponent(schedule.id)}&locale=${encodeURIComponent(locale)}&showEmitidoPor=1&showFullCompanyData=1`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? t('exportError'))
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? `cronograma-${schedule.id}.pdf`
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success(t('exportSuccess'), { description: t('pdfDownloaded') })
    } catch {
      toast.error(t('exportError'))
    } finally {
      setExporting(false)
    }
  }

  async function handleSetBaseline() {
    try {
      const result = await setScheduleAsBaseline(schedule.id)
      if (result.success) {
        toast.success(t('baselineSet'), { description: t('baselineSetDesc') })
        router.refresh()
      } else {
        toast.error(result.error ?? t('baselineSetError'))
      }
    } catch {
      toast.error(t('baselineSetError'))
    }
  }

  async function handleApproveSchedule() {
    setApproving(true)
    try {
      const result = await approveSchedule(schedule.id)
      if (result.success) {
        toast.success(t('approveScheduleSuccess'))
        router.refresh()
      } else {
        toast.error(result.error ?? t('approveScheduleError'))
      }
    } catch {
      toast.error(t('approveScheduleError'))
    } finally {
      setApproving(false)
    }
  }

  async function handleTaskDragEnd(
    taskId: string,
    newStartDate: Date,
    newEndDate: Date
  ) {
    if (!canEdit) {
      toast.error(t('cannotEditTask'))
      return
    }
    try {
      const result = await updateTaskDates(taskId, {
        plannedStartDate: newStartDate,
        plannedEndDate: newEndDate,
      })
      if (result.success) {
        toast.success(t('taskDatesUpdated'))
        router.refresh()
      } else {
        toast.error(result.error ?? t('updateError'))
      }
    } catch {
      toast.error(t('updateError'))
    }
  }

  function handleToggleExpand(taskId: string) {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  function handleRangeChange(startDate: Date, endDate: Date) {
    setVisibleStartDate(startDate)
    setVisibleEndDate(endDate)
  }

  const selectedTaskForEditData = selectedTaskForEdit
    ? schedule.tasks.find(
        (t: (typeof schedule.tasks)[0]) => t.id === selectedTaskForEdit
      )
    : null

  const selectedTaskForDependencyData = selectedTaskForDependency
    ? schedule.tasks.find(
        (t: (typeof schedule.tasks)[0]) => t.id === selectedTaskForDependency
      )
    : null

  type DepWithPredecessor = {
    id: string
    predecessorId: string
    successorId: string
    dependencyType: string
    lagDays: number
    predecessor?: { wbsNode?: { name: string } }
  }
  type DepWithSuccessor = {
    id: string
    predecessorId: string
    successorId: string
    dependencyType: string
    lagDays: number
    successor?: { wbsNode?: { name: string } }
  }

  const existingDependencies = selectedTaskForDependencyData
    ? [
        ...(selectedTaskForDependencyData.predecessors as DepWithPredecessor[]).map(
          (dep) => ({
            id: dep.id,
            predecessorId: dep.predecessorId,
            predecessorName:
              dep.predecessor?.wbsNode?.name ??
              schedule.tasks.find(
                (t: (typeof schedule.tasks)[0]) => t.id === dep.predecessorId
              )?.wbsNode.name ??
              '',
            successorId: dep.successorId,
            successorName: selectedTaskForDependencyData.wbsNode.name,
            type: dep.dependencyType as 'FS' | 'SS' | 'FF' | 'SF',
            lagDays: dep.lagDays,
          })
        ),
        ...(selectedTaskForDependencyData.successors as DepWithSuccessor[]).map(
          (dep) => ({
            id: dep.id,
            predecessorId: dep.predecessorId,
            predecessorName: selectedTaskForDependencyData.wbsNode.name,
            successorId: dep.successorId,
            successorName:
              dep.successor?.wbsNode?.name ??
              schedule.tasks.find(
                (t: (typeof schedule.tasks)[0]) => t.id === dep.successorId
              )?.wbsNode.name ??
              '',
            type: dep.dependencyType as 'FS' | 'SS' | 'FF' | 'SF',
            lagDays: dep.lagDays,
          })
        ),
      ]
    : []

  const editTaskDependencies = selectedTaskForEditData
    ? [
        ...((selectedTaskForEditData.predecessors as DepWithPredecessor[]) || []).map(
          (dep) => ({
            id: dep.id,
            predecessorName:
              dep.predecessor?.wbsNode?.name ??
              schedule.tasks.find(
                (t: (typeof schedule.tasks)[0]) => t.id === dep.predecessorId
              )?.wbsNode.name ??
              '',
            successorName: selectedTaskForEditData.wbsNode.name,
            type: dep.dependencyType,
          })
        ),
        ...((selectedTaskForEditData.successors as DepWithSuccessor[]) || []).map(
          (dep) => ({
            id: dep.id,
            predecessorName: selectedTaskForEditData.wbsNode.name,
            successorName:
              dep.successor?.wbsNode?.name ??
              schedule.tasks.find(
                (t: (typeof schedule.tasks)[0]) => t.id === dep.successorId
              )?.wbsNode.name ??
              '',
            type: dep.dependencyType,
          })
        ),
      ]
    : []

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('totalTasks')}
            </CardTitle>
            <Calendar className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-slate-500">
              {completedTasks} {t('completed')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('criticalPath')}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {criticalTasks}
            </div>
            <p className="text-xs text-slate-500">
              {totalTasks > 0
                ? ((criticalTasks / totalTasks) * 100).toFixed(1)
                : 0}
              % {t('ofTotal')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('duration')}
            </CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectDuration}</div>
            <p className="text-xs text-slate-500">{t('workingDays')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('progress')}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgProgress.toFixed(1)}%</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-green-600 transition-all"
                style={{ width: `${Math.min(100, avgProgress)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-sm font-medium text-slate-600">{t('status')}:</p>
            <Badge
              className={
                schedule.status === 'APPROVED'
                  ? 'bg-green-100 text-green-800'
                  : schedule.status === 'BASELINE'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-muted text-foreground'
              }
            >
              {schedule.status}
            </Badge>
            {!canEdit && schedule.status !== 'DRAFT' && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('editOnlyInDraft')}
              </p>
            )}
          </div>
          {schedule.isBaseline && (
            <div className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
              {t('baselineVersion')}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-600">
              {t('dateRange')}:
            </p>
            <p className="text-sm text-foreground">
              {format(schedule.projectStartDate, "dd 'de' MMMM, yyyy", {
                locale: es,
              })}{' '}
              -{' '}
              {format(schedule.projectEndDate, "dd 'de' MMMM, yyyy", {
                locale: es,
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canSetBaseline &&
            schedule.status === 'DRAFT' &&
            !schedule.isBaseline && (
              <Button onClick={handleSetBaseline} variant="outline">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t('setAsBaseline')}
              </Button>
            )}
          {canSetBaseline &&
            (schedule.status === 'DRAFT' || schedule.status === 'BASELINE') && (
              <Button
                onClick={handleApproveSchedule}
                disabled={approving}
                variant="default"
              >
                {approving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {t('approveSchedule')}
              </Button>
            )}
          <Button
            onClick={handleExportPDF}
            disabled={exporting}
            variant="outline"
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('exporting')}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {t('exportPDF')}
              </>
            )}
          </Button>
        </div>
      </div>

      {delayedTasks.length > 0 && (
        <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('delayedTasksAlert')}</AlertTitle>
          <AlertDescription>
            {t('delayedTasksAlertDesc', { count: delayedTasks.length })}
          </AlertDescription>
        </Alert>
      )}

      <GanttControlPanel
        showCriticalPath={showCriticalPath}
        onShowCriticalPathChange={setShowCriticalPath}
        showBaseline={showBaseline}
        onShowBaselineChange={setShowBaseline}
        showProgress={showProgress}
        onShowProgressChange={setShowProgress}
        showDependencies={showDependencies}
        onShowDependenciesChange={setShowDependencies}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        onExportPDF={handleExportPDF}
      />

      <DateRangeSlider
        projectStartDate={schedule.projectStartDate}
        projectEndDate={schedule.projectEndDate}
        currentStartDate={visibleStartDate}
        currentEndDate={visibleEndDate}
        onRangeChange={handleRangeChange}
        zoom={zoom}
        onZoomChange={setZoom}
      />

      <div className="space-y-1">
        <div className="flex w-full items-center gap-2">
          <Input
            placeholder={t('searchTasks')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 min-w-[320px] flex-1 max-w-full text-xs"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex h-[520px] min-h-0">
            <div className="flex min-h-0 flex-1 overflow-auto">
              <div className="min-w-[420px] shrink-0 border-r border-border">
                <GanttDataTable
                tasks={visibleTableTasks}
                allTasks={tableTasks}
                expandedNodes={expandedNodes}
                onToggleExpand={handleToggleExpand}
                onTaskClick={(taskId) => setSelectedTaskForEdit(taskId)}
                onDependenciesClick={(taskId) =>
                  setSelectedTaskForDependency(taskId)
                }
                onTaskDatesChange={handleTaskDragEnd}
                canEdit={canEdit}
                highlightedTask={highlightedTask}
                searchQuery={searchQuery}
                workingDaysPerWeek={schedule.workingDaysPerWeek}
              />
            </div>
            <div className="min-h-0 min-w-0 flex-1">
              <GanttTimelineDynamic
            tasks={visibleGanttTasks}
            visibleStartDate={visibleStartDate}
            visibleEndDate={visibleEndDate}
            zoom={zoom}
            showCriticalPath={showCriticalPath}
            showDependencies={showDependencies}
            showTodayLine={showTodayLine}
            workingDaysPerWeek={schedule.workingDaysPerWeek}
            onTaskClick={(taskId) => setSelectedTaskForEdit(taskId)}
            onTaskDragEnd={handleTaskDragEnd}
            highlightedTask={highlightedTask}
            onTaskHover={setHighlightedTask}
          />
              </div>
            </div>
          </div>
          <div
            className="flex flex-wrap items-center gap-4 border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
            role="img"
            aria-label={t('legendCriticalPath')}
          >
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-6 rounded-sm border border-red-800 bg-red-500"
              aria-hidden
            />
            {t('legendCriticalPath')}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 border-t-2 border-dashed border-red-600"
              aria-hidden
            />
            {t('legendToday')}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-6 rounded-sm border border-blue-800 bg-blue-500"
              aria-hidden
            />
            {t('legendTask')}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-5 rounded-sm border border-cyan-800 bg-cyan-500"
              aria-hidden
            />
            {t('legendSummary')}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rotate-45 border border-amber-700 bg-amber-500"
              aria-hidden
            />
            {t('legendMilestone')}
          </span>
          </div>
        </div>
      </div>

      {selectedTaskForEditData && (
        <TaskEditDialog
          open={!!selectedTaskForEdit}
          onOpenChange={(open) => !open && setSelectedTaskForEdit(null)}
          task={{
            id: selectedTaskForEditData.id,
            code: selectedTaskForEditData.wbsNode.code,
            name: selectedTaskForEditData.wbsNode.name,
            taskType: (selectedTaskForEditData.taskType as
              | 'TASK'
              | 'SUMMARY'
              | 'MILESTONE') || 'TASK',
            startDate: selectedTaskForEditData.plannedStartDate,
            endDate: selectedTaskForEditData.plannedEndDate,
            duration: selectedTaskForEditData.plannedDuration,
            progress: Number(selectedTaskForEditData.progressPercent),
            notes: selectedTaskForEditData.notes ?? null,
          }}
          workingDaysPerWeek={schedule.workingDaysPerWeek}
          canEdit={canEdit}
          dependencies={editTaskDependencies}
          onOpenDependencies={() => {
            if (selectedTaskForEdit) {
              setSelectedTaskForDependency(selectedTaskForEdit)
              setSelectedTaskForEdit(null)
            }
          }}
        />
      )}

      {selectedTaskForDependencyData && (
        <DependencyManager
          open={!!selectedTaskForDependency}
          onOpenChange={(open) =>
            !open && setSelectedTaskForDependency(null)
          }
          scheduleId={schedule.id}
          taskId={selectedTaskForDependency!}
          taskName={`${selectedTaskForDependencyData.wbsNode.code} ${selectedTaskForDependencyData.wbsNode.name}`}
          availableTasks={schedule.tasks.map(
            (t: (typeof schedule.tasks)[0]) => ({
              id: t.id,
              code: t.wbsNode.code,
              name: t.wbsNode.name,
            })
          )}
          existingDependencies={existingDependencies}
        />
      )}
    </div>
  )
}
