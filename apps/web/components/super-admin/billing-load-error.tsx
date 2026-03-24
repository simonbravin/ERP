import { Prisma } from '@repo/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function formatLoadError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return `${err.code}: ${err.message}`
  }
  if (err instanceof Error) return err.message
  return String(err)
}

export function BillingLoadError({ context, error }: { context: string; error: unknown }) {
  const text = formatLoadError(error).slice(0, 1200)
  return (
    <div className="space-y-6 p-6">
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Error al cargar billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{context}</p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">
            {text}
          </pre>
          <p className="text-xs text-muted-foreground">
            Códigos útiles: <code className="rounded bg-muted px-1">P1001</code> conexión;
            <code className="mx-1 rounded bg-muted px-1">P2021</code> tabla inexistente;
            <code className="mx-1 rounded bg-muted px-1">42501</code> permisos en Postgres.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
