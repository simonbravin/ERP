'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { submitSubmittal, reviewSubmittal } from '@/app/actions/quality'
import { cn } from '@/lib/utils'

const REVIEW_STATUSES = [
  'APPROVED',
  'APPROVED_AS_NOTED',
  'REJECTED',
  'REVISE_AND_RESUBMIT',
] as const

type SubmittalDetailProps = {
  submittal: {
    id: string
    number: number
    submittalType: string
    specSection: string | null
    status: string
    revisionNumber: number
    dueDate: Date
    submittedDate: Date | null
    reviewedDate: Date | null
    reviewComments: string | null
    submittedBy: { name: string } | null
    reviewedBy: { user: { fullName: string } } | null
    wbsNode: { code: string; name: string } | null
  }
  projectId: string
  canEdit: boolean
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, {
    dateStyle: 'medium',
  })
}

const inputClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
const textareaClassName =
  'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-muted text-muted-foreground',
    SUBMITTED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    UNDER_REVIEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    APPROVED_AS_NOTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    REVISE_AND_RESUBMIT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
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

export function SubmittalDetail({
  submittal,
  projectId,
  canEdit,
}: SubmittalDetailProps) {
  const t = useTranslations('quality')
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [reviewStatus, setReviewStatus] = useState('APPROVED')
  const [reviewComments, setReviewComments] = useState(
    submittal.reviewComments ?? ''
  )

  const statusLabel =
    t(`status.${submittal.status}` as 'status.DRAFT') || submittal.status

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await submitSubmittal(submittal.id)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : t('submittedAt'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReview() {
    setSubmitting(true)
    try {
      await reviewSubmittal(submittal.id, {
        status: reviewStatus,
        reviewComments: reviewComments || undefined,
      })
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : t('reviewComments'))
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = canEdit && submittal.status === 'DRAFT'
  const canReview =
    canEdit &&
    ['SUBMITTED', 'UNDER_REVIEW'].includes(submittal.status)

  const activityItems: { label: string; date: Date | null; by?: string }[] = []
  if (submittal.submittedDate) {
    activityItems.push({
      label: t('submittedAt'),
      date: submittal.submittedDate,
      by: submittal.submittedBy?.name,
    })
  }
  if (submittal.reviewedDate) {
    activityItems.push({
      label: t('reviewedAt'),
      date: submittal.reviewedDate,
      by: submittal.reviewedBy?.user.fullName,
    })
  }

  const typeLabel = t(`submittalType.${submittal.submittalType}` as 'submittalType.MATERIAL') || submittal.submittalType

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold text-foreground">
          S-{String(submittal.number).padStart(3, '0')} — {typeLabel}
        </h2>
        <div className="mt-2">
          <StatusBadge status={submittal.status} label={statusLabel} />
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {t('specSection')}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {submittal.specSection ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {t('revision')}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {submittal.revisionNumber}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {t('dueDate')}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {formatDate(submittal.dueDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {t('submittedBy')}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {submittal.submittedBy?.name ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {t('submittedDate')}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {formatDate(submittal.submittedDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {t('wbsLocation')}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {submittal.wbsNode
                ? `${submittal.wbsNode.code} — ${submittal.wbsNode.name}`
                : '—'}
            </dd>
          </div>
        </dl>

        {activityItems.length > 0 && (
          <div className="mt-4 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">
              {t('activityLog')}
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {activityItems.map((item, i) => (
                <li key={i}>
                  {item.label}: {formatDate(item.date)}
                  {item.by && ` — ${item.by}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {submittal.reviewComments && (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium text-foreground">
              {t('reviewComments')}
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {submittal.reviewComments}
            </p>
            {submittal.reviewedBy && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('reviewedBy')} {submittal.reviewedBy.user.fullName} —{' '}
                {formatDate(submittal.reviewedDate)}
              </p>
            )}
          </div>
        )}

        {canSubmit && (
          <div className="mt-4">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '…' : t('submitForReview')}
            </Button>
          </div>
        )}

        {canReview && (
          <div className="mt-6 space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <h3 className="text-sm font-medium text-foreground">
              {t('reviewSubmittal')}
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('decision')}
              </label>
              <Select
                value={reviewStatus}
                onValueChange={setReviewStatus}
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REVIEW_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`status.${value}` as 'status.APPROVED')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('comments')}
              </label>
              <textarea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                rows={3}
                className={textareaClassName}
              />
            </div>
            <Button onClick={handleReview} disabled={submitting}>
              {submitting ? '…' : t('submitReview')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
