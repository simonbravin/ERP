'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { answerRfi, closeRfi } from '@/app/actions/quality'
import { QualityEntityAttachments } from '@/components/quality/quality-entity-attachments'
import { RFI_ENTITY } from '@/lib/document-entities'
import { cn } from '@/lib/utils'

type RfiDetailProps = {
  rfi: {
    id: string
    number: number
    subject: string
    question: string
    answer: string | null
    status: string
    priority: string
    dueDate: Date | null
    answeredDate: Date | null
    closedDate: Date | null
    createdAt: Date
    raisedBy: { user: { fullName: string; email: string | null } }
    assignedTo: { user: { fullName: string; email: string | null } } | null
    wbsNode: { code: string; name: string } | null
  }
  comments?: Array<{
    id: string
    comment: string
    createdAt: Date
    author: { user: { fullName: string } }
  }>
  projectId: string
  canAnswer: boolean
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    OPEN: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    ANSWERED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    CLOSED: 'bg-muted text-muted-foreground',
  }
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-xs font-medium',
        styles[status] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {label}
    </span>
  )
}

function PriorityBadge({ priority, label }: { priority: string; label: string }) {
  const styles: Record<string, string> = {
    LOW: 'bg-muted text-muted-foreground',
    MEDIUM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-xs font-medium',
        styles[priority] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {label}
    </span>
  )
}

const textareaClassName =
  'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function RfiDetail({
  rfi,
  comments: _comments = [],
  projectId: _projectId,
  canAnswer,
}: RfiDetailProps) {
  const t = useTranslations('quality')
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [answer, setAnswer] = useState(rfi.answer ?? '')

  const statusLabel = t(`status.${rfi.status}` as 'status.OPEN')
  const priorityLabel = t(`priority.${rfi.priority}` as 'priority.LOW')

  async function handleAnswer() {
    if (!answer.trim()) return
    setSubmitting(true)
    try {
      await answerRfi(rfi.id, answer)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : t('answer'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClose() {
    setSubmitting(true)
    try {
      await closeRfi(rfi.id)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : t('status.CLOSED'))
    } finally {
      setSubmitting(false)
    }
  }

  const activityItems: { label: string; date: Date | null }[] = [
    { label: t('createdAt'), date: rfi.createdAt },
    { label: t('answeredAt'), date: rfi.answeredDate },
    { label: t('closedAt'), date: rfi.closedDate },
  ].filter((x) => x.date)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              RFI-{String(rfi.number).padStart(3, '0')} — {rfi.subject}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={rfi.status} label={statusLabel} />
              <PriorityBadge priority={rfi.priority} label={priorityLabel} />
            </div>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {t('wbsLocation')}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {rfi.wbsNode ? `${rfi.wbsNode.code} — ${rfi.wbsNode.name}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {t('dueDate')}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {formatDate(rfi.dueDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {t('raisedBy')}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {rfi.raisedBy.user.fullName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {t('assignTo')}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {rfi.assignedTo?.user.fullName ?? '—'}
            </dd>
          </div>
        </dl>

        {activityItems.length > 0 && (
          <div className="mt-4 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">
              {t('activityLog')}
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {activityItems.map((item) => (
                <li key={item.label}>
                  {item.label}: {formatDate(item.date)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-medium text-foreground">{t('question')}</h3>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {rfi.question}
          </p>
        </div>

        {rfi.answer && (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium text-foreground">
              {t('answer')}{' '}
              {rfi.answeredDate && `(${formatDate(rfi.answeredDate)})`}
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {rfi.answer}
            </p>
          </div>
        )}

        {canAnswer && rfi.status === 'OPEN' && (
          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('provideAnswer')}
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              className={textareaClassName}
              placeholder="…"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleAnswer}
                disabled={submitting || !answer.trim()}
              >
                {submitting ? '…' : t('answerRfi')}
              </Button>
            </div>
          </div>
        )}

        {canAnswer && rfi.status === 'ANSWERED' && (
          <div className="mt-4">
            <Button onClick={handleClose} disabled={submitting}>
              {submitting ? '…' : t('closeRfi')}
            </Button>
          </div>
        )}

        <QualityEntityAttachments entityType={RFI_ENTITY} entityId={rfi.id} />
      </div>
    </div>
  )
}
