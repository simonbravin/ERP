'use client'

import dynamic from 'next/dynamic'
import type { BudgetVersionTabsWithSearchProps } from '@/components/budget/budget-version-tabs-with-search'

function BudgetTabsSkeleton() {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-2">
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border p-3 flex gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-7 w-20 animate-pulse rounded bg-muted" />
          ))}
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-6 w-16 animate-pulse rounded bg-muted shrink-0" />
              <div className="h-6 flex-1 max-w-md animate-pulse rounded bg-muted" />
              <div className="h-6 w-24 animate-pulse rounded bg-muted shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const BudgetVersionTabsWithSearch = dynamic<BudgetVersionTabsWithSearchProps>(
  () => import('@/components/budget/budget-version-tabs-with-search').then((m) => ({ default: m.BudgetVersionTabsWithSearch })),
  { loading: BudgetTabsSkeleton, ssr: true }
)

export function BudgetVersionTabsDynamic(props: BudgetVersionTabsWithSearchProps) {
  return <BudgetVersionTabsWithSearch {...props} />
}
