'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ListResourcesResult } from '@/app/actions/resources'

type ResourceListProps = {
  data: ListResourcesResult
  canEdit: boolean
  onDeactivate: (id: string) => Promise<void>
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function ResourceList({ data, canEdit, onDeactivate }: ResourceListProps) {
  const t = useTranslations('resources')

  if (data.items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        {t('noResourcesYet')}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('code')}</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('name')}</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('category')}</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('unit')}</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">{t('unitCost')}</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('supplier')}</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('status')}</th>
              {canEdit && <th className="w-24 px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-100 dark:border-gray-800"
              >
                <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                  {row.code}
                </td>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                  {row.name}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {row.category}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {row.unit}
                </td>
                <td className="text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {formatCurrency(row.unitCost)}
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                  {row.supplier?.name ?? '—'}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium',
                      row.active
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    )}
                  >
                    {row.active ? t('active') : t('inactive')}
                  </span>
                </td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Link href={`/resources/${row.id}/edit`}>
                        <Button type="button" variant="ghost" className="h-8 px-2 text-xs">
                          Edit
                        </Button>
                      </Link>
                      {row.active && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                          onClick={() => onDeactivate(row.id)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.total > data.pageSize && (
        <div className="border-t border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t('showing')} {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} {t('of')} {data.total}
        </div>
      )}
    </div>
  )
}
