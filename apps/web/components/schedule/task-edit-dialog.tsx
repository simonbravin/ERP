'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { updateTaskDates, updateTaskProgress } from '@/app/actions/schedule'
import { Loader2, Calendar, Clock, GitBranch } from 'lucide-react'
import { format } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import {
  addWorkingDays,
  countWorkingDays,
  type WorkingDayOptions,
} from '@/lib/schedule/working-days'
import { parseLocalYmd } from '@/lib/parse-local-ymd'
import type { ScheduleAssignmentOption } from './schedule-view'

interface TaskEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: {
    id: string
    code: string
    name: string
    taskType: 'TASK' | 'SUMMARY' | 'MILESTONE'
    startDate: Date
    endDate: Date
    duration: number
    progress: number
    notes?: string | null
    assignedTo?: string | null
  }
  workingDaysPerWeek: number
  calendarOptions?: WorkingDayOptions
  canEdit: boolean
  /** Estado del cronograma (p. ej. DRAFT). El avance y el resto de ediciones solo aplican en DRAFT. */
  scheduleStatus: string
  dependencies?: Array<{
    id: string
    predecessorName: string
    successorName: string
    type: string
  }>
  onOpenDependencies?: () => void
  /** Miembros del proyecto; el valor elegido se guarda en `assigned_to` (texto). */
  assignmentOptions?: ScheduleAssignmentOption[]
}

export function TaskEditDialog({
  open,
  onOpenChange,
  task,
  workingDaysPerWeek,
  calendarOptions,
  canEdit,
  scheduleStatus,
  dependencies = [],
  onOpenDependencies,
  assignmentOptions = [],
}: TaskEditDialogProps) {
  const t = useTranslations('schedule')
  const intlLocale = useLocale()
  const dateLocale = intlLocale.startsWith('en') ? enUS : es
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const planEditableInView =
    scheduleStatus === 'DRAFT' || scheduleStatus === 'BASELINE'
  const mayEdit = canEdit && planEditableInView

  const [startDate, setStartDate] = useState(format(task.startDate, 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(task.endDate, 'yyyy-MM-dd'))
  const [duration, setDuration] = useState(task.duration)
  const [progress, setProgress] = useState(task.progress)
  const [notes, setNotes] = useState(task.notes || '')
  const [assignedTo, setAssignedTo] = useState(task.assignedTo || '')

  useEffect(() => {
    setStartDate(format(task.startDate, 'yyyy-MM-dd'))
    setEndDate(format(task.endDate, 'yyyy-MM-dd'))
    setDuration(task.duration)
    setProgress(task.progress)
    setNotes(task.notes || '')
    setAssignedTo(task.assignedTo || '')
  }, [
    task.id,
    task.startDate,
    task.endDate,
    task.duration,
    task.progress,
    task.notes,
    task.assignedTo,
  ])

  const assigneeSelectValue = useMemo(() => {
    const trimmed = assignedTo.trim()
    if (!trimmed) return '_none'
    if (assignmentOptions.some((o) => o.value === trimmed)) return trimmed
    return '_custom'
  }, [assignedTo, assignmentOptions])

  function handleStartDateChange(newStart: string) {
    setStartDate(newStart)
    const start = parseLocalYmd(newStart)
    const end = addWorkingDays(start, duration, workingDaysPerWeek, calendarOptions)
    setEndDate(format(end, 'yyyy-MM-dd'))
  }

  function handleEndDateChange(newEnd: string) {
    setEndDate(newEnd)
    const start = parseLocalYmd(startDate)
    const end = parseLocalYmd(newEnd)
    const newDuration = countWorkingDays(start, end, workingDaysPerWeek, calendarOptions)
    setDuration(Math.max(1, newDuration))
  }

  function handleDurationChange(newDuration: number) {
    const durValue = Math.max(1, newDuration)
    setDuration(durValue)
    const start = parseLocalYmd(startDate)
    const end = addWorkingDays(start, durValue, workingDaysPerWeek, calendarOptions)
    setEndDate(format(end, 'yyyy-MM-dd'))
  }

  function handleSave() {
    if (!mayEdit) {
      toast.error(
        !canEdit
          ? t('cannotEditTask')
          : t('editApprovedFrozen')
      )
      return
    }

    if (task.taskType === 'SUMMARY') {
      toast.error(t('cannotEditSummaryTask'))
      return
    }

    startTransition(async () => {
      try {
        const dateResult = await updateTaskDates(task.id, {
          plannedStartDate: parseLocalYmd(startDate),
          plannedEndDate: parseLocalYmd(endDate),
          plannedDuration: duration,
          notes: notes || null,
          assignedTo: assignedTo.trim() || null,
        })

        if (!dateResult.success) {
          toast.error(dateResult.error || t('updateError'))
          return
        }

        const progressResult = await updateTaskProgress(task.id, {
          progressPercent: progress,
        })

        if (!progressResult.success) {
          toast.error(progressResult.error || t('updateError'))
          return
        }

        toast.success(t('taskUpdated'))
        router.refresh()
        onOpenChange(false)
      } catch {
        toast.error(t('updateError'))
      }
    })
  }

  const isSummary = task.taskType === 'SUMMARY'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('editTask')}</DialogTitle>
          <DialogDescription>
            {task.code} - {task.name}
          </DialogDescription>
        </DialogHeader>

        {!mayEdit && (
          <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {!canEdit ? t('cannotEditTask') : t('editApprovedFrozen')}
          </p>
        )}

        <div className="space-y-4">
          {isSummary && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm text-foreground">{t('summaryTaskNote')}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">{t('startDate')} *</Label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  disabled={!mayEdit || isSummary || isPending}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="endDate">{t('endDate')} *</Label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  disabled={!mayEdit || isSummary || isPending}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">
                {t('duration')} ({t('workingDays')})
              </Label>
              <div className="relative mt-1">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) =>
                    handleDurationChange(parseInt(e.target.value, 10) || 1)
                  }
                  disabled={!mayEdit || isSummary || isPending}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="progress">{t('progress')} (%)</Label>
              <div className="mt-1 space-y-2">
                <Input
                  id="progress"
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) =>
                    setProgress(
                      Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
                    )
                  }
                  disabled={!mayEdit || isPending}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(parseInt(e.target.value, 10))}
                  disabled={!mayEdit || isPending}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="assignedTo">{t('taskAssignedTo')}</Label>
            {assignmentOptions.length > 0 && (
              <Select
                value={assigneeSelectValue}
                onValueChange={(v) => {
                  if (v === '_none') setAssignedTo('')
                  else if (v === '_custom') {
                    /* keep current text for free edit */
                  } else setAssignedTo(v)
                }}
                disabled={!mayEdit || isSummary || isPending}
              >
                <SelectTrigger id="assignee-pick" className="mt-1 h-9">
                  <SelectValue placeholder={t('taskAssignPickFromTeam')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t('taskAssignNone')}</SelectItem>
                  {assignmentOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="_custom">{t('taskAssignCustom')}</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Input
              id="assignedTo"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder={t('taskAssignedToPlaceholder')}
              disabled={!mayEdit || isSummary || isPending}
              className="mt-1"
              maxLength={500}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('taskAssignedToHint')}</p>
          </div>

          <div>
            <Label htmlFor="notes">{t('notes')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              disabled={!mayEdit || isPending}
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">
                  {t('calculatedStart')}:
                </span>
                <p className="text-foreground">
                  {format(parseLocalYmd(startDate), 'EEEE dd/MM/yyyy', {
                    locale: dateLocale,
                  })}
                </p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  {t('calculatedEnd')}:
                </span>
                <p className="text-foreground">
                  {format(parseLocalYmd(endDate), 'EEEE dd/MM/yyyy', {
                    locale: dateLocale,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                {t('dependencies')}
              </Label>
              {onOpenDependencies && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenDependencies()
                    onOpenChange(false)
                  }}
                  disabled={!mayEdit}
                >
                  {t('manageDependencies')}
                </Button>
              )}
            </div>
            {dependencies.length > 0 ? (
              <ul className="max-h-32 space-y-1 overflow-y-auto rounded border border-slate-200 p-2 text-sm">
                {dependencies.map((dep) => (
                  <li key={dep.id} className="flex items-center gap-2 text-slate-700">
                    <span className="truncate">{dep.predecessorName}</span>
                    <span className="text-slate-400">→</span>
                    <span className="truncate">{dep.successorName}</span>
                    <span className="rounded bg-muted px-1 text-xs">{dep.type}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded border border-dashed border-border p-2 text-xs text-muted-foreground">
                {t('noDependenciesYet')}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !mayEdit || isSummary}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('saveChanges')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
