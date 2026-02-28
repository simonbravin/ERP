'use client'

import { useState, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
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
import { toast } from 'sonner'
import { updateTaskDates, updateTaskProgress } from '@/app/actions/schedule'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Calendar, Clock, GitBranch } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { addWorkingDays, countWorkingDays } from '@/lib/schedule/working-days'

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
  }
  workingDaysPerWeek: number
  canEdit: boolean
  dependencies?: Array<{
    id: string
    predecessorName: string
    successorName: string
    type: string
  }>
  onOpenDependencies?: () => void
}

export function TaskEditDialog({
  open,
  onOpenChange,
  task,
  workingDaysPerWeek,
  canEdit,
  dependencies = [],
  onOpenDependencies,
}: TaskEditDialogProps) {
  const t = useTranslations('schedule')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [startDate, setStartDate] = useState(format(task.startDate, 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(task.endDate, 'yyyy-MM-dd'))
  const [duration, setDuration] = useState(task.duration)
  const [progress, setProgress] = useState(task.progress)
  const [notes, setNotes] = useState(task.notes || '')

  useEffect(() => {
    setStartDate(format(task.startDate, 'yyyy-MM-dd'))
    setEndDate(format(task.endDate, 'yyyy-MM-dd'))
    setDuration(task.duration)
    setProgress(task.progress)
    setNotes(task.notes || '')
  }, [task.id, task.startDate, task.endDate, task.duration, task.progress, task.notes])

  function handleStartDateChange(newStart: string) {
    setStartDate(newStart)
    const start = new Date(newStart)
    const end = addWorkingDays(start, duration, workingDaysPerWeek)
    setEndDate(format(end, 'yyyy-MM-dd'))
  }

  function handleEndDateChange(newEnd: string) {
    setEndDate(newEnd)
    const start = new Date(startDate)
    const end = new Date(newEnd)
    const newDuration = countWorkingDays(start, end, workingDaysPerWeek)
    setDuration(Math.max(1, newDuration))
  }

  function handleDurationChange(newDuration: number) {
    const durValue = Math.max(1, newDuration)
    setDuration(durValue)
    const start = new Date(startDate)
    const end = addWorkingDays(start, durValue, workingDaysPerWeek)
    setEndDate(format(end, 'yyyy-MM-dd'))
  }

  function handleSave() {
    if (!canEdit) {
      toast.error(t('cannotEditTask'))
      return
    }

    if (task.taskType === 'SUMMARY') {
      toast.error(t('cannotEditSummaryTask'))
      return
    }

    startTransition(async () => {
      try {
        const dateResult = await updateTaskDates(task.id, {
          plannedStartDate: new Date(startDate),
          plannedEndDate: new Date(endDate),
          plannedDuration: duration,
          notes: notes || null,
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

        {!canEdit && (
          <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertDescription>{t('cannotEditTask')}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {isSummary && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-900">ℹ️ {t('summaryTaskNote')}</p>
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
                  disabled={!canEdit || isSummary || isPending}
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
                  disabled={!canEdit || isSummary || isPending}
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
                  disabled={!canEdit || isSummary || isPending}
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
                  disabled={!canEdit || isPending}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(parseInt(e.target.value, 10))}
                  disabled={!canEdit || isPending}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">{t('notes')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              disabled={!canEdit || isPending}
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
                  {format(
                    new Date(startDate),
                    "EEEE, dd 'de' MMMM yyyy",
                    { locale: es }
                  )}
                </p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  {t('calculatedEnd')}:
                </span>
                <p className="text-foreground">
                  {format(
                    new Date(endDate),
                    "EEEE, dd 'de' MMMM yyyy",
                    { locale: es }
                  )}
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
                  disabled={!canEdit}
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
            disabled={isPending || !canEdit || isSummary}
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
