'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { getDocumentDownloadUrl } from '@/app/actions/documents'
import { X } from 'lucide-react'

type DocumentViewerModalProps = {
  versionId: string
  mimeType: string
  fileName: string
  open: boolean
  onClose: () => void
}

export function DocumentViewerModal({
  versionId,
  mimeType,
  fileName,
  open,
  onClose,
}: DocumentViewerModalProps) {
  const t = useTranslations('documents')
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !versionId) {
      setUrl(null)
      setError(null)
      setLoading(true)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getDocumentDownloadUrl(versionId)
      .then(({ url: u }) => {
        if (!cancelled && !u.startsWith('#mock-')) setUrl(u)
        else if (!cancelled && u.startsWith('#mock-')) setError(t('downloadsRequireR2'))
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('downloadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, versionId, t])

  if (!open) return null

  const viewablePdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
  const viewableImage = mimeType.startsWith('image/')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="truncate text-sm font-medium">{fileName}</span>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex min-h-[400px] flex-1 items-center justify-center overflow-auto p-4">
          {loading && <p className="text-sm text-muted-foreground">{t('uploading')}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && url && viewablePdf && (
            <iframe src={url} title={fileName} className="h-[70vh] w-full rounded border-0" />
          )}
          {!loading && !error && url && viewableImage && (
            <img src={url} alt={fileName} className="max-h-[70vh] max-w-full object-contain" />
          )}
          {!loading && !error && url && !viewablePdf && !viewableImage && (
            <div className="space-y-2 text-center text-sm text-muted-foreground">
              <p>Este tipo de archivo no se puede previsualizar.</p>
              <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')}>
                {t('download')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
