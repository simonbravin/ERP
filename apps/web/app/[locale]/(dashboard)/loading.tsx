/**
 * Shown while the dashboard layout or a child page is loading (e.g. navigating Dashboard → Proyectos).
 * Reduces perceived latency by showing a skeleton instead of a blank screen.
 */
export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col gap-6 p-6 md:p-8">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="flex-1 space-y-3">
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-sm animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 max-w-xs animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
