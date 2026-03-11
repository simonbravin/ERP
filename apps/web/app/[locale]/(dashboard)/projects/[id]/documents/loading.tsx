export default function ProjectDocumentsLoading() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col gap-4 p-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-10 w-full max-w-sm animate-pulse rounded bg-muted" />
      <div className="flex-1 grid gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  )
}
