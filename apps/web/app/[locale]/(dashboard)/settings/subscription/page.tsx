import { getSession } from '@/lib/session'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { PageHeader } from '@/components/layout/page-header'
import { getTranslations } from 'next-intl/server'
import {
  getCurrentBillingStateAction,
  getBillingHistoryAction,
  listAvailableBillingPricesAction,
} from '@/app/actions/billing'
import { SubscriptionPlansCheckout } from '@/components/billing/subscription-plans-checkout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function SubscriptionSettingsPage() {
  const session = await getSession()
  const locale = await getLocale()
  if (!session?.user?.id) redirect({ href: '/login', locale })

  const t = await getTranslations('settings')
  const [billingState, billingHistory, catalogPlans] = await Promise.all([
    getCurrentBillingStateAction(),
    getBillingHistoryAction(10),
    listAvailableBillingPricesAction().catch(() => [] as Awaited<ReturnType<typeof listAvailableBillingPricesAction>>),
  ])

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title={t('subscription')}
        subtitle={t('subscriptionSubtitle', {
          defaultValue: 'Gestiona tu suscripción y facturación',
        })}
      />
      <SubscriptionPlansCheckout plans={catalogPlans} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estado de suscripción</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Estado:</span>
              <Badge variant="outline">{billingState.status ?? 'NO_SUBSCRIPTION'}</Badge>
            </div>
            <p>
              <span className="text-muted-foreground">Plan:</span> {billingState.planName ?? 'Sin plan'}
            </p>
            <p>
              <span className="text-muted-foreground">Intervalo:</span> {billingState.interval ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Renovación:</span>{' '}
              {billingState.nextBillingAt ? new Date(billingState.nextBillingAt).toLocaleDateString() : '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Modo de acceso:</span> {billingState.accessMode}
            </p>
            <p>
              <span className="text-muted-foreground">Motivo:</span> {billingState.reasonCode}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Historial reciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Documentos: {billingHistory.documents.length} | Eventos: {billingHistory.events.length}
            </p>
            <ul className="space-y-2">
              {billingHistory.events.slice(0, 5).map((event) => (
                <li key={event.id} className="flex items-center justify-between">
                  <span>{event.eventType}</span>
                  <Badge variant="outline">{event.status}</Badge>
                </li>
              ))}
              {billingHistory.events.length === 0 && (
                <li className="text-muted-foreground">Sin eventos aún.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
