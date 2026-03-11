export default function SettingsLoading() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col gap-4 p-4">
      <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
      <div className="flex-1 space-y-4">
        <div className="h-24 w-full max-w-xl animate-pulse rounded-lg bg-muted" />
        <div className="h-24 w-full max-w-xl animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}
