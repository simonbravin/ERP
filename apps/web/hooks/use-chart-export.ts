'use client'

import { useCallback } from 'react'
import html2canvas from 'html2canvas'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

export function useChartExport() {
  const t = useTranslations('common')
  const captureChart = useCallback(async (elementId: string): Promise<string | null> => {
    const element = document.getElementById(elementId)
    if (!element) {
      toast.error(t('toast.elementNotFound'))
      return null
    }

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      })

      return canvas.toDataURL('image/png')
    } catch (error) {
      console.error('Error capturing chart:', error)
      toast.error(t('toast.chartCaptureError'))
      return null
    }
  }, [t])

  const downloadFile = useCallback((base64: string, filename: string) => {
    const link = document.createElement('a')
    link.href = `data:application/pdf;base64,${base64}`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  return { captureChart, downloadFile }
}
