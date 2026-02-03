'use client'

import { useRef, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { uploadDailyReportFiles } from '@/app/actions/daily-reports'

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
  const [uploading, setUploading] = useState(false)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    if (photoCount + files.length > MAX_FILES) {
      toast.error('Máximo 10 archivos por reporte.')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) formData.append('files', files[i])
      await uploadDailyReportFiles(reportId, projectId, formData)
      toast.success('Archivos subidos.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (!canUpload || photoCount >= MAX_FILES) return null

  return (
    <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {photoCount > 0 ? 'Agregar más fotos/documentos' : t('photosAndDocs')}
      </h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('dropzoneHint')}</p>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
        onChange={handleFileUpload}
        disabled={uploading}
        className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 dark:file:bg-gray-800 dark:file:text-gray-300"
      />
      {uploading && <p className="mt-2 text-sm text-gray-500">{tCommon('loading')}</p>}
    </div>
  )
}
