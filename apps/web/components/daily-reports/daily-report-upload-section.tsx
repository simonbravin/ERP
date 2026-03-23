'use client'

import { useRef, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { uploadDailyReportFiles } from '@/app/actions/daily-reports'
import { ACCEPT_ATTACHMENTS } from '@/lib/file-accept'

const MAX_FILES = 10

type DailyReportUploadSectionProps = {
  reportId: string
  projectId: string
  photoCount: number
  canUpload: boolean
}

export function DailyReportUploadSection({
  reportId,
  projectId,
  photoCount,
  canUpload,
}: DailyReportUploadSectionProps) {
  const t = useTranslations('dailyReports')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    if (photoCount + files.length > MAX_FILES) {
      toast.error(t('toast.maxFiles'))
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) formData.append('files', files[i])
      await uploadDailyReportFiles(reportId, projectId, formData)
      toast.success(t('toast.filesUploaded'))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.uploadError'))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (!canUpload || photoCount >= MAX_FILES) return null

  return (
    <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {photoCount > 0 ? t('addMoreAttachments') : t('photosAndDocs')}
      </h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('dropzoneHint')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTACHMENTS}
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
          id={`daily-report-file-${reportId}`}
        />
        <label
          htmlFor={`daily-report-file-${reportId}`}
          className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {t('chooseFile')}
        </label>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
          id={`daily-report-camera-${reportId}`}
        />
        <label
          htmlFor={`daily-report-camera-${reportId}`}
          className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {t('takePhoto')}
        </label>
      </div>
      {uploading && <p className="mt-2 text-sm text-gray-500">{tCommon('loading')}</p>}
    </div>
  )
}
