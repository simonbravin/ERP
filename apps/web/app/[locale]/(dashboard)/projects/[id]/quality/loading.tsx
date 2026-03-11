export default function QualityLoading() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col gap-4 p-4">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="flex-1 grid gap-3">
        <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-48 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}
