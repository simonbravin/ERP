import { notFound } from 'next/navigation'
import { adminGetOrganizationBillingSnapshotAction } from '@/app/actions/super-admin-billing'
import { BillingLoadError } from '@/components/super-admin/billing-load-error'
import { BillingSchemaMissingNotice } from '@/components/super-admin/billing-schema-missing'
import { billingCoreTablesExist } from '@/lib/prisma/billing-schema-exists'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/navigation'

export default async function SuperAdminOrganizationBillingDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params

  let tablesOk: boolean
  try {
    tablesOk = await billingCoreTablesExist()
  } catch (err) {
    console.error('[super-admin/org/billing] billingCoreTablesExist failed:', err)
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

  let snapshot: Awaited<ReturnType<typeof adminGetOrganizationBillingSnapshotAction>>
  try {
    snapshot = await adminGetOrganizationBillingSnapshotAction(orgId)
  } catch (err) {
    console.error('[super-admin/org/billing] snapshot load failed:', err)
    return (
      <BillingLoadError
        context="No se pudo cargar el detalle de billing de la organización."
        error={err}
      />
    )
  }
  if (!snapshot) notFound()

  const { org, subscription, events, overrides, documents, statusHistory } = snapshot

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link
            href={`/super-admin/organizations/${orgId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {org.name}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Billing: {org.name}</h1>
          <p className="text-sm text-muted-foreground">Plan Paddle, eventos, documentos e historial.</p>
        </div>
        <Link
          href="/super-admin/billing"
          className="text-sm text-primary underline"
        >
          Vista global billing
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Legacy (Organization)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="outline">{org.subscriptionStatus}</Badge>
            </div>
            <p>
              <span className="text-muted-foreground">Plan:</span> {org.subscriptionPlan ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Blocked:</span> {org.isBlocked ? 'Yes' : 'No'}
            </p>
            {org.blockedReason ? (
              <p>
                <span className="text-muted-foreground">Block reason:</span> {org.blockedReason}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>OrganizationSubscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {subscription ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">{subscription.status}</Badge>
                </div>
                <p>
                  <span className="text-muted-foreground">Plan:</span>{' '}
                  {subscription.billingPlan?.name} ({subscription.billingPlan?.code})
                </p>
                <p>
                  <span className="text-muted-foreground">Paddle subscription:</span>{' '}
                  {subscription.paddleSubscriptionId ?? '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">Paddle customer:</span>{' '}
                  {subscription.billingCustomer.paddleCustomerId}
                </p>
                <p>
                  <span className="text-muted-foreground">Trial end:</span>{' '}
                  {subscription.trialEnd?.toISOString() ?? '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">Current period:</span>{' '}
                  {subscription.currentPeriodStart?.toISOString() ?? '—'} —{' '}
                  {subscription.currentPeriodEnd?.toISOString() ?? '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">Cancel at period end:</span>{' '}
                  {subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Sin fila de suscripción en BD (usar backfill o checkout).</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overrides activos</CardTitle>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {overrides.map((o) => (
                <li key={o.id} className="flex flex-wrap gap-2 border-b border-border/60 pb-2">
                  <Badge variant="outline">{o.mode}</Badge>
                  <span>{o.reason ?? '—'}</span>
                  <span className="text-muted-foreground">hasta {o.endsAt?.toISOString() ?? '∞'}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Eventos de webhook (org)</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[360px] space-y-2 overflow-y-auto text-xs">
            {events.length === 0 ? (
              <p className="text-muted-foreground">Sin eventos</p>
            ) : (
              events.map((ev) => (
                <div key={ev.id} className="border-b border-border/40 pb-2 font-mono">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{ev.status}</Badge>
                    <span>{ev.eventType}</span>
                  </div>
                  <div className="text-muted-foreground">{ev.receivedAt.toISOString()}</div>
                  {ev.errorMessage ? <div className="text-destructive">{ev.errorMessage}</div> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de estado</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[360px] space-y-2 overflow-y-auto text-xs">
            {statusHistory.length === 0 ? (
              <p className="text-muted-foreground">Sin entradas</p>
            ) : (
              statusHistory.map((h) => (
                <div key={h.id} className="border-b border-border/40 pb-2">
                  <div>
                    {h.fromStatus ?? '—'} → {h.toStatus}
                  </div>
                  <div className="text-muted-foreground">
                    {h.createdAt.toISOString()} · {h.source}
                  </div>
                  {h.reason ? <div>{h.reason}</div> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentos de facturación</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2 pr-2">Estado</th>
                  <th className="py-2 pr-2">Total</th>
                  <th className="py-2">Emitido</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-b border-border/60">
                    <td className="py-2 pr-2">{d.documentType}</td>
                    <td className="py-2 pr-2">{d.status}</td>
                    <td className="py-2 pr-2">
                      {d.total != null ? String(d.total) : '—'} {d.currency ?? ''}
                    </td>
                    <td className="py-2">{d.issuedAt?.toISOString() ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
