'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { getDocumentDownloadUrl } from '@/app/actions/documents'
import { DocumentViewerModal } from './document-viewer-modal'
import { FileText } from 'lucide-react'

type DocumentThumbnailProps = {
  versionId: string
  mimeType: string
  fileName: string
  title?: string
  caption?: string
}

export function DocumentThumbnail({
  versionId,
  mimeType,
  fileName,
  title,
  caption,
}: DocumentThumbnailProps) {
  const t = useTranslations('documents')
  const [url, setUrl] = useState<string | null>(null)
  const [showViewer, setShowViewer] = useState(false)

  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')

  useEffect(() => {
    let cancelled = false
    getDocumentDownloadUrl(versionId)
      .then(({ url: u }) => {
        if (!cancelled && !u.startsWith('#mock-')) setUrl(u)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [versionId])

  const canPreview = isImage || isPdf

  return (
    <>
      <div className="flex flex-col items-center rounded-lg border border-border bg-muted/30 p-2">
        {url && isImage ? (
          <button
            type="button"
            onClick={() => canPreview && setShowViewer(true)}
            className="block overflow-hidden rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <img
              src={url}
              alt={title ?? fileName}
              className="h-24 w-24 object-cover"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => canPreview && setShowViewer(true)}
            className="flex h-24 w-24 items-center justify-center rounded-md bg-muted"
          >
            <FileText className="h-10 w-10 text-muted-foreground" />
          </button>
        )}
        <p className="mt-1 max-w-[120px] truncate text-center text-xs font-medium" title={title ?? fileName}>
          {title ?? fileName}
        </p>
        {caption && (
          <p className="max-w-[120px] truncate text-center text-xs text-muted-foreground" title={caption}>
            {caption}
          </p>
        )}
        <div className="mt-1 flex gap-2">
          {canPreview && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setShowViewer(true)}
            >
              {t('view')}
            </button>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary hover:underline"
            >
              {t('download')}
            </a>
          )}
        </div>
      </div>

      {showViewer && (
        <DocumentViewerModal
          versionId={versionId}
          mimeType={mimeType}
          fileName={fileName}
          open={showViewer}
          onClose={() => setShowViewer(false)}
        />
      )}
    </>
  )
}
