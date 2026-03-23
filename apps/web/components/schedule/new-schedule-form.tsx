'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createScheduleFromWBS, duplicateScheduleAsDraft } from '@/app/actions/schedule'
import { updateProject } from '@/app/actions/projects'
import { Loader2, Calendar } from 'lucide-react'

function toDateString(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().slice(0, 10)
}

type NewScheduleFormProps = {
  projectId: string
  /** Fecha de inicio del proyecto (para pre-rellenar) */
  initialStartDate?: string | null
  /** Fecha estimada de finalización del proyecto (solo informativa) */
  plannedEndDate?: string | null
  /** Si está definido, duplica ese cronograma en un DRAFT en lugar de crear desde WBS */
  duplicateFromScheduleId?: string | null
  defaultRevisionName?: string | null
  duplicateSourceLabel?: string | null
}

export function NewScheduleForm({
  projectId,
  initialStartDate,
  plannedEndDate,
  duplicateFromScheduleId = null,
  defaultRevisionName = null,
  duplicateSourceLabel = null,
}: NewScheduleFormProps) {
  const t = useTranslations('schedule')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(defaultRevisionName ?? '')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(toDateString(initialStartDate))
  const [plannedEnd, setPlannedEnd] = useState(toDateString(plannedEndDate))
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState<number>(6)
  const [hoursPerDay, setHoursPerDay] = useState<number>(8)

  const isDuplicate = Boolean(duplicateFromScheduleId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name) {
      toast.error(t('fillRequiredFields'))
      return
    }
    if (!isDuplicate && !startDate) {
      toast.error(t('fillRequiredFields'))
      return
    }
    if (!projectId) {
      toast.error(t('error'))
      return
    }
    startTransition(async () => {
      try {
        if (plannedEnd) {
          const updateResult = await updateProject(projectId, {
            plannedEndDate: new Date(plannedEnd),
          })
          if ('error' in updateResult && updateResult.error) {
            toast.error(t('updateProjectEndDateError', { defaultValue: 'No se pudo actualizar la fecha de fin del proyecto' }))
            return
          }
        }
        const result = isDuplicate && duplicateFromScheduleId
          ? await duplicateScheduleAsDraft(duplicateFromScheduleId, {
              name,
              description: description || undefined,
            })
          : await createScheduleFromWBS(projectId, {
              name,
              description: description || undefined,
              projectStartDate: new Date(startDate),
              workingDaysPerWeek,
              hoursPerDay,
            })
        if (result.success && result.tasksCreated != null) {
          toast.success(t('scheduleCreated'), {
            description: t('scheduleCreatedDesc', { count: result.tasksCreated }),
          })
          router.push(`/projects/${projectId}/schedule`)
        } else {
          toast.error(
            result.error ??
              (isDuplicate ? t('duplicateScheduleError') : t('createScheduleError'))
          )
        }
      } catch {
        toast.error(isDuplicate ? t('duplicateScheduleError') : t('createScheduleError'))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="erp-form-page space-y-6">
      <div className="space-y-5">
        <div className="erp-form-group">
          <Label htmlFor="name" className="erp-form-label">{t('scheduleName')} *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('scheduleNamePlaceholder')}
            disabled={isPending}
            className="mt-1 w-full min-w-0"
          />
        </div>

        <div className="erp-form-group">
          <Label htmlFor="description" className="erp-form-label">{t('description')}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            disabled={isPending}
            className="mt-1 w-full min-w-0 min-h-[120px] resize-y"
            rows={4}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!isDuplicate && (
            <div className="erp-form-group">
              <Label htmlFor="startDate" className="erp-form-label">{t('projectStartDate')} *</Label>
              <div className="relative mt-1 w-full">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isPending}
                  className="w-full pl-10 min-w-0"
                />
              </div>
            </div>
          )}
          <div className={`erp-form-group ${isDuplicate ? 'sm:col-span-2' : ''}`}>
            <Label htmlFor="plannedEndDate" className="erp-form-label">{t('projectPlannedEndDate')}</Label>
            <div className="relative mt-1 w-full">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="plannedEndDate"
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
                disabled={isPending}
                className="w-full pl-10 min-w-0"
              />
            </div>
          </div>
        </div>

        {!isDuplicate && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="erp-form-group">
              <Label htmlFor="workingDays" className="erp-form-label">{t('workingDaysPerWeek')}</Label>
              <Select
                value={workingDaysPerWeek.toString()}
                onValueChange={(v) => setWorkingDaysPerWeek(parseInt(v))}
                disabled={isPending}
              >
                <SelectTrigger id="workingDays" className="mt-1 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 {t('workingDays')} (Lun-Vie)</SelectItem>
                  <SelectItem value="6">6 {t('workingDays')} (Lun-Sáb)</SelectItem>
                  <SelectItem value="7">7 {t('workingDays')} (continuo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="erp-form-group">
              <Label htmlFor="hoursPerDay" className="erp-form-label">{t('hoursPerDay')}</Label>
              <Input
                id="hoursPerDay"
                type="number"
                min={1}
                max={24}
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(parseInt(e.target.value) || 8)}
                disabled={isPending}
                className="mt-1 w-full min-w-0"
              />
            </div>
          </div>
        )}

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/40">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            {isDuplicate ? t('duplicateRevisionNote') : t('scheduleCreationNote')}
          </p>
          {isDuplicate && duplicateSourceLabel ? (
            <p className="mt-2 text-sm text-blue-900/90 dark:text-blue-100/90">
              {t('duplicateSourceFrom', { name: duplicateSourceLabel })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isDuplicate ? t('duplicateRevisionCreating') : t('creating')}
            </>
          ) : (
            isDuplicate ? t('duplicateRevisionSubmit') : t('createSchedule')
          )}
        </Button>
      </div>
    </form>
  )
}
