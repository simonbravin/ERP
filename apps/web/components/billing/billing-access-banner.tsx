import { Badge } from '@/components/ui/badge'
import { getOrganizationBillingAccess } from '@/lib/billing/policy'
import { Link } from '@/i18n/navigation'

export async function BillingAccessBanner({ orgId }: { orgId: string }) {
  const access = await getOrganizationBillingAccess(orgId)
  const hideBannerReasons = new Set([
    'ACTIVE',
    'TRIAL_ACTIVE',
    'MANUAL_ACTIVE',
    'LEGACY_GRANDFATHERED',
    'LEGACY_TRIAL',
    'LEGACY_ACTIVE',
  ])
  if (hideBannerReasons.has(access.reasonCode)) {
    return null
  }

  const isReadOnly = access.accessMode === 'READ_ONLY'
  return (
    <div
      className={`mx-6 mt-4 rounded-lg border p-3 text-sm ${
        isReadOnly
          ? 'border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
          : 'border-blue-500/40 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{access.reasonCode}</Badge>
          <span>
            {isReadOnly
              ? 'Tu organización está en modo solo lectura por estado de facturación.'
              : 'Tu organización tiene alertas de facturación.'}
          </span>
        </div>
        <Link href="/settings/subscription" className="underline">
          Gestionar suscripción
        </Link>
      </div>
    </div>
  )
}
