'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { DocumentRow } from './document-list'

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, { dateStyle: 'short' })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type DocumentCardProps = {
  document: DocumentRow
}

export function DocumentCard({ document: doc }: DocumentCardProps) {
  const t = useTranslations('documents')
  const latest = doc.versions[0]

  return (
    <Link href={`/documents/${doc.id}`} className="erp-card-interactive block p-6">
      <h3 className="truncate text-lg font-semibold text-foreground">{doc.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {doc.docType.replace(/_/g, ' ')}
        {doc.project ? ` · ${doc.project.name}` : ''}
      </p>
      {latest && (
        <p className="mt-2 text-xs text-muted-foreground">
          v{latest.versionNumber} – {latest.fileName} ({formatSize(latest.sizeBytes)})
        </p>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          {doc.createdBy.user.fullName} · {formatDate(doc.createdAt)}
        </span>
        <span className="text-xs font-medium text-primary">{t('view')}</span>
      </div>
    </Link>
  )
}
