'use client'

import { useTranslations } from 'next-intl'

export function DailyReportUploadPlaceholder() {
  const t = useTranslations('dailyReports')

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-4 dark:border-gray-600 dark:bg-gray-800/30">
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('photosAndDocs')}</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Guardá primero como borrador para habilitar la subida de fotos o documentos (máx. 10 archivos).
      </p>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t('dropzoneHint')}</p>
    </div>
  )
}
