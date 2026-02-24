'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export type DocumentRow = {
  id: string
  title: string
  docType: string
  category: string | null
  description: string | null
  project: { id: string; name: string; projectNumber: string } | null
  createdAt: Date
  createdBy: { user: { fullName: string } }
  versions: { versionNumber: number; fileName: string; sizeBytes: number }[]
}

type DocumentListProps = {
  documents: DocumentRow[]
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, { dateStyle: 'short' })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentList({ documents }: DocumentListProps) {
  const t = useTranslations('documents')

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        {t('noDocumentsYet')}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
              {t('tableTitle')}
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
              {t('type')}
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
              {t('project')}
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
              {t('latestVersion')}
            </th>
            <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">
              {t('size')}
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
              {t('createdBy')}
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
              {t('date')}
            </th>
            <th className="w-20 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const latest = doc.versions[0]
            return (
              <tr
                key={doc.id}
                className="border-b border-gray-100 dark:border-gray-800"
              >
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                  {doc.title}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {doc.docType.replace(/_/g, ' ')}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {doc.project ? doc.project.name : t('none')}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {latest
                    ? `v${latest.versionNumber} – ${latest.fileName}`
                    : t('none')}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">
                  {latest ? formatSize(latest.sizeBytes) : '—'}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {doc.createdBy.user.fullName}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {formatDate(doc.createdAt)}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/documents/${doc.id}`}>
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs">
                      {t('view')}
                    </Button>
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
