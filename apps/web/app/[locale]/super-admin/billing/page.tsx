import {
  adminCreatePromoFromFormAction,
  adminDeactivatePromoFromFormAction,
  adminListOrganizationsBillingAction,
  adminListPromoCodesAction,
  adminListRecentBillingEventsAction,
} from '@/app/actions/super-admin-billing'
import { BillingLoadError } from '@/components/super-admin/billing-load-error'
import { BillingSchemaMissingNotice } from '@/components/super-admin/billing-schema-missing'
import { billingCoreTablesExist } from '@/lib/prisma/billing-schema-exists'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Link } from '@/i18n/navigation'

const STATUS_OPTIONS = [
  '',
  'NO_SUBSCRIPTION',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'UNPAID',
  'CANCELED',
  'EXPIRED',
  'PAUSED',
  'MANUAL_ACTIVE',
  'MANUAL_LOCKED',
] as const

export default async function SuperAdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; plan?: string }>
}) {
  const sp = await searchParams
  const q = sp.q?.trim() || undefined
  const status = sp.status?.trim() || undefined
  const planCode = sp.plan?.trim() || undefined

  let tablesOk: boolean
  try {
    tablesOk = await billingCoreTablesExist()
  } catch (err) {
    console.error('[super-admin/billing] billingCoreTablesExist failed:', err)
    return (
      <BillingLoadError
        context="No se pudo comprobar en la base de datos si existen las tablas de billing."
        error={err}
      />
    )
  }
  if (!tablesOk) {
    return <BillingSchemaMissingNotice />
  }

  let orgs: Awaited<ReturnType<typeof adminListOrganizationsBillingAction>>
  let promos: Awaited<ReturnType<typeof adminListPromoCodesAction>>
  let events: Awaited<ReturnType<typeof adminListRecentBillingEventsAction>>
  try {
    ;[orgs, promos, events] = await Promise.all([
      adminListOrganizationsBillingAction({ query: q, status, planCode }),
      adminListPromoCodesAction(),
      adminListRecentBillingEventsAction(60),
    ])
  } catch (err) {
    console.error('[super-admin/billing] data load failed:', err)
    return (
      <BillingLoadError
        context="Las tablas de billing están creadas, pero falló cargar listados (orgs / promos / eventos)."
        error={err}
      />
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Vista global de suscripciones, webhooks recientes y códigos promocionales.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtrar organizaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Buscar</label>
              <Input name="q" placeholder="Nombre o slug" defaultValue={q ?? ''} className="w-[220px]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Estado suscripción</label>
              <select
                name="status"
                defaultValue={status ?? ''}
                className="flex h-9 w-[200px] rounded-md border border-input bg-background px-2 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s || 'all'} value={s}>
                    {s === '' ? 'Todos' : s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Código de plan</label>
              <Input name="plan" placeholder="ej. STANDARD" defaultValue={planCode ?? ''} className="w-[160px]" />
            </div>
            <Button type="submit" variant="secondary">
              Aplicar
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/super-admin/billing">Limpiar</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organizations billing state ({orgs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {orgs.map((org) => {
              const subscription = org.organizationSubscriptions[0]
              return (
                <li key={org.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="space-y-1">
                    <p className="font-medium">{org.name}</p>
                    <p className="text-xs text-muted-foreground">{org.slug}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{subscription?.status ?? 'NO_SUBSCRIPTION'}</Badge>
                    <Badge variant="outline">{subscription?.billingPlan?.code ?? '—'}</Badge>
                    <Link
                      href={`/super-admin/organizations/${org.id}/billing`}
                      className="text-sm text-primary underline"
                    >
                      Ver detalle
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook events (recientes)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-2">Recibido</th>
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2">Estado</th>
                <th className="py-2 pr-2">Organización</th>
                <th className="py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-border/60">
                  <td className="py-2 pr-2 whitespace-nowrap">{ev.receivedAt.toISOString()}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{ev.eventType}</td>
                  <td className="py-2 pr-2">
                    <Badge variant="outline">{ev.status}</Badge>
                  </td>
                  <td className="py-2 pr-2">
                    {ev.organization ? (
                      <span>
                        {ev.organization.name}{' '}
                        {ev.orgId ? (
                          <Link
                            href={`/super-admin/organizations/${ev.orgId}/billing`}
                            className="text-primary underline"
                          >
                            billing
                          </Link>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{ev.orgId ?? '—'}</span>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate text-xs text-destructive">{ev.errorMessage ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promo codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form action={adminCreatePromoFromFormAction} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Código</label>
              <Input name="code" required placeholder="WELCOME10" className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <select
                name="discountType"
                className="flex h-9 w-[140px] rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="PERCENTAGE">Porcentaje</option>
                <option value="FIXED">Fijo</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Monto</label>
              <Input name="amount" placeholder="10" className="w-[100px]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max usos</label>
              <Input name="maxUses" type="number" placeholder="opcional" className="w-[100px]" />
            </div>
            <Button type="submit">Crear</Button>
          </form>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-2">Código</th>
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2">Monto</th>
                <th className="py-2 pr-2">Usos</th>
                <th className="py-2 pr-2">Activo</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-2 pr-2 font-medium">{p.code}</td>
                  <td className="py-2 pr-2">{p.discountType}</td>
                  <td className="py-2 pr-2">{String(p.amount)}</td>
                  <td className="py-2 pr-2">
                    {p.usedCount}
                    {p.maxUses != null ? ` / ${p.maxUses}` : ''}
                  </td>
                  <td className="py-2 pr-2">{p.active ? 'Sí' : 'No'}</td>
                  <td className="py-2 text-right">
                    {p.active ? (
                      <form action={adminDeactivatePromoFromFormAction}>
                        <input type="hidden" name="promoId" value={p.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Desactivar
                        </Button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
