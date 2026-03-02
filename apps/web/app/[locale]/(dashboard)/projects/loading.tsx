/**
 * Skeleton while projects list page loads. Reduces perceived latency.
 */
export default function ProjectsLoading() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-muted/30 p-3 flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded bg-muted" />
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex gap-4 p-3 border-b border-border last:border-0">
            <div className="h-5 w-28 animate-pulse rounded bg-muted" />
            <div className="h-5 flex-1 max-w-xs animate-pulse rounded bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
