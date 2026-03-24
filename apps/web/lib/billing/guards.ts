import { BILLING_ALLOWED_IN_READ_ONLY } from '@/lib/billing/constants'
import { getOrganizationBillingAccess } from '@/lib/billing/services/access-policy'
import { BillingWriteForbiddenError } from '@/lib/billing/errors'

export async function assertBillingWriteAllowed(orgId: string, operation: string): Promise<void> {
  if (BILLING_ALLOWED_IN_READ_ONLY.has(operation)) return
  const access = await getOrganizationBillingAccess(orgId)
  if (!access.writeAllowed) {
    throw new BillingWriteForbiddenError(
      'Your organization is currently in read-only mode due to billing status.',
      access.accessMode,
      access.reasonCode
    )
  }
}
