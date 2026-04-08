'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import { useLocale } from 'next-intl'
import { getScheduleAuditLogs } from '@/app/actions/schedule'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2 } from 'lucide-react'

type LogRow = Awaited<
  ReturnType<typeof getScheduleAuditLogs>
>['logs'][number]

function snapshotSummary(row: LogRow): string {
  const dj = row.detailsJson as Record<string, unknown> | null
  const desc = dj?.description
  if (typeof desc === 'string' && desc.trim().length > 0) return desc
  if (row.action && row.entityType) {
    return `${row.action} · ${row.entityType}`
  }
  return row.action || '—'
}

export function ScheduleChangeLogDialog({
  scheduleId,
  open,
  onOpenChange,
}: {
  scheduleId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('schedule')
  const intlLocale = useLocale()
  const dateLocale = intlLocale.startsWith('en') ? enUS : es
  const [logs, setLogs] = useState<LogRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setError(null)
    startTransition(() => {
      void getScheduleAuditLogs(scheduleId).then((res) => {
        if (res.success) {
          setLogs(res.logs)
        } else {
          setLogs([])
          setError(res.error ?? t('scheduleChangeLogError'))
        }
      })
    })
  }, [open, scheduleId, t])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t('scheduleChangeLogTitle')}</DialogTitle>
        </DialogHeader>
        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('scheduleChangeLogLoading')}
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {!pending && !error && logs.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('scheduleChangeLogEmpty')}</p>
        )}
        {logs.length > 0 && (
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">{t('scheduleChangeLogWhen')}</TableHead>
                  <TableHead className="w-[160px]">{t('scheduleChangeLogWho')}</TableHead>
                  <TableHead>{t('scheduleChangeLogWhat')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((row) => {
                  const who =
                    (row.actor?.fullName ?? '').trim() ||
                    row.actor?.email ||
                    '—'
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap align-top text-xs tabular-nums text-muted-foreground">
                        {format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm', {
                          locale: dateLocale,
                        })}
                      </TableCell>
                      <TableCell className="align-top text-sm">{who}</TableCell>
                      <TableCell className="align-top text-sm">
                        <div className="font-medium text-foreground">
                          {snapshotSummary(row)}
                        </div>
                        {(row.beforeSnapshot != null || row.afterSnapshot != null) && (
                          <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted/50 p-2 text-[10px] leading-tight text-muted-foreground">
                            {row.beforeSnapshot != null && (
                              <>
                                <span className="font-semibold">−</span>{' '}
                                {JSON.stringify(row.beforeSnapshot, null, 0)}
                                {'\n'}
                              </>
                            )}
                            {row.afterSnapshot != null && (
                              <>
                                <span className="font-semibold">+</span>{' '}
                                {JSON.stringify(row.afterSnapshot, null, 0)}
                              </>
                            )}
                          </pre>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
