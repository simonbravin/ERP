'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DailyReportListItem } from '@/app/actions/daily-reports'

type DailyReportsTableProps = {
  projectId: string
  items: DailyReportListItem[]
  canEdit?: boolean
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function StatusBadge({ statusKey, label }: { statusKey: string; label: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    SUBMITTED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    APPROVED: 'bg-[#7d9d7a]/20 text-[#4a6741] dark:bg-[#7d9d7a]/25 dark:text-[#9fbd9a]',
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

const SUMMARY_MAX = 60

export function DailyReportsTable({ projectId, items, canEdit = false }: DailyReportsTableProps) {
  const t = useTranslations('dailyReports')
  const tCommon = useTranslations('common')
  const statusLabels: Record<string, string> = {
    DRAFT: t('statusDraft'),
    SUBMITTED: t('statusSubmitted'),
    APPROVED: t('statusApproved'),
    PUBLISHED: t('statusPublished'),
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('date')}</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('author')}</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('summary')}</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">WBS</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('statusColumn')}</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('approvedByColumn')}</th>
            <th className="w-20 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300">
                {formatDate(row.reportDate)}
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.authorName}</td>
              <td className="max-w-[280px] truncate px-3 py-2 text-gray-900 dark:text-white">
                {row.summary.length > SUMMARY_MAX ? `${row.summary.slice(0, SUMMARY_MAX)}...` : row.summary}
              </td>
              <td className="max-w-[200px] truncate px-3 py-2 text-sm text-gray-600 dark:text-gray-400" title={row.wbsSummary ?? undefined}>
                {row.wbsSummary ?? '—'}
              </td>
              <td className="px-3 py-2">
                <StatusBadge statusKey={row.status} label={statusLabels[row.status] ?? row.status} />
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.approvedByName ?? '—'}</td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <Link href={`/projects/${projectId}/daily-reports/${row.id}`}>
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs">
                      {tCommon('view')}
                    </Button>
                  </Link>
                  {canEdit && row.status === 'DRAFT' && (
                    <Link href={`/projects/${projectId}/daily-reports/${row.id}/edit`}>
                      <Button type="button" variant="ghost" className="h-8 px-2 text-xs">
                        {t('editReport')}
                      </Button>
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
