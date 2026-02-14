'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { VersionList } from './version-list'
import type { VersionRow } from './version-card'
import {
  setBudgetBaseline,
  approveBudgetVersion,
  copyBudgetVersion,
} from '@/app/actions/budget'
import { Button } from '@/components/ui/button'

type BudgetVersionListClientProps = {
  projectId: string
  versions: VersionRow[]
  canEdit: boolean
}

export function BudgetVersionListClient({
  projectId,
  versions,
  canEdit,
}: BudgetVersionListClientProps) {
  const router = useRouter()
  const t = useTranslations('budget')

  async function handleSetBaseline(versionId: string) {
    const result = await setBudgetBaseline(versionId)
    if (result && 'error' in result) {
      alert(result.error)
      return
    }
    router.refresh()
  }

  async function handleApprove(versionId: string) {
    const result = await approveBudgetVersion(versionId)
    if (result && 'error' in result) {
      alert(result.error)
      return
    }
    router.refresh()
  }

  async function handleCopy(versionId: string) {
    const result = await copyBudgetVersion(versionId)
    if (!result || 'error' in result) {
      alert(result?.error ?? 'Failed to copy')
      return
    }
    router.refresh()
    if ('versionId' in result && result.versionId) {
      router.push(`/projects/${projectId}/budget/${result.versionId}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="erp-header-row">
        <h2 className="erp-section-title">{t('versions')}</h2>
        {canEdit && (
          <div className="erp-header-actions">
            <Link href={`/projects/${projectId}/budget/new`}>
              <Button type="button">{t('newVersion')}</Button>
            </Link>
          </div>
        )}
      </div>
      <VersionList
        projectId={projectId}
        versions={versions}
        canEdit={canEdit}
        onSetBaseline={handleSetBaseline}
        onApprove={handleApprove}
        onCopy={handleCopy}
      />
    </div>
  )
}
