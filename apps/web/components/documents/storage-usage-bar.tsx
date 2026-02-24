'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getOrgStorageUsage } from '@/app/actions/documents'
import { getProjectStorageUsage } from '@/app/actions/documents'

type StorageUsageBarProps = {
  projectId?: string | null
}

function formatBytes(bytes: number, type: 'gb' | 'mb'): string {
  if (type === 'gb') {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2)
  }
  return (bytes / (1024 * 1024)).toFixed(1)
}

export function StorageUsageBar({ projectId }: StorageUsageBarProps) {
  const t = useTranslations('documents')
  const [usedBytes, setUsedBytes] = useState<number>(0)
  const [limitBytes, setLimitBytes] = useState<number | null>(null)

  useEffect(() => {
    if (projectId) {
      getProjectStorageUsage(projectId).then(({ usedBytes, limitBytes }) => {
        setUsedBytes(usedBytes)
        setLimitBytes(limitBytes)
      })
    } else {
      getOrgStorageUsage().then(({ usedBytes, limitBytes }) => {
        setUsedBytes(usedBytes)
        setLimitBytes(limitBytes)
      })
    }
  }, [projectId])

  if (limitBytes === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('storageUsage', {
          used: `${formatBytes(usedBytes, 'gb')} GB`,
          limit: t('planUnlimited'),
        })}
      </p>
    )
  }

  const percent = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0
  const usedStr = projectId
    ? `${formatBytes(usedBytes, 'mb')} MB`
    : `${formatBytes(usedBytes, 'gb')} GB`
  const limitStr = projectId
    ? '500 MB'
    : `${formatBytes(limitBytes, 'gb')} GB`

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">
        {projectId
          ? t('storageUsageProject', { used: formatBytes(usedBytes, 'mb') })
          : t('storageUsage', { used: usedStr, limit: limitStr })}
        {' '}
        <span className="tabular-nums font-medium">({percent}%)</span>
      </p>
      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
