/**
 * Skeleton while finance section loads. Reduces perceived latency.
 */
export default function FinanceLoading() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col gap-6 p-6 md:p-8">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="flex-1 rounded-lg border border-border bg-card p-4">
        <div className="h-6 w-40 animate-pulse rounded bg-muted mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}
