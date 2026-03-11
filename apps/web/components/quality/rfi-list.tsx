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

export type RfiRow = {
  id: string
  number: number
  subject: string
  status: string
  priority: string
  dueDate: Date | null
  raisedBy: { user: { fullName: string } }
  assignedTo: { user: { fullName: string } } | null
  wbsNode: { code: string; name: string } | null
  comments: { id: string }[]
}

type RfiListProps = {
  rfis: RfiRow[]
  projectId: string
}

const STATUS_OPTIONS = ['', 'OPEN', 'ANSWERED', 'CLOSED'] as const
const PRIORITY_OPTIONS = ['', 'LOW', 'MEDIUM', 'HIGH'] as const

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'neutral'> = {
  OPEN: 'warning',
  ANSWERED: 'info',
  CLOSED: 'neutral',
}

const PRIORITY_VARIANT: Record<string, 'neutral' | 'info' | 'danger'> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'danger',
}

export function RfiList({ rfis, projectId }: RfiListProps) {
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const filtered = rfis.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (priorityFilter && r.priority !== priorityFilter) return false
    return true
  })

  if (rfis.length === 0) {
    return (
      <div className="erp-card py-12 text-center text-muted-foreground">
        No RFIs yet. Create one to get started.
      </div>
    )
  }

  function clearFilters() {
    setStatusFilter('')
    setPriorityFilter('')
  }

  return (
    <div className="space-y-4">
      <ListFiltersBar onClear={clearFilters}>
        <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter || 'all'} onValueChange={(v) => setPriorityFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {PRIORITY_OPTIONS.filter(Boolean).map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ListFiltersBar>

      <div className="erp-card overflow-hidden">
        <table className="erp-table w-full text-sm">
          <thead>
            <tr className="erp-table-header">
              <th className="erp-table-cell font-medium text-muted-foreground">#</th>
              <th className="erp-table-cell font-medium text-muted-foreground">Subject</th>
              <th className="erp-table-cell font-medium text-muted-foreground">Status</th>
              <th className="erp-table-cell font-medium text-muted-foreground">Priority</th>
              <th className="erp-table-cell font-medium text-muted-foreground">Raised By</th>
              <th className="erp-table-cell font-medium text-muted-foreground">Assigned To</th>
              <th className="erp-table-cell font-medium text-muted-foreground">Due</th>
              <th className="erp-table-cell font-medium text-center text-muted-foreground">Comments</th>
              <th className="erp-table-cell w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((rfi) => (
              <tr key={rfi.id} className="erp-table-row">
                <td className="erp-table-cell whitespace-nowrap font-mono text-foreground">
                  RFI-{String(rfi.number).padStart(3, '0')}
                </td>
                <td className="erp-table-cell font-medium text-foreground">{rfi.subject}</td>
                <td className="erp-table-cell">
                  <Badge variant={STATUS_VARIANT[rfi.status] ?? 'neutral'}>{rfi.status}</Badge>
                </td>
                <td className="erp-table-cell">
                  <Badge variant={PRIORITY_VARIANT[rfi.priority] ?? 'neutral'}>{rfi.priority}</Badge>
                </td>
                <td className="erp-table-cell text-muted-foreground">{rfi.raisedBy.user.fullName}</td>
                <td className="erp-table-cell text-muted-foreground">{rfi.assignedTo?.user.fullName ?? '—'}</td>
                <td className="erp-table-cell text-muted-foreground font-mono tabular-nums">
                  {formatDateShort(rfi.dueDate)}
                </td>
                <td className="erp-table-cell text-center font-mono tabular-nums text-muted-foreground">
                  {rfi.comments.length}
                </td>
                <td className="erp-table-cell">
                  <Link href={`/projects/${projectId}/quality/rfis/${rfi.id}`}>
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
