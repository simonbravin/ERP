'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { DailyReportListItem } from '@/app/actions/daily-reports'

type DailyReportsCardGridProps = {
  projectId: string
  items: DailyReportListItem[]
  canEdit?: boolean
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function StatusBadge({ statusKey, label }: { statusKey: string; label: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    SUBMITTED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    APPROVED: 'badge-success',
    PUBLISHED: 'bg-violet-100/80 text-violet-700 dark:bg-violet-900/25 dark:text-violet-400',
  }
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-xs font-medium',
        styles[statusKey] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      )}
    >
      {label || statusKey}
    </span>
  )
}

const SUMMARY_MAX = 100

export function DailyReportsCardGrid({ projectId, items, canEdit = false }: DailyReportsCardGridProps) {
  const t = useTranslations('dailyReports')
  const statusLabels: Record<string, string> = {
    DRAFT: t('statusDraft'),
    SUBMITTED: t('statusSubmitted'),
    APPROVED: t('statusApproved'),
    PUBLISHED: t('statusPublished'),
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((row) => (
        <Card key={row.id} className="h-full transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <Link href={`/projects/${projectId}/daily-reports/${row.id}`} className="block">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <time className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {formatDate(row.reportDate)}
              </time>
              <StatusBadge statusKey={row.status} label={statusLabels[row.status] ?? row.status} />
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-white">
                {row.summary.length > SUMMARY_MAX ? `${row.summary.slice(0, SUMMARY_MAX)}...` : row.summary}
              </p>
              {row.wbsSummary && (
                <p className="text-xs text-gray-500 dark:text-gray-400" title={row.wbsSummary}>
                  WBS: {row.wbsSummary.length > 40 ? `${row.wbsSummary.slice(0, 40)}…` : row.wbsSummary}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {row.authorName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-gray-500 dark:text-gray-400">{row.authorName}</span>
                {row.photoCount > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    · {row.photoCount} foto(s)
                  </span>
                )}
              </div>
            </CardContent>
          </Link>
          {canEdit && row.status === 'DRAFT' && (
            <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800">
              <Link
                href={`/projects/${projectId}/daily-reports/${row.id}/edit`}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                {t('editReport')}
              </Link>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
