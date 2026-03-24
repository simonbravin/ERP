import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Shown when billing Prisma queries fail because production DB has not applied billing migrations yet. */
export function BillingSchemaMissingNotice() {
  return (
    <div className="space-y-6 p-6">
      <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="text-amber-900 dark:text-amber-100">
            Billing: base de datos sin migrar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-amber-950/90 dark:text-amber-50/90">
          <p>
            Las tablas de facturación (Paddle) no existen en esta base de datos o el esquema no coincide con el
            código desplegado.
          </p>
          <p className="font-medium">Qué hacer</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Conectá <code className="rounded bg-black/10 px-1">DATABASE_URL</code> de producción (Neon).
            </li>
            <li>
              Ejecutá:{' '}
              <code className="rounded bg-black/10 px-1">
                pnpm --filter @repo/database exec prisma migrate deploy
              </code>
            </li>
            <li>
              Opcional:{' '}
              <code className="rounded bg-black/10 px-1">pnpm --filter @repo/database db:backfill-billing-legacy</code>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            El resto del portal Super Admin sigue funcionando; solo fallan las pantallas que leen datos de billing.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
