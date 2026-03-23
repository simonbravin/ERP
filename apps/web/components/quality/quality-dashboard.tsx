'use client'

import { Card, CardContent } from '@/components/ui/card'

type QualityDashboardProps = {
  projectId: string
  stats: {
    totalRfis: number
    totalSubmittals: number
    openRfis: number
    pendingSubmittals: number
  }
}

export function QualityDashboard({ projectId: _projectId, stats }: QualityDashboardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-muted-foreground">Total RFIs</p>
          <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-foreground">
            {stats.totalRfis}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-muted-foreground">Open RFIs</p>
          <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-status-warning">
            {stats.openRfis}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-muted-foreground">Total Submittals</p>
          <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-foreground">
            {stats.totalSubmittals}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-muted-foreground">Pending Submittals</p>
          <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-status-warning">
            {stats.pendingSubmittals}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
