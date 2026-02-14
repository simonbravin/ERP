'use client'

import { useTranslations } from 'next-intl'
import { VersionCard, type VersionRow } from './version-card'

type VersionListProps = {
  projectId: string
  versions: VersionRow[]
  canEdit: boolean
  onSetBaseline: (versionId: string) => Promise<void>
  onApprove: (versionId: string) => Promise<void>
  onCopy: (versionId: string) => Promise<void>
}

export function VersionList({
  projectId,
  versions,
  canEdit,
  onSetBaseline,
  onApprove,
  onCopy,
}: VersionListProps) {
  const t = useTranslations('budget')
  if (versions.length === 0) {
    return (
      <div className="erp-card py-12 text-center text-muted-foreground">
        {t('noBudgetVersionsYet')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <VersionCard
          key={v.id}
          projectId={projectId}
          version={v}
          canEdit={canEdit}
          onSetBaseline={onSetBaseline}
          onApprove={onApprove}
          onCopy={onCopy}
        />
      ))}
    </div>
  )
}
