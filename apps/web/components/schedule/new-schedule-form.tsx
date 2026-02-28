'use client'

import { useState, useTransition } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { format } from 'date-fns'
import type { Locale } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { createScheduleFromWBS } from '@/app/actions/schedule'
import { Loader2, ArrowLeft, Calendar } from 'lucide-react'
import { Link } from '@/i18n/navigation'

const dateFnsLocaleMap: Record<string, Locale> = { es, en: enUS }

function toDateString(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().slice(0, 10)
}

function formatDateForDisplay(isoDate: string, locale: string): string {
  try {
    const date = new Date(isoDate + 'T12:00:00')
    const loc = dateFnsLocaleMap[locale] ?? es
    return format(date, 'd MMM yyyy', { locale: loc })
  } catch {
    return isoDate
  }
}

type NewScheduleFormProps = {
  projectId: string
  /** Fecha de inicio del proyecto (para pre-rellenar) */
  initialStartDate?: string | null
  /** Fecha estimada de finalización del proyecto (solo informativa) */
  plannedEndDate?: string | null
}

export function NewScheduleForm({
  projectId,
  initialStartDate,
  plannedEndDate,
}: NewScheduleFormProps) {
  const t = useTranslations('schedule')
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(toDateString(initialStartDate))
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState<number>(6)
  const [hoursPerDay, setHoursPerDay] = useState<number>(8)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !startDate) {
      toast.error(t('fillRequiredFields'))
      return
    }
    if (!projectId) {
      toast.error(t('error'))
      return
    }
    startTransition(async () => {
      try {
        const result = await createScheduleFromWBS(projectId, {
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
          toast.error(result.error ?? t('createScheduleError'))
        }
      } catch {
        toast.error(t('createScheduleError'))
      }
    })
  }

  const plannedEndStr = plannedEndDate ? toDateString(plannedEndDate) : null
  const plannedEndFormatted = plannedEndStr ? formatDateForDisplay(plannedEndStr, locale) : null

  return (
    <div className="flex flex-col items-center p-6">
      <div className="w-full max-w-4xl space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}/schedule`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToSchedule')}
          </Link>
        </Button>

        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">{t('createNewSchedule')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('createScheduleDesc')}</p>
        </div>

        <Card className="mx-auto w-full max-w-4xl">
          <CardHeader>
            <CardTitle>{t('scheduleDetails')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">{t('scheduleName')} *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('scheduleNamePlaceholder')}
                  disabled={isPending}
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <Label htmlFor="description">{t('description')}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  disabled={isPending}
                  className="mt-1 w-full min-h-[100px]"
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="startDate">{t('projectStartDate')} *</Label>
                <div className="relative mt-1 w-full max-w-md">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isPending}
                    className="min-w-[280px] w-full pl-10 py-2.5 text-base"
                  />
                </div>
                {plannedEndFormatted && (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {t('projectPlannedEndDate')}: <span className="font-medium text-foreground">{plannedEndFormatted}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="workingDays">{t('workingDaysPerWeek')}</Label>
                  <Select
                    value={workingDaysPerWeek.toString()}
                    onValueChange={(v) => setWorkingDaysPerWeek(parseInt(v))}
                    disabled={isPending}
                  >
                    <SelectTrigger id="workingDays" className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 {t('workingDays')} (Lun-Vie)</SelectItem>
                      <SelectItem value="6">6 {t('workingDays')} (Lun-Sáb)</SelectItem>
                      <SelectItem value="7">7 {t('workingDays')} (continuo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="hoursPerDay">{t('hoursPerDay')}</Label>
                  <Input
                    id="hoursPerDay"
                    type="number"
                    min={1}
                    max={24}
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(parseInt(e.target.value) || 8)}
                    disabled={isPending}
                    className="mt-1 w-full"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/40">
                <p className="text-sm text-blue-900 dark:text-blue-100">{t('scheduleCreationNote')}</p>
              </div>

              <div className="flex justify-end gap-2">
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
                      {t('creating')}
                    </>
                  ) : (
                    t('createSchedule')
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
