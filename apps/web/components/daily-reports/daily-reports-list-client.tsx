'use client'

import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DailyReportsTable } from './daily-reports-table'
import { DailyReportsCardGrid } from './daily-reports-card-grid'
import type { DailyReportListItem } from '@/app/actions/daily-reports'

type Author = { id: string; name: string }

type DailyReportsListClientProps = {
  projectId: string
  projectName: string
  items: DailyReportListItem[]
  total: number
  page: number
  pageSize: number
  authors: Author[]
  canEdit: boolean
  canApprove: boolean
  initialSearch: string
  initialStatuses: string[]
  initialAuthors: string[]
  initialDateFrom: string
  initialDateTo: string
  initialView: 'table' | 'cards'
  title: string
  subtitle: string
}

export function DailyReportsListClient({
  projectId,
  projectName,
  items,
  total,
  page,
  pageSize,
  authors,
  canEdit,
  initialSearch,
  initialStatuses,
  initialAuthors,
  initialDateFrom,
  initialDateTo,
  initialView,
  title,
  subtitle,
}: DailyReportsListClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('dailyReports')
  const tCommon = useTranslations('common')

  const [view, setView] = useState<'table' | 'cards'>(initialView)
  const [search, setSearch] = useState(initialSearch)
  const [statuses, setStatuses] = useState<string[]>(initialStatuses)
  const [authorIds, setAuthorIds] = useState<string[]>(initialAuthors)
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)

  const buildParams = useCallback(() => {
    const p = new URLSearchParams()
    if (search.trim()) p.set('search', search.trim())
    if (statuses.length) p.set('status', statuses.join(','))
    if (authorIds.length) p.set('author', authorIds.join(','))
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo) p.set('dateTo', dateTo)
    if (page > 1) p.set('page', String(page))
    if (view !== 'table') p.set('view', view)
    return p
  }, [search, statuses, authorIds, dateFrom, dateTo, page, view])

  const applyFilters = () => {
    const p = buildParams()
    p.delete('page')
    router.push(`/projects/${projectId}/daily-reports?${p.toString()}`)
    router.refresh()
  }

  const toggleStatus = (s: string) => {
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }
  const toggleAuthor = (id: string) => {
    setAuthorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {projectName} — {subtitle}
          </p>
        </div>
        {canEdit && (
          <Link href={`/projects/${projectId}/daily-reports/new`}>
            <Button type="button">{t('createNew')}</Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          className="min-w-[280px] w-full max-w-md sm:min-w-[320px] sm:max-w-lg"
        />
        <select
          value={statuses.join(',')}
          onChange={(e) => setStatuses(e.target.value ? e.target.value.split(',') : [])}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        >
          <option value="">{t('filterByStatus')} — {tCommon('all')}</option>
          <option value="DRAFT">{t('statusDraft')}</option>
          <option value="SUBMITTED">{t('statusSubmitted')}</option>
          <option value="APPROVED">{t('statusApproved')}</option>
          <option value="PUBLISHED">{t('statusPublished')}</option>
        </select>
        {authors.length > 0 && (
          <select
            value={authorIds.join(',')}
            onChange={(e) => setAuthorIds(e.target.value ? e.target.value.split(',') : [])}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="">{t('filterByAuthor')} — {tCommon('all')}</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        />
        <Button type="button" variant="secondary" size="sm" onClick={applyFilters}>
          {tCommon('apply')}
        </Button>
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            variant={view === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setView('table')
              const p = buildParams()
              p.set('view', 'table')
              router.push(`/projects/${projectId}/daily-reports?${p.toString()}`)
            }}
          >
            {t('viewTable')}
          </Button>
          <Button
            type="button"
            variant={view === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setView('cards')
              const p = buildParams()
              p.set('view', 'cards')
              router.push(`/projects/${projectId}/daily-reports?${p.toString()}`)
            }}
          >
            {t('viewCards')}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          <p>{t('noReportsYet')}</p>
          {canEdit && (
            <Link href={`/projects/${projectId}/daily-reports/new`} className="mt-2 inline-block">
              <Button type="button" variant="outline" size="sm">
                {t('createFirst')}
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          {view === 'table' ? (
            <DailyReportsTable projectId={projectId} items={items} canEdit={canEdit} />
          ) : (
            <DailyReportsCardGrid projectId={projectId} items={items} canEdit={canEdit} />
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>
                {tCommon('from')} {from} {tCommon('to')} {to} {tCommon('of')} {total}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    const p = buildParams()
                    p.set('page', String(page - 1))
                    router.push(`/projects/${projectId}/daily-reports?${p.toString()}`)
                    router.refresh()
                  }}
                >
                  {tCommon('previous')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const p = buildParams()
                    p.set('page', String(page + 1))
                    router.push(`/projects/${projectId}/daily-reports?${p.toString()}`)
                    router.refresh()
                  }}
                >
                  {tCommon('next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
