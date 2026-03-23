'use client'

import { cn } from '@/lib/utils'

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export type ApprovalEntry = {
  id: string
  decision: string
  comment: string | null
  createdAt: Date
  orgMember: { user: { fullName: string } }
}

type ApprovalTimelineProps = {
  approvals: ApprovalEntry[]
}

export function ApprovalTimeline({ approvals }: ApprovalTimelineProps) {
  if (approvals.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">No approval history yet.</p>
    )
  }

  return (
    <div className="space-y-3">
      {approvals.map((entry) => (
        <div key={entry.id} className="flex gap-3">
          <div
            className={cn(
              'mt-1.5 h-2 w-2 shrink-0 rounded-full',
              entry.decision === 'APPROVED' && 'bg-emerald-500',
              entry.decision === 'REJECTED' && 'bg-red-500',
              entry.decision === 'CHANGES_REQUESTED' && 'bg-amber-500'
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {entry.decision.replace('_', ' ')} — {entry.orgMember.user.fullName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatDateTime(entry.createdAt)}
            </p>
            {entry.comment && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{entry.comment}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
