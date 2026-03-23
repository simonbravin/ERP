'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export type VersionRow = {
  id: string
  versionCode: string
  versionType: string
  status: string
  notes: string | null
  createdAt: Date
  approvedAt: Date | null
  lockedAt: Date | null
  totalCost: number
  createdBy: { user: { fullName: string } }
  approvedBy: { user: { fullName: string } } | null
  _count?: { budgetLines: number }
}

type VersionCardProps = {
  projectId: string
  version: VersionRow
  canEdit: boolean
  onSetBaseline: (versionId: string) => Promise<void>
  onApprove: (versionId: string) => Promise<void>
  onCopy: (versionId: string) => Promise<void>
}

import { formatCurrency, formatDate as formatDateUtil } from '@/lib/format-utils'
import { CertStatusBadge } from '@/components/certifications/cert-status-badge'

function formatDate(d: Date): string {
  return formatDateUtil(new Date(d))
}

export function VersionCard({
  projectId,
  version,
  canEdit,
  onSetBaseline,
  onApprove,
  onCopy,
}: VersionCardProps) {
  const t = useTranslations('budget')
  const isEditable = version.status === 'DRAFT'
  const canSetBaseline = canEdit && isEditable
  const canApprove = canEdit && isEditable
  const statusLabels: Record<string, string> = { DRAFT: t('statusDraft'), BASELINE: t('baseline'), APPROVED: t('approve') }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card py-3 px-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/budget/${version.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {version.versionCode}
          </Link>
          <CertStatusBadge status={version.status} label={statusLabels[version.status] ?? version.status} />
          <span className="text-sm text-muted-foreground">
            {version.versionType}
          </span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {t('createdBy')} {formatDate(version.createdAt)} — {version.createdBy.user.fullName}
          {version.approvedBy && (
            <> · {t('approvedBy')} {version.approvedAt && formatDate(version.approvedAt)} — {version.approvedBy.user.fullName}</>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right font-mono tabular-nums text-foreground">
        {formatCurrency(version.totalCost)}
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          href={`/projects/${projectId}/budget/${version.id}`}
          className="inline-flex items-center rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          {t('viewLines')}
        </Link>
        {canSetBaseline && (
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3 text-sm"
            onClick={() => onSetBaseline(version.id)}
          >
            {t('setAsBaseline')}
          </Button>
        )}
        {canApprove && (
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3 text-sm"
            onClick={() => onApprove(version.id)}
          >
            {t('approve')}
          </Button>
        )}
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-3 text-sm"
            onClick={() => onCopy(version.id)}
          >
            {t('copyVersion')}
          </Button>
        )}
      </div>
    </div>
  )
}
