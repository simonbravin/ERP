'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useTransition,
  type ComponentProps,
  type RefObject,
} from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useMessageBus } from '@/hooks/use-message-bus'
import { ScheduleCalendarBlock } from './schedule-calendar-block'
import { ScheduleSvarGantt } from './schedule-svar-gantt'
import { GanttControlPanel } from './gantt-control-panel'
import { DependencyManager } from './dependency-manager'
import { TaskEditDialog } from './task-edit-dialog'
import { DateRangeSlider } from './date-range-slider'
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
  updateScheduleProjectWindow,
} from '@/app/actions/schedule'
import { exportScheduleToExcel, exportScheduleToMsProjectXml } from '@/app/actions/export'
import type { getScheduleForView } from '@/app/actions/schedule'
import type { ScheduleAssignmentOption } from './schedule-view'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Search,
  ChevronDown,
} from 'lucide-react'
import { format, addDays, subDays, differenceInDays, startOfDay } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import type { WorkingDayOptions } from '@/lib/schedule/working-days'
import { cn } from '@/lib/utils'

function ScheduleMainChart({
  mode,
  scrollRef,
  layout,
  ganttProps,
  calendarProps,
}: {
  mode: 'gantt' | 'calendar'
  scrollRef: RefObject<HTMLDivElement | null>
  layout: 'page' | 'fullscreen'
  ganttProps: ComponentProps<typeof ScheduleSvarGantt>
  calendarProps: ComponentProps<typeof ScheduleCalendarBlock>
}) {
  if (mode === 'gantt') {
    const wrap =
      layout === 'page'
        ? 'flex min-h-0 w-full flex-1 overflow-auto'
        : 'flex min-h-0 flex-1 overflow-auto'
    const ganttClass =
      layout === 'page'
        ? cn('min-h-[520px] w-full flex-1', ganttProps.className)
        : cn('min-h-0 w-full flex-1', ganttProps.className)
    return (
      <div ref={scrollRef} className={wrap}>
        <ScheduleSvarGantt {...ganttProps} className={ganttClass} />
      </div>
    )
  }
  const calClass =
    layout === 'fullscreen'
      ? 'flex min-h-0 flex-1 overflow-auto'
      : calendarProps.className
  return (
    <ScheduleCalendarBlock
      {...calendarProps}
      scrollContainerRef={scrollRef}
      className={calClass}
    />
  )
}

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

  const [projectWindowStart, setProjectWindowStart] = useState(() =>
    format(startOfDay(new Date(scheduleData.projectStartDate)), 'yyyy-MM-dd')
  )
  const [projectWindowEnd, setProjectWindowEnd] = useState(() =>
    format(startOfDay(new Date(scheduleData.projectEndDate)), 'yyyy-MM-dd')
  )
  const [projectWindowSaving, setProjectWindowSaving] = useState(false)

  useEffect(() => {
    setProjectWindowStart(
      format(startOfDay(new Date(scheduleData.projectStartDate)), 'yyyy-MM-dd')
    )
    setProjectWindowEnd(
      format(startOfDay(new Date(scheduleData.projectEndDate)), 'yyyy-MM-dd')
    )
    setVisibleStartDate(startOfDay(new Date(scheduleData.projectStartDate)))
    setVisibleEndDate(startOfDay(new Date(scheduleData.projectEndDate)))
  }, [scheduleData.id, scheduleData.projectStartDate, scheduleData.projectEndDate])

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

  async function handleSaveProjectWindow() {
    if (!canEdit || schedule.status !== 'DRAFT') return
    setProjectWindowSaving(true)
    try {
      const [ys, ms, ds] = projectWindowStart.split('-').map(Number)
      const [ye, me, de] = projectWindowEnd.split('-').map(Number)
      const result = await updateScheduleProjectWindow(schedule.id, {
        projectStartDate: startOfDay(new Date(ys, ms - 1, ds)),
        projectEndDate: startOfDay(new Date(ye, me - 1, de)),
      })
      if (result.success === false) {
        toast.error(
          result.messageKey
            ? t(result.messageKey)
            : (result.error ?? t('projectWindowUpdateError'))
        )
        return
      }
      toast.success(t('projectWindowSaved'))
      router.refresh()
    } catch {
      toast.error(t('projectWindowUpdateError'))
    } finally {
      setProjectWindowSaving(false)
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

  const calendarBlockProps: ComponentProps<typeof ScheduleCalendarBlock> = {
    tableTasks: visibleTableTasks,
    allTableTasks: tableTasks,
    expandedNodes,
    onToggleExpand: handleToggleExpand,
    onTaskClick: (taskId) => {
      setHighlightedTask(taskId)
      setSelectedTaskForEdit(taskId)
      handleCenterOnTask(taskId)
    },
    onDependenciesClick: (taskId) => setSelectedTaskForDependency(taskId),
    onTaskDatesChange: handleTaskDragEnd,
    canEdit,
    highlightedTask,
    searchQuery,
    workingDaysPerWeek: schedule.workingDaysPerWeek,
    calendarOptions,
    groupBy,
    visibleStartDate,
    visibleEndDate,
    zoom,
    weekStartsOn,
    showWbsDetailColumns,
    wbsMinimalStrip: calendarWbsStrip,
  }

  const svarGanttProps: ComponentProps<typeof ScheduleSvarGantt> = {
    scheduleData,
    visibleTaskIds: svarVisibleTaskIds,
    visibleStartDate,
    visibleEndDate,
    zoom,
    weekStartsOn,
    readonly: svarGanttReadonly,
    showCriticalPath,
    showDependencies,
    showProgress,
    showTodayLine,
    showBaseline: showBaseline && baselineOverlayAvailable,
    baselinePlanByWbsNodeId: scheduleData.baselinePlanByWbsNodeId,
    onTaskDatesPersist: handleTaskDragEnd,
    onTaskProgressPersist: handleSvarProgressPersist,
    onDependencyAdd: handleSvarDependencyAdd,
    onDependencyRemove: handleSvarDependencyRemove,
    onTaskActivate: (taskId) => {
      setHighlightedTask(taskId)
      setSelectedTaskForEdit(taskId)
      handleCenterOnTask(taskId)
    },
  }

  return (
    <div className="erp-stack space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="erp-card erp-card-body">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">{t('totalTasks')}</p>
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{totalTasks}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {completedTasks} {t('completed')}
          </p>
        </div>
        <div className="erp-card erp-card-body">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">{t('criticalPath')}</p>
            <TrendingUp className="h-4 w-4 shrink-0 text-destructive" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-destructive">{criticalTasks}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalTasks > 0 ? ((criticalTasks / totalTasks) * 100).toFixed(1) : 0}% {t('ofTotal')}
          </p>
        </div>
        <div className="erp-card erp-card-body">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">{t('duration')}</p>
            <Calendar className="h-4 w-4 shrink-0 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{projectDuration}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('workingDays')}</p>
        </div>
        <div className="erp-card erp-card-body">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">{t('progress')}</p>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
            {avgProgress.toFixed(1)}%
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-emerald-600 transition-all dark:bg-emerald-500"
              style={{ width: `${Math.min(100, avgProgress)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="erp-card erp-card-body">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('status')}</p>
              <Badge
                className={cn(
                  'mt-1',
                  schedule.status === 'APPROVED' &&
                    'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
                  schedule.status === 'BASELINE' && 'bg-primary/15 text-primary',
                  schedule.status === 'DRAFT' && 'bg-muted text-foreground',
                  schedule.status !== 'APPROVED' &&
                    schedule.status !== 'BASELINE' &&
                    schedule.status !== 'DRAFT' &&
                    'bg-muted text-foreground'
                )}
              >
                {schedule.status}
              </Badge>
              {!canEdit && schedule.status !== 'DRAFT' && (
                <p className="mt-1 text-xs text-muted-foreground">{t('editOnlyInDraft')}</p>
              )}
            </div>
            {schedule.isBaseline && (
              <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {t('baselineVersion')}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">{t('dateRange')}</p>
              {canEdit && schedule.status === 'DRAFT' ? (
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="schedule-project-start" className="text-xs text-muted-foreground">
                      {t('projectStartDate')}
                    </Label>
                    <Input
                      id="schedule-project-start"
                      type="date"
                      className="h-10 w-full min-w-[160px] sm:w-[168px]"
                      value={projectWindowStart}
                      onChange={(e) => setProjectWindowStart(e.target.value)}
                      disabled={projectWindowSaving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="schedule-project-end" className="text-xs text-muted-foreground">
                      {t('projectPlannedEndDate')}
                    </Label>
                    <Input
                      id="schedule-project-end"
                      type="date"
                      className="h-10 w-full min-w-[160px] sm:w-[168px]"
                      value={projectWindowEnd}
                      onChange={(e) => setProjectWindowEnd(e.target.value)}
                      disabled={projectWindowSaving}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-10"
                    onClick={() => void handleSaveProjectWindow()}
                    disabled={projectWindowSaving}
                  >
                    {projectWindowSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('saving')}
                      </>
                    ) : (
                      t('projectWindowSave')
                    )}
                  </Button>
                </div>
              ) : (
                <p className="mt-1 text-sm text-foreground">
                  {format(schedule.projectStartDate, 'dd/MM/yyyy', { locale: dateLocale })} –{' '}
                  {format(schedule.projectEndDate, 'dd/MM/yyyy', { locale: dateLocale })}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canSetBaseline && schedule.status === 'DRAFT' && !schedule.isBaseline && (
              <Button onClick={handleSetBaseline} variant="outline" size="sm" className="h-10">
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
                  size="sm"
                  className="h-10"
                >
                  {approving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {t('approveSchedule')}
                </Button>
              )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-1">
                  <Download className="h-4 w-4" />
                  {t('exportMenuLabel')}
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem
                  disabled={exporting}
                  onSelect={() => {
                    void handleExportPDF()
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {exporting ? t('exporting') : t('exportPDF')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={exportingViewPDF}
                  onSelect={() => {
                    void handleExportPDFView()
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {exportingViewPDF ? t('exporting') : t('exportPDFView')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={exportingExcel}
                  onSelect={() => {
                    void handleExportExcel()
                  }}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {exportingExcel ? t('exportingExcel') : t('exportExcel')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={exportingMsXml}
                  onSelect={() => {
                    void handleExportMsProjectXml()
                  }}
                >
                  <FileCode2 className="mr-2 h-4 w-4" />
                  {exportingMsXml ? t('exportingMsProjectXml') : t('exportMsProjectXml')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              size="sm"
              className="h-10"
              disabled={importingMsXml || !canEdit || schedule.status !== 'DRAFT'}
              onClick={() => msXmlFileInputRef.current?.click()}
            >
              {importingMsXml ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {importingMsXml ? t('importingMsProjectXml') : t('importMsProjectXml')}
            </Button>
          </div>
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

      {isScheduleFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <span className="text-sm font-medium text-foreground">{t('fullscreen')}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 gap-2"
              onClick={() => setIsScheduleFullscreen(false)}
            >
              <Minimize2 className="h-4 w-4" />
              {t('exitFullscreen')}
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ minHeight: 0 }}>
            <ScheduleMainChart
              mode={viewMode}
              scrollRef={fullscreenScheduleScrollRef}
              layout="fullscreen"
              ganttProps={svarGanttProps}
              calendarProps={calendarBlockProps}
            />
          </div>
        </div>
      )}

      <Tabs
        value={viewMode}
        onValueChange={(v) => setViewMode(v as 'gantt' | 'calendar')}
        className="space-y-0"
      >
        <div className="erp-card">
          <div className="border-b border-border bg-muted/20 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-1">
                <h3 className="text-base font-semibold text-foreground">{t('scheduleWorkspaceTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('scheduleWorkspaceHint')}</p>
              </div>
              <TabsList className="grid h-10 w-full grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1 sm:flex sm:w-auto">
                <TabsTrigger
                  value="gantt"
                  className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-muted"
                >
                  {t('viewGantt')}
                </TabsTrigger>
                <TabsTrigger
                  value="calendar"
                  className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-muted"
                >
                  {t('viewCalendar')}
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
              <div className="relative min-w-0 flex-1 lg:max-w-md">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  placeholder={t('searchTasks')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full pl-9 text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => {
                    if (zoom === 'month') setZoom('week')
                    else if (zoom === 'week') setZoom('day')
                  }}
                  disabled={zoom === 'day'}
                  title={t('daily')}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Select
                  value={zoom}
                  onValueChange={(v) => setZoom(v as 'day' | 'week' | 'month')}
                >
                  <SelectTrigger className="h-9 w-[104px] border-0 bg-transparent text-sm shadow-none focus:ring-0">
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
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => {
                    if (zoom === 'day') setZoom('week')
                    else if (zoom === 'week') setZoom('month')
                  }}
                  disabled={zoom === 'month'}
                  title={t('monthly')}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-sm"
                  onClick={handleGoToToday}
                >
                  <Calendar className="h-4 w-4" />
                  {t('legendToday')}
                </Button>
                <Button
                  type="button"
                  variant={showWbsDetailColumns ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-pressed={showWbsDetailColumns}
                  title={
                    showWbsDetailColumns
                      ? t('wbsDetailColumnsHide')
                      : t('wbsDetailColumnsShow')
                  }
                  onClick={() => setShowWbsDetailColumns((v) => !v)}
                >
                  <Columns2 className="h-4 w-4" />
                </Button>
                {viewMode === 'calendar' && (
                  <Button
                    type="button"
                    variant={calendarWbsStrip ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-pressed={calendarWbsStrip}
                    title={
                      calendarWbsStrip ? t('calendarWbsWide') : t('calendarWbsNarrow')
                    }
                    onClick={() => setCalendarWbsStrip((v) => !v)}
                  >
                    {calendarWbsStrip ? (
                      <PanelLeft className="h-4 w-4" />
                    ) : (
                      <PanelLeftClose className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-sm"
                  onClick={() => setIsScheduleFullscreen(true)}
                >
                  <Maximize2 className="h-4 w-4" />
                  {t('fullscreen')}
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-muted/10 px-4 py-3 sm:px-6">
            <div className="space-y-3">
              <DateRangeSlider
                embedded
                projectStartDate={schedule.projectStartDate}
                projectEndDate={schedule.projectEndDate}
                currentStartDate={visibleStartDate}
                currentEndDate={visibleEndDate}
                onRangeChange={handleRangeChange}
              />
              <GanttControlPanel
                embedded
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
                showTodayLine={showTodayLine}
                onShowTodayLineChange={setShowTodayLine}
                todayLineApplicable={viewMode === 'gantt'}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
                weekStartsOn={weekStartsOn}
                onWeekStartsOnChange={setWeekStartsOn}
              />
            </div>
          </div>

          <div
            className="flex min-h-0 flex-col"
            style={{ minHeight: 'max(520px, 60vh)', maxHeight: '85vh' }}
          >
            <ScheduleMainChart
              mode={viewMode}
              scrollRef={mainScheduleScrollRef}
              layout="page"
              ganttProps={svarGanttProps}
              calendarProps={calendarBlockProps}
            />
          </div>
          <div
            className="flex flex-wrap items-center gap-4 border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:px-6"
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
                  className="h-3 w-6 rounded-sm border border-dashed border-slate-500 bg-slate-300/50 dark:border-slate-600 dark:bg-slate-600/40"
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
      </Tabs>

      {workloadByAssigneeRows.length > 0 && (
        <div className="erp-card overflow-hidden">
          <div className="erp-card-header">
            <h3 className="text-base font-semibold text-foreground">{t('workloadByAssigneeTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('workloadByAssigneeHint')}</p>
          </div>
          <div className="erp-card-body pt-0">
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
          </div>
        </div>
      )}

      <div className="erp-card overflow-hidden">
        <div className="erp-card-header">
          <h3 className="text-base font-semibold text-foreground">{t('calendarExceptionsTitle')}</h3>
          <p className="text-sm text-muted-foreground">{t('calendarExceptionsHint')}</p>
        </div>
        <div className="erp-card-body space-y-3">
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
