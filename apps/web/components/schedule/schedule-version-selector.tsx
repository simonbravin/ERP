'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type ScheduleVersionOption = {
  id: string
  name: string
  status: string
  isBaseline: boolean
  taskCount: number
}

type ScheduleVersionSelectorProps = {
  projectId: string
  schedules: ScheduleVersionOption[]
  /** Versión que se muestra ahora */
  activeScheduleId: string
  /** Versión que elegiría el servidor sin `?schedule=` (DRAFT → baseline → más reciente) */
  defaultScheduleId: string
}

export function ScheduleVersionSelector({
  projectId,
  schedules,
  activeScheduleId,
  defaultScheduleId,
}: ScheduleVersionSelectorProps) {
  const t = useTranslations('schedule')
  const router = useRouter()

  const baseHref = `/projects/${projectId}/schedule`

  function navigateToVersion(scheduleId: string) {
    if (scheduleId === defaultScheduleId) {
      router.push(baseHref)
      return
    }
    router.push(`${baseHref}?schedule=${encodeURIComponent(scheduleId)}`)
  }

  return (
    <div className="min-w-0 space-y-1.5 sm:max-w-md sm:flex-1">
      <Label htmlFor="schedule-version" className="text-xs text-muted-foreground">
        {t('scheduleVersionLabel')}
      </Label>
      <Select value={activeScheduleId} onValueChange={navigateToVersion}>
        <SelectTrigger id="schedule-version" className="h-9 w-full min-w-0 text-left text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {schedules.map((s) => (
            <SelectItem key={s.id} value={s.id} className="min-h-9 py-2">
              {s.name}
              {' — '}
              {s.status}
              {s.isBaseline ? ` · ${t('baseline')}` : ''}
              {` (${t('scheduleVersionTasks', { count: s.taskCount })})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
