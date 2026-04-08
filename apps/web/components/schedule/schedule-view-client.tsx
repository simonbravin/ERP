'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import { useMessageBus } from '@/hooks/use-message-bus'
import { ScheduleGanttBlock } from './schedule-gantt-block'
import { ScheduleSvarGantt } from './schedule-svar-gantt'
import { GanttControlPanel } from './gantt-control-panel'
import { DependencyManager } from './dependency-manager'
import { TaskEditDialog } from './task-edit-dialog'
import { DateRangeSlider } from './date-range-slider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  setScheduleAsBaseline,
  approveSchedule,
  updateTaskDates,
  updateTaskProgress,
  addTaskDependency,
  removeTaskDependency,
  updateScheduleNonWorkingDates,
  importScheduleFromMsProjectXml,
} from '@/app/actions/schedule'
import { exportScheduleToExcel, exportScheduleToMsProjectXml } from '@/app/actions/export'
import type { getScheduleForView } from '@/app/actions/schedule'
import type { ScheduleAssignmentOption } from './schedule-view'
import {
  Calendar,
  TrendingUp,
  CheckCircle2,
  Download,
  Loader2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Columns2,
  PanelLeftClose,
  PanelLeft,
  FileSpreadsheet,
  FileCode2,
  Upload,
} from 'lucide-react'
import { format, addDays, subDays, differenceInDays, startOfDay } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import type { WorkingDayOptions } from '@/lib/schedule/working-days'

export type ScheduleViewData = NonNullable<
  Awaited<ReturnType<typeof getScheduleForView>>
>

interface ScheduleViewClientProps {
  scheduleData: ScheduleViewData
  canEdit: boolean
  canSetBaseline: boolean
  canCreateVersion?: boolean
  /** Miembros del proyecto (nombre guardado en `assigned_to`, texto libre). */
  assignmentOptions?: ScheduleAssignmentOption[]
}

export function ScheduleViewClient({
  scheduleData,
  canEdit,
  canSetBaseline,
  canCreateVersion = false,
  assignmentOptions = [],
}: ScheduleViewClientProps) {
  const t = useTranslations('schedule')
  const intlLocale = useLocale()
  const dateLocale = intlLocale.startsWith('en') ? enUS : es
  const router = useRouter()

  useMessageBus('WBS_NODE.CREATED', () => router.refresh())
  useMessageBus('WBS_NODE.UPDATED', () => router.refresh())
  useMessageBus('WBS_NODE.DELETED', () => router.refresh())
  useMessageBus('WBS_NODE.REORDERED', () => router.refresh())
  useMessageBus('PROJECT.UPDATED', () => router.refresh())

  const [calendarSavePending, startCalendarSave] = useTransition()
  const [exporting, setExporting] = useState(false)
  const [exportingViewPDF, setExportingViewPDF] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingMsXml, setExportingMsXml] = useState(false)
  const [importingMsXml, setImportingMsXml] = useState(false)
  const msXmlFileInputRef = useRef<HTMLInputElement>(null)
  const [approving, setApproving] = useState(false)

  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('week')
  const [showCriticalPath, setShowCriticalPath] = useState(true)
  const [showBaseline, setShowBaseline] = useState(false)

  const baselineOverlayAvailable = Boolean(
    scheduleData.baselinePlanByWbsNodeId &&
      Object.keys(scheduleData.baselinePlanByWbsNodeId).length > 0
  )

  useEffect(() => {
    if (!baselineOverlayAvailable) setShowBaseline(false)
  }, [baselineOverlayAvailable, scheduleData.id])
  const [showProgress, setShowProgress] = useState(true)
  const [showDependencies, setShowDependencies] = useState(true)
  const [showTodayLine, setShowTodayLine] = useState(true)
  const [groupBy, setGroupBy] = useState<'none' | 'phase' | 'assigned'>('none')
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(1)
  const [viewMode, setViewMode] = useState<'gantt' | 'calendar'>('gantt')

  const baselineChartOverlaySupported = viewMode === 'gantt'
  const [showWbsDetailColumns, setShowWbsDetailColumns] = useState(true)
  const [calendarWbsStrip, setCalendarWbsStrip] = useState(false)

  const mainScheduleScrollRef = useRef<HTMLDivElement>(null)
  const fullscreenScheduleScrollRef = useRef<HTMLDivElement>(null)

  const schedulePrefsKey = `bloqer-schedule-prefs-${scheduleData.id}`
  useEffect(() => {
    try {
      const raw = localStorage.getItem(schedulePrefsKey)
      if (!raw) return
      const stored = JSON.parse(raw) as Partial<{
        zoom: 'day' | 'week' | 'month'
        showCriticalPath: boolean
        showBaseline: boolean
        showProgress: boolean
        showDependencies: boolean
        showTodayLine: boolean
        groupBy: 'none' | 'phase' | 'assigned'
        weekStartsOn: 0 | 1
        viewMode: 'gantt' | 'calendar'
        showWbsDetailColumns: boolean
        calendarWbsStrip: boolean
      }>
      if (stored.zoom && ['day', 'week', 'month'].includes(stored.zoom)) setZoom(stored.zoom)
      if (typeof stored.showCriticalPath === 'boolean') setShowCriticalPath(stored.showCriticalPath)
      if (
        typeof stored.showBaseline === 'boolean' &&
        baselineOverlayAvailable
      ) {
        setShowBaseline(stored.showBaseline)
      }
      if (typeof stored.showProgress === 'boolean') setShowProgress(stored.showProgress)
      if (typeof stored.showDependencies === 'boolean') setShowDependencies(stored.showDependencies)
      if (typeof stored.showTodayLine === 'boolean') setShowTodayLine(stored.showTodayLine)
      if (stored.groupBy && ['none', 'phase', 'assigned'].includes(stored.groupBy)) setGroupBy(stored.groupBy)
      if (stored.weekStartsOn === 0 || stored.weekStartsOn === 1) setWeekStartsOn(stored.weekStartsOn)
      if (stored.viewMode && ['gantt', 'calendar'].includes(stored.viewMode)) setViewMode(stored.viewMode)
      if (typeof stored.showWbsDetailColumns === 'boolean')
        setShowWbsDetailColumns(stored.showWbsDetailColumns)
      if (typeof stored.calendarWbsStrip === 'boolean') setCalendarWbsStrip(stored.calendarWbsStrip)
    } catch {
      // ignore invalid stored prefs
    }
  }, [schedulePrefsKey, baselineOverlayAvailable])

  const hasPersistedOnce = useRef(false)
  useEffect(() => {
    if (!hasPersistedOnce.current) {
      hasPersistedOnce.current = true
      return
    }
    localStorage.setItem(
      schedulePrefsKey,
      JSON.stringify({
        zoom,
        showCriticalPath,
        showBaseline,
        showProgress,
        showDependencies,
        showTodayLine,
        groupBy,
        weekStartsOn,
        viewMode,
        showWbsDetailColumns,
        calendarWbsStrip,
      })
    )
  }, [
    schedulePrefsKey,
    zoom,
    showCriticalPath,
    showBaseline,
    showProgress,
    showDependencies,
    showTodayLine,
    groupBy,
    weekStartsOn,
    viewMode,
    showWbsDetailColumns,
    calendarWbsStrip,
  ])

  const [visibleStartDate, setVisibleStartDate] = useState(
    () => startOfDay(new Date(scheduleData.projectStartDate))
  )
  const [visibleEndDate, setVisibleEndDate] = useState(
    () => startOfDay(new Date(scheduleData.projectEndDate))
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
  const [isScheduleFullscreen, setIsScheduleFullscreen] = useState(false)

  useEffect(() => {
    if (!isScheduleFullscreen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsScheduleFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isScheduleFullscreen])

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

  const nonWorkingKey = (scheduleData.nonWorkingDates ?? []).join('|')

  const calendarOptions = useMemo((): WorkingDayOptions | undefined => {
    if (!nonWorkingKey) return undefined
    return { nonWorkingDates: nonWorkingKey.split('|') }
  }, [nonWorkingKey])

  const [exceptionsText, setExceptionsText] = useState(() =>
    (scheduleData.nonWorkingDates ?? []).join('\n')
  )
  useEffect(() => {
    setExceptionsText(nonWorkingKey ? nonWorkingKey.split('|').join('\n') : '')
  }, [scheduleData.id, nonWorkingKey])

  // Stable across router.refresh(): parent often passes a new `tasks` array reference with the same ids.
  const expandedNodesResetKey = `${scheduleData.id}:${[...scheduleData.tasks]
    .map((t: { id: string }) => t.id)
    .sort()
    .join('|')}`

  useEffect(() => {
    const tasks = scheduleData.tasks
    if (tasks.length > 0) {
      setExpandedNodes(new Set(tasks.map((t: { id: string }) => t.id)))
    }
    // expandedNodesResetKey captures task id set; do not depend on `tasks` array identity (refresh()).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync expand-all only when schedule or task ids change
  }, [expandedNodesResetKey])

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
      assignedTo: task.assignedTo ?? null,
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
  const sortedByGroup =
    groupBy === 'phase'
      ? [...filteredTableTasks].sort((a, b) => {
          const phaseA = a.code.split('.')[0]
          const phaseB = b.code.split('.')[0]
          return phaseA.localeCompare(phaseB, undefined, { numeric: true })
        })
      : groupBy === 'assigned'
        ? [...filteredTableTasks].sort((a, b) => {
            const aAssigned = (a.assignedTo ?? '').trim().toLowerCase()
            const bAssigned = (b.assignedTo ?? '').trim().toLowerCase()
            if (aAssigned !== bAssigned) {
              // First show assigned tasks, then unassigned ones.
              if (!aAssigned) return 1
              if (!bAssigned) return -1
              return aAssigned.localeCompare(bAssigned, undefined, { numeric: true })
            }
            return a.code.localeCompare(b.code, undefined, { numeric: true })
          })
      : filteredTableTasks
  const visibleTableTasks = sortedByGroup.filter((task) =>
    shouldShowTask(task, tableTasks)
  )
  const svarVisibleTaskIds = useMemo(
    () => new Set<string>(visibleTableTasks.map((r) => r.id)),
    [visibleTableTasks]
  )

  const svarGanttReadonly = !canEdit || schedule.status !== 'DRAFT'

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

  const workloadByAssigneeRows = (() => {
    const counts = new Map<string, number>()
    for (const t of schedule.tasks) {
      if (t.taskType === 'SUMMARY') continue
      const raw =
        typeof t.assignedTo === 'string' ? t.assignedTo.trim() : ''
      const k = raw || '__unassigned__'
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => {
        if (a.key === '__unassigned__' && b.key !== '__unassigned__') return 1
        if (b.key === '__unassigned__' && a.key !== '__unassigned__') return -1
        if (b.count !== a.count) return b.count - a.count
        return a.key.localeCompare(b.key, undefined, { sensitivity: 'base' })
      })
  })()

  async function handleExportPDF() {
    setExporting(true)
    try {
      const locale = typeof document !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
      const params = new URLSearchParams({
        template: 'schedule',
        id: schedule.id,
        locale,
        showEmitidoPor: '1',
        showFullCompanyData: '1',
      })
      const toYmd = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      params.set('from', toYmd(visibleStartDate))
      params.set('to', toYmd(visibleEndDate))
      const url = `/api/pdf?${params.toString()}`
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

  async function handleExportPDFView() {
    setExportingViewPDF(true)
    try {
      const locale = typeof document !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
      const params = new URLSearchParams({
        template: 'schedule',
        id: schedule.id,
        locale,
        mode: 'view',
        showEmitidoPor: '1',
        showFullCompanyData: '1',
      })
      const toYmd = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      params.set('from', toYmd(visibleStartDate))
      params.set('to', toYmd(visibleEndDate))
      const url = `/api/pdf?${params.toString()}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? t('exportError'))
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? `cronograma-vista-${schedule.id}.pdf`
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success(t('exportSuccess'), { description: t('pdfDownloaded') })
    } catch {
      toast.error(t('exportError'))
    } finally {
      setExportingViewPDF(false)
    }
  }

  async function handleExportExcel() {
    setExportingExcel(true)
    try {
      const locale =
        typeof document !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
      const result = await exportScheduleToExcel(schedule.id, locale)
      if (!result.success) {
        toast.error(result.error ?? t('exportExcelError'))
        return
      }
      if (result.data && result.filename) {
        const bin = atob(result.data)
        const arr = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        const blob = new Blob([arr], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = result.filename
        link.click()
        URL.revokeObjectURL(link.href)
        toast.success(t('exportExcelSuccess'), {
          description: t('exportExcelDownloaded'),
        })
      }
    } catch {
      toast.error(t('exportExcelError'))
    } finally {
      setExportingExcel(false)
    }
  }

  async function handleExportMsProjectXml() {
    setExportingMsXml(true)
    try {
      const result = await exportScheduleToMsProjectXml(schedule.id)
      if (!result.success) {
        toast.error(result.error ?? t('exportMsProjectXmlError'))
        return
      }
      if (result.data && result.filename) {
        const bin = atob(result.data)
        const arr = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        const blob = new Blob([arr], {
          type: 'application/xml',
        })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = result.filename
        link.click()
        URL.revokeObjectURL(link.href)
        toast.success(t('exportMsProjectXmlSuccess'))
      }
    } catch {
      toast.error(t('exportMsProjectXmlError'))
    } finally {
      setExportingMsXml(false)
    }
  }

  async function handleMsXmlFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!canEdit || schedule.status !== 'DRAFT') {
      toast.error(t('importMsProjectXmlDraftOnly'))
      return
    }
    setImportingMsXml(true)
    try {
      const text = await file.text()
      const result = await importScheduleFromMsProjectXml(schedule.id, text)
      if (!result.success) {
        toast.error(result.error ?? t('importMsProjectXmlError'))
        return
      }
      toast.success(
        t('importMsProjectXmlSuccess', {
          tasks: result.updatedTasks ?? 0,
          deps: result.createdDependencies ?? 0,
        })
      )
      router.refresh()
    } catch {
      toast.error(t('importMsProjectXmlError'))
    } finally {
      setImportingMsXml(false)
    }
  }

  function handleSaveCalendarExceptions() {
    if (!canEdit || schedule.status !== 'DRAFT') return
    startCalendarSave(async () => {
      try {
        const result = await updateScheduleNonWorkingDates(schedule.id, exceptionsText)
        if (result.success) {
          toast.success(t('calendarExceptionsSaved'))
          router.refresh()
        } else {
          toast.error(result.error ?? t('calendarExceptionsError'))
        }
      } catch {
        toast.error(t('calendarExceptionsError'))
      }
    })
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

  const handleSvarProgressPersist = useCallback(
    async (taskId: string, progressPercent: number) => {
      try {
        const result = await updateTaskProgress(taskId, { progressPercent })
        if (result.success) {
          toast.success(t('taskUpdated'))
          router.refresh()
        } else {
          toast.error(result.error ?? t('updateError'))
        }
      } catch {
        toast.error(t('updateError'))
      }
    },
    [router, t]
  )

  const handleSvarDependencyAdd = useCallback(
    async (input: {
      predecessorId: string
      successorId: string
      dependencyType: 'FS' | 'SS' | 'FF' | 'SF'
      lagDays: number
    }) => {
      try {
        const result = await addTaskDependency({
          scheduleId: schedule.id,
          predecessorId: input.predecessorId,
          successorId: input.successorId,
          dependencyType: input.dependencyType,
          lagDays: input.lagDays,
        })
        if (result.success) {
          toast.success(t('dependencyAddedDesc'))
          router.refresh()
        } else {
          toast.error(result.error ?? t('dependencyAddError'))
        }
      } catch {
        toast.error(t('dependencyAddError'))
      }
    },
    [schedule.id, router, t]
  )

  const handleSvarDependencyRemove = useCallback(
    async (dependencyId: string) => {
      try {
        const result = await removeTaskDependency(dependencyId)
        if (result.success) {
          toast.success(t('dependencyRemovedDesc'))
          router.refresh()
        } else {
          toast.error(result.error ?? t('dependencyRemoveError'))
        }
      } catch {
        toast.error(t('dependencyRemoveError'))
      }
    },
    [router, t]
  )

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
    setVisibleStartDate(startOfDay(startDate))
    setVisibleEndDate(startOfDay(endDate))
  }

  const scrollScheduleToTop = useCallback(() => {
    requestAnimationFrame(() => {
      const el = isScheduleFullscreen
        ? fullscreenScheduleScrollRef.current
        : mainScheduleScrollRef.current
      el?.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }, [isScheduleFullscreen])

  function handleGoToToday() {
    const today = startOfDay(new Date())
    const projectStart = startOfDay(schedule.projectStartDate)
    const projectEnd = startOfDay(schedule.projectEndDate)
    const daysToShow = Math.max(
      14,
      differenceInDays(visibleEndDate, visibleStartDate) + 1
    )

    // Primera columna visible = hoy (calendario real), sin forzar inicio de proyecto.
    const newStart = today
    const newEnd = addDays(newStart, daysToShow - 1)

    if (today < projectStart || today > projectEnd) {
      toast.info(t('todayOutsideProject'), {
        description: t('todayOutsideProjectHint'),
      })
    }

    handleRangeChange(newStart, newEnd)
    scrollScheduleToTop()
  }

  function handleCenterOnTask(taskId: string) {
    const task = schedule.tasks.find(
      (t: (typeof schedule.tasks)[0]) => t.id === taskId
    )
    if (!task) return
    const taskStart = new Date(task.plannedStartDate)
    taskStart.setHours(0, 0, 0, 0)
    const taskEnd = new Date(task.plannedEndDate)
    taskEnd.setHours(0, 0, 0, 0)
    const projectStart = new Date(schedule.projectStartDate)
    projectStart.setHours(0, 0, 0, 0)
    const projectEnd = new Date(schedule.projectEndDate)
    projectEnd.setHours(0, 0, 0, 0)
    const paddingDays = 7
    const totalDays = Math.max(
      14,
      differenceInDays(taskEnd, taskStart) + 1 + paddingDays * 2
    )
    const half = Math.floor((totalDays - (differenceInDays(taskEnd, taskStart) + 1)) / 2)
    let newStart = subDays(taskStart, half)
    let newEnd = addDays(newStart, totalDays - 1)
    if (newStart < projectStart) {
      newStart = new Date(projectStart)
      newEnd = addDays(newStart, totalDays - 1)
    }
    if (newEnd > projectEnd) {
      newEnd = new Date(projectEnd)
      newStart = subDays(newEnd, totalDays - 1)
    }
    if (newStart < projectStart) {
      newStart = new Date(projectStart)
    }
    handleRangeChange(newStart, newEnd)
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
              {format(schedule.projectStartDate, 'dd/MM/yyyy', {
                locale: dateLocale,
              })}{' '}
              –{' '}
              {format(schedule.projectEndDate, 'dd/MM/yyyy', {
                locale: dateLocale,
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
          <Button
            onClick={handleExportExcel}
            disabled={exportingExcel}
            variant="outline"
          >
            {exportingExcel ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('exportingExcel')}
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t('exportExcel')}
              </>
            )}
          </Button>
          <Button
            onClick={handleExportMsProjectXml}
            disabled={exportingMsXml}
            variant="outline"
          >
            {exportingMsXml ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('exportingMsProjectXml')}
              </>
            ) : (
              <>
                <FileCode2 className="mr-2 h-4 w-4" />
                {t('exportMsProjectXml')}
              </>
            )}
          </Button>
          <input
            ref={msXmlFileInputRef}
            type="file"
            accept=".xml,application/xml,text/xml"
            className="hidden"
            onChange={handleMsXmlFileSelected}
          />
          <Button
            type="button"
            variant="outline"
            disabled={importingMsXml || !canEdit || schedule.status !== 'DRAFT'}
            onClick={() => msXmlFileInputRef.current?.click()}
          >
            {importingMsXml ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('importingMsProjectXml')}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {t('importMsProjectXml')}
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

      {workloadByAssigneeRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('workloadByAssigneeTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('workloadByAssigneeHint')}</p>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('taskAssignedTo')}</TableHead>
                  <TableHead className="w-[120px] text-right">{t('workloadColTasks')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workloadByAssigneeRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="text-sm">
                      {row.key === '__unassigned__'
                        ? t('workloadUnassigned')
                        : row.key}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {t('workloadTaskCount', { count: row.count })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!canEdit && schedule.status !== 'DRAFT' && canCreateVersion && (
        <Alert>
          <AlertTitle>{t('scheduleEditBlockedTitle')}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{t('scheduleEditBlockedBody', { status: schedule.status })}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="default">
                <Link href={`/projects/${schedule.project.id}/schedule/new?from=${schedule.id}`}>
                  {t('newRevisionFromPlan')}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/projects/${schedule.project.id}/schedule/new`}>
                  {t('scheduleCreateNewVersionCta')}
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('calendarExceptionsTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('calendarExceptionsHint')}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="schedule-non-working-dates" className="text-sm">
              {t('calendarExceptionsLabel')}
            </Label>
            <Textarea
              id="schedule-non-working-dates"
              value={exceptionsText}
              onChange={(e) => setExceptionsText(e.target.value)}
              placeholder={t('calendarExceptionsPlaceholder')}
              rows={4}
              disabled={!canEdit || schedule.status !== 'DRAFT' || calendarSavePending}
              className="font-mono text-sm"
            />
          </div>
          {(!canEdit || schedule.status !== 'DRAFT') && (
            <p className="text-xs text-muted-foreground">{t('calendarExceptionsReadOnly')}</p>
          )}
          {canEdit && schedule.status === 'DRAFT' && (
            <Button
              type="button"
              size="sm"
              onClick={handleSaveCalendarExceptions}
              disabled={calendarSavePending}
            >
              {calendarSavePending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('calendarExceptionsSaving')}
                </>
              ) : (
                t('calendarExceptionsSave')
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <GanttControlPanel
        showCriticalPath={showCriticalPath}
        onShowCriticalPathChange={setShowCriticalPath}
        showBaseline={showBaseline}
        onShowBaselineChange={setShowBaseline}
        baselineOverlayAvailable={baselineOverlayAvailable}
        baselineChartOverlaySupported={baselineChartOverlaySupported}
        showProgress={showProgress}
        onShowProgressChange={setShowProgress}
        showDependencies={showDependencies}
        onShowDependenciesChange={setShowDependencies}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        weekStartsOn={weekStartsOn}
        onWeekStartsOnChange={setWeekStartsOn}
        onExportPDF={handleExportPDF}
        onExportPDFView={handleExportPDFView}
        exportingPDFView={exportingViewPDF}
        onExportExcel={handleExportExcel}
        exportingExcel={exportingExcel}
      />

      <DateRangeSlider
        projectStartDate={schedule.projectStartDate}
        projectEndDate={schedule.projectEndDate}
        currentStartDate={visibleStartDate}
        currentEndDate={visibleEndDate}
        onRangeChange={handleRangeChange}
      />

      <div className="space-y-1">
        <div className="flex w-full flex-wrap items-center gap-2">
          <Input
            placeholder={t('searchTasks')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 min-w-[320px] flex-1 max-w-full text-xs"
          />
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                if (zoom === 'month') setZoom('week')
                else if (zoom === 'week') setZoom('day')
              }}
              disabled={zoom === 'day'}
              title={t('daily')}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Select
              value={zoom}
              onValueChange={(v) => setZoom(v as 'day' | 'week' | 'month')}
            >
              <SelectTrigger className="h-7 w-[90px] border-0 bg-transparent text-xs shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t('daily')}</SelectItem>
                <SelectItem value="week">{t('weekly')}</SelectItem>
                <SelectItem value="month">{t('monthly')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                if (zoom === 'day') setZoom('week')
                else if (zoom === 'week') setZoom('month')
              }}
              disabled={zoom === 'month'}
              title={t('monthly')}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleGoToToday}
            >
              <Calendar className="h-3.5 w-3.5" />
              {t('legendToday')}
            </Button>
            <Select
              value={viewMode}
              onValueChange={(v) => setViewMode(v as 'gantt' | 'calendar')}
            >
              <SelectTrigger className="h-7 w-[100px] border-0 bg-transparent text-xs shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gantt">{t('viewGantt')}</SelectItem>
                <SelectItem value="calendar">{t('viewCalendar')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant={showWbsDetailColumns ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              aria-pressed={showWbsDetailColumns}
              title={
                showWbsDetailColumns
                  ? t('wbsDetailColumnsHide')
                  : t('wbsDetailColumnsShow')
              }
              onClick={() => setShowWbsDetailColumns((v) => !v)}
            >
              <Columns2 className="h-3.5 w-3.5" />
            </Button>
            {viewMode === 'calendar' && (
              <Button
                type="button"
                variant={calendarWbsStrip ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                aria-pressed={calendarWbsStrip}
                title={
                  calendarWbsStrip ? t('calendarWbsWide') : t('calendarWbsNarrow')
                }
                onClick={() => setCalendarWbsStrip((v) => !v)}
              >
                {calendarWbsStrip ? (
                  <PanelLeft className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftClose className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setIsScheduleFullscreen(true)}
              title={t('fullscreen')}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              {t('fullscreen')}
            </Button>
          </div>
        </div>

        {isScheduleFullscreen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
              <span className="text-sm font-medium">{t('fullscreen')}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsScheduleFullscreen(false)}
                className="gap-1.5"
              >
                <Minimize2 className="h-4 w-4" />
                {t('exitFullscreen')}
              </Button>
            </div>
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{ minHeight: 0 }}
            >
              {viewMode === 'gantt' ? (
                <div
                  ref={fullscreenScheduleScrollRef}
                  className="flex min-h-0 flex-1 overflow-auto"
                >
                  <ScheduleSvarGantt
                    scheduleData={scheduleData}
                    visibleTaskIds={svarVisibleTaskIds}
                    visibleStartDate={visibleStartDate}
                    visibleEndDate={visibleEndDate}
                    zoom={zoom}
                    weekStartsOn={weekStartsOn}
                    readonly={svarGanttReadonly}
                    showCriticalPath={showCriticalPath}
                    showDependencies={showDependencies}
                    showProgress={showProgress}
                    showTodayLine={showTodayLine}
                    showBaseline={showBaseline && baselineOverlayAvailable}
                    baselinePlanByWbsNodeId={scheduleData.baselinePlanByWbsNodeId}
                    className="min-h-0 w-full flex-1"
                    onTaskDatesPersist={handleTaskDragEnd}
                    onTaskProgressPersist={handleSvarProgressPersist}
                    onDependencyAdd={handleSvarDependencyAdd}
                    onDependencyRemove={handleSvarDependencyRemove}
                    onTaskActivate={(taskId) => {
                      setHighlightedTask(taskId)
                      setSelectedTaskForEdit(taskId)
                      handleCenterOnTask(taskId)
                    }}
                  />
                </div>
              ) : (
                <ScheduleGanttBlock
                  tableTasks={visibleTableTasks}
                  allTableTasks={tableTasks}
                  expandedNodes={expandedNodes}
                  onToggleExpand={handleToggleExpand}
                  onTaskClick={(taskId) => {
                    setHighlightedTask(taskId)
                    setSelectedTaskForEdit(taskId)
                    handleCenterOnTask(taskId)
                  }}
                  onDependenciesClick={(taskId) =>
                    setSelectedTaskForDependency(taskId)
                  }
                  onTaskDatesChange={handleTaskDragEnd}
                  canEdit={canEdit}
                  highlightedTask={highlightedTask}
                  searchQuery={searchQuery}
                  workingDaysPerWeek={schedule.workingDaysPerWeek}
                  calendarOptions={calendarOptions}
                  groupBy={groupBy}
                  visibleStartDate={visibleStartDate}
                  visibleEndDate={visibleEndDate}
                  zoom={zoom}
                  weekStartsOn={weekStartsOn}
                  scrollContainerRef={fullscreenScheduleScrollRef}
                  showWbsDetailColumns={showWbsDetailColumns}
                  wbsMinimalStrip={calendarWbsStrip}
                />
              )}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex min-h-0" style={{ minHeight: 'max(520px, 60vh)', maxHeight: '85vh' }}>
            {viewMode === 'gantt' ? (
              <div
                ref={mainScheduleScrollRef}
                className="flex min-h-0 w-full flex-1 overflow-auto"
              >
                <ScheduleSvarGantt
                  scheduleData={scheduleData}
                  visibleTaskIds={svarVisibleTaskIds}
                  visibleStartDate={visibleStartDate}
                  visibleEndDate={visibleEndDate}
                  zoom={zoom}
                  weekStartsOn={weekStartsOn}
                  readonly={svarGanttReadonly}
                  showCriticalPath={showCriticalPath}
                  showDependencies={showDependencies}
                  showProgress={showProgress}
                  showTodayLine={showTodayLine}
                  showBaseline={showBaseline && baselineOverlayAvailable}
                  baselinePlanByWbsNodeId={scheduleData.baselinePlanByWbsNodeId}
                  className="min-h-[520px] w-full flex-1"
                  onTaskDatesPersist={handleTaskDragEnd}
                  onTaskProgressPersist={handleSvarProgressPersist}
                  onDependencyAdd={handleSvarDependencyAdd}
                  onDependencyRemove={handleSvarDependencyRemove}
                  onTaskActivate={(taskId) => {
                    setHighlightedTask(taskId)
                    setSelectedTaskForEdit(taskId)
                    handleCenterOnTask(taskId)
                  }}
                />
              </div>
            ) : (
              <ScheduleGanttBlock
                tableTasks={visibleTableTasks}
                allTableTasks={tableTasks}
                expandedNodes={expandedNodes}
                onToggleExpand={handleToggleExpand}
                onTaskClick={(taskId) => {
                  setHighlightedTask(taskId)
                  setSelectedTaskForEdit(taskId)
                  handleCenterOnTask(taskId)
                }}
                onDependenciesClick={(taskId) =>
                  setSelectedTaskForDependency(taskId)
                }
                onTaskDatesChange={handleTaskDragEnd}
                canEdit={canEdit}
                highlightedTask={highlightedTask}
                searchQuery={searchQuery}
                workingDaysPerWeek={schedule.workingDaysPerWeek}
                calendarOptions={calendarOptions}
                groupBy={groupBy}
                visibleStartDate={visibleStartDate}
                visibleEndDate={visibleEndDate}
                zoom={zoom}
                weekStartsOn={weekStartsOn}
                scrollContainerRef={mainScheduleScrollRef}
                showWbsDetailColumns={showWbsDetailColumns}
                wbsMinimalStrip={calendarWbsStrip}
              />
            )}
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
          {baselineOverlayAvailable && (
            <span className="flex items-center gap-1.5">
              <span
                className="h-3 w-6 rounded-sm border border-dashed border-slate-500 bg-slate-300/50"
                aria-hidden
              />
              {t('legendBaseline')}
            </span>
          )}
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
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTaskForEdit(null)
              setHighlightedTask(null)
            }
          }}
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
            assignedTo: selectedTaskForEditData.assignedTo ?? null,
          }}
          workingDaysPerWeek={schedule.workingDaysPerWeek}
          calendarOptions={calendarOptions}
          canEdit={canEdit}
          scheduleStatus={schedule.status}
          assignmentOptions={assignmentOptions}
          dependencies={editTaskDependencies}
          onOpenDependencies={() => {
            if (selectedTaskForEdit) {
              setSelectedTaskForDependency(selectedTaskForEdit)
              setSelectedTaskForEdit(null)
              setHighlightedTask(null)
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
          canEdit={canEdit}
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
