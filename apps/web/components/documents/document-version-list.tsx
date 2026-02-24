'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { getDocumentDownloadUrl } from '@/app/actions/documents'
import { uploadNewVersion } from '@/app/actions/documents'
import { useRouter } from 'next/navigation'
import { FileUploader } from './file-uploader'
import { DocumentViewerModal } from './document-viewer-modal'
import { toast } from 'sonner'

export type DocumentVersionRow = {
  id: string
  versionNumber: number
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadedAt: Date
  uploadedBy: { user: { fullName: string } }
}

type DocumentVersionListProps = {
  documentId: string
  versions: DocumentVersionRow[]
  canUpload: boolean
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentVersionList({
  documentId,
  versions,
  canUpload,
}: DocumentVersionListProps) {
  const router = useRouter()
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<{
    id: string
    mimeType: string
    fileName: string
  } | null>(null)

  const t = useTranslations('documents')

  const canPreview = (mime: string, name: string) =>
    mime === 'application/pdf' ||
    name.toLowerCase().endsWith('.pdf') ||
    mime.startsWith('image/')

  async function handleDownload(versionId: string) {
    try {
      const { url } = await getDocumentDownloadUrl(versionId)
      if (url.startsWith('#mock-')) {
        toast.warning(t('downloadsRequireR2'))
        return
      }
      window.open(url, '_blank')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('downloadFailed'))
    }
  }

  async function handleUploadNewVersion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await uploadNewVersion(documentId, formData)
      setShowUpload(false)
      router.refresh()
      toast.success(t('uploadDocument'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          {t('versions')}
        </h2>
        {canUpload && (
          <Button
            type="button"
            variant="outline"
            className="h-8 text-sm"
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? t('cancel') : t('uploadNewVersion')}
          </Button>
        )}
      </div>

      {showUpload && canUpload && (
        <form
          onSubmit={handleUploadNewVersion}
          className="erp-form-page rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
        >
          <h3 className="mb-3 text-sm font-medium">{t('newVersion')}</h3>
          <div className="space-y-3">
            <FileUploader name="file" required />
            <div>
              <label className="block text-sm font-medium">{t('notesOptional')}</label>
              <input
                type="text"
                name="notes"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={uploading}>
                {uploading ? t('uploading') : t('uploadButton')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUpload(false)}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        </form>
      )}

      {versions.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noVersionsYet')}</p>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                  {t('versions')}
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                  File
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">
                  {t('size')}
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                  Uploaded
                </th>
                <th className="w-32 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                    v{v.versionNumber}
                  </td>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">
                    {v.fileName}
                  </td>
                  <td className="text-right tabular-nums text-gray-600 dark:text-gray-400">
                    {formatSize(v.sizeBytes)}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {formatDate(v.uploadedAt)} by {v.uploadedBy.user.fullName}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {canPreview(v.mimeType, v.fileName) && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() =>
                            setViewingVersion({
                              id: v.id,
                              mimeType: v.mimeType,
                              fileName: v.fileName,
                            })
                          }
                        >
                          {t('view')}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => handleDownload(v.id)}
                      >
                        {t('download')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingVersion && (
        <DocumentViewerModal
          versionId={viewingVersion.id}
          mimeType={viewingVersion.mimeType}
          fileName={viewingVersion.fileName}
          open={!!viewingVersion}
          onClose={() => setViewingVersion(null)}
        />
      )}
    </div>
  )
}
