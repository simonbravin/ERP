'use client'

import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ListFiltersBar } from '@/components/list'
import { formatDateShort } from '@/lib/format-utils'

export type SubmittalRow = {
  id: string
  number: number
  submittalType: string
  specSection: string | null
  status: string
  revisionNumber: number
  dueDate: Date
  submittedDate: Date | null
  reviewedDate: Date | null
  submittedBy: { name: string } | null
  reviewedBy: { user: { fullName: string } } | null
  wbsNode: { code: string; name: string } | null
}

type SubmittalListProps = {
  submittals: SubmittalRow[]
  projectId: string
}

const STATUS_OPTIONS = [
  '',
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'APPROVED_AS_NOTED',
  'REJECTED',
  'REVISE_AND_RESUBMIT',
] as const

const STATUS_VARIANT: Record<string, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  APPROVED_AS_NOTED: 'success',
  REJECTED: 'danger',
  REVISE_AND_RESUBMIT: 'warning',
}

export function SubmittalList({ submittals, projectId }: SubmittalListProps) {
  const [statusFilter, setStatusFilter] = useState('')

  const filtered =
    statusFilter === ''
      ? submittals
      : submittals.filter((s) => s.status === statusFilter)

  if (submittals.length === 0) {
    return (
      <div className="erp-card py-12 text-center text-muted-foreground">
        No submittals yet. Create one to get started.
      </div>
    )
  }

  function clearFilters() {
    setStatusFilter('')
  }

  return (
    <div className="space-y-4">
      <ListFiltersBar onClear={clearFilters}>
        <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ListFiltersBar>

      <div className="erp-card overflow-hidden">
        <table className="erp-table w-full text-sm">
          <thead>
            <tr className="erp-table-header">
              <th className="erp-table-cell font-medium text-muted-foreground">#</th>
              <th className="erp-table-cell font-medium text-muted-foreground">Type</th>
              <th className="erp-table-cell font-medium text-muted-foreground">Spec</th>
              <th className="erp-table-cell font-medium text-muted-foreground">Status</th>
              <th className="erp-table-cell font-medium text-muted-foreground">Revision</th>
              <th className="erp-table-cell font-medium text-muted-foreground">Due</th>
              <th className="erp-table-cell w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="erp-table-row">
                <td className="erp-table-cell whitespace-nowrap font-mono text-foreground">
                  S-{String(s.number).padStart(3, '0')}
                </td>
                <td className="erp-table-cell font-medium text-foreground">
                  {s.submittalType.replace(/_/g, ' ')}
                </td>
                <td className="erp-table-cell text-muted-foreground">{s.specSection ?? '—'}</td>
                <td className="erp-table-cell">
                  <Badge variant={STATUS_VARIANT[s.status] ?? 'neutral'}>
                    {s.status.replace(/_/g, ' ')}
                  </Badge>
                </td>
                <td className="erp-table-cell font-mono tabular-nums text-muted-foreground">
                  {s.revisionNumber}
                </td>
                <td className="erp-table-cell font-mono tabular-nums text-muted-foreground">
                  {formatDateShort(s.dueDate)}
                </td>
                <td className="erp-table-cell">
                  <Link href={`/projects/${projectId}/quality/submittals/${s.id}`}>
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs">
                      View
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
